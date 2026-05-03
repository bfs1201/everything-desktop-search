# Everything 快速启动器实现计划

> **给 agentic workers：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行。本计划使用 checkbox（`- [ ]`）追踪进度。

**目标：** 开发一款 Windows 桌面快速搜索应用，通过双击 Ctrl 呼出居中搜索框，直接调用 Everything CLI 搜索，并支持键盘优先的文件操作。

**架构：** 使用 Electron 负责桌面窗口、全局快捷键、进程调用、剪贴板和文件动作。使用 React + TypeScript 构建渲染进程 UI。将 Everything 搜索适配器、双击 Ctrl 检测、文件动作和 IPC 分成小模块，便于测试和维护。

**技术栈：** Electron、Vite、React、TypeScript、Vitest、Testing Library、`electron-builder`。

---

## 文件结构

- `package.json`：项目脚本、依赖和打包配置。
- `tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`、`vitest.config.ts`：TypeScript、Vite 和测试配置。
- `index.html`：渲染进程挂载入口。
- `src/shared/searchTypes.ts`：主进程和渲染进程共享的搜索类型。
- `src/main/everythingSearch.ts`：调用 `D:\Everything\es.exe`，解析输出，处理 Everything 未运行时的重试。
- `src/main/hotkeyDetector.ts`：纯函数式双击 Ctrl 检测状态机。
- `src/main/fileActions.ts`：打开文件、打开所在位置、复制路径。
- `src/main/ipc.ts`：注册渲染进程到主进程的 IPC 调用。
- `src/main/main.ts`：Electron 应用启动、窗口生命周期和快捷键注册。
- `src/preload.ts`：安全暴露给渲染进程的 API。
- `src/renderer/App.tsx`：搜索框 UI 和键盘交互。
- `src/renderer/main.tsx`：React 启动入口。
- `src/renderer/styles.css`：浮动单框样式。
- `tests/main/*`、`tests/renderer/*`：主进程和渲染进程测试。

## 任务 1：搭建桌面项目骨架

**文件：**
- 新建：`package.json`
- 新建：`tsconfig.json`
- 新建：`tsconfig.node.json`
- 新建：`vite.config.ts`
- 新建：`vitest.config.ts`
- 新建：`index.html`
- 新建：`src/shared/searchTypes.ts`

- [ ] **步骤 1：写入项目配置**

创建 `package.json`：

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

创建 `tsconfig.json`：

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

创建 `tsconfig.node.json`：

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

创建 `vite.config.ts`：

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

创建 `vitest.config.ts`：

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

创建 `index.html`：

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

创建 `src/shared/searchTypes.ts`：

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

- [ ] **步骤 2：安装依赖**

运行：

```powershell
npm install
```

预期：依赖安装成功，生成 `package-lock.json`。

- [ ] **步骤 3：验证骨架状态**

运行：

```powershell
npm run build
```

预期：构建失败，原因是主进程或渲染进程入口文件尚未创建。这说明工具链已接通，但业务代码还未开始。

- [ ] **步骤 4：提交项目骨架**

```powershell
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html src/shared/searchTypes.ts
git commit -m "chore: scaffold Electron React project"
```

## 任务 2：实现 Everything 搜索适配器

**文件：**
- 新建：`src/main/everythingSearch.ts`
- 新建测试：`tests/main/everythingSearch.test.ts`
- 新建：`tests/setup.ts`

- [ ] **步骤 1：先写失败测试**

创建 `tests/setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
```

创建 `tests/main/everythingSearch.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { parseEverythingOutput, searchEverything } from "../../src/main/everythingSearch";

describe("parseEverythingOutput", () => {
  it("将绝对路径转换为可展示的搜索结果", () => {
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

  it("忽略空行", () => {
    expect(parseEverythingOutput("\r\nD:\\file.txt\r\n\r\n")).toHaveLength(1);
  });
});

describe("searchEverything", () => {
  it("查询为空时不启动进程并返回空结果", async () => {
    const execFile = vi.fn();
    const startEverything = vi.fn();

    const response = await searchEverything("   ", { execFile, startEverything });

    expect(response).toEqual({ results: [] });
    expect(execFile).not.toHaveBeenCalled();
  });

  it("调用 es.exe 并解析 stdout", async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: "D:\\file.txt\r\n", stderr: "" });
    const startEverything = vi.fn();

    const response = await searchEverything("file", { execFile, startEverything });

    expect(execFile).toHaveBeenCalledWith("D:\\Everything\\es.exe", ["-n", "50", "file"]);
    expect(response.results[0]?.path).toBe("D:\\file.txt");
  });

  it("Everything IPC 不可用时启动 Everything 并重试一次", async () => {
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

  it("重试后仍失败时返回简短错误", async () => {
    const execFile = vi.fn().mockRejectedValue(new Error("boom"));
    const startEverything = vi.fn();

    const response = await searchEverything("x", { execFile, startEverything });

    expect(response).toEqual({ results: [], error: "Everything 搜索失败：boom" });
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
npm test -- tests/main/everythingSearch.test.ts
```

