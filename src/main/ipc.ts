import { app, BrowserWindow, clipboard, ipcMain, shell } from "electron";
import { loadMoreEverything, searchEverything } from "./everythingSearch.js";
import { createFileActions } from "./fileActions.js";
import { createFileIconResolver } from "./fileIcons.js";
import { advanceFocusGeneration } from "./focusGeneration.js";
import { beginResultOpening, endResultOpening } from "./resultOpeningFocus.js";
import { getUsageHistoryPath, loadUsageHistory, recordOpenedPath } from "./usageHistory.js";
import { restorePreviousForegroundWindow } from "./windowFocus.js";

const historyPath = getUsageHistoryPath(app.getPath("userData"));

const fileActions = createFileActions({
  openPath: shell.openPath,
  showItemInFolder: shell.showItemInFolder,
  writeText: clipboard.writeText,
  recordOpenedPath: (filePath) => recordOpenedPath(filePath, historyPath)
});

const getFileIcon = createFileIconResolver({
  getFileIcon: async (filePath) => {
    const icon = await app.getFileIcon(filePath, { size: "normal" });
    return icon.toDataURL();
  },
  readShortcutLink: shell.readShortcutLink
});

async function hideLauncherWindow(window: BrowserWindow, options: { restorePreviousFocus?: boolean } = {}) {
  const { restorePreviousFocus = true } = options;
  advanceFocusGeneration();
  window.webContents.send("window-hidden");
  window.blur();
  window.hide();
  window.setFocusable(false);
  if (restorePreviousFocus) {
    await restorePreviousForegroundWindow();
  }
}

export function registerIpc() {
  ipcMain.handle("search", (_event, query: string) =>
    searchEverything(query, {
      loadUsageHistory: () => loadUsageHistory(historyPath),
      getFileIcon
    })
  );
  ipcMain.handle("load-more", (_event, query: string, offset: number) =>
    loadMoreEverything(query, offset, {
      loadUsageHistory: () => loadUsageHistory(historyPath),
      getFileIcon
    })
  );
  ipcMain.handle("open-path", async (_event, filePath: string) => fileActions.open(filePath));
  ipcMain.handle("open-path-and-hide", async (event, filePath: string) => {
    beginResultOpening();
    let error = "";
    try {
      error = await fileActions.openWithoutRecording(filePath);
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        await hideLauncherWindow(window, { restorePreviousFocus: false });
      }
    } finally {
      endResultOpening({ afterBlurGrace: true });
    }
    if (!error) {
      await fileActions.recordSuccessfulOpen(filePath);
    }
    return error;
  });
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
