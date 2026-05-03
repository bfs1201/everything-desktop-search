import type { EverythingSearchApi } from "../preload.cjs";

declare global {
  interface Window {
    everythingSearch: EverythingSearchApi;
  }
}

export {};
