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
