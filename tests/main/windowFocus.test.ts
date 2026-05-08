import { beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.fn();
const out = vi.fn((type: unknown) => ({ direction: "out", type }));
const pointer = vi.fn((type: unknown) => ({ pointer: type }));

const api = {
  AttachThreadInput: vi.fn(),
  BringWindowToTop: vi.fn(),
  GetCurrentThreadId: vi.fn(),
  GetForegroundWindow: vi.fn(),
  GetWindowLongPtr: vi.fn(),
  GetWindowThreadProcessId: vi.fn(),
  IsWindow: vi.fn(),
  IsWindowVisible: vi.fn(),
  SetForegroundWindow: vi.fn(),
  SetWindowLongPtr: vi.fn(),
  SetWindowPos: vi.fn()
};

function apiFunction(name: string) {
  return api[name.replace(/W$/, "") as keyof typeof api];
}

const user32 = {
  func: vi.fn((_convention: string, name: string) => apiFunction(name))
};

const kernel32 = {
  func: vi.fn((_convention: string, name: string) => apiFunction(name))
};

vi.mock("koffi", () => ({
  default: {
    load,
    out,
    pointer
  }
}));

function nativeHandle(hwnd: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(hwnd));
  return buffer;
}

async function importWindowFocus() {
  vi.resetModules();
  return import("../../src/main/windowFocus");
}

describe("window focus native integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, "platform", {
      value: "win32"
    });
    load.mockImplementation((library: string) => {
      if (library === "user32.dll") {
        return user32;
      }
      if (library === "kernel32.dll") {
        return kernel32;
      }
      throw new Error(`Unexpected library ${library}`);
    });
    api.AttachThreadInput.mockReturnValue(true);
    api.BringWindowToTop.mockReturnValue(true);
    api.GetCurrentThreadId.mockReturnValue(30);
    api.GetForegroundWindow.mockReturnValue(10);
    api.GetWindowLongPtr.mockReturnValue(0x00040000);
    api.GetWindowThreadProcessId.mockImplementation((hwnd: number, processId: number[]) => {
      processId[0] = hwnd + 1000;
      return hwnd + 20;
    });
    api.IsWindow.mockReturnValue(true);
    api.IsWindowVisible.mockReturnValue(true);
    api.SetForegroundWindow.mockReturnValue(true);
    api.SetWindowLongPtr.mockReturnValue(0);
    api.SetWindowPos.mockReturnValue(true);
  });

  it("captures and restores the previous foreground window in-process", async () => {
    const { capturePreviousForegroundWindow, restorePreviousForegroundWindow } = await importWindowFocus();

    capturePreviousForegroundWindow();
    restorePreviousForegroundWindow();

    expect(load).toHaveBeenCalledWith("user32.dll");
    expect(load).toHaveBeenCalledWith("kernel32.dll");
    expect(api.GetForegroundWindow).toHaveBeenCalledOnce();
    expect(api.IsWindow).toHaveBeenCalledWith(10);
    expect(api.SetForegroundWindow).toHaveBeenCalledWith(10);
  });

  it("forces only visible native windows to the foreground and detaches input queues", async () => {
    const { forceForegroundWindow } = await importWindowFocus();

    forceForegroundWindow(nativeHandle(50));

    expect(api.IsWindowVisible).toHaveBeenCalledWith(50);
    expect(api.GetWindowThreadProcessId).toHaveBeenCalledWith(10, expect.any(Array));
    expect(api.GetWindowThreadProcessId).toHaveBeenCalledWith(50, expect.any(Array));
    expect(api.AttachThreadInput).toHaveBeenNthCalledWith(1, 30, 70, true);
    expect(api.BringWindowToTop).toHaveBeenCalledWith(50);
    expect(api.SetForegroundWindow).toHaveBeenCalledWith(50);
    expect(api.AttachThreadInput).toHaveBeenNthCalledWith(2, 30, 70, false);
  });

  it("skips foreground activation for invisible or invalid native windows", async () => {
    const { forceForegroundWindow } = await importWindowFocus();

    api.IsWindowVisible.mockReturnValue(false);
    forceForegroundWindow(nativeHandle(50));
    forceForegroundWindow(Buffer.alloc(2));

    expect(api.BringWindowToTop).not.toHaveBeenCalled();
    expect(api.SetForegroundWindow).not.toHaveBeenCalled();
  });

  it("marks the launcher native window as a tool window", async () => {
    const { hideNativeWindowFromTaskbar } = await importWindowFocus();

    hideNativeWindowFromTaskbar(nativeHandle(50));

    expect(api.IsWindow).toHaveBeenCalledWith(50);
    expect(api.GetWindowLongPtr).toHaveBeenCalledWith(50, -20);
    expect(api.SetWindowLongPtr).toHaveBeenCalledWith(50, -20, 0x00000080);
    expect(api.SetWindowPos).toHaveBeenCalledWith(50, 0, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0020);
  });
});
