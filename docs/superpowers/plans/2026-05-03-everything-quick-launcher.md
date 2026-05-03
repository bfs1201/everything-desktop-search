# Everything Quick Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop quick launcher that toggles a centered search box with double Ctrl, searches through Everything CLI, and supports keyboard-first file actions.

**Architecture:** Use Electron for the desktop shell, global keyboard listening, process execution, clipboard, and file actions. Use React + TypeScript for the renderer UI. Keep the Everything CLI integration, hotkey state machine, and file actions in small testable modules, then wire them through Electron IPC.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, Testing Library, `electron-builder`.

---

## File Structure

- Create `package.json`: scripts, dependencies, build config.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript, Vite, and test setup.
- Create `index.html`: renderer mount point.
- Create `src/shared/searchTypes.ts`: shared `SearchResult` and IPC payload types.
- Create `src/main/everythingSearch.ts`: calls `D:\Everything\es.exe`, parses output, retries after starting Everything on IPC errors.
- Create `src/main/hotkeyDetector.ts`: detects double Ctrl and exposes a pure testable state machine.
- Create `src/main/fileActions.ts`: opens files, reveals files, and copies paths.
- Create `src/main/ipc.ts`: renderer-to-main IPC handlers.
- Create `src/main/main.ts`: Electron app bootstrap and window lifecycle.
- Create `src/preload.ts`: safe renderer bridge.
- Create `src/renderer/App.tsx`: search UI and keyboard behavior.
- Create `src/renderer/main.tsx`: React bootstrap.
- Create `src/renderer/styles.css`: floating single-box styling.
- Create tests under `tests/main` and `tests/renderer`.

## Task 1: Scaffold Desktop Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/shared/searchTypes.ts`

- [ ] **Step 1: Write package and TypeScript configuration**

Create `package.json`:

