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

function pinyinForms(value: string) {
  if (!containsChinese(value)) {
    return [];
  }

  const syllables = pinyin(value, { toneType: "none", type: "array" }) as string[];
  const full = syllables.join("").toLowerCase();
  const initials = syllables.map((item) => item[0] ?? "").join("").toLowerCase();
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

function scoreKeyword(result: SearchResult, keyword: string) {
  const normalizedName = normalize(result.name);
  const normalizedStem = normalize(nameWithoutExtension(result.name));
  const normalizedPath = normalize(result.path);

  const textScore = Math.max(
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

      if (normalizedPath.includes(normalizedKeyword)) {
        return 300;
      }

      return 0;
    })
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

function defaultSearchSection(result: SearchResult, usageHistory: UsageHistory): SearchResult["section"] {
  if (usageHistory[result.path]) {
    return "history";
  }

  if (inferredKind(result) === "app") {
    return "apps";
  }

  return "files";
}

function sectionRank(section: SearchResult["section"]) {
  if (section === "history") {
    return 0;
  }

  if (section === "apps") {
    return 1;
  }

  return 2;
}

export function rankSearchResults(
  results: SearchResult[],
  query: ParsedSearchQuery,
  usageHistory: UsageHistory = {},
  now = Date.now()
) {
  const fileSearchIntent = isFileSearchIntent(query);

  return results
    .map((result) => ({
      ...result,
      kind: inferredKind(result),
      section: fileSearchIntent ? undefined : defaultSearchSection(result, usageHistory)
    }))
    .sort((left, right) => {
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
      } else {
        const rankDiff = sectionRank(left.section) - sectionRank(right.section);
        if (rankDiff !== 0) {
          return rankDiff;
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
    });
}
