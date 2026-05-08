import { execFile } from "node:child_process";

let previousForegroundWindowHandle: string | undefined;

function runPowerShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
      { timeout: 1200, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(String(stdout));
      }
    );
  });
}

function user32Definition(members: string) {
  return `
Add-Type -Namespace Win32 -Name NativeWindow -MemberDefinition @'
${members}
'@;
`;
}

function hwndFromNativeHandle(nativeHandle: Buffer): string | undefined {
  if (nativeHandle.length >= 8) {
    const hwnd = nativeHandle.readBigUInt64LE(0);
    return hwnd > 0n ? hwnd.toString() : undefined;
  }

  if (nativeHandle.length >= 4) {
    const hwnd = nativeHandle.readUInt32LE(0);
    return hwnd > 0 ? String(hwnd) : undefined;
  }

  return undefined;
}

export async function capturePreviousForegroundWindow() {
  if (process.platform !== "win32") {
    return;
  }

  try {
    const stdout = await runPowerShell(
      `${user32Definition('[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();')}
[Win32.NativeWindow]::GetForegroundWindow().ToInt64()`
    );
    const handle = stdout.trim();
    if (/^[1-9]\d*$/.test(handle)) {
      previousForegroundWindowHandle = handle;
    }
  } catch {
    previousForegroundWindowHandle = undefined;
  }
}

export async function restorePreviousForegroundWindow() {
  if (process.platform !== "win32" || !previousForegroundWindowHandle) {
    return;
  }

  const handle = previousForegroundWindowHandle;
  previousForegroundWindowHandle = undefined;

  try {
    await runPowerShell(
      `${user32Definition(`
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool IsWindow(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
`)}
$hwnd = [System.IntPtr]([int64]${handle});
if ([Win32.NativeWindow]::IsWindow($hwnd)) {
  [Win32.NativeWindow]::SetForegroundWindow($hwnd) | Out-Null
}`
    );
  } catch {
    // Restoring focus is best-effort; hiding the launcher should still complete.
  }
}

export async function forceForegroundWindow(nativeHandle: Buffer): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const handle = hwndFromNativeHandle(nativeHandle);
  if (!handle) {
    return;
  }

  try {
    await runPowerShell(
      `${user32Definition(`
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool BringWindowToTop(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint processId);
[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
`)}
$hwnd = [System.IntPtr]([int64]${handle});
[uint32]$currentThreadId = 0;
[uint32]$foregroundThreadId = 0;
[uint32]$targetThreadId = 0;
$attachedForeground = $false;
$attachedTarget = $false;
try {
  [uint32]$foregroundProcessId = 0;
  [uint32]$targetProcessId = 0;
  $foreground = [Win32.NativeWindow]::GetForegroundWindow();
  if ($foreground -ne [System.IntPtr]::Zero) {
    $foregroundThreadId = [Win32.NativeWindow]::GetWindowThreadProcessId($foreground, [ref]$foregroundProcessId);
  }
  $targetThreadId = [Win32.NativeWindow]::GetWindowThreadProcessId($hwnd, [ref]$targetProcessId);
  $currentThreadId = [Win32.NativeWindow]::GetCurrentThreadId();
  if ($currentThreadId -ne 0 -and $foregroundThreadId -ne 0 -and $currentThreadId -ne $foregroundThreadId) {
    $attachedForeground = [Win32.NativeWindow]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true);
  }
  if ($currentThreadId -ne 0 -and $targetThreadId -ne 0 -and $currentThreadId -ne $targetThreadId) {
    $attachedTarget = [Win32.NativeWindow]::AttachThreadInput($currentThreadId, $targetThreadId, $true);
  }
  if ([Win32.NativeWindow]::IsWindowVisible($hwnd)) {
    [Win32.NativeWindow]::BringWindowToTop($hwnd) | Out-Null;
    [Win32.NativeWindow]::SetForegroundWindow($hwnd) | Out-Null;
  }
} catch {
} finally {
  if ($attachedTarget) {
    [Win32.NativeWindow]::AttachThreadInput($currentThreadId, $targetThreadId, $false) | Out-Null;
  }
  if ($attachedForeground) {
    [Win32.NativeWindow]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false) | Out-Null;
  }
}`
    );
  } catch {
    // Foreground activation is best-effort; Electron focus retries still run.
  }
}
