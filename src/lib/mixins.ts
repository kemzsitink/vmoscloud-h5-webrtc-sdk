import type { TouchInfo } from "./types/webrtcType"

// Constants for realistic touch simulation (Android/iOS)
const MIN_PRESSURE = 0.5;
const PRESSURE_RANGE = 0.3;
const MIN_SIZE = 0.05;
const SIZE_RANGE = 0.03;
const BASE_TOUCH_MAJOR = 80;
const TOUCH_MAJOR_RANGE = 130;
const MIN_MINOR_RATIO = 0.7; // touchMinor is 70% to 90% of touchMajor
const MINOR_RATIO_RANGE = 0.2;

export const generateTouchCoord = (): TouchInfo => {
  const pressure = MIN_PRESSURE + PRESSURE_RANGE * Math.random();
  const size = MIN_SIZE + SIZE_RANGE * Math.random();
  const touchMajor = BASE_TOUCH_MAJOR + Math.floor(TOUCH_MAJOR_RANGE * Math.random());
  
  // touchMinor should realistically be smaller than touchMajor
  const ratio = MIN_MINOR_RATIO + MINOR_RATIO_RANGE * Math.random();
  const touchMinor = Math.floor(touchMajor * ratio);

  const params: TouchInfo = {
    pressure,
    size,
    touchMajor,
    touchMinor,
    toolMajor: touchMajor,
    toolMinor: touchMinor
  };

  return params;
}
