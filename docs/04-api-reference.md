# 04 - API Reference

The following methods are public on `ArmcloudEngine`.

## Session

- `isSupported(): Promise<boolean | undefined>`
- `start(isGroupControl?: boolean, pads?: string[]): void`
- `stop(): Promise<void>`
- `destroyEngine(): void`

## Audio/Video

- `startPlay(): void`
- `muted(): void`
- `unmuted(): void`
- `subscribeStream(mediaType?: number): Promise<void>`
- `unsubscribeStream(mediaType?: number): Promise<void>`
- `pauseAllSubscribedStream(mediaType?: number): void`
- `resumeAllSubscribedStream(mediaType?: number): void`
- `setStreamConfig(config: CustomDefinition): void`

## Input/Clipboard

- `sendInputString(inputStr: string): void`
- `sendInputClipper(inputStr: string): void`
- `sendGroupInputString(pads: string[], strs: string[]): void`
- `sendGroupInputClipper(pads: string[], strs: string[]): void`
- `setKeyboardStyle(keyBoardType: "pad" | "local"): void`
- `saveCloudClipboard(flag: boolean): void`

## Device actions

- `sendCommand(command: string): void`
- `setGPS(longitude: number, latitude: number): void`
- `executeAdbCommand(command: string): void`
- `sendShake(time?: number): void`
- `increaseVolume(): void`
- `decreaseVolume(): void`
- `setPhoneRotation(type: number): void`

## UI/Screenshot

- `setViewSize(width: number, height: number, rotateType?: 0 | 1): void`
- `rotateContainerVideo(type?: 0 | 1): void`
- `setScreenshotRotation(rotation?: number): void`
- `takeScreenshot(rotation?: number): void`
- `resizeScreenshot(width: number, height: number): void`
- `showScreenShot(): void`
- `hideScreenShot(): void`
- `clearScreenShot(): void`
- `saveScreenShotToLocal(): Promise<ImageData | undefined>`
- `saveScreenShotToRemote(): void`

## Group control

- `joinGroupRoom(pads?: string[]): void`
- `kickItOutRoom(pads?: string[]): void`

## Utility

- `setMicrophone(val: boolean): void`
- `setCamera(val: boolean): void`
- `setVideoDeviceId(val: string): void`
- `setAudioDeviceId(val: string): void`
- `setAutoRecycleTime(second: number): void`
- `getAutoRecycleTime(): number | undefined`
- `injectVideoStream(type, options?): void`

## Idempotency notes

- `start()` is guarded against duplicate start.
- `stop()` performs cleanup for observers/listeners/timers.
- Keep one instance per session where possible.
