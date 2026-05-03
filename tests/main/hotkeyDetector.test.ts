import { describe, expect, it } from "vitest";
import { createDoubleCtrlDetector } from "../../src/main/hotkeyDetector";

describe("createDoubleCtrlDetector", () => {
  it("does not trigger on the first Ctrl press", () => {
    const detector = createDoubleCtrlDetector(350);

    expect(detector.record("Control", 1000)).toBe(false);
  });

  it("triggers when Ctrl is pressed twice within the threshold", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1250)).toBe(true);
  });

  it("does not trigger when the second Ctrl press is too late", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("Control", 1500)).toBe(false);
  });

  it("resets after a successful double press", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);
    expect(detector.record("Control", 1100)).toBe(true);

    expect(detector.record("Control", 1200)).toBe(false);
  });

  it("ignores non-Ctrl keys", () => {
    const detector = createDoubleCtrlDetector(350);

    detector.record("Control", 1000);

    expect(detector.record("A", 1100)).toBe(false);
  });
});
