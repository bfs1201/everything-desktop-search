import { BrowserWindow, Menu, Tray, app, nativeImage, screen } from "electron";
import path from "node:path";
import { UiohookKey, uIOhook } from "uiohook-napi";
import { advanceFocusGeneration, getFocusGeneration, isCurrentFocusGeneration } from "./focusGeneration.js";
import { createDoubleCtrlDetector } from "./hotkeyDetector.js";
import { registerIpc } from "./ipc.js";
import { shouldSuppressFocusRestoreForResultOpening } from "./resultOpeningFocus.js";
import {
  capturePreviousForegroundWindow,
  forceForegroundWindow,
  hideNativeWindowFromTaskbar,
  restorePreviousForegroundWindow
} from "./windowFocus.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isShowingWindow = false;
let showGraceTimer: NodeJS.Timeout | null = null;
const WINDOW_WIDTH = 720;
const COMPACT_HEIGHT = 104;
const EXPANDED_HEIGHT = 560;

function isLaunchAtLoginEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

function setLaunchAtLoginEnabled(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
}

function positionWindow(window: BrowserWindow, expanded = false) {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const height = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
  window.setBounds({
    width: WINDOW_WIDTH,
    height,
    x: Math.round((width - WINDOW_WIDTH) / 2),
    y: 120
  });
}

function focusLauncherWindow(window: BrowserWindow, expectedFocusGeneration = getFocusGeneration()) {
  if (window.isDestroyed() || !isCurrentFocusGeneration(expectedFocusGeneration)) {
    return;
  }
  window.setFocusable(true);
  forceForegroundWindow(window.getNativeWindowHandle());
  if (window.isDestroyed() || !window.isVisible() || !isCurrentFocusGeneration(expectedFocusGeneration)) {
    return;
  }
  app.focus();
  window.focus();
  window.webContents.focus();

  if (!window.isFocused()) {
    window.setAlwaysOnTop(false);
    window.setAlwaysOnTop(true);
    window.moveTop();
    window.setSkipTaskbar(true);
    void hideNativeWindowFromTaskbar(window.getNativeWindowHandle());
    window.focus();
    window.webContents.focus();
  }
}

function scheduleFocusRetries(window: BrowserWindow, expectedFocusGeneration: number) {
  for (const delayMs of [0, 50, 150, 300, 600]) {
    setTimeout(() => {
      if (!isCurrentFocusGeneration(expectedFocusGeneration)) {
        return;
      }
      if (!window.isDestroyed() && window.isVisible()) {
        focusLauncherWindow(window, expectedFocusGeneration);
      }
    }, delayMs);
  }
}

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

async function showAndFocusWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.setFocusable(true);
  mainWindow.setSkipTaskbar(true);
  hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle());
  if (!mainWindow.isVisible()) {
    capturePreviousForegroundWindow();
  }
  const expectedFocusGeneration = advanceFocusGeneration();
  mainWindow.webContents.send("window-will-show");
  isShowingWindow = true;
  if (showGraceTimer) {
    clearTimeout(showGraceTimer);
  }
  positionWindow(mainWindow, false);
  if (mainWindow.isMinimized()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.restore();
    mainWindow.setSkipTaskbar(true);
  }
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setSkipTaskbar(true);
  mainWindow.show();
  mainWindow.setSkipTaskbar(true);
  void hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle());
  mainWindow.moveTop();
  mainWindow.setSkipTaskbar(true);
  focusLauncherWindow(mainWindow, expectedFocusGeneration);
  scheduleFocusRetries(mainWindow, expectedFocusGeneration);
  showGraceTimer = setTimeout(() => {
    isShowingWindow = false;
    showGraceTimer = null;
  }, 1000);
  mainWindow.webContents.send("window-shown");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: COMPACT_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setSkipTaskbar(true);
  hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle());
  mainWindow.on("show", () => {
    if (mainWindow) {
      mainWindow.setSkipTaskbar(true);
      void hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle());
    }
  });
  mainWindow.on("blur", () => {
    if (isShowingWindow) {
      return;
    }
    if (mainWindow) {
      if (shouldSuppressFocusRestoreForResultOpening()) {
        void hideLauncherWindow(mainWindow, { restorePreviousFocus: false });
      } else {
        void hideLauncherWindow(mainWindow);
      }
    }
  });
  await mainWindow.loadFile(path.join(app.getAppPath(), "dist/renderer/index.html"));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "assets", "icon.ico"));
  const menu = Menu.buildFromTemplate([
    {
      label: "显示搜索",
      click: () => {
        void showAndFocusWindow();
      }
    },
    {
      label: "设置",
      enabled: false
    },
    {
      label: "开机自启",
      type: "checkbox",
      checked: isLaunchAtLoginEnabled(),
      click: (menuItem) => {
        setLaunchAtLoginEnabled(menuItem.checked);
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.quit();
      }
    }
  ]);

  tray = new Tray(icon);
  tray.setToolTip("Everything Quick Launcher");
  tray.setContextMenu(menu);
  tray.on("click", () => {
    tray?.popUpContextMenu(menu);
  });
}

function keyNameFromCode(keycode: number): string {
  if (keycode === UiohookKey.Ctrl || keycode === UiohookKey.CtrlRight) {
    return "Control";
  }
  return String(keycode);
}

function registerKeyboardHook() {
  const detector = createDoubleCtrlDetector();
  uIOhook.on("keydown", (event) => {
    if (detector.keyDown(keyNameFromCode(event.keycode), Date.now())) {
      void showAndFocusWindow();
    }
  });
  uIOhook.on("keyup", (event) => {
    detector.keyUp(keyNameFromCode(event.keycode));
  });
  uIOhook.start();
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  createTray();
  registerKeyboardHook();
});

app.on("window-all-closed", () => {});

app.on("will-quit", () => {
  tray?.destroy();
  tray = null;
  uIOhook.stop();
});
