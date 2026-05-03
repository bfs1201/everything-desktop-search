import { execFile as execFileCallback, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SearchResponse, SearchResult } from "../shared/searchTypes.js";

const execFilePromise = promisify(execFileCallback);
const ES_PATH = "D:\\Everything\\es.exe";
const EVERYTHING_PATH = "D:\\Everything\\Everything.exe";

type ExecFile = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
type StartEverything = () => Promise<void>;

interface SearchDeps {
  execFile?: ExecFile;
  startEverything?: StartEverything;
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
      directory: path.win32.dirname(filePath)
    }));
}

async function defaultExecFile(file: string, args: string[]) {
  const { stdout, stderr } = await execFilePromise(file, args, {
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

export async function searchEverything(query: string, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  const startEverything = deps.startEverything ?? defaultStartEverything;
  const args = ["-n", "50", trimmed];

  try {
    const { stdout } = await execFile(ES_PATH, args);
    return { results: parseEverythingOutput(stdout) };
  } catch (firstError) {
    if (isEverythingIpcError(firstError)) {
      try {
        await startEverything();
        const { stdout } = await execFile(ES_PATH, args);
        return { results: parseEverythingOutput(stdout) };
      } catch (retryError) {
        return { results: [], error: `Everything 搜索失败：${messageFromError(retryError)}` };
      }
    }

    return { results: [], error: `Everything 搜索失败：${messageFromError(firstError)}` };
  }
}
