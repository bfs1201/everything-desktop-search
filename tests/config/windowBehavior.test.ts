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

  it("npm run dist 生成 NSIS 安装器而不是 portable 版本", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
      build: {
        npmRebuild: boolean;
        win: {
          target: string[];
          signAndEditExecutable: boolean;
        };
        nsis: {
          oneClick: boolean;
          perMachine: boolean;
          allowToChangeInstallationDirectory: boolean;
          createDesktopShortcut: boolean;
          createStartMenuShortcut: boolean;
        };
        portable?: unknown;
      };
    };

    expect(packageJson.scripts.dist).toBe("npm run build && electron-builder --win nsis");
    expect(packageJson.build.npmRebuild).toBe(false);
    expect(packageJson.build.win.target).toContain("nsis");
    expect(packageJson.build.win.signAndEditExecutable).toBe(false);
    expect(packageJson.build.nsis).toMatchObject({
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true
    });
    expect(packageJson.build.portable).toBeUndefined();
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

  it("启动和唤醒后都强制隐藏任务栏图标", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const showFlow = mainSource.slice(
      mainSource.indexOf("async function showAndFocusWindow"),
      mainSource.indexOf("async function createWindow")
    );
    const focusFlow = mainSource.slice(
      mainSource.indexOf("function focusLauncherWindow"),
      mainSource.indexOf("function scheduleFocusRetries")
    );
    const createFlow = mainSource.slice(
      mainSource.indexOf("async function createWindow"),
      mainSource.indexOf("function keyNameFromCode")
    );

    expect(createFlow).toContain("skipTaskbar: true");
    expect(createFlow).toContain('mainWindow.on("show"');
    expect(createFlow).toContain("mainWindow.setSkipTaskbar(true)");
    expect(createFlow).toContain("hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle())");
    expect(showFlow).toContain("mainWindow.setSkipTaskbar(true)");
    expect(showFlow).toContain("hideNativeWindowFromTaskbar(mainWindow.getNativeWindowHandle())");
    expect(showFlow.indexOf("mainWindow.setSkipTaskbar(true)")).toBeLessThan(showFlow.indexOf("mainWindow.show()"));
    expect(showFlow.lastIndexOf("mainWindow.setSkipTaskbar(true)")).toBeGreaterThan(showFlow.indexOf("mainWindow.show()"));
    expect(focusFlow).toContain("window.setSkipTaskbar(true)");
    expect(focusFlow).toContain("hideNativeWindowFromTaskbar(window.getNativeWindowHandle())");
    expect(focusFlow.indexOf("window.moveTop()")).toBeLessThan(focusFlow.indexOf("window.setSkipTaskbar(true)"));
  });

  it("创建托盘菜单作为唯一常驻入口", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      build: { files: string[] };
    };
    const trayFlow = mainSource.slice(
      mainSource.indexOf("function createTray"),
      mainSource.indexOf("function keyNameFromCode")
    );

    expect(mainSource).toContain("Tray");
    expect(mainSource).toContain("Menu");
    expect(mainSource).toContain("nativeImage");
    expect(mainSource).toContain("let tray: Tray | null = null");
    expect(trayFlow).toContain("assets");
    expect(trayFlow).toContain("icon.ico");
    expect(trayFlow).toContain("显示搜索");
    expect(trayFlow).toContain("showAndFocusWindow()");
    expect(trayFlow).toContain("设置");
    expect(trayFlow).toContain("enabled: false");
    expect(trayFlow).toContain("退出");
    expect(trayFlow).toContain("app.quit()");
    expect(mainSource).toContain("createTray()");
    expect(packageJson.build.files).toContain("assets/**/*");
  });

  it("托盘菜单提供默认关闭的开机自启切换", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const trayFlow = mainSource.slice(
      mainSource.indexOf("function createTray"),
      mainSource.indexOf("function keyNameFromCode")
    );
    const readyFlow = mainSource.slice(
      mainSource.indexOf("app.whenReady()"),
      mainSource.indexOf("app.on(\"window-all-closed\"")
    );

    expect(mainSource).toContain("getLoginItemSettings");
    expect(mainSource).toContain("setLoginItemSettings");
    expect(mainSource).toContain("function isLaunchAtLoginEnabled");
    expect(mainSource).toContain("function setLaunchAtLoginEnabled");
    expect(trayFlow).toContain("开机自启");
    expect(trayFlow).toContain("type: \"checkbox\"");
    expect(trayFlow).toContain("checked: isLaunchAtLoginEnabled()");
    expect(trayFlow).toContain("setLaunchAtLoginEnabled(menuItem.checked)");
    expect(mainSource).toContain("path: process.execPath");
    expect(readyFlow).not.toContain("setLoginItemSettings");
    expect(mainSource).not.toContain("openAtLogin: true");
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
    expect(focusFlow).toContain("forceForegroundWindow");
    expect(focusFlow).toContain("window.getNativeWindowHandle()");
    expect(focusFlow.indexOf("window.setFocusable(true)")).toBeLessThan(focusFlow.indexOf("forceForegroundWindow"));
    expect(showFlow).toContain("focusLauncherWindow(mainWindow, expectedFocusGeneration)");
    expect(showFlow).toContain("scheduleFocusRetries(mainWindow, expectedFocusGeneration)");
  });

  it("原生前台激活不阻塞窗口显示完成事件", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const showFlow = mainSource.slice(
      mainSource.indexOf("async function showAndFocusWindow"),
      mainSource.indexOf("async function createWindow")
    );

    expect(showFlow).toContain('mainWindow.webContents.send("window-will-show")');
    expect(showFlow).toContain('mainWindow.webContents.send("window-shown")');
    expect(showFlow.indexOf('mainWindow.webContents.send("window-will-show")')).toBeLessThan(showFlow.indexOf("mainWindow.show()"));
    expect(showFlow.indexOf("focusLauncherWindow(mainWindow, expectedFocusGeneration)")).toBeLessThan(
      showFlow.indexOf('mainWindow.webContents.send("window-shown")')
    );
    expect(showFlow).not.toContain("await focusLauncherWindow");
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

  it("隐藏窗口前通知渲染进程重置搜索状态，避免下次唤醒闪现旧内容", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const hideFlow = mainSource.slice(
      mainSource.indexOf("async function hideLauncherWindow"),
      mainSource.indexOf("async function showAndFocusWindow")
    );

    expect(hideFlow).toContain('window.webContents.send("window-hidden")');
    expect(hideFlow.indexOf('window.webContents.send("window-hidden")')).toBeLessThan(hideFlow.indexOf("window.hide()"));
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

  it("IPC 关闭或打开结果隐藏窗口前也通知渲染进程清空本次搜索", () => {
    const ipcSource = readFileSync(join(process.cwd(), "src/main/ipc.ts"), "utf-8");
    const hideFlow = ipcSource.slice(
      ipcSource.indexOf("async function hideLauncherWindow"),
      ipcSource.indexOf("export function registerIpc")
    );
    const openAndHideFlow = ipcSource.slice(
      ipcSource.indexOf('ipcMain.handle("open-path-and-hide"'),
      ipcSource.indexOf('ipcMain.handle("reveal-path"')
    );
    const hideWindowFlow = ipcSource.slice(
      ipcSource.indexOf('ipcMain.handle("hide-window"'),
      ipcSource.indexOf('ipcMain.handle("set-expanded"')
    );

    expect(hideFlow).toContain('window.webContents.send("window-hidden")');
    expect(hideFlow.indexOf('window.webContents.send("window-hidden")')).toBeLessThan(hideFlow.indexOf("window.hide()"));
    expect(openAndHideFlow).toContain("hideLauncherWindow(window, { restorePreviousFocus: false })");
    expect(hideWindowFlow).toContain("hideLauncherWindow(window)");
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
