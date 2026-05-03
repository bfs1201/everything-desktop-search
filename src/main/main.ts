import { BrowserWindow, app, screen } from "electron";
import path from "node:path";
import { UiohookKey, uIOhook } from "uiohook-napi";
import { createDoubleCtrlDetector } from "./hotkeyDetector.js";
import { registerIpc } from "./ipc.js";

let mainWindow: BrowserWindow | null = null;
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

function showAndFocusWindow() {
  if (!mainWindow) {
    return;
  }

  positionWindow(mainWindow, false);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.setAlwaysOnTop(true);
  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
  mainWindow.webContents.focus();
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
    if (mainWindow) {
      mainWindow.hide();
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
      showAndFocusWindow();
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
