import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("vite config", () => {
  it("uses relative asset paths for Electron loadFile", () => {
    const source = readFileSync(join(process.cwd(), "vite.config.ts"), "utf-8");

    expect(source).toContain('base: "./"');
  });

  it("excludes nested worktrees from test discovery", () => {
    const source = readFileSync(join(process.cwd(), "vitest.config.ts"), "utf-8");

    expect(source).toContain('".worktrees/**"');
  });
});
