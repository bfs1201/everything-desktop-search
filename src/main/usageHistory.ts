import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UsageHistory } from "./searchRanking.js";

function isUsageHistory(value: unknown): value is UsageHistory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => {
    return (
      item &&
      typeof item === "object" &&
      typeof (item as { openCount?: unknown }).openCount === "number" &&
      typeof (item as { lastOpenedAt?: unknown }).lastOpenedAt === "number"
    );
  });
}

export async function loadUsageHistory(historyPath: string): Promise<UsageHistory> {
  try {
    const content = await readFile(historyPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    return isUsageHistory(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveUsageHistory(historyPath: string, history: UsageHistory) {
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
}

export async function recordOpenedPath(filePath: string, historyPath: string, now = Date.now()) {
  const history = await loadUsageHistory(historyPath);
  const current = history[filePath] ?? { openCount: 0, lastOpenedAt: 0 };

  history[filePath] = {
    openCount: current.openCount + 1,
    lastOpenedAt: now
  };

  await saveUsageHistory(historyPath, history);
}
