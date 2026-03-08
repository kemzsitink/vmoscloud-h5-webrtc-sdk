# 01 - Quick Start

## Install

```bash
npm install vmoscloud-h5-webrtc-sdk
```

For local integration in this workspace:

```bash
npm install ../vmoscloud-h5-webrtc-sdk
```

## Basic usage

```ts
import { ArmcloudEngine } from "vmoscloud-h5-webrtc-sdk";

const sdk = new ArmcloudEngine({
  baseUrl: "https://openapi-hk.armcloud.net",
  token: "YOUR_STS_TOKEN",
  viewId: "phoneBox",
  deviceInfo: {
    padCode: "YOUR_PAD_CODE",
    userId: `web_${Date.now()}`,
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
    onInit: async ({ code, msg }) => {
      console.log("onInit", code, msg);
      if (code !== 0) return;

      const supported = await sdk.isSupported();
      if (!supported) return;

      sdk.start();
    },
    onConnectSuccess: () => console.log("connected"),
    onConnectFail: ({ code, msg }) => console.error("connect fail", code, msg),
  },
});
```

## Stop session

```ts
await sdk.stop();
```

## Lifecycle recommendation

- Create one SDK instance per active session.
- Avoid creating instances inside frequently re-rendered code paths.
- On unmount/route leave, call `stop()`.
