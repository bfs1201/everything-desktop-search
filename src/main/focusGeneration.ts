let focusGeneration = 0;

export function advanceFocusGeneration() {
  focusGeneration += 1;
  return focusGeneration;
}

export function getFocusGeneration() {
  return focusGeneration;
}

export function isCurrentFocusGeneration(expectedFocusGeneration: number) {
  return expectedFocusGeneration === focusGeneration;
}
