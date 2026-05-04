import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("window behavior", () => {
  it("失去焦点时隐藏启动器", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain('mainWindow.on("blur"');
    expect(mainSource).toContain("mainWindow.hide()");
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
