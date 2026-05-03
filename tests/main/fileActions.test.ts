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
