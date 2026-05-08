let activeResultOpeningCount = 0;

const RESULT_OPENING_BLUR_GRACE_MS = 250;

export function beginResultOpening() {
  activeResultOpeningCount += 1;
}

export function endResultOpening(options: { afterBlurGrace?: boolean } = {}) {
  if (options.afterBlurGrace) {
    setTimeout(() => {
      activeResultOpeningCount = Math.max(0, activeResultOpeningCount - 1);
    }, RESULT_OPENING_BLUR_GRACE_MS);
    return;
  }

  activeResultOpeningCount = Math.max(0, activeResultOpeningCount - 1);
}

export function shouldSuppressFocusRestoreForResultOpening() {
  return activeResultOpeningCount > 0;
}
