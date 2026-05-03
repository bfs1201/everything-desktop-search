import { execFile as execFileCallback, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SearchResponse, SearchResult } from "../shared/searchTypes.js";
import {
  buildChineseCandidateArgs,
  buildEverythingArgs,
  isPinyinCandidateQuery,
  parseSearchQuery
} from "./searchQuery.js";
import { rankSearchResults, type UsageHistory } from "./searchRanking.js";

const execFilePromise = promisify(execFileCallback);
const ES_PATH = "D:\\Everything\\es.exe";
const EVERYTHING_PATH = "D:\\Everything\\Everything.exe";

type ProcessOutput = string | Buffer;
type ExecFile = (file: string, args: string[]) => Promise<{ stdout: ProcessOutput; stderr: ProcessOutput }>;
type StartEverything = () => Promise<void>;
type LoadUsageHistory = () => Promise<UsageHistory>;
type GetFileIcon = (filePath: string) => Promise<string | undefined>;
type SearchResultKind = NonNullable<SearchResult["kind"]>;

const DIRECTORY_ATTRIBUTE = 16;

interface SearchDeps {
  execFile?: ExecFile;
  startEverything?: StartEverything;
  loadUsageHistory?: LoadUsageHistory;
  getFileIcon?: GetFileIcon;
}

interface EverythingJsonResult {
  filename?: string;
  name?: string;
  path?: string;
  attributes?: number | string;
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

  return new TextDecoder("gb18030").decode(output);
}

async function defaultExecFile(file: string, args: string[]) {
  const { stdout, stderr } = await execFilePromise(file, args, {
    encoding: "buffer",
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  return { stdout, stderr };
}

async function defaultStartEverything() {
  const child = spawn(EVERYTHING_PATH, [], {
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

export async function searchEverything(query: string, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  const startEverything = deps.startEverything ?? defaultStartEverything;
  const parsedQuery = parseSearchQuery(trimmed);
  const args = buildEverythingArgs(parsedQuery, 200);
  const candidateArgs = isPinyinCandidateQuery(parsedQuery) ? buildChineseCandidateArgs(parsedQuery, 300) : undefined;
  const getRankedResults = async (outputs: ProcessOutput[]) => {
    const usageHistory = deps.loadUsageHistory ? await deps.loadUsageHistory() : {};
    return withIcons(
      rankSearchResults(
        mergeResults(outputs.flatMap((stdout) => parseEverythingOutput(decodeEverythingOutput(stdout)))),
        parsedQuery,
        usageHistory
      ),
      deps.getFileIcon
    );
  };
  const runSearches = async () => {
    const { stdout } = await execFile(ES_PATH, args);
    const outputs = [stdout];

    if (candidateArgs) {
      try {
        const candidateResponse = await execFile(ES_PATH, candidateArgs);
        outputs.push(candidateResponse.stdout);
      } catch {
        // 拼音候选是增强召回；失败时保留 Everything 的常规结果。
      }
    }

    return outputs;
  };

  try {
    return { results: await getRankedResults(await runSearches()) };
  } catch (firstError) {
    if (isEverythingIpcError(firstError)) {
      try {
        await startEverything();
        return { results: await getRankedResults(await runSearches()) };
      } catch (retryError) {
        return { results: [], error: `Everything 搜索失败：${messageFromError(retryError)}` };
      }
    }

    return { results: [], error: `Everything 搜索失败：${messageFromError(firstError)}` };
  }
}
