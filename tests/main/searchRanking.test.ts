import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/shared/searchTypes";
import { rankSearchResults } from "../../src/main/searchRanking";
import { parseSearchQuery } from "../../src/main/searchQuery";

function result(filePath: string): SearchResult {
  const parts = filePath.split("\\");
  return {
    id: filePath,
    name: parts.at(-1) ?? filePath,
    path: filePath,
    directory: parts.slice(0, -1).join("\\")
  };
}

describe("rankSearchResults", () => {
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
      "D:\\Projects\\qq",
      "D:\\Projects\\qq-music.exe",
      "D:\\Projects\\my-qq-note.txt",
      "D:\\qq\\notes.txt"
    ]);
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
