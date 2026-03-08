# 03 - Callbacks

Callback contracts are defined in `src/core/types.ts` (`SDKCallbacks`).

## Core callbacks

- `onInit({ code, msg, streamType })`
- `onConnectSuccess()`
- `onConnectFail({ code, msg })`
- `onErrorMessage(error)`

## Runtime callbacks

- `onRunInformation(info)`
  - may include `videoStats`, `audioStats`, and `latencyInfo`
- `onNetworkQuality(uplinkNetworkQuality, downlinkNetworkQuality)`
- `onRenderedFirstFrame()`
- `onConnectionStateChanged(event)`

## Device/Input callbacks

- `onOutputClipper(data)`
- `onTransparentMsg(msgType, data)`
- `onAdbOutput(data)`
- `onEquipmentInfo(data)`

## Media callbacks

- `onVideoInit(result)` / `onVideoError(error)`
- `onAudioInit(result)` / `onAudioError(error)`
- `onInjectVideoResult(type, result)`

## Rotate/Resolution callbacks

- `onChangeRotate(type, { width, height })`
- `onChangeResolution({ from: { width, height }, to: { width, height } })`

## Group callbacks

- `onGroupControlError({ code, msg })`
- `onUserLeaveOrJoin({ type: "join" | "leave", userInfo })`

## Best practices

- Do not throw inside callbacks.
- Wrap async callback logic with your own `try/catch`.
- Keep callbacks lightweight; move heavy work to app state/store.
