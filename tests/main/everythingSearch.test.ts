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
