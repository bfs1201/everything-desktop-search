import { beforeEach, describe, expect, it, vi } from "vitest";

const execFile = vi.fn();

vi.mock("node:child_process", () => ({
  default: { execFile },
  execFile
}));

describe("window focus restore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.defineProperty(process, "platform", {
      value: "win32"
    });
  });

  it("captures the current foreground window handle through user32", async () => {
    execFile.mockImplementation((_file, _args, _options, callback) => {
      callback(undefined, "12345\r\n", "");
    });
    const { capturePreviousForegroundWindow } = await import("../../src/main/windowFocus");

    await capturePreviousForegroundWindow();

    expect(execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-NonInteractive", "-Command", expect.stringContaining("GetForegroundWindow")]),
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    );
  });

  it("restores the captured foreground window handle through user32", async () => {
    execFile
      .mockImplementationOnce((_file, _args, _options, callback) => {
        callback(undefined, "12345\r\n", "");
      })
      .mockImplementationOnce((_file, _args, _options, callback) => {
        callback(undefined, "", "");
      });
    const { capturePreviousForegroundWindow, restorePreviousForegroundWindow } = await import("../../src/main/windowFocus");

    await capturePreviousForegroundWindow();
    await restorePreviousForegroundWindow();

    expect(execFile).toHaveBeenLastCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-NonInteractive", "-Command", expect.stringContaining("SetForegroundWindow")]),
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    );
  });
});
