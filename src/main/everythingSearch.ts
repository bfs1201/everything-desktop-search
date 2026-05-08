import { execFile as execFileCallback, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SearchResponse, SearchResult } from "../shared/searchTypes.js";
import {
  buildChineseAppCandidateArgs,
  buildEverythingMoreArgs,
  buildEverythingSearches,
  isApplicationPinyinCandidateQuery,
  parseSearchQuery
} from "./searchQuery.js";
import { rankSearchResults, searchResultMatchesChineseAppCandidate, type UsageHistory } from "./searchRanking.js";

const execFilePromise = promisify(execFileCallback);

type ProcessOutput = string | Buffer;
type ExecFile = (file: string, args: string[]) => Promise<{ stdout: ProcessOutput; stderr: ProcessOutput }>;
type StartEverything = (everythingPath: string) => Promise<void>;
type LoadUsageHistory = () => Promise<UsageHistory>;
type GetFileIcon = (filePath: string) => Promise<string | undefined>;
type SearchResultKind = NonNullable<SearchResult["kind"]>;
type Environment = Record<string, string | undefined>;

const DIRECTORY_ATTRIBUTE = 16;
const DEFAULT_PAGE_LIMIT = 60;
const MODERN_OUTPUT_ARGS = new Set(["-json", "-attributes", "-size", "-dm", "-run-count", "-date-run"]);

interface SearchDeps {
  execFile?: ExecFile;
  startEverything?: StartEverything;
  loadUsageHistory?: LoadUsageHistory;
  getFileIcon?: GetFileIcon;
  env?: Environment;
}

interface EverythingJsonResult {
  filename?: string;
  name?: string;
  path?: string;
  attributes?: number | string;
  size?: number | string;
  "run-count"?: number | string;
  "date-run"?: number | string;
  "date-modified"?: number | string;
}

