import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("window behavior", () => {
  it("失去焦点时隐藏启动器", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain('mainWindow.on("blur"');
    expect(mainSource).toContain("mainWindow.hide()");
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
