interface FileActionDeps {
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;
  writeText: (text: string) => void;
  recordOpenedPath?: (path: string) => Promise<void>;
}

export function createFileActions(deps: FileActionDeps) {
  return {
    async open(path: string) {
      const error = await deps.openPath(path);
      if (!error) {
        await deps.recordOpenedPath?.(path);
      }
      return error;
    },
    openWithoutRecording(path: string) {
      return deps.openPath(path);
    },
    async recordSuccessfulOpen(path: string) {
      try {
        await deps.recordOpenedPath?.(path);
      } catch {
        // Opening has already succeeded; usage history must not alter that result.
      }
    },
    reveal(path: string) {
      deps.showItemInFolder(path);
    },
    copyPath(path: string) {
      deps.writeText(path);
    }
  };
}
