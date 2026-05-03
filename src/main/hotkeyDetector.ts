export interface DoubleCtrlDetector {
  record(key: string, timestamp: number): boolean;
}

export function createDoubleCtrlDetector(thresholdMs = 350): DoubleCtrlDetector {
  let lastCtrlAt = 0;

  return {
    record(key: string, timestamp: number) {
      if (key !== "Control") {
        return false;
      }

      const isDoublePress = lastCtrlAt > 0 && timestamp - lastCtrlAt <= thresholdMs;
      lastCtrlAt = isDoublePress ? 0 : timestamp;
      return isDoublePress;
    }
  };
}
