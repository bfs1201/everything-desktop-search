import { execFile as execFileCallback, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SearchResponse, SearchResult } from "../shared/searchTypes.js";
import { buildEverythingArgs, parseSearchQuery } from "./searchQuery.js";
import { rankSearchResults, type UsageHistory } from "./searchRanking.js";

const execFilePromise = promisify(execFileCallback);
const ES_PATH = "D:\\Everything\\es.exe";
const EVERYTHING_PATH = "D:\\Everything\\Everything.exe";

type ProcessOutput = string | Buffer;
type ExecFile = (file: string, args: string[]) => Promise<{ stdout: ProcessOutput; stderr: ProcessOutput }>;
type StartEverything = () => Promise<void>;
type LoadUsageHistory = () => Promise<UsageHistory>;
type GetFileIcon = (filePath: string) => Promise<string | undefined>;

interface SearchDeps {
  execFile?: ExecFile;
  startEverything?: StartEverything;
  loadUsageHistory?: LoadUsageHistory;
  getFileIcon?: GetFileIcon;
}

export function parseEverythingOutput(output: string): SearchResult[] {
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

export function classifySearchResult(filePath: string): SearchResult["kind"] {
  const normalizedPath = filePath.toLowerCase();
  const extension = path.win32.extname(filePath).toLowerCase();
  const isShortcut = extension === ".lnk";
  const isStartMenu = normalizedPath.includes("\\start menu\\programs\\");
  const isDesktop = normalizedPath.includes("\\desktop\\");

  if ((isShortcut && (isStartMenu || isDesktop)) || extension === ".exe") {
    return "app";
  }

  return extension ? "file" : "folder";
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

export async function searchEverything(query: string, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  const startEverything = deps.startEverything ?? defaultStartEverything;
  const parsedQuery = parseSearchQuery(trimmed);
  const args = buildEverythingArgs(parsedQuery, 200);
  const getRankedResults = async (stdout: ProcessOutput) => {
    const usageHistory = deps.loadUsageHistory ? await deps.loadUsageHistory() : {};
    return withIcons(
      rankSearchResults(parseEverythingOutput(decodeEverythingOutput(stdout)), parsedQuery, usageHistory),
      deps.getFileIcon
    );
  };

  try {
    const { stdout } = await execFile(ES_PATH, args);
    return { results: await getRankedResults(stdout) };
  } catch (firstError) {
    if (isEverythingIpcError(firstError)) {
      try {
        await startEverything();
        const { stdout } = await execFile(ES_PATH, args);
        return { results: await getRankedResults(stdout) };
      } catch (retryError) {
        return { results: [], error: `Everything 搜索失败：${messageFromError(retryError)}` };
      }
    }

    return { results: [], error: `Everything 搜索失败：${messageFromError(firstError)}` };
  }
}
