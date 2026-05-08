import path from "node:path";

interface ShortcutDetails {
  target?: string;
}

interface FileIconDeps {
  getFileIcon: (filePath: string) => Promise<string | undefined>;
  readShortcutLink: (filePath: string) => ShortcutDetails;
}

function isShortcut(filePath: string) {
  return path.win32.extname(filePath).toLowerCase() === ".lnk";
}

export function createFileIconResolver(deps: FileIconDeps) {
  return async function resolveFileIcon(filePath: string) {
    if (!isShortcut(filePath)) {
      return deps.getFileIcon(filePath);
    }

    try {
      const target = deps.readShortcutLink(filePath).target;
      if (target) {
        return await deps.getFileIcon(target);
      }
    } catch {
      // Shortcut targets can be missing or unreadable; fall back to the shortcut file icon.
    }

    return deps.getFileIcon(filePath);
  };
}
