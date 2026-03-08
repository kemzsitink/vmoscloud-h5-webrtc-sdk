# 07 - Architecture

This document explains the full runtime architecture of the customized SDK.

## Layered structure

1. **Public API Layer**
- `src/index.ts`
- `src/engine/engine.ts` (`ArmcloudEngine`)

2. **Session / RTC Orchestration**
- `src/rtc/huoshanRtc.ts` (`HuoshanRTC`)
- `src/rtc/huoshanGroupRtc.ts` (group-control RTC)

3. **Controllers (single-responsibility)**
- `src/rtc/controllers/ConnectionController.ts`
- `src/rtc/controllers/MessageController.ts`
- `src/rtc/controllers/UIController.ts`
- `src/rtc/controllers/InputController.ts`
- `src/rtc/controllers/StreamController.ts`
- `src/rtc/controllers/DeviceController.ts`

4. **Input/Event handlers**
- `src/rtc/handlers/TouchInputHandler.ts`

5. **Feature/UI helpers**
- `src/features/input.ts`
- `src/features/screenshot.ts`
- `src/ui/videoElement.ts`

6. **Core contracts / constants / utilities**
- `src/core/types.ts`
- `src/core/constants.ts`
- `src/core/error.ts`
- `src/utils/*`

7. **Vendor binding**
- `src/vendor/volcengine-rtc/*`

## Runtime sequence

1. App creates `new ArmcloudEngine(params)`.
2. Engine validates browser runtime and user params.
3. Engine calls apply-token endpoint.
4. On success, engine builds `HuoshanRTC`.
5. `HuoshanRTC` builds DOM container + controllers + vendor engine.
6. App calls `start()` (usually after `onInit` success).
7. Connection controller joins room and binds runtime callbacks/events.
8. Message/controller layers drive stream subscribe, UI rotate, input state, and feature callbacks.
9. App calls `stop()` on teardown; SDK cleans listeners/observers/timers/engines.

## Design goals in this customized version

- Explicit controller boundaries.
- Safer lifecycle for React/Vue unmount/mount loops.
- Better callback typing for app integration.
- Reduced unsafe dynamic typing in app-level source.

## Current lifecycle hardening

- Duplicate `start()` guard (`isStarted`) to avoid repeated joins.
- `stop()` and `destroyEngine()` include observer/listener cleanup.
- `TouchInputHandler` supports `unbindEvents()` for deterministic teardown.

## Threading and async model

- Browser single-thread event loop.
- Event-driven callback dispatch from vendor RTC and DOM.
- Async actions:
  - apply-token HTTP request
  - join/leave/subscription/publish operations
  - message sending and handling

## Failure model

- Hard failures are surfaced via callbacks (`onInit`, `onConnectFail`, `onErrorMessage`, etc.).
- Runtime/media failures are localized in controllers and forwarded via typed callbacks.
- Cleanup paths are defensive and idempotent where possible.
