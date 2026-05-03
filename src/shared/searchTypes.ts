export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
  kind?: "app" | "folder" | "file";
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}
