import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("preload config", () => {
  it("loads a CommonJS preload file in Electron", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");

    expect(mainSource).toContain('"dist/preload.cjs"');
  });
});
