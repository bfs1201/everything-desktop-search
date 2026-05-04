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
