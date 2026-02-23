# ArmCloud H5 WebRTC SDK (by VMOSCloud)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)

A professional WebRTC-based SDK for interacting with **ArmCloud Phone** and **Cloud App** streaming services. Developed by **ArmCloud** (a subsidiary of **VMOSCloud**), this SDK enables developers to build low-latency clients with full remote control capabilities.

---

## 🚀 Key Features

- **🎮 Remote Control**: High-precision touch events, gestures, and keyboard mapping (Home, Back, Menu).
- **📡 Dual WebRTC Stack**:
  - **Huoshan RTC**: Optimized for ByteDance's Volcengine infrastructure.
  - **Standard WebRTC**: Fallback/Custom implementation using WebSocket and PeerConnection.
- **🌍 Virtual Sensors**:
  - **GPS Simulation**: Set custom longitude and latitude.
  - **Device Orientation**: Rotate the remote screen (Portrait/Landscape).
  - **Shake Simulation**: Trigger "shake to refresh" or other motion-based features.
- **🛠 System Integration**:
  - **ADB Support**: Execute ADB commands directly from the browser.
  - **Clipboard**: Synchronize text between local and remote devices.
  - **Media**: Microphone and Camera stream injection.
- **📸 Screen Capture**: Take high-quality screenshots and save them locally or to a remote server.
- **👥 Group Control**: Advanced logic to manage multiple cloud instances simultaneously.

---

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- `npm` or `pnpm`

### Installation & Build

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Build the production bundles (CommonJS, ESM, and Global):
```bash
npm run build
```

The output will be generated in the `dist/` directory:
- `dist/index.cjs.js`: Node.js/CommonJS bundle.
- `dist/index.es.js`: Modern bundler (React/Vue/Vite) bundle.
- `dist/index.global.js`: Browser direct include (Global: `ArmcloudRtc`).

---

## 💻 Usage Example

```typescript
import { ArmcloudEngine, KEYTYPE } from 'vmoscloud-h5-webrtc-sdk';

const engine = new ArmcloudEngine({
  container: document.getElementById('vmos-container'),
  token: 'YOUR_ACCESS_TOKEN',
  onMessage: (data) => console.log('Cloud Data:', data),
  onConnect: () => console.log('Connected to Cloud Phone!'),
});

// Initialize the engine
engine.init();

// Simulate Home button click
engine.sendKeypad(KEYTYPE.EYHOMEPAGE);

// Set GPS Location (New York)
engine.setGPS(-74.006, 40.7128);

// Take a screenshot
engine.saveScreenShotToLocal();
```

---

## 🏗 Project Structure

- `src/lib/pkg.ts`: Core `ArmcloudEngine` class.
- `src/lib/huoshanRtc.ts`: Volcengine RTC implementation.
- `src/lib/webRtc.ts`: Standard WebRTC implementation.
- `src/lib/enums.ts`: Action types and key constants.
- `src/lib/utils.ts`: Internal helper functions.

---

## 🔗 Resources

- **Official Documentation**: [VMOS Cloud H5 Example](https://cloud.vmoscloud.com/vmoscloud/doc/en/client/h5/example.html#sample-code)
- **Technology Stack**: WebRTC, TypeScript, Rollup, Axios, CryptoJS.

---

## ⚖ Disclaimer

This project is a reverse-engineered/recovered version of the VMOS Cloud H5 SDK, extracted from source maps for educational and research purposes. All original intellectual property and trademarks belong to **VMOS Cloud**. Use this SDK in compliance with their terms of service.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
