export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
  size?: number;
  kind?: "app" | "folder" | "file";
  section?: "frequent" | "results";
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
