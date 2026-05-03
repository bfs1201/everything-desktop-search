import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadUsageHistory, recordOpenedPath } from "../../src/main/usageHistory";

let tempDir: string;
let historyPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "everything-usage-"));
  historyPath = path.join(tempDir, "usage-history.json");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("usage history", () => {
  it("returns empty history when the file does not exist", async () => {
    await expect(loadUsageHistory(historyPath)).resolves.toEqual({});
  });

  it("returns empty history when the JSON file is corrupted", async () => {
    await writeFile(historyPath, "{ broken", "utf-8");

    await expect(loadUsageHistory(historyPath)).resolves.toEqual({});
  });

  it("increments open count and updates last opened time", async () => {
    const filePath = "D:\\Projects\\qq.txt";
    await recordOpenedPath(filePath, historyPath, Date.parse("2026-05-03T10:00:00.000Z"));
    await recordOpenedPath(filePath, historyPath, Date.parse("2026-05-03T11:00:00.000Z"));

    await expect(loadUsageHistory(historyPath)).resolves.toEqual({
      [filePath]: {
        openCount: 2,
        lastOpenedAt: Date.parse("2026-05-03T11:00:00.000Z")
      }
    });
  });
});
