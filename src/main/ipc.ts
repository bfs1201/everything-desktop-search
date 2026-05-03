import { BrowserWindow, clipboard, ipcMain, shell } from "electron";
import { searchEverything } from "./everythingSearch.js";
import { createFileActions } from "./fileActions.js";

const fileActions = createFileActions({
  openPath: shell.openPath,
  showItemInFolder: shell.showItemInFolder,
  writeText: clipboard.writeText
});

export function registerIpc() {
  ipcMain.handle("search", (_event, query: string) => searchEverything(query));
  ipcMain.handle("open-path", async (_event, filePath: string) => fileActions.open(filePath));
  ipcMain.handle("reveal-path", (_event, filePath: string) => fileActions.reveal(filePath));
  ipcMain.handle("copy-path", (_event, filePath: string) => fileActions.copyPath(filePath));
  ipcMain.handle("hide-window", (event) => BrowserWindow.fromWebContents(event.sender)?.hide());
  ipcMain.handle("set-expanded", (event, expanded: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    const bounds = window.getBounds();
    window.setBounds({ ...bounds, height: expanded ? 560 : 104 });
  });
}