function parseAttributes(attributes: number | string | undefined) {
  if (typeof attributes === "number") {
    return attributes;
  }

  if (typeof attributes === "string") {
    const parsed = Number.parseInt(attributes, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function parseSize(size: number | string | undefined) {
  if (typeof size === "number") {
    return Number.isFinite(size) ? size : undefined;
  }

  if (typeof size === "string") {
    const parsed = Number.parseInt(size, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function parseDateColumn(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const numericValue = Number.parseInt(value, 10);
    if (!Number.isNaN(numericValue) && String(numericValue) === value.trim()) {
      return numericValue;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function resultMetadata(row: EverythingJsonResult) {
  return {
    runCount: parseSize(row["run-count"]),
    dateRun: parseDateColumn(row["date-run"]),
    dateModified: parseDateColumn(row["date-modified"])
  };
}

function parseEverythingJsonOutput(output: string): SearchResult[] | undefined {
  try {
    const parsed = JSON.parse(output) as { results?: EverythingJsonResult[] } | EverythingJsonResult[];
    const rows = Array.isArray(parsed) ? parsed : parsed.results;
    if (!Array.isArray(rows)) {
      return undefined;
    }

    return rows
      .map((row): SearchResult | undefined => {
        if (row.filename) {
          const filePath = row.filename.replace(/[\\\/]+$/, "");
          return {
            id: filePath,
            name: path.win32.basename(filePath),
            path: filePath,
            directory: path.win32.dirname(filePath),
            size: parseSize(row.size),
            ...resultMetadata(row),
            kind: parseAttributes(row.attributes) & DIRECTORY_ATTRIBUTE ? "folder" : classifySearchResult(filePath, false)
          };
        }

        if (!row.name && !row.path) {
          return undefined;
        }

        const directory = row.path ?? "";
        const filePath = row.name ? path.win32.join(directory, row.name) : directory;
        const attributes = parseAttributes(row.attributes);
        const kind: SearchResultKind = attributes & DIRECTORY_ATTRIBUTE ? "folder" : classifySearchResult(filePath, false);

        return {
          id: filePath,
          name: row.name ?? path.win32.basename(filePath),
          path: filePath,
          directory: path.win32.dirname(filePath),
          size: parseSize(row.size),
          ...resultMetadata(row),
          kind
        } satisfies SearchResult;
      })
      .filter((result): result is SearchResult => Boolean(result));
  } catch {
    return undefined;
  }
}

export function parseEverythingOutput(output: string): SearchResult[] {
  const jsonResults = parseEverythingJsonOutput(output);
  if (jsonResults) {
    return jsonResults;
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => ({
      id: filePath,
      name: path.win32.basename(filePath),
      path: filePath,
      directory: path.win32.dirname(filePath),
      kind: classifySearchResult(filePath)
    }));
}

export function classifySearchResult(filePath: string, inferFolder = true): SearchResultKind {
  const normalizedPath = filePath.toLowerCase();
  const extension = path.win32.extname(filePath).toLowerCase();
  const isShortcut = extension === ".lnk";
  const isStartMenu = normalizedPath.includes("\\start menu\\programs\\");
  const isDesktop = normalizedPath.includes("\\desktop\\");

  if ((isShortcut && (isStartMenu || isDesktop)) || extension === ".exe") {
    return "app";
  }

  if (extension) {
    return "file";
  }

  return inferFolder ? "folder" : "file";
}

export function decodeEverythingOutput(output: ProcessOutput): string {
  if (typeof output === "string") {
    return output;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(output);
  } catch {
    return new TextDecoder("gb18030").decode(output);
  }
}

async function defaultExecFile(file: string, args: string[]) {
  const { stdout, stderr } = await execFilePromise(file, args, {
    encoding: "buffer",
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  return { stdout, stderr };
}

export function resolveEverythingPaths(env: Environment = process.env) {
  const everythingDirectory = env.EVERYTHING_PATH?.trim();
  if (!everythingDirectory) {
    throw new Error("请设置 EVERYTHING_PATH 环境变量，指向 Everything.exe 和 es.exe 所在目录。");
  }

  if (path.win32.basename(everythingDirectory).toLowerCase() === "everything.exe") {
    throw new Error("EVERYTHING_PATH 必须是 Everything.exe 和 es.exe 所在目录，而不是 Everything.exe 文件路径。");
  }

  return {
    everythingPath: path.win32.join(everythingDirectory, "Everything.exe"),
    esPath: path.win32.join(everythingDirectory, "es.exe")
  };
}

async function defaultStartEverything(everythingPath: string) {
  const child = spawn(everythingPath, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  await new Promise((resolve) => setTimeout(resolve, 800));
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEverythingIpcError(error: unknown): boolean {
  return messageFromError(error).includes("Everything IPC not found");
}

function isUnknownSwitchError(error: unknown): boolean {
  return messageFromError(error).includes("Unknown switch");
}

function legacyOutputArgs(args: string[]) {
  return args.filter((arg) => !MODERN_OUTPUT_ARGS.has(arg));
}

function shouldRetryWithLegacyOutputArgs(error: unknown, args: string[]) {
  return isUnknownSwitchError(error) && args.some((arg) => MODERN_OUTPUT_ARGS.has(arg));
}

async function execEverything(execFile: ExecFile, esPath: string, args: string[]) {
  try {
    return await execFile(esPath, args);
  } catch (error) {
    if (shouldRetryWithLegacyOutputArgs(error, args)) {
      return execFile(esPath, legacyOutputArgs(args));
    }

    throw error;
  }
}

async function withIcons(results: SearchResult[], getFileIcon?: GetFileIcon): Promise<SearchResult[]> {
  if (!getFileIcon) {
    return results;
  }

  return Promise.all(
    results.map(async (result) => {
      if (result.kind === "folder") {
        return result;
      }

      try {
        return {
          ...result,
          iconDataUrl: await getFileIcon(result.path)
        };
      } catch {
        return result;
      }
    })
  );
}

function mergeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.path.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function responsePaging(
  queryMode: SearchResponse["queryMode"],
  resultCount: number,
  offset = 0
): Pick<SearchResponse, "canLoadMore" | "nextOffset" | "queryMode"> {
  if (queryMode !== "default") {
    return { queryMode };
  }

  const canLoadMore = resultCount >= DEFAULT_PAGE_LIMIT;
  return {
    queryMode,
    canLoadMore,
    nextOffset: canLoadMore ? offset + DEFAULT_PAGE_LIMIT : undefined
  };
}

function lastOutputResultCount(outputs: ProcessOutput[]) {
  const lastOutput = outputs.at(-1);
  return lastOutput ? parseEverythingOutput(decodeEverythingOutput(lastOutput)).length : 0;
}

export async function searchEverything(query: string, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  const startEverything = deps.startEverything ?? defaultStartEverything;
  let everythingPaths: ReturnType<typeof resolveEverythingPaths>;
  try {
    everythingPaths = resolveEverythingPaths(deps.env);
  } catch (error) {
    return { results: [], error: `Everything 搜索失败：${messageFromError(error)}` };
  }
  const parsedQuery = parseSearchQuery(trimmed);
  const searchArgs = buildEverythingSearches(parsedQuery);
  const appCandidateArgs = isApplicationPinyinCandidateQuery(parsedQuery) ? buildChineseAppCandidateArgs(parsedQuery) : undefined;
  const getRankedResults = async (outputs: ProcessOutput[], appCandidateOutput?: ProcessOutput) => {
    const usageHistory = deps.loadUsageHistory ? await deps.loadUsageHistory() : {};
    const regularResults = outputs.flatMap((stdout) => parseEverythingOutput(decodeEverythingOutput(stdout)));
    const appCandidateResults = appCandidateOutput
      ? parseEverythingOutput(decodeEverythingOutput(appCandidateOutput)).filter((result) =>
          searchResultMatchesChineseAppCandidate(result, parsedQuery)
        )
      : [];

    return withIcons(
      rankSearchResults(
        mergeResults([...regularResults, ...appCandidateResults]),
        parsedQuery,
        usageHistory
      ),
      deps.getFileIcon
    );
  };
  const runSearches = async () => {
    const outputs: ProcessOutput[] = [];

    for (const args of searchArgs) {
      const { stdout } = await execEverything(execFile, everythingPaths.esPath, args);
      outputs.push(stdout);
    }

    let appCandidateOutput: ProcessOutput | undefined;
    if (appCandidateArgs) {
      try {
        const appCandidateResponse = await execEverything(execFile, everythingPaths.esPath, appCandidateArgs);
        appCandidateOutput = appCandidateResponse.stdout;
      } catch {
        // 应用拼音候选是增强召回；失败时保留 Everything 的常规结果。
      }
    }

    return { outputs, appCandidateOutput };
  };

  try {
    const { outputs, appCandidateOutput } = await runSearches();
    const results = await getRankedResults(outputs, appCandidateOutput);
    return { results, ...responsePaging(parsedQuery.mode, lastOutputResultCount(outputs)) };
  } catch (firstError) {
    if (isEverythingIpcError(firstError)) {
      try {
        await startEverything(everythingPaths.everythingPath);
        const { outputs, appCandidateOutput } = await runSearches();
        const results = await getRankedResults(outputs, appCandidateOutput);
        return { results, ...responsePaging(parsedQuery.mode, lastOutputResultCount(outputs)) };
      } catch (retryError) {
        return { results: [], error: `Everything 搜索失败：${messageFromError(retryError)}` };
      }
    }

    return { results: [], error: `Everything 搜索失败：${messageFromError(firstError)}` };
  }
}

export async function loadMoreEverything(query: string, offset: number, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const parsedQuery = parseSearchQuery(trimmed);
  const args = buildEverythingMoreArgs(parsedQuery, offset);
  if (!args) {
    return { results: [], queryMode: parsedQuery.mode, canLoadMore: false };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  let everythingPaths: ReturnType<typeof resolveEverythingPaths>;
  try {
    everythingPaths = resolveEverythingPaths(deps.env);
  } catch (error) {
    return { results: [], error: `Everything 搜索失败：${messageFromError(error)}` };
  }
  const { stdout } = await execEverything(execFile, everythingPaths.esPath, args);
  const usageHistory = deps.loadUsageHistory ? await deps.loadUsageHistory() : {};
  const rawResults = parseEverythingOutput(decodeEverythingOutput(stdout));
  const results = await withIcons(
    rankSearchResults(rawResults, parsedQuery, usageHistory),
    deps.getFileIcon
  );
  return { results, ...responsePaging(parsedQuery.mode, rawResults.length, offset) };
}
