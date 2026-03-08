# 08 - Source Walkthrough

This is a full walkthrough of source modules and their responsibilities.

## `src/index.ts`

- Re-exports:
  - `ArmcloudEngine`
  - `KEYTYPE`

## `src/engine/engine.ts` (`ArmcloudEngine`)

Main responsibilities:

- Public API surface consumed by app code.
- Parse and normalize init params into `RTCOptions`.
- Build callback registry with safe defaults.
- Browser-runtime guard (`window`/`document` required).
- Call apply-token endpoint.
- Construct `HuoshanRTC` after apply-token success.
- Delegate all feature methods to internal RTC instance.

Important behaviors:

- Apply-token is done during construction.
- `stop()` aborts pending initialization request and stops RTC session.
- Public methods are wrappers around RTC/controller methods.

## `src/rtc/huoshanRtc.ts` (`HuoshanRTC`)

Main responsibilities:

- Session-level state holder.
- DOM container ownership (`VideoElement`, screenshot overlay, input element).
- Controller composition root.
- Message sending helper and group-control branching.
- Session analytics/log tracking.

Important state:

- `engine`, `groupEngine`, `groupRtc`
- `isStarted`, `isFirstRotate`, `rotation`, `remoteResolution`
- cached DOM metrics (`videoDomRect`, `videoDomWidth`, `videoDomHeight`)

## `src/rtc/huoshanGroupRtc.ts`

Main responsibilities:

- Separate RTC behavior for group-control sessions.
- Group room/user message handling.
- Join/leave and group callback propagation.

## Controllers

### `ConnectionController`

- Creates vendor engine and sets vendor parameters.
- Joins room and binds connect-level callbacks.
- Initializes runtime listeners + input/touch bindings.
- Handles stop/teardown cleanup:
  - timers
  - observers
  - DOM listeners
  - RTC engine listeners
  - RTC engine destruction

### `MessageController`

- Handles room/user message channels.
- Parses callback protocol payloads.
- Triggers app callbacks for resolution/audio/video/injection/device events.
- Handles first-frame, publish-stream, input-state, and clipboard flows.

### `UIController`

- Controls rendered dimensions and rotation transforms.
- Handles screenshot overlay actions.
- Sends UI update/screenshot commands to remote side.

### `InputController`

- Text/clipboard send APIs.
- Group input variants.
- Keyboard mode switching.
- Input state query trigger.

### `StreamController`

- Subscribe/unsubscribe/mute/unmute operations.
- Pause/resume all subscribed stream.
- Stream profile command sending.
- Video injection start/stop message.

### `DeviceController`

- Device command channel:
  - navigation keys
  - volume keys
  - GPS injection
  - ADB command
  - shake sensor emulation
  - app uninstall and equipment info queries

## Handlers and Features

### `TouchInputHandler`

- Converts mouse/touch/wheel events to remote gesture protocol.
- Applies rotation-aware coordinate transforms.
- Caches listeners and supports explicit unbind.

### `features/input.ts`

- Creates hidden input element for IME bridge.
- Handles composition/input/key events and sends remote input messages.

### `features/screenshot.ts`

- Canvas overlay manager for screenshot draw/show/hide/rotate/resize/destroy.

### `ui/videoElement.ts`

- Creates stable video container structure.
- Tracks injected `<video>` node with MutationObserver.
- Manages optional DOM event wrapper registrations.

## Core and Utility

### `core/types.ts`

- Public and internal types:
  - init params
  - callback contracts
  - RTC options
  - shared payload contracts

### `core/constants.ts`, `core/error.ts`

- SDK constants and error/return codes.

### `utils/*`

- Type checks, buffer conversions, and input/coordinate helpers.

## Vendor binding

- `src/vendor/volcengine-rtc` is the upstream RTC SDK binding and bundled artifacts.
- App source should avoid editing vendor files unless explicitly required by upgrade strategy.
