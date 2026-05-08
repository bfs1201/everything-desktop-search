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

  it("records usage after a path opens successfully", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const recordOpenedPath = vi.fn().mockResolvedValue(undefined);
    const actions = createFileActions({ openPath, showItemInFolder, writeText, recordOpenedPath });

    await actions.open("D:\\file.txt");

    expect(recordOpenedPath).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("can open a path without waiting for usage recording", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const recordOpenedPath = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText, recordOpenedPath });

    const error = await actions.openWithoutRecording("D:\\file.txt");

    expect(error).toBe("");
    expect(openPath).toHaveBeenCalledWith("D:\\file.txt");
    expect(recordOpenedPath).not.toHaveBeenCalled();
  });

  it("records a successful opened path without changing the open result", async () => {
    const openPath = vi.fn();
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const recordOpenedPath = vi.fn().mockRejectedValue(new Error("history unavailable"));
    const actions = createFileActions({ openPath, showItemInFolder, writeText, recordOpenedPath });

    await expect(actions.recordSuccessfulOpen("D:\\file.txt")).resolves.toBeUndefined();

    expect(recordOpenedPath).toHaveBeenCalledWith("D:\\file.txt");
  });

  it("does not record usage when opening a path fails", async () => {
    const openPath = vi.fn().mockResolvedValue("failed");
    const showItemInFolder = vi.fn();
    const writeText = vi.fn();
    const recordOpenedPath = vi.fn();
    const actions = createFileActions({ openPath, showItemInFolder, writeText, recordOpenedPath });

    await actions.open("D:\\file.txt");

    expect(recordOpenedPath).not.toHaveBeenCalled();
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
