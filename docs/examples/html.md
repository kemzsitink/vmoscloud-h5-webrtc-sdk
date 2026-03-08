# Example - HTML

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SDK HTML Example</title>
    <style>
      #phoneBox { width: 360px; height: 640px; background: #000; }
    </style>
  </head>
  <body>
    <button id="startBtn">Init + Start</button>
    <button id="stopBtn">Stop</button>
    <div id="phoneBox"></div>

    <script src="./dist/index.global.js"></script>
    <script>
      let sdk = null;

      document.getElementById("startBtn").onclick = function () {
        sdk = new ArmcloudRtc.ArmcloudEngine({
          baseUrl: "https://openapi-hk.armcloud.net",
          token: "YOUR_STS_TOKEN",
          viewId: "phoneBox",
          deviceInfo: {
            padCode: "YOUR_PAD_CODE",
            userId: "html_user_" + Date.now(),
            mediaType: 3,
            rotateType: 0,
            keyboard: "pad",
            saveCloudClipboard: true,
            videoStream: { resolution: 15, frameRate: 4, bitrate: 7 },
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
            onConnectFail: ({ code, msg }) => console.error(code, msg),
            onRunInformation: (info) => console.log("stats", info),
          },
        });
      };

      document.getElementById("stopBtn").onclick = async function () {
        if (!sdk) return;
        await sdk.stop();
        sdk = null;
      };
    </script>
  </body>
</html>
```
