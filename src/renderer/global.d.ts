import type { EverythingSearchApi } from "../preload";

declare global {
  interface Window {
    everythingSearch: EverythingSearchApi;
  }
}

export {};

