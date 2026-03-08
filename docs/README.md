# vmoscloud-h5-webrtc-sdk Documentation

This documentation reflects the current customized SDK implementation in this repository.

## Table of contents

1. [Quick Start](./01-quick-start.md)
2. [Configuration](./02-configuration.md)
3. [Callbacks](./03-callbacks.md)
4. [API Reference](./04-api-reference.md)
5. [Apply Token API](./06-apply-token.md)
6. [Architecture](./07-architecture.md)
7. [Source Walkthrough](./08-source-walkthrough.md)
8. [Message Protocol](./09-message-protocol.md)
9. [Maintenance Checklist](./10-maintenance-checklist.md)
10. [HTML Example](./examples/html.md)
11. [React Example](./examples/react.md)
12. [Vue 3 Example](./examples/vue3.md)
13. [Troubleshooting](./05-troubleshooting.md)

## Important notes

- This is a browser SDK and requires `window`/`document`.
- `ArmcloudEngine` requests RTC apply-token during construction.
- Always call `stop()` on page/component teardown.
