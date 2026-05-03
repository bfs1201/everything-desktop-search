import { contextBridge, ipcRenderer } from "electron";
import type { SearchResponse } from "./shared/searchTypes.js";

const api = {
  search(query: string): Promise<SearchResponse> {
    return ipcRenderer.invoke("search", query);
  },
  openPath(filePath: string): Promise<string> {
    return ipcRenderer.invoke("open-path", filePath);
  },
  revealPath(filePath: string): Promise<void> {
    return ipcRenderer.invoke("reveal-path", filePath);
  },
  copyPath(filePath: string): Promise<void> {
    return ipcRenderer.invoke("copy-path", filePath);
  },
  onWindowShown(callback: () => void) {
    ipcRenderer.on("window-shown", callback);
  }
};

contextBridge.exposeInMainWorld("everythingSearch", api);

export type EverythingSearchApi = typeof api;