```json
{
  "name": "everything-desktop-search",
  "version": "0.1.0",
  "private": true,
  "description": "A keyboard-first Everything quick launcher for Windows.",
  "main": "dist/main/main.js",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.node.json && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "electron .",
    "dist": "npm run build && electron-builder --win portable"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "electron": "^36.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "electron-builder": "^26.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  },
  "build": {
    "appId": "local.everything.quicklauncher",
    "productName": "Everything Quick Launcher",
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "directories": {
      "output": "release"
    }
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*.ts", "src/preload.ts", "src/shared/**/*.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false
  },
  server: {
    port: 5173
  }
});
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"]
  }
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Everything Quick Launcher</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

Create `src/shared/searchTypes.ts`:

```ts
export interface SearchResult {
  id: string;
  name: string;
  path: string;
  directory: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 3: Verify scaffold builds fail only because source entry files are missing**

Run: `npm run build`

Expected: FAIL with missing `src/main/main.ts` or renderer entry files. This confirms tooling is wired before app code exists.

- [ ] **Step 4: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html src/shared/searchTypes.ts
git commit -m "chore: scaffold Electron React project"
```

## Task 2: Everything Search Adapter

**Files:**
- Create: `src/main/everythingSearch.ts`
- Test: `tests/main/everythingSearch.test.ts`
- Modify: `tests/setup.ts`

- [ ] **Step 1: Write failing tests for parsing and search behavior**

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `tests/main/everythingSearch.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { parseEverythingOutput, searchEverything } from "../../src/main/everythingSearch";

describe("parseEverythingOutput", () => {
  it("turns absolute paths into displayable search results", () => {
    const output = [
      "D:\\Everything\\Everything.exe",
      "C:\\Users\\bfs\\Desktop\\notes.md"
    ].join("\r\n");

    expect(parseEverythingOutput(output)).toEqual([
      {
        id: "D:\\Everything\\Everything.exe",
        name: "Everything.exe",
        path: "D:\\Everything\\Everything.exe",
        directory: "D:\\Everything"
      },
      {
        id: "C:\\Users\\bfs\\Desktop\\notes.md",
        name: "notes.md",
        path: "C:\\Users\\bfs\\Desktop\\notes.md",
        directory: "C:\\Users\\bfs\\Desktop"
      }
    ]);
  });

  it("ignores blank output lines", () => {
    expect(parseEverythingOutput("\r\nD:\\file.txt\r\n\r\n")).toHaveLength(1);
  });
});

describe("searchEverything", () => {
  it("returns an empty result without spawning when query is blank", async () => {
    const execFile = vi.fn();
    const startEverything = vi.fn();

    const response = await searchEverything("   ", { execFile, startEverything });

    expect(response).toEqual({ results: [] });
    expect(execFile).not.toHaveBeenCalled();
  });

  it("calls es.exe with a result limit and parses stdout", async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: "D:\\file.txt\r\n", stderr: "" });
    const startEverything = vi.fn();

    const response = await searchEverything("file", { execFile, startEverything });

    expect(execFile).toHaveBeenCalledWith("D:\\Everything\\es.exe", ["-n", "50", "file"]);
    expect(response.results[0]?.path).toBe("D:\\file.txt");
  });

  it("starts Everything and retries once when IPC is not found", async () => {
    const execFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("Error 8: Everything IPC not found"))
      .mockResolvedValueOnce({ stdout: "D:\\again.txt\r\n", stderr: "" });
    const startEverything = vi.fn().mockResolvedValue(undefined);

    const response = await searchEverything("again", { execFile, startEverything });

    expect(startEverything).toHaveBeenCalledOnce();
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(response.results[0]?.name).toBe("again.txt");
  });

  it("returns a short error when the command fails after retry", async () => {
    const execFile = vi.fn().mockRejectedValue(new Error("boom"));
    const startEverything = vi.fn();

    const response = await searchEverything("x", { execFile, startEverything });

    expect(response).toEqual({ results: [], error: "Everything 搜索失败：boom" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/everythingSearch.test.ts`

Expected: FAIL because `src/main/everythingSearch.ts` does not exist.

- [ ] **Step 3: Implement Everything adapter**

Create `src/main/everythingSearch.ts`:

```ts
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SearchResponse, SearchResult } from "../shared/searchTypes.js";

const execFilePromise = promisify(execFileCallback);
const ES_PATH = "D:\\Everything\\es.exe";
const EVERYTHING_PATH = "D:\\Everything\\Everything.exe";

type ExecFile = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
type StartEverything = () => Promise<void>;

interface SearchDeps {
  execFile?: ExecFile;
  startEverything?: StartEverything;
}

export function parseEverythingOutput(output: string): SearchResult[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => ({
      id: filePath,
      name: path.win32.basename(filePath),
      path: filePath,
      directory: path.win32.dirname(filePath)
    }));
}

async function defaultExecFile(file: string, args: string[]) {
  const { stdout, stderr } = await execFilePromise(file, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  return { stdout, stderr };
}

async function defaultStartEverything() {
  await execFilePromise(EVERYTHING_PATH, [], { windowsHide: true });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEverythingIpcError(error: unknown): boolean {
  return messageFromError(error).includes("Everything IPC not found");
}

export async function searchEverything(query: string, deps: SearchDeps = {}): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const execFile = deps.execFile ?? defaultExecFile;
  const startEverything = deps.startEverything ?? defaultStartEverything;
  const args = ["-n", "50", trimmed];

  try {
    const { stdout } = await execFile(ES_PATH, args);
    return { results: parseEverythingOutput(stdout) };
  } catch (firstError) {
    if (isEverythingIpcError(firstError)) {
      try {
        await startEverything();
        const { stdout } = await execFile(ES_PATH, args);
        return { results: parseEverythingOutput(stdout) };
      } catch (retryError) {
        return { results: [], error: `Everything 搜索失败：${messageFromError(retryError)}` };
      }
    }

    return { results: [], error: `Everything 搜索失败：${messageFromError(firstError)}` };
  }
}
```

- [ ] **Step 4: Run tests to verify adapter passes**

Run: `npm test -- tests/main/everythingSearch.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit adapter**

```bash
git add src/main/everythingSearch.ts tests/main/everythingSearch.test.ts tests/setup.ts
git commit -m "feat: add Everything search adapter"
```

## Task 3: Hotkey State Machine

**Files:**
- Create: `src/main/hotkeyDetector.ts`
- Test: `tests/main/hotkeyDetector.test.ts`

- [ ] **Step 1: Write failing tests for double Ctrl detection**

Create `tests/main/hotkeyDetector.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDoubleCtrlDetector } from "../../src/main/hotkeyDetector";

describe("createDoubleCtrlDetector", () => {
  it("does not trigger on the first Ctrl press", () => {
    const detector = createDoubleCtrlDetector(350);

    expect(detector.record("Control", 1000)).toBe(false);
  });

  it("triggers when Ctrl is pressed twice within the threshold", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1250)).toBe(true);
  });

  it("does not trigger when the second Ctrl press is too late", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1500)).toBe(false);
  });

  it("resets after a successful double press", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);
    expect(detector.record("Control", 1100)).toBe(true);

    expect(detector.record("Control", 1200)).toBe(false);
  });

  it("ignores non-Ctrl keys", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("A", 1100)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/hotkeyDetector.test.ts`

Expected: FAIL because `src/main/hotkeyDetector.ts` does not exist.

- [ ] **Step 3: Implement detector**

Create `src/main/hotkeyDetector.ts`:

```ts
export interface DoubleCtrlDetector {
  record(key: string, timestamp: number): boolean;
}

export function createDoubleCtrlDetector(thresholdMs = 350): DoubleCtrlDetector {
  let lastCtrlAt = 0;

  return {
    record(key: string, timestamp: number) {
      if (key !== "Control") {
        return false;
      }

      const isDoublePress = lastCtrlAt > 0 && timestamp - lastCtrlAt <= thresholdMs;
      lastCtrlAt = isDoublePress ? 0 : timestamp;
      return isDoublePress;
    }
  };
}
```

- [ ] **Step 4: Run tests to verify detector passes**

Run: `npm test -- tests/main/hotkeyDetector.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit detector**

```bash
git add src/main/hotkeyDetector.ts tests/main/hotkeyDetector.test.ts
git commit -m "feat: add double Ctrl detector"
```

## Task 4: Main Process, IPC, and File Actions

**Files:**
- Create: `src/main/fileActions.ts`
- Create: `src/main/ipc.ts`
- Create: `src/main/main.ts`
- Create: `src/preload.ts`
- Test: `tests/main/fileActions.test.ts`

- [ ] **Step 1: Write failing tests for file action helpers**

Create `tests/main/fileActions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createFileActions } from "../../src/main/fileActions";

describe("createFileActions", () => {
  it("opens the selected file path", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    await actions.open("D:\\file.txt");

    expect(openPath).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("reveals the selected file path", () => {
    const openPath = vi.fn();
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    actions.reveal("D:\\file.txt");

    expect(showItemInFolder).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("copies the selected file path", () => {
    const openPath = vi.fn();
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    actions.copyPath("D:\\file.txt");

    expect(writeText).toHaveBeenCalledWith("D:\\file.txt");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/fileActions.test.ts`

Expected: FAIL because `src/main/fileActions.ts` does not exist.

- [ ] **Step 3: Implement file action helpers**

Create `src/main/fileActions.ts`:

```ts
import { clipboard, shell } from "electron";

interface FileActionDeps {
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;
  writeText: (text: string) => void;
}

export function createFileActions(deps: FileActionDeps) {
  return {
    open(path: string) {
      return deps.openPath(path);
    },
    reveal(path: string) {
      deps.showItemInFolder(path);
    },
    copyPath(path: string) {
      deps.writeText(path);
    }
  };
}

export const fileActions = createFileActions({
  openPath: shell.openPath,
  showItemInFolder: shell.showItemInFolder,
  writeText: clipboard.writeText
});
```

- [ ] **Step 4: Create IPC bridge and main process**

Create `src/main/ipc.ts`:

```ts
import { ipcMain } from "electron";
import { searchEverything } from "./everythingSearch.js";
import { fileActions } from "./fileActions.js";

export function registerIpc() {
  ipcMain.handle("search", (_event, query: string) => searchEverything(query));
  ipcMain.handle("open-path", async (_event, path: string) => fileActions.open(path));
  ipcMain.handle("reveal-path", (_event, path: string) => fileActions.reveal(path));
  ipcMain.handle("copy-path", (_event, path: string) => fileActions.copyPath(path));
}
```

Create `src/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { SearchResponse } from "./shared/searchTypes.js";

const api = {
  search(query: string): Promise<SearchResponse> {
    return ipcRenderer.invoke("search", query);
  },
  openPath(path: string): Promise<string> {
    return ipcRenderer.invoke("open-path", path);
  },
  revealPath(path: string): Promise<void> {
    return ipcRenderer.invoke("reveal-path", path);
  },
  copyPath(path: string): Promise<void> {
    return ipcRenderer.invoke("copy-path", path);
  },
  onWindowShown(callback: () => void) {
    ipcRenderer.on("window-shown", callback);
  }
};

contextBridge.exposeInMainWorld("everythingSearch", api);

export type EverythingSearchApi = typeof api;
```

Create `src/main/main.ts`:

```ts
import { BrowserWindow, app, globalShortcut, screen } from "electron";
import path from "node:path";
import { createDoubleCtrlDetector } from "./hotkeyDetector.js";
import { registerIpc } from "./ipc.js";

let mainWindow: BrowserWindow | null = null;

function positionWindow(window: BrowserWindow) {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  window.setBounds({
    width: 720,
    height: 420,
    x: Math.round((width - 720) / 2),
    y: 120
  });
}

function toggleWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  positionWindow(mainWindow);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("window-shown");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist/renderer/index.html"));
  }
}

function registerShortcuts() {
  const detector = createDoubleCtrlDetector();
  globalShortcut.register("Control", () => {
    if (detector.record("Control", Date.now())) {
      toggleWindow();
    }
  });
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  registerShortcuts();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/main/fileActions.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: FAIL because renderer files do not exist yet, with no errors in main modules.

- [ ] **Step 6: Commit main process**

```bash
git add src/main/fileActions.ts src/main/ipc.ts src/main/main.ts src/preload.ts tests/main/fileActions.test.ts
git commit -m "feat: wire Electron main process"
```

## Task 5: Renderer Search UI

**Files:**
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/styles.css`
- Create: `src/renderer/global.d.ts`
- Test: `tests/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Create `tests/renderer/App.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/renderer/App";

const api = {
  search: vi.fn(),
  openPath: vi.fn(),
  revealPath: vi.fn(),
  copyPath: vi.fn(),
  onWindowShown: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  window.everythingSearch = api;
  api.search.mockResolvedValue({
    results: [
      { id: "D:\\a.txt", name: "a.txt", path: "D:\\a.txt", directory: "D:\\" },
      { id: "D:\\b.txt", name: "b.txt", path: "D:\\b.txt", directory: "D:\\" }
    ]
  });
});

describe("App", () => {
  it("searches and renders results as the user types", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("txt"));
    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("D:\\a.txt")).toBeInTheDocument();
  });

  it("opens the selected result with Enter", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("moves selection with arrow keys", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("b.txt");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\b.txt");
  });

  it("reveals the selected result with Alt+Enter", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter", altKey: true });

    expect(api.revealPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("copies the selected path with Ctrl+C", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    expect(api.copyPath).toHaveBeenCalledWith("D:\\a.txt");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/renderer/App.test.tsx`

Expected: FAIL because `src/renderer/App.tsx` does not exist.

- [ ] **Step 3: Implement renderer API typing**

Create `src/renderer/global.d.ts`:

```ts
import type { EverythingSearchApi } from "../preload";

declare global {
  interface Window {
    everythingSearch: EverythingSearchApi;
  }
}

export {};
```

- [ ] **Step 4: Implement renderer app**

Create `src/renderer/App.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "../shared/searchTypes";
import "./styles.css";

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);

  return debounced;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 120);

  const selected = useMemo(() => results[selectedIndex], [results, selectedIndex]);

  useEffect(() => {
    window.everythingSearch.onWindowShown(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      setIsLoading(Boolean(debouncedQuery.trim()));
      const response = await window.everythingSearch.search(debouncedQuery);
      if (!active) {
        return;
      }
      setResults(response.results);
      setSelectedIndex(0);
      setError(response.error ?? "");
      setIsLoading(false);
    }

    runSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter" && selected) {
        event.preventDefault();
        if (event.altKey) {
          window.everythingSearch.revealPath(selected.path);
        } else {
          window.everythingSearch.openPath(selected.path);
        }
      }
      if (event.key.toLowerCase() === "c" && event.ctrlKey && selected) {
        event.preventDefault();
        window.everythingSearch.copyPath(selected.path);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [results.length, selected]);

  return (
    <main className="launcher">
      <section className="panel">
        <div className="searchLine">
          <span className="searchIcon">⌕</span>
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索文件、文件夹或路径"
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <kbd>Ctrl Ctrl</kbd>
        </div>

        <div className="results" role="listbox" aria-label="搜索结果">
          {error ? <div className="state">{error}</div> : null}
          {!error && !isLoading && query.trim() && results.length === 0 ? (
            <div className="state">没有结果</div>
          ) : null}
          {!error && !query.trim() ? <div className="state">输入关键词开始搜索</div> : null}
          {results.map((result, index) => (
            <div
              className={index === selectedIndex ? "result selected" : "result"}
              key={result.id}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div>
                <div className="name">{result.name}</div>
                <div className="path">{result.path}</div>
              </div>
              <div className="action">{index === selectedIndex ? "Enter" : ""}</div>
            </div>
          ))}
        </div>

        <footer>
          <span>↑↓ 选择 · Enter 打开 · Alt+Enter 定位 · Ctrl+C 复制</span>
          <span>{isLoading ? "搜索中" : `${results.length} 项`}</span>
        </footer>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Implement renderer bootstrap and styles**

Create `src/renderer/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `src/renderer/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: transparent;
  color: #111827;
  font-family: "Segoe UI", system-ui, sans-serif;
}

.launcher {
  min-height: 100vh;
  padding: 18px;
  background: transparent;
}

.panel {
  overflow: hidden;
  width: 100%;
  height: calc(100vh - 36px);
  border: 1px solid #d7dce3;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(28, 39, 54, 0.22);
}

.searchLine {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #edf0f3;
}

.searchIcon {
  color: #566070;
  font-size: 20px;
}

input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #111827;
  font: inherit;
  font-size: 18px;
}

kbd {
  flex: 0 0 auto;
  border: 1px solid #e1e5ea;
  border-radius: 5px;
  padding: 3px 6px;
  color: #7b8493;
  font-size: 12px;
}

.results {
  height: calc(100% - 98px);
  overflow: hidden;
  padding: 8px 0;
}

.state {
  padding: 28px 16px;
  color: #7b8493;
  text-align: center;
}

.result {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  min-height: 56px;
  padding: 9px 16px;
}

.result.selected {
  background: #eef6ff;
}

.name {
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path {
  overflow: hidden;
  margin-top: 2px;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action {
  color: #667085;
  font-size: 12px;
}

footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #edf0f3;
  padding: 9px 14px;
  background: #fafbfc;
  color: #7b8493;
  font-size: 12px;
}
```

- [ ] **Step 6: Run renderer tests**

Run: `npm test -- tests/renderer/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit renderer**

```bash
git add src/renderer tests/renderer
git commit -m "feat: add launcher renderer"
```

## Task 6: Window Hide and Final Verification

**Files:**
- Modify: `src/preload.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/App.tsx`
- Test: `tests/renderer/App.test.tsx`

- [ ] **Step 1: Add failing test for Esc hiding**

Append to `tests/renderer/App.test.tsx`:

```tsx
it("hides the window with Escape", () => {
  api.hideWindow = vi.fn();
  render(<App />);

  fireEvent.keyDown(window, { key: "Escape" });

  expect(api.hideWindow).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderer/App.test.tsx`

Expected: FAIL because `hideWindow` does not exist or is not called.

- [ ] **Step 3: Wire hide-window IPC**

Modify `src/preload.ts` to add:

```ts
hideWindow(): Promise<void> {
  return ipcRenderer.invoke("hide-window");
}
```

Modify `src/main/ipc.ts`:

```ts
import { BrowserWindow, ipcMain } from "electron";
import { searchEverything } from "./everythingSearch.js";
import { fileActions } from "./fileActions.js";

export function registerIpc() {
  ipcMain.handle("search", (_event, query: string) => searchEverything(query));
  ipcMain.handle("open-path", async (_event, path: string) => fileActions.open(path));
  ipcMain.handle("reveal-path", (_event, path: string) => fileActions.reveal(path));
  ipcMain.handle("copy-path", (_event, path: string) => fileActions.copyPath(path));
  ipcMain.handle("hide-window", (event) => BrowserWindow.fromWebContents(event.sender)?.hide());
}
```

Modify the key handler in `src/renderer/App.tsx` to include:

```ts
if (event.key === "Escape") {
  event.preventDefault();
  window.everythingSearch.hideWindow();
}
```

- [ ] **Step 4: Run all tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS and `dist` contains main, preload, and renderer output.

- [ ] **Step 5: Manual smoke test**

Run: `npm start`

Expected:
- App starts hidden.
- Double Ctrl shows the search window.
- Double Ctrl hides it.
- Double Ctrl shows it again.
- Esc hides it.
- Searching `Everything.exe` shows results from `D:\Everything\es.exe`.
- Enter opens the selected item.
- Alt+Enter reveals the selected item in Explorer.
- Ctrl+C copies the selected path.

- [ ] **Step 6: Commit final integration**

```bash
git add src/preload.ts src/main/ipc.ts src/renderer/App.tsx tests/renderer/App.test.tsx
git commit -m "feat: support hiding launcher with Escape"
```

## Self-Review

- Spec coverage: The plan covers the single floating UI, double Ctrl toggle, Esc hide, Everything CLI search, result display, Enter open, Alt+Enter reveal, Ctrl+C copy, IPC error handling, and final smoke testing.
- Placeholder scan: No incomplete markers or unspecified steps are present.
- Type consistency: `SearchResult`, `SearchResponse`, and `EverythingSearchApi` are defined once and referenced consistently by main, preload, renderer, and tests.
