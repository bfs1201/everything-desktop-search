export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}
