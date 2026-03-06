import type { TouchInfo } from "../core/webrtcType"
export const generateTouchCoord = (): TouchInfo => {
  const params = {
    pressure: Number((0.5 + 0.3 * Math.random()).toFixed(2)),
    size: Number((0.05 + 0.03 * Math.random()).toFixed(2)),
    touchMajor: 80 + Math.floor(130 * Math.random()),
    touchMinor: 0,
    toolMajor: 0,
    toolMinor: 0
  }
  params.touchMinor = params.touchMajor - (15 + Math.floor(30 * Math.random()))
  params.toolMajor = params.touchMajor
  params.toolMinor = params.touchMinor

  return params
}
