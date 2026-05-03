import { BrowserWindow, app, screen } from "electron";
import path from "node:path";
import { UiohookKey, uIOhook } from "uiohook-napi";
import { createDoubleCtrlDetector } from "./hotkeyDetector.js";
import { registerIpc } from "./ipc.js";

let mainWindow: BrowserWindow | null = null;

function positionWindow(window: BrowserWindow) {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  window.setBounds({
    width: 720,
    height: 420,
    x: Math.round((width - 720) / 2),
    y: 120
  });
}

function toggleWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  positionWindow(mainWindow);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("window-shown");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 420,
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
    if (detector.record(keyNameFromCode(event.keycode), Date.now())) {
      toggleWindow();
    }
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
