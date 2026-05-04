export type SearchFilter = "folder" | "file" | "doc" | "pic" | "video" | "audio" | undefined;
export type SearchMode = "default" | "apps" | "recent" | "files";

export interface ParsedSearchQuery {
  raw: string;
  mode: SearchMode;
  filter: SearchFilter;
  keywords: string[];
  includeTerms: string[];
  excludeTerms: string[];
  pathTerms: string[];
  pathScope?: string;
  parentScope?: string;
  rawEverythingTerms: string[];
}

const FILTERS = new Set(["folder", "file", "doc", "pic", "video", "audio"]);

const PINYIN_ALIASES: Record<string, string[]> = {
  weixin: ["微信"],
  wechat: ["微信"]
};

const EXTENSION_FILTERS: Record<Exclude<SearchFilter, "folder" | "file" | undefined>, string> = {
  doc: "ext:doc;docx;pdf;txt;md;xls;xlsx;ppt;pptx",
  pic: "ext:jpg;jpeg;png;gif;webp;bmp;svg",
  video: "ext:mp4;mkv;mov;avi;wmv;flv;webm",
  audio: "ext:mp3;wav;flac;aac;m4a;ogg"
};

const STRUCTURED_OUTPUT_ARGS = ["-json", "-attributes"];
const RANKING_OUTPUT_ARGS = ["-json", "-attributes", "-size", "-dm", "-run-count", "-date-run"];
const DEFAULT_APP_LIMIT = 40;
const DEFAULT_RESULT_LIMIT = 60;

function isPathTerm(term: string) {
  return term.includes("\\") || /^[a-zA-Z]:\\?$/.test(term);
}

function splitPathTerm(term: string) {
  const lastSlashIndex = term.lastIndexOf("\\");

  if (lastSlashIndex === -1 || lastSlashIndex === term.length - 1) {
    return { pathTerm: term };
  }

  return {
    pathTerm: term.slice(0, lastSlashIndex + 1),
    keyword: term.slice(lastSlashIndex + 1)
  };
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const terms = raw.trim().split(/\s+/).filter(Boolean);
  let filter: SearchFilter;
  let mode: SearchMode = "default";
  const includeTerms: string[] = [];
  const excludeTerms: string[] = [];
  const pathTerms: string[] = [];
  let pathScope: string | undefined;
  let parentScope: string | undefined;
  const rawEverythingTerms: string[] = [];

  for (const term of terms) {
    if (term.startsWith("!") && term.length > 1) {
      excludeTerms.push(term.slice(1));
      continue;
    }

    const scopedMatch = term.match(/^([a-zA-Z]+):(.*)$/);
    if (scopedMatch) {
      const key = scopedMatch[1].toLowerCase();
      const value = scopedMatch[2];

      if (key === "app") {
        mode = "apps";
        if (value) {
          includeTerms.push(value);
        }
        continue;
      }

      if (key === "recent") {
        mode = "recent";
        if (value) {
          includeTerms.push(value);
        }
        continue;
      }

      if (key === "path" && value) {
        mode = "files";
        pathScope = value;
        continue;
      }

      if (key === "parent" && value) {
        mode = "files";
        parentScope = value;
        continue;
      }

      if (FILTERS.has(key) && value) {
        mode = "files";
        filter = key as SearchFilter;
        includeTerms.push(value);
        continue;
      }
    }

    const filterMatch = term.match(/^([a-zA-Z]+):$/);
    if (filterMatch && FILTERS.has(filterMatch[1].toLowerCase())) {
      mode = "files";
      filter = filterMatch[1].toLowerCase() as SearchFilter;
      continue;
    }

    if (isPathTerm(term)) {
      mode = "files";
      const { pathTerm, keyword } = splitPathTerm(term);
      pathTerms.push(pathTerm);
      if (keyword) {
        includeTerms.push(keyword);
      }
      continue;
    }

    if (term.startsWith("<") && term.endsWith(">")) {
      rawEverythingTerms.push(term);
    }
    includeTerms.push(term);
  }

  return { raw, mode, filter, keywords: includeTerms, includeTerms, excludeTerms, pathTerms, pathScope, parentScope, rawEverythingTerms };
}

export function expandSearchTerm(term: string): string[] {
  const aliases = PINYIN_ALIASES[term.toLowerCase()] ?? [];
  return [term, ...aliases];
}

function formatEverythingTerm(term: string) {
  const expandedTerms = expandSearchTerm(term);
  return expandedTerms.length > 1 ? `<${expandedTerms.join("|")}>` : term;
}

