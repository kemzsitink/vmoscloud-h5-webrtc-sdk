# vmoscloud-h5-webrtc-sdk

A customized WebRTC SDK for VMOSCloud/ArmCloud browser clients.

This repository contains a refactored TypeScript version focused on:

- stricter typing in app-level code
- cleaner controller separation
- safer lifecycle behavior (`start/stop/destroy`)
- better compatibility with modern React/Vue usage patterns

## Installation

```bash
npm install vmoscloud-h5-webrtc-sdk
```

Local workspace usage:

```bash
npm install ../vmoscloud-h5-webrtc-sdk
```

## Quick Example

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
    onInit: async ({ code }) => {
      if (code !== 0) return;
      const supported = await sdk.isSupported();
      if (!supported) return;
      sdk.start();
    },
    onConnectSuccess: () => console.log("connected"),
    onConnectFail: ({ code, msg }) => console.error(code, msg),
  },
});

// Later
// await sdk.stop();
```

## Documentation

- [Docs index](./docs/README.md)
- [Quick Start](./docs/01-quick-start.md)
- [Configuration](./docs/02-configuration.md)
- [Callbacks](./docs/03-callbacks.md)
- [API Reference](./docs/04-api-reference.md)
- [Apply Token API](./docs/06-apply-token.md)
- [Architecture](./docs/07-architecture.md)
- [Source Walkthrough](./docs/08-source-walkthrough.md)
- [Message Protocol](./docs/09-message-protocol.md)
- [Maintenance Checklist](./docs/10-maintenance-checklist.md)
- Examples:
  - [HTML](./docs/examples/html.md)
  - [React](./docs/examples/react.md)
  - [Vue 3](./docs/examples/vue3.md)
- [Troubleshooting](./docs/05-troubleshooting.md)

## Scripts

```bash
npm run lint
npm run build
```

## Notes

- Browser runtime is required (`window`/`document`).
- Use backend-issued short-lived STS tokens in production.
- Always call `stop()` on page/component teardown.

## License

MIT (see [LICENSE](./LICENSE)).
