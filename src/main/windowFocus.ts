import koffi from "koffi";

let previousForegroundWindowHandle: number | undefined;

const GWL_EXSTYLE = -20;
const WS_EX_APPWINDOW = 0x00040000;
const WS_EX_TOOLWINDOW = 0x00000080;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_FRAMECHANGED = 0x0020;

type Win32Api = {
  AttachThreadInput: (idAttach: number, idAttachTo: number, attach: boolean) => boolean;
  BringWindowToTop: (hwnd: number) => boolean;
  GetCurrentThreadId: () => number;
  GetForegroundWindow: () => number;
  GetWindowLongPtr: (hwnd: number, index: number) => number;
  GetWindowThreadProcessId: (hwnd: number, processId: number[]) => number;
  IsWindow: (hwnd: number) => boolean;
  IsWindowVisible: (hwnd: number) => boolean;
  SetForegroundWindow: (hwnd: number) => boolean;
  SetWindowLongPtr: (hwnd: number, index: number, value: number) => number;
  SetWindowPos: (hwnd: number, insertAfter: number, x: number, y: number, cx: number, cy: number, flags: number) => boolean;
};

let cachedWin32Api: Win32Api | undefined;

function getWin32Api(): Win32Api | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }

  if (cachedWin32Api) {
    return cachedWin32Api;
  }

  try {
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");
    cachedWin32Api = {
      AttachThreadInput: user32.func("__stdcall", "AttachThreadInput", "bool", ["uint32", "uint32", "bool"]) as Win32Api["AttachThreadInput"],
      BringWindowToTop: user32.func("__stdcall", "BringWindowToTop", "bool", ["uintptr_t"]) as Win32Api["BringWindowToTop"],
      GetCurrentThreadId: kernel32.func("__stdcall", "GetCurrentThreadId", "uint32", []) as Win32Api["GetCurrentThreadId"],
      GetForegroundWindow: user32.func("__stdcall", "GetForegroundWindow", "uintptr_t", []) as Win32Api["GetForegroundWindow"],
      GetWindowLongPtr: user32.func("__stdcall", "GetWindowLongPtrW", "intptr_t", ["uintptr_t", "int"]) as Win32Api["GetWindowLongPtr"],
      GetWindowThreadProcessId: user32.func("__stdcall", "GetWindowThreadProcessId", "uint32", [
        "uintptr_t",
        koffi.out(koffi.pointer("uint32"))
      ]) as Win32Api["GetWindowThreadProcessId"],
      IsWindow: user32.func("__stdcall", "IsWindow", "bool", ["uintptr_t"]) as Win32Api["IsWindow"],
      IsWindowVisible: user32.func("__stdcall", "IsWindowVisible", "bool", ["uintptr_t"]) as Win32Api["IsWindowVisible"],
      SetForegroundWindow: user32.func("__stdcall", "SetForegroundWindow", "bool", ["uintptr_t"]) as Win32Api["SetForegroundWindow"],
      SetWindowLongPtr: user32.func("__stdcall", "SetWindowLongPtrW", "intptr_t", [
        "uintptr_t",
        "int",
        "intptr_t"
      ]) as Win32Api["SetWindowLongPtr"],
      SetWindowPos: user32.func("__stdcall", "SetWindowPos", "bool", [
        "uintptr_t",
        "uintptr_t",
        "int",
        "int",
        "int",
        "int",
        "uint32"
      ]) as Win32Api["SetWindowPos"]
    };
    return cachedWin32Api;
  } catch {
    return undefined;
  }
}

function hwndFromNativeHandle(nativeHandle: Buffer): number | undefined {
  if (nativeHandle.length >= 8) {
    const hwnd = nativeHandle.readBigUInt64LE(0);
    return hwnd > 0n && hwnd <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(hwnd) : undefined;
  }

  if (nativeHandle.length >= 4) {
    const hwnd = nativeHandle.readUInt32LE(0);
    return hwnd > 0 ? hwnd : undefined;
  }

  return undefined;
}

function getWindowThreadId(api: Win32Api, hwnd: number) {
  const processId = [0];
  return api.GetWindowThreadProcessId(hwnd, processId);
}

export function capturePreviousForegroundWindow() {
  const api = getWin32Api();
  if (!api) {
    return;
  }

  try {
    const handle = api.GetForegroundWindow();
    previousForegroundWindowHandle = handle && api.IsWindow(handle) ? handle : undefined;
  } catch {
    previousForegroundWindowHandle = undefined;
  }
}

export function restorePreviousForegroundWindow() {
  const api = getWin32Api();
  if (!api || !previousForegroundWindowHandle) {
    return;
  }

  const handle = previousForegroundWindowHandle;
  previousForegroundWindowHandle = undefined;

  try {
    if (api.IsWindow(handle)) {
      api.SetForegroundWindow(handle);
    }
  } catch {
    // Restoring focus is best-effort; hiding the launcher should still complete.
  }
}

export function forceForegroundWindow(nativeHandle: Buffer): void {
  const api = getWin32Api();
  const hwnd = hwndFromNativeHandle(nativeHandle);
  if (!api || !hwnd) {
    return;
  }

  let attachedForeground = false;
  let attachedTarget = false;
  let currentThreadId = 0;
  let foregroundThreadId = 0;
  let targetThreadId = 0;

  try {
    if (!api.IsWindowVisible(hwnd)) {
      return;
    }

    const foreground = api.GetForegroundWindow();
    foregroundThreadId = foreground ? getWindowThreadId(api, foreground) : 0;
    targetThreadId = getWindowThreadId(api, hwnd);
    currentThreadId = api.GetCurrentThreadId();

    if (currentThreadId !== 0 && foregroundThreadId !== 0 && currentThreadId !== foregroundThreadId) {
      attachedForeground = api.AttachThreadInput(currentThreadId, foregroundThreadId, true);
    }
    if (currentThreadId !== 0 && targetThreadId !== 0 && currentThreadId !== targetThreadId) {
      attachedTarget = api.AttachThreadInput(currentThreadId, targetThreadId, true);
    }

    api.BringWindowToTop(hwnd);
    api.SetForegroundWindow(hwnd);
  } catch {
    // Foreground activation is best-effort; Electron focus retries still run.
  } finally {
    try {
      if (attachedTarget) {
        api.AttachThreadInput(currentThreadId, targetThreadId, false);
      }
      if (attachedForeground) {
        api.AttachThreadInput(currentThreadId, foregroundThreadId, false);
      }
    } catch {
      // Detaching input queues is best-effort.
    }
  }
}

export function hideNativeWindowFromTaskbar(nativeHandle: Buffer): void {
  const api = getWin32Api();
  const hwnd = hwndFromNativeHandle(nativeHandle);
  if (!api || !hwnd) {
    return;
  }

  try {
    if (!api.IsWindow(hwnd)) {
      return;
    }

    const style = api.GetWindowLongPtr(hwnd, GWL_EXSTYLE);
    const newStyle = (style & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW;
    api.SetWindowLongPtr(hwnd, GWL_EXSTYLE, newStyle);
    api.SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
  } catch {
    // Taskbar hiding is best-effort; Electron skipTaskbar remains active.
  }
}
