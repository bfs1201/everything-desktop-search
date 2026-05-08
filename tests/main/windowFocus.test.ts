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

  it("forces the visible launcher native window to the foreground using attached input threads", async () => {
    execFile.mockImplementation((_file, _args, _options, callback) => {
      callback(undefined, "", "");
    });
    const nativeHandle = Buffer.alloc(8);
    nativeHandle.writeBigUInt64LE(74565n);
    const { forceForegroundWindow } = await import("../../src/main/windowFocus");

    await forceForegroundWindow(nativeHandle);

    const command = execFile.mock.calls[0][1].at(-1);
    expect(execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-NonInteractive", "-Command", expect.any(String)]),
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    );
    expect(command).not.toContain("ShowWindowAsync");
    expect(command).toContain("BringWindowToTop");
    expect(command).toContain("SetForegroundWindow");
    expect(command).toContain("GetForegroundWindow");
    expect(command).toContain("IsWindowVisible");
    expect(command).toContain("GetWindowThreadProcessId");
    expect(command).toContain("GetCurrentThreadId");
    expect(command).toContain("AttachThreadInput");
    expect(command).toContain("if ([Win32.NativeWindow]::IsWindowVisible($hwnd))");
    expect(command).toContain("[int64]74565");
    expect(command).toContain("finally");
  });

  it("does not invoke native foreground activation for an invalid native handle", async () => {
    const { forceForegroundWindow } = await import("../../src/main/windowFocus");

    await forceForegroundWindow(Buffer.alloc(8));
    await forceForegroundWindow(Buffer.alloc(2));

    expect(execFile).not.toHaveBeenCalled();
  });
});
