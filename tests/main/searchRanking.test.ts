import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/shared/searchTypes";
import { rankSearchResults } from "../../src/main/searchRanking";
import { parseSearchQuery } from "../../src/main/searchQuery";

function result(filePath: string, overrides: Partial<SearchResult> = {}): SearchResult {
  const parts = filePath.split("\\");
  return {
    id: filePath,
    name: parts.at(-1) ?? filePath,
    path: filePath,
    directory: parts.slice(0, -1).join("\\"),
    ...overrides
  };
}

function sectionOf(item: SearchResult) {
  return (item as SearchResult & { section?: "history" | "apps" | "files" }).section;
}

describe("rankSearchResults", () => {
  it("keeps default searches app-first instead of size-first", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\qq.iso", { size: 5_000_000_000 }),
        result("C:\\Program Files\\Tencent\\QQ\\QQ.exe", { size: 50_000_000 })
      ],
      parseSearchQuery("qq")
    );

    expect(ranked[0]?.path).toBe("C:\\Program Files\\Tencent\\QQ\\QQ.exe");
  });

  it("boosts recently used apps above same-name large files in default searches", () => {
    const appPath = "D:\\Tools\\QQ\\QQ.exe";
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\qq-backup.zip", { size: 9_000_000_000 }),
        result(appPath, { size: 40_000_000 })
      ],
      parseSearchQuery("qq"),
      {
        [appPath]: {
          openCount: 7,
          lastOpenedAt: Date.parse("2026-05-03T10:00:00.000Z")
        }
      },
      Date.parse("2026-05-03T10:30:00.000Z")
    );

    expect(ranked[0]?.path).toBe(appPath);
  });

  it("puts previously opened matching results before ordinary files in default searches", () => {
    const historyPath = "D:\\Projects\\qq-notes.txt";
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\qq.iso", { size: 5_000_000_000 }),
        result(historyPath, { size: 10_000 })
      ],
      parseSearchQuery("qq"),
      {
        [historyPath]: {
          openCount: 3,
          lastOpenedAt: Date.parse("2026-05-03T10:00:00.000Z")
        }
      },
      Date.parse("2026-05-03T10:30:00.000Z")
    );

    expect(ranked.map((item) => ({ path: item.path, section: sectionOf(item) }))).toEqual([
      { path: historyPath, section: "history" },
      { path: "D:\\Downloads\\qq.iso", section: "files" }
    ]);
  });

  it("puts previously opened results before apps and ordinary files in default searches", () => {
    const historyPath = "D:\\Projects\\qq-notes.txt";
    const exePath = "D:\\Tools\\QQ\\QQ.exe";
    const ranked = rankSearchResults(
      [
        result(historyPath, { size: 10_000 }),
        result(exePath, { size: 50_000_000 }),
        result("D:\\Downloads\\qq.iso", { size: 5_000_000_000 })
      ],
      parseSearchQuery("qq"),
      {
        [historyPath]: {
          openCount: 9,
          lastOpenedAt: Date.parse("2026-05-03T10:00:00.000Z")
        }
      },
      Date.parse("2026-05-03T10:30:00.000Z")
    );

    expect(ranked.map((item) => ({ path: item.path, section: sectionOf(item) }))).toEqual([
      { path: historyPath, section: "history" },
      { path: exePath, section: "apps" },
      { path: "D:\\Downloads\\qq.iso", section: "files" }
    ]);
  });

  it("uses Everything run metadata to rank recent searches", () => {
    const older = result("D:\\Tools\\QQ\\QQ.exe", {
      runCount: 20,
      dateRun: Date.parse("2026-05-01T10:00:00.000Z")
    } as Partial<SearchResult>);
    const newer = result("D:\\Tools\\QQBeta\\QQBeta.exe", {
      runCount: 1,
      dateRun: Date.parse("2026-05-03T10:00:00.000Z")
    } as Partial<SearchResult>);

    const ranked = rankSearchResults([older, newer], parseSearchQuery("recent: qq"));

    expect(ranked.map((item) => item.path)).toEqual(["D:\\Tools\\QQBeta\\QQBeta.exe", "D:\\Tools\\QQ\\QQ.exe"]);
  });

  it("labels default search results by apps and files sections", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\qq.txt"),
        result("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ.lnk")
      ],
      parseSearchQuery("qq")
    );

    expect(ranked.map((item) => ({ path: item.path, section: sectionOf(item) }))).toEqual([
      { path: "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ.lnk", section: "apps" },
      { path: "D:\\Downloads\\qq.txt", section: "files" }
    ]);
  });

  it("sorts file-filtered results from largest to smallest", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\a-small-qq.txt", { size: 10 }),
        result("D:\\z-large-qq.txt", { size: 30 }),
        result("D:\\medium-qq.txt", { size: 20 })
      ],
      parseSearchQuery("file: qq")
    );

    expect(ranked.map((item) => item.path)).toEqual([
      "D:\\z-large-qq.txt",
      "D:\\medium-qq.txt",
      "D:\\a-small-qq.txt"
    ]);
    expect(ranked.map(sectionOf)).toEqual([undefined, undefined, undefined]);
  });

  it("sorts path-constrained results from largest to smallest", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\a-small-qq.txt", { size: 10 }),
        result("D:\\Downloads\\z-large-qq.txt", { size: 30 }),
        result("D:\\Downloads\\medium-qq.txt", { size: 20 })
      ],
      parseSearchQuery("D:\\Downloads qq")
    );

    expect(ranked.map((item) => item.path)).toEqual([
      "D:\\Downloads\\z-large-qq.txt",
      "D:\\Downloads\\medium-qq.txt",
      "D:\\Downloads\\a-small-qq.txt"
    ]);
  });

  it("prefers executable application entries over shortcuts and same-name folders", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\QQ"),
        result("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ.lnk"),
        result("C:\\Program Files\\Tencent\\QQ\\QQ.exe")
      ],
      parseSearchQuery("qq")
    );

    expect(ranked.map((item) => item.path)).toEqual([
      "C:\\Program Files\\Tencent\\QQ\\QQ.exe",
      "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\QQ.lnk",
      "D:\\QQ"
    ]);
    expect(ranked[0]?.kind).toBe("app");
  });

  it("scores Chinese names through full pinyin aliases", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Images\\weixin.png"),
        result("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\微信.lnk")
      ],
      parseSearchQuery("weixin")
    );

    expect(ranked[0]?.path).toBe("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\微信.lnk");
  });

  it("scores Chinese names through pinyin initials", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Images\\wx.png"),
        result("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\微信.lnk")
      ],
      parseSearchQuery("wx")
    );

    expect(ranked[0]?.path).toBe("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\微信.lnk");
  });

  it("prefers exact filename match over prefix, contains, and path-only matches", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Projects\\qq-music.exe"),
        result("D:\\Projects\\my-qq-note.txt"),
        result("D:\\qq\\notes.txt"),
        result("D:\\Projects\\qq")
      ],
      parseSearchQuery("qq")
    );

    expect(ranked.map((item) => item.path)).toEqual([
      "D:\\Projects\\qq-music.exe",
      "D:\\Projects\\qq",
      "D:\\Projects\\my-qq-note.txt",
      "D:\\qq\\notes.txt"
    ]);
  });

  it("prefers executable files over non-executable file results", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Downloads\\weixin.png"),
        result("D:\\Weixin\\Weixin.exe"),
        result("D:\\Downloads\\weixin.js")
      ],
      parseSearchQuery("weixin")
    );

    expect(ranked[0]?.path).toBe("D:\\Weixin\\Weixin.exe");
  });

  it("prefers executable files over matching shortcut entries", () => {
    const ranked = rankSearchResults(
      [
        result("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Weixin.lnk"),
        result("D:\\Weixin\\Weixin.exe")
      ],
      parseSearchQuery("weixin")
    );

    expect(ranked[0]?.path).toBe("D:\\Weixin\\Weixin.exe");
  });

  it("prefers common installed app executables over same-name folders", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Foo"),
        result("C:\\Program Files\\Foo\\FooLauncher.exe")
      ],
      parseSearchQuery("foo")
    );

    expect(ranked[0]?.path).toBe("C:\\Program Files\\Foo\\FooLauncher.exe");
    expect(ranked[0]?.kind).toBe("app");
  });

  it("prefers user-local installed app executables over same-name folders", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Bar"),
        result("C:\\Users\\bfs\\AppData\\Local\\Programs\\Bar\\Bar.exe")
      ],
      parseSearchQuery("bar")
    );

    expect(ranked[0]?.path).toBe("C:\\Users\\bfs\\AppData\\Local\\Programs\\Bar\\Bar.exe");
  });

  it("prefers executable results even when they are outside common app locations", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Foo"),
        result("C:\\Users\\bfs\\AppData\\Local\\Temp\\FooTool.exe")
      ],
      parseSearchQuery("foo")
    );

    expect(ranked[0]?.path).toBe("C:\\Users\\bfs\\AppData\\Local\\Temp\\FooTool.exe");
  });

  it("boosts recently and frequently opened results", () => {
    const ranked = rankSearchResults(
      [
        result("D:\\Projects\\qq-alpha.txt"),
        result("D:\\Projects\\qq-beta.txt")
      ],
      parseSearchQuery("qq"),
      {
        "D:\\Projects\\qq-beta.txt": {
          openCount: 8,
          lastOpenedAt: Date.parse("2026-05-03T10:00:00.000Z")
        }
      },
      Date.parse("2026-05-03T10:30:00.000Z")
    );

    expect(ranked[0]?.path).toBe("D:\\Projects\\qq-beta.txt");
  });

  it("demotes noisy folders such as node_modules, recycle bin, and temp", () => {
    const ranked = rankSearchResults(
      [
        result("C:\\Users\\bfs\\Desktop\\qq.txt"),
        result("C:\\Users\\bfs\\AppData\\Local\\Temp\\qq.txt"),
        result("D:\\$RECYCLE.BIN\\qq.txt"),
        result("D:\\repo\\node_modules\\qq.txt")
      ],
      parseSearchQuery("qq")
    );

    expect(ranked.at(-1)?.path).toBe("D:\\repo\\node_modules\\qq.txt");
    expect(ranked[0]?.path).toBe("C:\\Users\\bfs\\Desktop\\qq.txt");
  });
});
