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
    reveal(path: string) {
      deps.showItemInFolder(path);
    },
    copyPath(path: string) {
      deps.writeText(path);
    }
  };
}
