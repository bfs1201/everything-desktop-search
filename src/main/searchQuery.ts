export type SearchFilter = "folder" | "file" | "doc" | "pic" | "video" | "audio" | undefined;

export interface ParsedSearchQuery {
  raw: string;
  filter: SearchFilter;
  keywords: string[];
  pathTerms: string[];
}

const FILTERS = new Set(["folder", "file", "doc", "pic", "video", "audio"]);

const EXTENSION_FILTERS: Record<Exclude<SearchFilter, "folder" | "file" | undefined>, string> = {
  doc: "ext:doc;docx;pdf;txt;md;xls;xlsx;ppt;pptx",
  pic: "ext:jpg;jpeg;png;gif;webp;bmp;svg",
  video: "ext:mp4;mkv;mov;avi;wmv;flv;webm",
  audio: "ext:mp3;wav;flac;aac;m4a;ogg"
};

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
  const keywords: string[] = [];
  const pathTerms: string[] = [];

  for (const term of terms) {
    const filterMatch = term.match(/^([a-zA-Z]+):$/);
    if (filterMatch && FILTERS.has(filterMatch[1].toLowerCase())) {
      filter = filterMatch[1].toLowerCase() as SearchFilter;
      continue;
    }

    if (isPathTerm(term)) {
      const { pathTerm, keyword } = splitPathTerm(term);
      pathTerms.push(pathTerm);
      if (keyword) {
        keywords.push(keyword);
      }
      continue;
    }

    keywords.push(term);
  }

  return { raw, filter, keywords, pathTerms };
}

export function buildEverythingArgs(query: ParsedSearchQuery, limit = 200): string[] {
  const args = ["-n", String(limit)];

  if (query.filter === "folder") {
    args.push("/ad");
  }
  if (query.filter === "file") {
    args.push("/a-d");
  }
  if (query.filter && query.filter in EXTENSION_FILTERS) {
    args.push(EXTENSION_FILTERS[query.filter as keyof typeof EXTENSION_FILTERS]);
  }

  args.push(...query.pathTerms);
  args.push(...query.keywords.filter((keyword) => !query.pathTerms.includes(keyword)));

  return args;
}
