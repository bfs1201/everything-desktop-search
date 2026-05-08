import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const exposedApis = new Map<string, unknown>();
const ipcListeners = new Map<string, (...args: unknown[]) => void>();

const contextBridge = {
  exposeInMainWorld: vi.fn((name: string, api: unknown) => {
    exposedApis.set(name, api);
  })
};

const ipcRenderer = {
  invoke: vi.fn(),
  on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    ipcListeners.set(channel, listener);
  })
};

vi.mock("electron", () => ({
  contextBridge,
  ipcRenderer
}));

function loadPreload() {
  const source = readFileSync(join(process.cwd(), "src/preload.cts"), "utf-8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const sandbox = {
    exports: {},
    require(id: string) {
      if (id === "electron") {
        return { contextBridge, ipcRenderer };
      }
      return {};
    }
  };

  vm.runInNewContext(output, sandbox, { filename: "preload.cjs" });
}

describe("preload api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exposedApis.clear();
    ipcListeners.clear();
    loadPreload();
  });

  it("does not expose ipc renderer events to window lifecycle callbacks", () => {
    const api = exposedApis.get("everythingSearch") as {
      onWindowWillShow(callback: () => void): void;
      onWindowHidden(callback: () => void): void;
      onWindowShown(callback: () => void): void;
    };
    const event = { sender: "main" };
    const callbacks = {
      willShow: vi.fn(),
      hidden: vi.fn(),
      shown: vi.fn()
    };

    api.onWindowWillShow(callbacks.willShow);
    api.onWindowHidden(callbacks.hidden);
    api.onWindowShown(callbacks.shown);
    ipcListeners.get("window-will-show")?.(event);
    ipcListeners.get("window-hidden")?.(event);
    ipcListeners.get("window-shown")?.(event);

    expect(callbacks.willShow).toHaveBeenCalledWith();
    expect(callbacks.hidden).toHaveBeenCalledWith();
    expect(callbacks.shown).toHaveBeenCalledWith();
  });
});
