import { BrowserWindow, app, screen } from "electron";
import path from "node:path";
import { UiohookKey, uIOhook } from "uiohook-napi";
import { advanceFocusGeneration, getFocusGeneration, isCurrentFocusGeneration } from "./focusGeneration.js";
import { createDoubleCtrlDetector } from "./hotkeyDetector.js";
import { registerIpc } from "./ipc.js";
import { shouldSuppressFocusRestoreForResultOpening } from "./resultOpeningFocus.js";
import { capturePreviousForegroundWindow, forceForegroundWindow, restorePreviousForegroundWindow } from "./windowFocus.js";

let mainWindow: BrowserWindow | null = null;
let isShowingWindow = false;
let showGraceTimer: NodeJS.Timeout | null = null;
const WINDOW_WIDTH = 720;
const COMPACT_HEIGHT = 104;
const EXPANDED_HEIGHT = 560;

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

async function focusLauncherWindow(window: BrowserWindow, expectedFocusGeneration = getFocusGeneration()) {
  if (window.isDestroyed() || !isCurrentFocusGeneration(expectedFocusGeneration)) {
    return;
  }
  window.setFocusable(true);
  await forceForegroundWindow(window.getNativeWindowHandle());
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
        void focusLauncherWindow(window, expectedFocusGeneration).catch(() => undefined);
      }
    }, delayMs);
  }
}

async function hideLauncherWindow(window: BrowserWindow, options: { restorePreviousFocus?: boolean } = {}) {
  const { restorePreviousFocus = true } = options;
  advanceFocusGeneration();
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
  if (!mainWindow.isVisible()) {
    await capturePreviousForegroundWindow();
  }
  const expectedFocusGeneration = advanceFocusGeneration();
  isShowingWindow = true;
  if (showGraceTimer) {
    clearTimeout(showGraceTimer);
  }
  positionWindow(mainWindow, false);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.setAlwaysOnTop(true);
  mainWindow.show();
  mainWindow.moveTop();
  await focusLauncherWindow(mainWindow, expectedFocusGeneration);
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
  registerKeyboardHook();
});

app.on("window-all-closed", () => {});

app.on("will-quit", () => {
  uIOhook.stop();
});
