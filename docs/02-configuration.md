# 02 - Configuration

`ArmcloudEngine` accepts `SDKInitParams`.

## Required fields

- `baseUrl: string`
- `token: string` (STS token)
- `viewId: string` (container element id)
- `deviceInfo.padCode: string`
- `deviceInfo.userId: string`
- `callbacks: Partial<SDKCallbacks>`

## Common fields

- `retryCount` (default: `2`)
- `retryTime` (default: `2000` ms)
- `enableMicrophone` (default: `true`)
- `enableCamera` (default: `true`)
- `disable` (default: `false`)
- `latencyTarget` (default: `0`)

## deviceInfo fields

- `videoStream.resolution` (default: `12`)
- `videoStream.frameRate` (default: `2`)
- `videoStream.bitrate` (default: `3`)
- `mediaType` (default: `2`)
- `rotateType` (`0` portrait, `1` landscape)
- `keyboard` (`"pad" | "local"`, default: `"pad"`)
- `autoRecoveryTime` (default: `300` seconds)
- `saveCloudClipboard` (default: `true`)
- `disableContextMenu` (default: `false`)

## Full example config

```ts
const params = {
  baseUrl: "https://openapi-hk.armcloud.net",
  token: "YOUR_STS_TOKEN",
  retryCount: 2,
  retryTime: 2000,
  enableMicrophone: true,
  enableCamera: true,
  viewId: "phoneBox",
  deviceInfo: {
    padCode: "AC32010830643",
    userId: `h5_${Date.now()}`,
    autoRecoveryTime: 0,
    mediaType: 3,
    rotateType: 0,
    keyboard: "pad",
    saveCloudClipboard: true,
    videoStream: {
      resolution: 15,
      frameRate: 4,
      bitrate: 7,
    },
  },
  callbacks: {
    onInit: () => {},
    onConnectSuccess: () => {},
    onConnectFail: () => {},
  },
};
```
