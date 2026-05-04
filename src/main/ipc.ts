import { app, BrowserWindow, clipboard, ipcMain, shell } from "electron";
import { searchEverything } from "./everythingSearch.js";
import { createFileActions } from "./fileActions.js";
import { getUsageHistoryPath, loadUsageHistory, recordOpenedPath } from "./usageHistory.js";
import { restorePreviousForegroundWindow } from "./windowFocus.js";

const historyPath = getUsageHistoryPath(app.getPath("userData"));

const fileActions = createFileActions({
  openPath: shell.openPath,
  showItemInFolder: shell.showItemInFolder,
  writeText: clipboard.writeText,
  recordOpenedPath: (filePath) => recordOpenedPath(filePath, historyPath)
});

async function hideLauncherWindow(window: BrowserWindow) {
  window.blur();
  window.hide();
  window.setFocusable(false);
  await restorePreviousForegroundWindow();
}

export function registerIpc() {
  ipcMain.handle("search", (_event, query: string) =>
    searchEverything(query, {
      loadUsageHistory: () => loadUsageHistory(historyPath),
      getFileIcon: async (filePath) => {
        const icon = await app.getFileIcon(filePath, { size: "normal" });
        return icon.toDataURL();
      }
    })
  );
  ipcMain.handle("open-path", async (_event, filePath: string) => fileActions.open(filePath));
  ipcMain.handle("reveal-path", (_event, filePath: string) => fileActions.reveal(filePath));
  ipcMain.handle("copy-path", (_event, filePath: string) => fileActions.copyPath(filePath));
  ipcMain.handle("hide-window", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      await hideLauncherWindow(window);
    }
  });
  ipcMain.handle("set-expanded", (event, expanded: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    const bounds = window.getBounds();
    window.setBounds({ ...bounds, height: expanded ? 560 : 104 });
  });
}
