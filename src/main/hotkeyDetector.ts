export interface DoubleCtrlDetector {
  keyDown(key: string, timestamp: number): boolean;
  keyUp(key: string): void;
}

export function createDoubleCtrlDetector(thresholdMs = 350): DoubleCtrlDetector {
  let lastCtrlAt = 0;
  let ctrlIsDown = false;

  return {
    keyDown(key: string, timestamp: number) {
      if (key !== "Control") {
        return false;
      }

      if (ctrlIsDown) {
        return false;
      }

      ctrlIsDown = true;
      const isDoublePress = lastCtrlAt > 0 && timestamp - lastCtrlAt <= thresholdMs;
      lastCtrlAt = isDoublePress ? 0 : timestamp;
      return isDoublePress;
    },
    keyUp(key: string) {
      if (key === "Control") {
        ctrlIsDown = false;
      }
    }
  };
}
