# Example - Vue 3

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ArmcloudEngine } from "vmoscloud-h5-webrtc-sdk";

const sdk = ref<ArmcloudEngine | null>(null);

onMounted(() => {
  const instance = new ArmcloudEngine({
    baseUrl: "https://openapi-hk.armcloud.net",
    token: "YOUR_STS_TOKEN",
    viewId: "phoneBox",
    deviceInfo: {
      padCode: "YOUR_PAD_CODE",
      userId: `vue_${Date.now()}`,
      mediaType: 3,
      rotateType: 0,
      keyboard: "pad",
      saveCloudClipboard: true,
      videoStream: { resolution: 15, frameRate: 4, bitrate: 7 },
    },
    callbacks: {
      onInit: async ({ code }) => {
        if (code !== 0) return;
        const supported = await instance.isSupported();
        if (!supported) return;
        instance.start();
      },
      onConnectSuccess: () => console.log("connected"),
    },
  });

  sdk.value = instance;
});

onBeforeUnmount(async () => {
  if (sdk.value) {
    await sdk.value.stop();
    sdk.value = null;
  }
});
</script>

<template>
  <div id="phoneBox" style="width: 360px; height: 640px; background: #000"></div>
</template>
```
