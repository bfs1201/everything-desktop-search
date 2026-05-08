import { contextBridge, ipcRenderer } from "electron";
import type { SearchResponse } from "./shared/searchTypes.js";

const api = {
  search(query: string): Promise<SearchResponse> {
    return ipcRenderer.invoke("search", query);
  },
  loadMore(query: string, offset: number): Promise<SearchResponse> {
    return ipcRenderer.invoke("load-more", query, offset);
  },
  openPath(filePath: string): Promise<string> {
    return ipcRenderer.invoke("open-path", filePath);
  },
  openPathAndHide(filePath: string): Promise<string> {
    return ipcRenderer.invoke("open-path-and-hide", filePath);
  },
  revealPath(filePath: string): Promise<void> {
    return ipcRenderer.invoke("reveal-path", filePath);
  },
  copyPath(filePath: string): Promise<void> {
    return ipcRenderer.invoke("copy-path", filePath);
  },
  hideWindow(): Promise<void> {
    return ipcRenderer.invoke("hide-window");
  },
  setExpanded(expanded: boolean): Promise<void> {
    return ipcRenderer.invoke("set-expanded", expanded);
  },
  onWindowShown(callback: () => void) {
    ipcRenderer.on("window-shown", callback);
  }
};

contextBridge.exposeInMainWorld("everythingSearch", api);

export type EverythingSearchApi = typeof api;
