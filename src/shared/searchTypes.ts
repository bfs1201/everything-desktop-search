export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
  size?: number;
  kind?: "app" | "folder" | "file";
  iconDataUrl?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}
