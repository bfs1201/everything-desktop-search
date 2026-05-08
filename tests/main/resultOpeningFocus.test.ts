import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("result opening focus suppression", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps suppression active through the blur grace window", async () => {
    const { beginResultOpening, endResultOpening, shouldSuppressFocusRestoreForResultOpening } = await import(
      "../../src/main/resultOpeningFocus"
    );

    beginResultOpening();
    endResultOpening({ afterBlurGrace: true });

    expect(shouldSuppressFocusRestoreForResultOpening()).toBe(true);
    vi.advanceTimersByTime(249);
    expect(shouldSuppressFocusRestoreForResultOpening()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(shouldSuppressFocusRestoreForResultOpening()).toBe(false);
  });

  it("does not lose pending decrements when another result opens during grace", async () => {
    const { beginResultOpening, endResultOpening, shouldSuppressFocusRestoreForResultOpening } = await import(
      "../../src/main/resultOpeningFocus"
    );

    beginResultOpening();
    endResultOpening({ afterBlurGrace: true });
    beginResultOpening();

    vi.advanceTimersByTime(250);
    expect(shouldSuppressFocusRestoreForResultOpening()).toBe(true);

    endResultOpening({ afterBlurGrace: true });
    vi.advanceTimersByTime(250);
    expect(shouldSuppressFocusRestoreForResultOpening()).toBe(false);
  });
});
