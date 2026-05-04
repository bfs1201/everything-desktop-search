import { describe, expect, it, vi } from "vitest";
import {
  decodeEverythingOutput,
  loadMoreEverything,
  parseEverythingOutput,
  searchEverything
} from "../../src/main/everythingSearch";

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
  it("uses Everything JSON attributes to classify directories", () => {
    const output = JSON.stringify({
      results: [
        {
          name: "没有扩展名的文件",
          path: "D:\\Downloads",
          attributes: 32,
          size: "2048"
        },
        {
          name: "QQ",
          path: "D:\\",
          attributes: 16
        }
      ]
    });

    expect(parseEverythingOutput(output)).toMatchObject([
      {
        name: "没有扩展名的文件",
        path: "D:\\Downloads\\没有扩展名的文件",
        directory: "D:\\Downloads",
        kind: "file",
        size: 2048
      },
      {
        name: "QQ",
        path: "D:\\QQ",
        directory: "D:\\",
        kind: "folder"
      }
    ]);
  });

  it("parses run count and date columns from Everything JSON rows", () => {
    const output = JSON.stringify({
      results: [
        {
          name: "QQ.exe",
          path: "D:\\Tools\\QQ",
          attributes: 32,
          size: "2048",
          "run-count": "12",
          "date-run": "2026-05-03T10:00:00.000Z",
          "date-modified": "2026-05-02T08:00:00.000Z"
        }
      ]
    });

    expect(parseEverythingOutput(output)).toMatchObject([
      {
        name: "QQ.exe",
        path: "D:\\Tools\\QQ\\QQ.exe",
        runCount: 12,
        dateRun: Date.parse("2026-05-03T10:00:00.000Z"),
        dateModified: Date.parse("2026-05-02T08:00:00.000Z")
      }
    ]);
  });

  it("parses real ES CLI JSON filename rows", () => {
    const output = JSON.stringify([
      {
        filename: "C:\\Users\\bfs\\Desktop\\毕业设计\\",
        attributes: 16
      },
      {
        filename: "C:\\Users\\bfs\\Desktop\\毕业设计.7z",
        attributes: 32
      }
    ]);

    expect(parseEverythingOutput(output)).toMatchObject([
      {
        name: "毕业设计",
        path: "C:\\Users\\bfs\\Desktop\\毕业设计",
        directory: "C:\\Users\\bfs\\Desktop",
        kind: "folder"
      },
      {
        name: "毕业设计.7z",
        path: "C:\\Users\\bfs\\Desktop\\毕业设计.7z",
        directory: "C:\\Users\\bfs\\Desktop",
        kind: "file"
      }
    ]);
  });

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
        directory: "D:\\Everything",
        kind: "app"
      },
      {
        id: "C:\\Users\\bfs\\Desktop\\notes.md",
        name: "notes.md",
        path: "C:\\Users\\bfs\\Desktop\\notes.md",
        directory: "C:\\Users\\bfs\\Desktop",
        kind: "file"
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

  it("runs app candidate and broad searches for default queries", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "D:\\Everything\\Everything.exe\r\n", stderr: "" })
      .mockResolvedValueOnce({
        stdout: Array.from({ length: 60 }, (_, index) => `D:\\file-${index}.txt`).join("\r\n"),
        stderr: ""
      });
    const startEverything = vi.fn();

    const response = await searchEverything("file", { execFile, startEverything });

    expect(execFile).toHaveBeenNthCalledWith(1, "D:\\Everything\\es.exe", [
      "-n",
      "40",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "ext:exe;lnk",
      "file"
    ]);
    expect(execFile).toHaveBeenNthCalledWith(2, "D:\\Everything\\es.exe", [
      "-n",
      "60",
      "-offset",
      "0",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "file"
    ]);
    expect(response).toMatchObject({
      canLoadMore: true,
      nextOffset: 60,
      queryMode: "default"
    });
    expect(response.results.map((item) => item.path)).toContain("D:\\file-0.txt");
  });

  it("loads the next default page with an ES offset and no app candidate query", async () => {
    const execFile = vi.fn().mockResolvedValue({
      stdout: Array.from({ length: 60 }, (_, index) => `D:\\more-${index}.txt`).join("\r\n"),
      stderr: ""
    });

    const response = await loadMoreEverything("qq", 60, { execFile });

    expect(execFile).toHaveBeenCalledOnce();
    expect(execFile).toHaveBeenCalledWith("D:\\Everything\\es.exe", [
      "-n",
      "60",
      "-offset",
      "60",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "qq"
    ]);
    expect(response).toMatchObject({
      canLoadMore: true,
      nextOffset: 120,
      queryMode: "default"
    });
  });

  it("does not enable ES pagination when fewer than a full default page returns", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "D:\\only-one.txt\r\n", stderr: "" });

    const response = await searchEverything("qq", { execFile });

    expect(response.canLoadMore).toBe(false);
    expect(response.nextOffset).toBeUndefined();
  });

  it("passes folder and document filters to Everything CLI", async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const startEverything = vi.fn();

    await searchEverything("folder: qq", { execFile, startEverything });
    await searchEverything("doc: 毕业", { execFile, startEverything });

    expect(execFile).toHaveBeenNthCalledWith(1, "D:\\Everything\\es.exe", [
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "/ad",
      "qq"
    ]);
    expect(execFile).toHaveBeenNthCalledWith(2, "D:\\Everything\\es.exe", [
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "ext:doc;docx;pdf;txt;md;xls;xlsx;ppt;pptx",
      "毕业"
    ]);
  });

  it("runs an additional Chinese candidate search for pinyin-like queries", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "D:\\Images\\weixin.png\r\n", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          results: [{ name: "微信.lnk", path: "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", attributes: 32 }]
        }),
        stderr: ""
      });
    const startEverything = vi.fn();

    const response = await searchEverything("weixin", { execFile, startEverything });

    expect(execFile).toHaveBeenNthCalledWith(3, "D:\\Everything\\es.exe", [
      "-n",
      "300",
      "-json",
      "-attributes",
      "regex:[一-龥]"
    ]);
    expect(response.results.map((item) => item.path)).toContain(
      "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\微信.lnk"
    );
  });

  it("sorts returned results with the V1 ranking strategy", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        stdout: ["D:\\qq\\notes.txt", "D:\\Projects\\my-qq-note.txt", "D:\\Projects\\qq"].join("\r\n"),
        stderr: ""
      });
    const startEverything = vi.fn();

    const response = await searchEverything("qq", { execFile, startEverything });

    expect(response.results.map((item) => item.path)).toEqual([
      "D:\\Projects\\qq",
      "D:\\Projects\\my-qq-note.txt",
      "D:\\qq\\notes.txt"
    ]);
  });

  it("adds icon data URLs when an icon provider is available", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "D:\\Weixin\\Weixin.exe\r\n", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    const startEverything = vi.fn();
    const getFileIcon = vi.fn().mockResolvedValue("data:image/png;base64,abc");

    const response = await searchEverything("weixin", { execFile, startEverything, getFileIcon });

    expect(getFileIcon).toHaveBeenCalledWith("D:\\Weixin\\Weixin.exe");
    expect(response.results[0]).toMatchObject({
      path: "D:\\Weixin\\Weixin.exe",
      iconDataUrl: "data:image/png;base64,abc"
    });
  });

  it("does not request per-path icons for folder results", async () => {
    const execFile = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          results: [{ name: "QQ", path: "D:\\", attributes: 16 }]
        }),
        stderr: ""
      });
    const startEverything = vi.fn();
    const getFileIcon = vi.fn().mockResolvedValue("data:image/png;base64,abc");

    const response = await searchEverything("qq", { execFile, startEverything, getFileIcon });

    expect(getFileIcon).not.toHaveBeenCalled();
    expect(response.results[0]?.kind).toBe("folder");
    expect(response.results[0]).not.toHaveProperty("iconDataUrl");
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
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "D:\\aaaa.txt\r\n", stderr: "" });
    const startEverything = vi.fn().mockResolvedValue(undefined);

    const response = await searchEverything("aaaa", { execFile, startEverything });

    expect(startEverything).toHaveBeenCalledOnce();
    expect(execFile).toHaveBeenCalledTimes(3);
    expect(response.results[0]?.name).toBe("aaaa.txt");
  });

  it("returns a short error when the command fails after retry", async () => {
    const execFile = vi.fn().mockRejectedValue(new Error("boom"));
    const startEverything = vi.fn();

    const response = await searchEverything("x", { execFile, startEverything });

    expect(response).toEqual({ results: [], error: "Everything 搜索失败：boom" });
  });
});