function appendFilters(args: string[], query: ParsedSearchQuery, includeSize = false) {
  args.push(...STRUCTURED_OUTPUT_ARGS);
  if (includeSize) {
    args.push("-size");
  }

  if (query.filter === "folder") {
    args.push("/ad");
  }
  if (query.filter === "file") {
    args.push("/a-d");
  }
  if (query.filter && query.filter in EXTENSION_FILTERS) {
    args.push(EXTENSION_FILTERS[query.filter as keyof typeof EXTENSION_FILTERS]);
  }
}

function appendRankingOutput(args: string[]) {
  args.push(...RANKING_OUTPUT_ARGS);
}

function appendOffset(args: string[], offset: number | undefined) {
  if (typeof offset === "number") {
    args.push("-offset", String(offset));
  }
}

function appendQueryTerms(args: string[], query: ParsedSearchQuery) {
  if (query.pathScope) {
    args.push("-path", query.pathScope);
  }

  if (query.parentScope) {
    args.push("-parent", query.parentScope);
  }

  args.push(...query.pathTerms);
  args.push(...query.includeTerms.filter((keyword) => !query.pathTerms.includes(keyword)).map(formatEverythingTerm));
  args.push(...query.excludeTerms.map((term) => `!${term}`));
}

function appendModeFilters(args: string[], query: ParsedSearchQuery) {
  if (query.filter === "folder") {
    args.push("/ad");
  }
  if (query.filter === "file") {
    args.push("/a-d");
  }
  if (query.filter && query.filter in EXTENSION_FILTERS) {
    args.push(EXTENSION_FILTERS[query.filter as keyof typeof EXTENSION_FILTERS]);
  }
}

export function isPinyinCandidateQuery(query: ParsedSearchQuery): boolean {
  if (query.pathTerms.length > 0 || query.keywords.length !== 1) {
    return false;
  }

  const keyword = query.keywords[0];
  if (!keyword || /[^\x00-\x7F]/.test(keyword) || !/^[a-zA-Z]{2,}$/.test(keyword)) {
    return false;
  }

  return new Set(keyword.toLowerCase()).size > 1;
}

export function buildChineseCandidateArgs(query: ParsedSearchQuery, limit = 300): string[] {
  const args = ["-n", String(limit)];
  appendFilters(args, query);
  args.push("regex:[一-龥]");
  return args;
}

interface SearchBuildOptions {
  appLimit?: number;
  resultLimit?: number;
  offset?: number;
}

export function buildEverythingSearches(query: ParsedSearchQuery, optionsOrLimit: SearchBuildOptions | number = {}): string[][] {
  const options: SearchBuildOptions = typeof optionsOrLimit === "number" ? { resultLimit: optionsOrLimit } : optionsOrLimit;
  const resultLimit = query.mode === "default" ? DEFAULT_RESULT_LIMIT : options.resultLimit ?? 200;
  const appLimit = options.appLimit ?? DEFAULT_APP_LIMIT;
  const makeBaseArgs = (limit: number) => {
    const args = ["-n", String(limit)];
    appendRankingOutput(args);
    return args;
  };

  if (query.mode === "default" || query.mode === "apps") {
    const appSearchLimit = query.mode === "default" ? Math.min(appLimit, resultLimit) : resultLimit;
    const appArgs = makeBaseArgs(appSearchLimit);
    appArgs.push("ext:exe;lnk");
    appendQueryTerms(appArgs, query);

    if (query.mode === "apps") {
      return [appArgs];
    }

    const broadArgs = ["-n", String(resultLimit)];
    appendOffset(broadArgs, options.offset ?? 0);
    appendRankingOutput(broadArgs);
    appendQueryTerms(broadArgs, query);
    return [appArgs, broadArgs];
  }

  const args = makeBaseArgs(resultLimit);
  appendModeFilters(args, query);
  if (query.mode === "recent") {
    args.push("-sort", "date-run-descending");
  }
  appendQueryTerms(args, query);
  return [args];
}

export function buildEverythingMoreArgs(query: ParsedSearchQuery, offset: number, limit = DEFAULT_RESULT_LIMIT): string[] | undefined {
  if (query.mode !== "default") {
    return undefined;
  }

  const args = ["-n", String(limit)];
  appendOffset(args, offset);
  appendRankingOutput(args);
  appendQueryTerms(args, query);
  return args;
}

export function buildEverythingArgs(query: ParsedSearchQuery, limit = 200): string[] {
  const args = ["-n", String(limit)];
  appendFilters(args, query, true);

  args.push(...query.pathTerms);
  args.push(...query.keywords.filter((keyword) => !query.pathTerms.includes(keyword)).map(formatEverythingTerm));

  return args;
}
