import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("window focus regression", () => {
  it("restores focusability before showing the launcher window", () => {
    const mainSource = readFileSync(join(process.cwd(), "src/main/main.ts"), "utf-8");
    const showFlow = mainSource.slice(
      mainSource.indexOf("async function showAndFocusWindow"),
      mainSource.indexOf("async function createWindow")
    );

    expect(showFlow).toContain("mainWindow.setFocusable(true)");
    expect(showFlow.indexOf("mainWindow.setFocusable(true)")).toBeLessThan(showFlow.indexOf("mainWindow.show()"));
  });
});
