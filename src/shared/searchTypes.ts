export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
  size?: number;
  kind?: "app" | "folder" | "file";
  section?: "history" | "apps" | "files";
  runCount?: number;
  dateRun?: number;
  dateModified?: number;
  iconDataUrl?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
  nextOffset?: number;
  canLoadMore?: boolean;
  queryMode?: "default" | "apps" | "recent" | "files";
}
