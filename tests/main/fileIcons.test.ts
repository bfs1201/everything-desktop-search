import { describe, expect, it, vi } from "vitest";
import { createFileIconResolver } from "../../src/main/fileIcons";

describe("createFileIconResolver", () => {
  it("uses the shortcut target icon for lnk files", async () => {
    const getFileIcon = vi
      .fn()
      .mockResolvedValueOnce("data:image/png;base64,target")
      .mockResolvedValueOnce("data:image/png;base64,shortcut");
    const readShortcutLink = vi.fn().mockReturnValue({ target: "C:\\Program Files\\Tencent\\QQMusic\\QQMusic.exe" });
    const resolveIcon = createFileIconResolver({ getFileIcon, readShortcutLink });

    await expect(resolveIcon("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ音乐.lnk")).resolves.toBe(
      "data:image/png;base64,target"
    );
    expect(readShortcutLink).toHaveBeenCalledWith("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ音乐.lnk");
    expect(getFileIcon).toHaveBeenCalledOnce();
    expect(getFileIcon).toHaveBeenCalledWith("C:\\Program Files\\Tencent\\QQMusic\\QQMusic.exe");
  });

  it("falls back to the shortcut file icon when the target icon cannot be read", async () => {
    const getFileIcon = vi.fn().mockRejectedValueOnce(new Error("missing target")).mockResolvedValueOnce("data:image/png;base64,shortcut");
    const readShortcutLink = vi.fn().mockReturnValue({ target: "C:\\Missing\\App.exe" });
    const resolveIcon = createFileIconResolver({ getFileIcon, readShortcutLink });

    await expect(resolveIcon("C:\\Users\\bfs\\Desktop\\App.lnk")).resolves.toBe("data:image/png;base64,shortcut");
    expect(getFileIcon).toHaveBeenNthCalledWith(1, "C:\\Missing\\App.exe");
    expect(getFileIcon).toHaveBeenNthCalledWith(2, "C:\\Users\\bfs\\Desktop\\App.lnk");
  });

  it("uses the file icon directly for non-shortcut files", async () => {
    const getFileIcon = vi.fn().mockResolvedValue("data:image/png;base64,exe");
    const readShortcutLink = vi.fn();
    const resolveIcon = createFileIconResolver({ getFileIcon, readShortcutLink });

    await expect(resolveIcon("C:\\Program Files\\Everything\\Everything.exe")).resolves.toBe("data:image/png;base64,exe");
    expect(readShortcutLink).not.toHaveBeenCalled();
  });
});
