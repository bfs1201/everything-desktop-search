import path from "node:path";
import type { SearchResult } from "../shared/searchTypes.js";
import type { ParsedSearchQuery } from "./searchQuery.js";

export interface UsageStats {
  openCount: number;
  lastOpenedAt: number;
}

export type UsageHistory = Record<string, UsageStats>;

const DAY_MS = 24 * 60 * 60 * 1000;

const NOISY_PATH_PENALTIES = [
  { pattern: "\\node_modules\\", penalty: 500 },
  { pattern: "\\$recycle.bin\\", penalty: 250 },
  { pattern: "\\appdata\\local\\temp\\", penalty: 200 },
  { pattern: "\\temp\\", penalty: 160 }
];

const APP_PATH_BONUSES = [
  { pattern: "\\start menu\\programs\\", bonus: 500 },
  { pattern: "\\desktop\\", bonus: 360 }
];

function normalize(value: string) {
  return value.toLowerCase();
}

function nameWithoutExtension(fileName: string) {
  const extension = path.win32.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function scoreKeyword(result: SearchResult, keyword: string) {
  const normalizedKeyword = normalize(keyword);
  const normalizedName = normalize(result.name);
  const normalizedStem = normalize(nameWithoutExtension(result.name));
  const normalizedPath = normalize(result.path);

  if (normalizedName === normalizedKeyword || normalizedStem === normalizedKeyword) {
    return 1000;
  }

  if (normalizedName.startsWith(normalizedKeyword) || normalizedStem.startsWith(normalizedKeyword)) {
    return 800;
  }

  if (normalizedName.includes(normalizedKeyword) || normalizedStem.includes(normalizedKeyword)) {
    return 600;
  }

  if (normalizedPath.includes(normalizedKeyword)) {
    return 300;
  }

  return 0;
}

function scorePathTerms(result: SearchResult, pathTerms: string[]) {
  const normalizedPath = normalize(result.path);
  return pathTerms.reduce((score, pathTerm) => {
    return normalizedPath.includes(normalize(pathTerm)) ? score + 150 : score;
  }, 0);
}

function scoreUsage(stats: UsageStats | undefined, now: number) {
  if (!stats) {
    return 0;
  }

  const openCountScore = Math.min(stats.openCount, 10) * 20;
  const ageInDays = Math.max(0, (now - stats.lastOpenedAt) / DAY_MS);
  const recentScore = Math.max(0, 200 - ageInDays * 20);

  return openCountScore + recentScore;
}

function scoreNoise(result: SearchResult) {
  const normalizedPath = normalize(`\\${result.path}`);
  return NOISY_PATH_PENALTIES.reduce((penalty, item) => {
    return normalizedPath.includes(item.pattern) ? penalty - item.penalty : penalty;
  }, 0);
}

function inferredKind(result: SearchResult): SearchResult["kind"] {
  if (result.kind) {
    return result.kind;
  }

  const extension = path.win32.extname(result.path).toLowerCase();
  const normalizedPath = normalize(result.path);
  const isShortcut = extension === ".lnk";
  const isStartMenu = normalizedPath.includes("\\start menu\\programs\\");
  const isDesktop = normalizedPath.includes("\\desktop\\");

  if ((isShortcut && (isStartMenu || isDesktop)) || extension === ".exe") {
    return "app";
  }

  return extension ? "file" : "folder";
}

function scoreKind(result: SearchResult) {
  const kind = inferredKind(result);
  const normalizedPath = normalize(result.path);

  if (kind !== "app") {
    return kind === "file" ? 80 : 0;
  }

  return APP_PATH_BONUSES.reduce((score, item) => {
    return normalizedPath.includes(item.pattern) ? score + item.bonus : score;
  }, 120);
}

export function scoreSearchResult(
  result: SearchResult,
  query: ParsedSearchQuery,
  usageHistory: UsageHistory = {},
  now = Date.now()
) {
  const keywordScore = query.keywords.reduce((score, keyword) => score + scoreKeyword(result, keyword), 0);
  return (
    keywordScore +
    scoreKind(result) +
    scorePathTerms(result, query.pathTerms) +
    scoreUsage(usageHistory[result.path], now) +
    scoreNoise(result)
  );
}

export function rankSearchResults(
  results: SearchResult[],
  query: ParsedSearchQuery,
  usageHistory: UsageHistory = {},
  now = Date.now()
) {
  return results
    .map((result) => ({
      ...result,
      kind: inferredKind(result)
    }))
    .sort((left, right) => {
    const leftScore = scoreSearchResult(left, query, usageHistory, now);
    const rightScore = scoreSearchResult(right, query, usageHistory, now);
    const scoreDiff = rightScore - leftScore;

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return left.path.localeCompare(right.path, "zh-Hans");
  });
}
