# vmoscloud-h5-webrtc-sdk Documentation

This documentation reflects the current customized SDK implementation in this repository.

## Table of contents

1. [Quick Start](./01-quick-start.md)
2. [Configuration](./02-configuration.md)
3. [Callbacks](./03-callbacks.md)
4. [API Reference](./04-api-reference.md)
5. [HTML Example](./examples/html.md)
6. [React Example](./examples/react.md)
7. [Vue 3 Example](./examples/vue3.md)
8. [Troubleshooting](./05-troubleshooting.md)

## Important notes

- This is a browser SDK and requires `window`/`document`.
- `ArmcloudEngine` requests RTC apply-token during construction.
- Always call `stop()` on page/component teardown.
