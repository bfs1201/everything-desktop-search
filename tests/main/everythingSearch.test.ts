import { describe, expect, it, vi } from "vitest";
import { decodeEverythingOutput, parseEverythingOutput, searchEverything } from "../../src/main/everythingSearch";

describe("decodeEverythingOutput", () => {
  it("decodes GB18030 output from Everything CLI", () => {
    const output = Buffer.from([
      0x43, 0x3a, 0x5c, 0x55, 0x73, 0x65, 0x72, 0x73, 0x5c, 0x62, 0x66, 0x73, 0x5c,
      0xd7, 0xc0, 0xc3, 0xe6, 0x5c, 0xb1, 0xcf, 0xd2, 0xb5, 0xc9, 0xe8, 0xbc, 0xc6
    ]);

    expect(decodeEverythingOutput(output)).toBe("C:\\Users\\bfs\\桌面\\毕业设计");
  });
});

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

  it("decodes Chinese paths returned as GB18030 bytes", async () => {
    const stdout = Buffer.from([
      0x43, 0x3a, 0x5c, 0x55, 0x73, 0x65, 0x72, 0x73, 0x5c, 0x62, 0x66, 0x73, 0x5c,
      0xd7, 0xc0, 0xc3, 0xe6, 0x5c, 0xb1, 0xcf, 0xd2, 0xb5, 0xc9, 0xe8, 0xbc, 0xc6,
      0x2e, 0x70, 0x64, 0x66, 0x0d, 0x0a
    ]);
    const execFile = vi.fn().mockResolvedValue({ stdout, stderr: Buffer.alloc(0) });
    const startEverything = vi.fn();

    const response = await searchEverything("毕业设计", { execFile, startEverything });

    expect(response.results[0]).toMatchObject({
      name: "毕业设计.pdf",
      path: "C:\\Users\\bfs\\桌面\\毕业设计.pdf"
    });
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
