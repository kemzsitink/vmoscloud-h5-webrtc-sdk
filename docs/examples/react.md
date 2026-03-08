# Example - React

```tsx
import { useEffect, useRef } from "react";
import { ArmcloudEngine } from "vmoscloud-h5-webrtc-sdk";

export default function CloudPhone() {
  const sdkRef = useRef<ArmcloudEngine | null>(null);

  useEffect(() => {
    const sdk = new ArmcloudEngine({
      baseUrl: "https://openapi-hk.armcloud.net",
      token: "YOUR_STS_TOKEN",
      viewId: "phoneBox",
      deviceInfo: {
        padCode: "YOUR_PAD_CODE",
        userId: `react_${Date.now()}`,
        mediaType: 3,
        rotateType: 0,
        keyboard: "pad",
        saveCloudClipboard: true,
        videoStream: { resolution: 15, frameRate: 4, bitrate: 7 },
      },
      callbacks: {
        onInit: async ({ code }) => {
          if (code !== 0) return;
          const supported = await sdk.isSupported();
          if (!supported) return;
          sdk.start();
        },
        onConnectSuccess: () => console.log("connected"),
      },
    });

    sdkRef.current = sdk;

    return () => {
      void (async () => {
        if (sdkRef.current) {
          await sdkRef.current.stop();
          sdkRef.current = null;
        }
      })();
    };
  }, []);

  return <div id="phoneBox" style={{ width: 360, height: 640, background: "#000" }} />;
}
```
