import path from "node:path";
import { pinyin } from "pinyin-pro";
import type { SearchResult } from "../shared/searchTypes.js";
import { expandSearchTerm, type ParsedSearchQuery } from "./searchQuery.js";

export interface UsageStats {
  openCount: number;
  lastOpenedAt: number;
}

export type UsageHistory = Record<string, UsageStats>;

const DAY_MS = 24 * 60 * 60 * 1000;
const FREQUENT_RESULT_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 20;

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

const COMMON_APP_EXE_PATH_BONUSES = [
  { pattern: "\\program files\\", bonus: 520 },
  { pattern: "\\program files (x86)\\", bonus: 520 },
  { pattern: "\\appdata\\local\\programs\\", bonus: 520 }
];

function normalize(value: string) {
  return value.toLowerCase();
}

function nameWithoutExtension(fileName: string) {
  const extension = path.win32.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function containsChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function pinyinTokens(value: string) {
  const tokens: Array<{ full: string; initial: string }> = [];
  let latinChunk = "";

  const flushLatin = () => {
    if (latinChunk) {
      const normalizedChunk = latinChunk.toLowerCase();
      tokens.push({ full: normalizedChunk, initial: normalizedChunk });
      latinChunk = "";
    }
  };

  for (const character of value) {
    if (/[\u4e00-\u9fff]/.test(character)) {
      flushLatin();
      const [full = ""] = pinyin(character, { toneType: "none", type: "array" }) as string[];
      tokens.push({ full: full.toLowerCase(), initial: (full[0] ?? "").toLowerCase() });
    } else if (/[a-zA-Z0-9]/.test(character)) {
      latinChunk += character;
    } else {
      flushLatin();
    }
  }

  flushLatin();
  return tokens;
}

function pinyinForms(value: string) {
  if (!containsChinese(value)) {
    return [];
  }

  const tokens = pinyinTokens(value);
  const full = tokens.map((item) => item.full).join("");
  const initials = tokens.map((item) => item.initial).join("");
  return [full, initials].filter(Boolean);
}

function scorePinyinName(result: SearchResult, keyword: string) {
  const normalizedKeyword = normalize(keyword);
  const forms = pinyinForms(nameWithoutExtension(result.name));

  if (forms.includes(normalizedKeyword)) {
    return 1000;
  }

  if (forms.some((form) => form.startsWith(normalizedKeyword))) {
    return 760;
  }

  return forms.some((form) => form.includes(normalizedKeyword)) ? 520 : 0;
}

function scoreNameKeyword(result: SearchResult, keyword: string) {
  const normalizedName = normalize(result.name);
  const normalizedStem = normalize(nameWithoutExtension(result.name));

  return Math.max(
    ...expandSearchTerm(keyword).map((term) => {
      const normalizedKeyword = normalize(term);

      if (normalizedName === normalizedKeyword || normalizedStem === normalizedKeyword) {
        return 1000;
      }

      if (normalizedName.startsWith(normalizedKeyword) || normalizedStem.startsWith(normalizedKeyword)) {
        return 800;
      }

      if (normalizedName.includes(normalizedKeyword) || normalizedStem.includes(normalizedKeyword)) {
        return 600;
      }

      return 0;
    })
  );
}

function scoreKeyword(result: SearchResult, keyword: string) {
  const normalizedPath = normalize(result.path);
  const textScore = Math.max(
    scoreNameKeyword(result, keyword),
    ...expandSearchTerm(keyword).map((term) => (normalizedPath.includes(normalize(term)) ? 300 : 0))
  );

  return Math.max(textScore, scorePinyinName(result, keyword));
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

function scoreRunMetadata(result: SearchResult, now: number) {
  const runCountScore = Math.min(result.runCount ?? 0, 20) * 12;
  if (!result.dateRun) {
    return runCountScore;
  }

  const ageInDays = Math.max(0, (now - result.dateRun) / DAY_MS);
  return runCountScore + Math.max(0, 260 - ageInDays * 26);
}

function scoreNoise(result: SearchResult) {
  const normalizedPath = normalize(`\\${result.path}`);
  return NOISY_PATH_PENALTIES.reduce((penalty, item) => {
    return normalizedPath.includes(item.pattern) ? penalty - item.penalty : penalty;
  }, 0);
}

function isExecutable(result: SearchResult) {
  return path.win32.extname(result.path).toLowerCase() === ".exe";
}

function scoreCommonAppExecutable(result: SearchResult) {
  if (!isExecutable(result)) {
    return 0;
  }

  const normalizedPath = normalize(result.path);
  return COMMON_APP_EXE_PATH_BONUSES.reduce((score, item) => {
    return normalizedPath.includes(item.pattern) ? score + item.bonus : score;
  }, 0);
}

function scoreExecutableEntryName(result: SearchResult) {
  if (!isExecutable(result)) {
    return 0;
  }

  const stem = normalize(nameWithoutExtension(result.name));
  const parentName = normalize(path.win32.basename(path.win32.dirname(result.path)));
  return stem && parentName === stem ? 420 : 0;
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

  const executableBonus = isExecutable(result)
    ? 560 + scoreCommonAppExecutable(result) + scoreExecutableEntryName(result)
    : 0;

  return APP_PATH_BONUSES.reduce((score, item) => {
    return normalizedPath.includes(item.pattern) ? score + item.bonus : score;
  }, 120 + executableBonus);
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
    scoreRunMetadata(result, now) +
    scoreNoise(result)
  );
}

function sortableSize(result: SearchResult) {
  return typeof result.size === "number" ? result.size : 0;
}

function isFileSearchIntent(query: ParsedSearchQuery) {
  return query.mode === "files" || Boolean(query.filter) || query.pathTerms.length > 0;
}

export function searchResultMatchesQuery(result: SearchResult, query: ParsedSearchQuery) {
  const keywordMatches = query.keywords.every((keyword) => scoreKeyword(result, keyword) > 0);
  const pathMatches = query.pathTerms.every((pathTerm) => normalize(result.path).includes(normalize(pathTerm)));
  return keywordMatches && pathMatches;
}

export function searchResultMatchesChineseAppCandidate(result: SearchResult, query: ParsedSearchQuery) {
  if (query.keywords.length !== 1) {
    return false;
  }

  const keyword = query.keywords[0];
  if (!keyword) {
    return false;
  }

  return scoreNameKeyword(result, keyword) > 0 || scorePinyinName(result, keyword) > 0;
}

export function rankSearchResults(
  results: SearchResult[],
  query: ParsedSearchQuery,
  usageHistory: UsageHistory = {},
  now = Date.now()
) {
  const fileSearchIntent = isFileSearchIntent(query);
  const compareResults = (left: SearchResult, right: SearchResult) => {
    if (query.mode === "recent") {
      const dateRunDiff = (right.dateRun ?? 0) - (left.dateRun ?? 0);
      if (dateRunDiff !== 0) {
        return dateRunDiff;
      }
    }

    if (fileSearchIntent) {
      const sizeDiff = sortableSize(right) - sortableSize(left);
      if (sizeDiff !== 0) {
        return sizeDiff;
      }
    }

    const leftScore = scoreSearchResult(left, query, usageHistory, now);
    const rightScore = scoreSearchResult(right, query, usageHistory, now);
    const scoreDiff = rightScore - leftScore;

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const sizeDiff = sortableSize(right) - sortableSize(left);
    if (sizeDiff !== 0) {
      return sizeDiff;
    }

    return left.path.localeCompare(right.path, "zh-Hans");
  };

  const ranked = results
    .map((result): SearchResult => ({
      ...result,
      kind: inferredKind(result)
    }))
    .sort(compareResults);

  const frequentResults = ranked
    .filter((result) => usageHistory[result.path] && searchResultMatchesQuery(result, query))
    .slice(0, FREQUENT_RESULT_LIMIT)
    .map((result): SearchResult => ({ ...result, section: "frequent" }));
  const frequentPaths = new Set(frequentResults.map((result) => result.path.toLowerCase()));
  const ordinaryResults = ranked
    .filter((result) => !frequentPaths.has(result.path.toLowerCase()))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((result): SearchResult => ({ ...result, section: "results" }));

  return [...frequentResults, ...ordinaryResults];
}
