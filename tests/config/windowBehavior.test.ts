import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("window behavior", () => {
  it("失去焦点时隐藏启动器", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain('mainWindow.on("blur"');
    expect(mainSource).toContain("hideLauncherWindow(mainWindow)");
  });

  it("隐藏启动器时释放焦点，让系统回到之前的输入位置", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");

    expect(mainSource).toContain("capturePreviousForegroundWindow");
    expect(mainSource).toContain("restorePreviousForegroundWindow");
    expect(mainSource).toContain("function hideLauncherWindow");
    expect(mainSource).toContain("window.blur()");
    expect(mainSource).toContain("window.hide()");
    expect(mainSource).toContain("window.setFocusable(false)");
    expect(ipcSource).toContain("restorePreviousForegroundWindow");
    expect(ipcSource).toContain("hideLauncherWindow");
  });

  it("双击 Ctrl 在窗口已显示时强制聚焦而不是隐藏", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain("showAndFocusWindow");
    expect(mainSource).toContain("window.webContents.focus()");
    expect(mainSource).not.toContain("if (mainWindow.isVisible()) {\n    mainWindow.hide();");
  });

  it("npm start 先构建再启动 Electron，避免运行旧 dist", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.start).toBe("npm run build && electron .");
  });

  it("双击 Ctrl 显示窗口时请求应用、窗口和页面焦点", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain("showAndFocusWindow");
    expect(mainSource).toContain("isShowingWindow");
    expect(mainSource).toContain("app.focus()");
    expect(mainSource).toContain("window.focus()");
    expect(mainSource).toContain("window.webContents.focus()");
    expect(mainSource).toContain("window.isFocused()");
    expect(mainSource).toContain("}, 1000)");
    expect(mainSource).not.toContain('mainWindow.on("focus"');
    expect(mainSource).not.toContain("if (mainWindow.isVisible()) {\n    mainWindow.hide();");
  });

  it("双击 Ctrl 显示窗口时使用原生 HWND 强制前台激活", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const focusFlow = mainSource.slice(
      mainSource.indexOf("function focusLauncherWindow"),
      mainSource.indexOf("function scheduleFocusRetries")
    );
    const showFlow = mainSource.slice(
      mainSource.indexOf("async function showAndFocusWindow"),
      mainSource.indexOf("async function createWindow")
    );

    expect(mainSource).toContain("forceForegroundWindow");
    expect(focusFlow).toContain("await forceForegroundWindow");
    expect(focusFlow).toContain("window.getNativeWindowHandle()");
    expect(focusFlow.indexOf("window.setFocusable(true)")).toBeLessThan(focusFlow.indexOf("forceForegroundWindow"));
    expect(showFlow).toContain("await focusLauncherWindow(mainWindow, expectedFocusGeneration)");
    expect(showFlow).toContain("scheduleFocusRetries(mainWindow, expectedFocusGeneration)");
  });

  it("原生前台激活等待后窗口已隐藏时不再重新聚焦", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const focusFlow = mainSource.slice(
      mainSource.indexOf("function focusLauncherWindow"),
      mainSource.indexOf("function scheduleFocusRetries")
    );

    expect(focusFlow).toContain("await forceForegroundWindow");
    expect(focusFlow).toContain("window.isDestroyed()");
    expect(focusFlow).toContain("!window.isVisible()");
    const nativeFocusIndex = focusFlow.indexOf("await forceForegroundWindow");
    const postNativeDestroyedGuardIndex = focusFlow.indexOf("window.isDestroyed()", nativeFocusIndex);
    const postNativeVisibleGuardIndex = focusFlow.indexOf("!window.isVisible()", nativeFocusIndex);

    expect(nativeFocusIndex).toBeLessThan(postNativeDestroyedGuardIndex);
    expect(postNativeDestroyedGuardIndex).toBeLessThan(focusFlow.indexOf("app.focus()"));
    expect(postNativeVisibleGuardIndex).toBeLessThan(focusFlow.indexOf("app.focus()"));
  });

  it("焦点重试只允许当前显示代继续执行", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const retryFlow = mainSource.slice(
      mainSource.indexOf("function scheduleFocusRetries"),
      mainSource.indexOf("async function hideLauncherWindow")
    );
    const showFlow = mainSource.slice(
      mainSource.indexOf("async function showAndFocusWindow"),
      mainSource.indexOf("async function createWindow")
    );
    const hideFlow = mainSource.slice(
      mainSource.indexOf("async function hideLauncherWindow"),
      mainSource.indexOf("async function showAndFocusWindow")
    );

    expect(mainSource).toContain("isCurrentFocusGeneration");
    expect(mainSource).toContain("getFocusGeneration");
    expect(showFlow).toContain("advanceFocusGeneration()");
    expect(hideFlow).toContain("advanceFocusGeneration()");
    expect(retryFlow).toContain("expectedFocusGeneration");
    expect(retryFlow).toContain("!isCurrentFocusGeneration(expectedFocusGeneration)");
    expect(retryFlow).toContain("focusLauncherWindow(window, expectedFocusGeneration)");
  });

  it("IPC 隐藏窗口时也会让旧焦点重试失效", () => {
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");
    const hideFlow = ipcSource.slice(
      ipcSource.indexOf("async function hideLauncherWindow"),
      ipcSource.indexOf("export function registerIpc")
    );

    expect(ipcSource).toContain("advanceFocusGeneration");
    expect(hideFlow).toContain("advanceFocusGeneration()");
    expect(hideFlow.indexOf("advanceFocusGeneration()")).toBeLessThan(hideFlow.indexOf("window.blur()"));
  });

  it("open-path-and-hide 打开结果时隐藏窗口但不恢复之前焦点", () => {
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");
    const handler = ipcSource.slice(
      ipcSource.indexOf('ipcMain.handle("open-path-and-hide"'),
      ipcSource.indexOf('ipcMain.handle("reveal-path"')
    );

    expect(handler).toContain("fileActions.openWithoutRecording(filePath)");
    expect(handler).toContain("hideLauncherWindow(window, { restorePreviousFocus: false })");
    expect(handler).toContain("fileActions.recordSuccessfulOpen(filePath)");
    expect(handler).toContain("return error");
    expect(handler).not.toContain("restorePreviousForegroundWindow");
    expect(handler.indexOf("fileActions.openWithoutRecording(filePath)")).toBeLessThan(
      handler.indexOf("hideLauncherWindow(window, { restorePreviousFocus: false })")
    );
    expect(handler.indexOf("hideLauncherWindow(window, { restorePreviousFocus: false })")).toBeLessThan(
      handler.indexOf("fileActions.recordSuccessfulOpen(filePath)")
    );
  });

  it("open-path-and-hide 打开结果期间 blur 隐藏窗口不恢复之前焦点", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");
    const blurFlow = mainSource.slice(
      mainSource.indexOf('mainWindow.on("blur"'),
      mainSource.indexOf("await mainWindow.loadFile")
    );
    const handler = ipcSource.slice(
      ipcSource.indexOf('ipcMain.handle("open-path-and-hide"'),
      ipcSource.indexOf('ipcMain.handle("reveal-path"')
    );

    expect(mainSource).toContain("shouldSuppressFocusRestoreForResultOpening");
    expect(blurFlow).toContain("shouldSuppressFocusRestoreForResultOpening()");
    expect(blurFlow).toContain("hideLauncherWindow(mainWindow, { restorePreviousFocus: false })");
    expect(handler).toContain("beginResultOpening()");
    expect(handler.indexOf("beginResultOpening()")).toBeLessThan(
      handler.indexOf("fileActions.openWithoutRecording(filePath)")
    );
    expect(handler).toContain("finally");
    expect(handler).toContain("endResultOpening({ afterBlurGrace: true })");
    expect(handler.indexOf("hideLauncherWindow(window, { restorePreviousFocus: false })")).toBeLessThan(
      handler.indexOf("endResultOpening({ afterBlurGrace: true })")
    );
  });

  it("open-path-and-hide 延迟释放 blur 抑制以覆盖异步失焦事件", () => {
    const stateSource = readFileSync(join(process.cwd(), "src/main/resultOpeningFocus.ts"), "utf-8");

    expect(stateSource).toContain("RESULT_OPENING_BLUR_GRACE_MS");
    expect(stateSource).toContain("setTimeout");
    expect(stateSource).toContain("afterBlurGrace");
    expect(stateSource).not.toContain("clearTimeout");
    expect(stateSource).toContain("activeResultOpeningCount > 0");
  });

  it("支持搜索框紧凑高度和结果展开高度", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");

    expect(mainSource).toContain("COMPACT_HEIGHT");
    expect(mainSource).toContain("EXPANDED_HEIGHT");
    expect(ipcSource).toContain('"set-expanded"');
  });

  it("IPC 搜索和打开共用使用记录文件", () => {
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");

    expect(ipcSource).toContain("getUsageHistoryPath");
    expect(ipcSource).toContain("loadUsageHistory");
    expect(ipcSource).toContain("recordOpenedPath");
  });
});