预期：失败，因为 `src/main/everythingSearch.ts` 尚不存在。

- [ ] **步骤 3：实现搜索适配器**

创建 `src/main/everythingSearch.ts`：

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

- [ ] **步骤 4：运行测试确认通过**

```powershell
npm test -- tests/main/everythingSearch.test.ts
```

预期：通过。

- [ ] **步骤 5：提交搜索适配器**

```powershell
git add src/main/everythingSearch.ts tests/main/everythingSearch.test.ts tests/setup.ts
git commit -m "feat: add Everything search adapter"
```

## 任务 3：实现双击 Ctrl 检测

**文件：**
- 新建：`src/main/hotkeyDetector.ts`
- 新建测试：`tests/main/hotkeyDetector.test.ts`

- [ ] **步骤 1：先写失败测试**

创建 `tests/main/hotkeyDetector.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { createDoubleCtrlDetector } from "../../src/main/hotkeyDetector";

describe("createDoubleCtrlDetector", () => {
  it("第一次按 Ctrl 不触发", () => {
    const detector = createDoubleCtrlDetector(350);

    expect(detector.record("Control", 1000)).toBe(false);
  });

  it("阈值内连续按两次 Ctrl 会触发", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1250)).toBe(true);
  });

  it("第二次 Ctrl 超时则不触发", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1500)).toBe(false);
  });

  it("触发后会重置状态", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);
    expect(detector.record("Control", 1100)).toBe(true);

    expect(detector.record("Control", 1200)).toBe(false);
  });

  it("忽略非 Ctrl 按键", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("A", 1100)).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
npm test -- tests/main/hotkeyDetector.test.ts
```

预期：失败，因为 `src/main/hotkeyDetector.ts` 尚不存在。

- [ ] **步骤 3：实现检测器**

创建 `src/main/hotkeyDetector.ts`：

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

- [ ] **步骤 4：运行测试确认通过**

```powershell
npm test -- tests/main/hotkeyDetector.test.ts
```

预期：通过。

- [ ] **步骤 5：提交检测器**

```powershell
git add src/main/hotkeyDetector.ts tests/main/hotkeyDetector.test.ts
git commit -m "feat: add double Ctrl detector"
```

## 任务 4：实现主进程、IPC 和文件动作

**文件：**
- 新建：`src/main/fileActions.ts`
- 新建：`src/main/ipc.ts`
- 新建：`src/main/main.ts`
- 新建：`src/preload.ts`
- 新建测试：`tests/main/fileActions.test.ts`

- [ ] **步骤 1：先写文件动作失败测试**

创建 `tests/main/fileActions.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { createFileActions } from "../../src/main/fileActions";

describe("createFileActions", () => {
  it("打开选中的文件路径", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    await actions.open("D:\\file.txt");

    expect(openPath).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("在资源管理器中定位选中的文件", () => {
    const openPath = vi.fn();
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    actions.reveal("D:\\file.txt");

    expect(showItemInFolder).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("复制选中文件路径", () => {
    const openPath = vi.fn();
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText });

    actions.copyPath("D:\\file.txt");

    expect(writeText).toHaveBeenCalledWith("D:\\file.txt");
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
npm test -- tests/main/fileActions.test.ts
```

预期：失败，因为 `src/main/fileActions.ts` 尚不存在。

- [ ] **步骤 3：实现文件动作**

创建 `src/main/fileActions.ts`：

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

- [ ] **步骤 4：实现 IPC、preload 和主进程**

创建 `src/main/ipc.ts`：

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

创建 `src/preload.ts`：

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

创建 `src/main/main.ts`：

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

- [ ] **步骤 5：运行测试和构建检查**

```powershell
npm test -- tests/main/fileActions.test.ts
npm run build
```

预期：文件动作测试通过；构建仍可能因为渲染进程文件尚不存在而失败，但主进程相关类型错误应已解决。

- [ ] **步骤 6：提交主进程能力**

```powershell
git add src/main/fileActions.ts src/main/ipc.ts src/main/main.ts src/preload.ts tests/main/fileActions.test.ts
git commit -m "feat: wire Electron main process"
```

## 任务 5：实现搜索框 UI

**文件：**
- 新建：`src/renderer/App.tsx`
- 新建：`src/renderer/main.tsx`
- 新建：`src/renderer/styles.css`
- 新建：`src/renderer/global.d.ts`
- 新建测试：`tests/renderer/App.test.tsx`

- [ ] **步骤 1：先写渲染进程失败测试**

创建 `tests/renderer/App.test.tsx`：

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
  it("用户输入时搜索并渲染结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("txt"));
    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("D:\\a.txt")).toBeInTheDocument();
  });

  it("按 Enter 打开当前选中结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("方向键可以移动选中项", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("b.txt");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\b.txt");
  });

  it("Alt+Enter 打开选中结果所在位置", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter", altKey: true });

    expect(api.revealPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("Ctrl+C 复制选中结果路径", async () => {
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

- [ ] **步骤 2：运行测试确认失败**

```powershell
npm test -- tests/renderer/App.test.tsx
```

预期：失败，因为 `src/renderer/App.tsx` 尚不存在。

- [ ] **步骤 3：实现渲染进程 API 类型**

创建 `src/renderer/global.d.ts`：

```ts
import type { EverythingSearchApi } from "../preload";

declare global {
  interface Window {
    everythingSearch: EverythingSearchApi;
  }
}

export {};
```

- [ ] **步骤 4：实现搜索框组件**

创建 `src/renderer/App.tsx`：

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

- [ ] **步骤 5：实现启动入口和样式**

创建 `src/renderer/main.tsx`：

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

创建 `src/renderer/styles.css`：

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

- [ ] **步骤 6：运行渲染进程测试**

```powershell
npm test -- tests/renderer/App.test.tsx
```

预期：通过。

- [ ] **步骤 7：提交搜索框 UI**

```powershell
git add src/renderer tests/renderer
git commit -m "feat: add launcher renderer"
```

## 任务 6：实现 Esc 隐藏窗口并做最终验证

**文件：**
- 修改：`src/preload.ts`
- 修改：`src/main/ipc.ts`
- 修改：`src/renderer/App.tsx`
- 修改测试：`tests/renderer/App.test.tsx`

- [ ] **步骤 1：追加 Esc 隐藏窗口的失败测试**

在 `tests/renderer/App.test.tsx` 末尾追加：

```tsx
it("按 Escape 隐藏窗口", () => {
  api.hideWindow = vi.fn();
  render(<App />);

  fireEvent.keyDown(window, { key: "Escape" });

  expect(api.hideWindow).toHaveBeenCalledOnce();
});
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
npm test -- tests/renderer/App.test.tsx
```

预期：失败，因为 `hideWindow` 还不存在或尚未被调用。

- [ ] **步骤 3：接通隐藏窗口 IPC**

在 `src/preload.ts` 的 API 中加入：

```ts
hideWindow(): Promise<void> {
  return ipcRenderer.invoke("hide-window");
}
```

将 `src/main/ipc.ts` 修改为：

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

在 `src/renderer/App.tsx` 的键盘处理函数中加入：

```ts
if (event.key === "Escape") {
  event.preventDefault();
  window.everythingSearch.hideWindow();
}
```

- [ ] **步骤 4：运行全部测试和构建**

```powershell
npm test
npm run build
```

预期：测试全部通过，构建成功，`dist` 中包含主进程、preload 和渲染进程输出。

- [ ] **步骤 5：手动冒烟测试**

运行：

```powershell
npm start
```

预期：

- 应用启动后默认隐藏。
- 双击 Ctrl 显示搜索窗口。
- 再次双击 Ctrl 隐藏窗口。
- 再次双击 Ctrl 可重新显示窗口。
- Esc 隐藏窗口。
- 搜索 `Everything.exe` 可以展示来自 `D:\Everything\es.exe` 的结果。
- Enter 打开选中项。
- Alt+Enter 在资源管理器中定位选中项。
- Ctrl+C 复制选中项路径。

- [ ] **步骤 6：提交最终集成**

```powershell
git add src/preload.ts src/main/ipc.ts src/renderer/App.tsx tests/renderer/App.test.tsx
git commit -m "feat: support hiding launcher with Escape"
```

## 自检

- 需求覆盖：计划覆盖单框浮窗、双击 Ctrl 显示/隐藏、Esc 隐藏、Everything CLI 搜索、结果展示、Enter 打开、Alt+Enter 定位、Ctrl+C 复制、错误处理和最终冒烟测试。
- 占位检查：没有未完成标记或含糊步骤。
- 类型一致性：`SearchResult`、`SearchResponse`、`EverythingSearchApi` 在主进程、preload、渲染进程和测试中保持一致。
