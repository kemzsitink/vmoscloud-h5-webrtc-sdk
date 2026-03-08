# 09 - Message Protocol

This document describes the high-level message protocol patterns used by the SDK.

## Transport channels

1. **User message channel**
- Point-to-point message to `clientId`.
- Used for control commands, input, media actions, and callbacks.

2. **Room message channel**
- Broadcast-like room-level events.
- Used in some synchronization and group scenarios.

3. **Group room channel**
- Dedicated channel for group-control orchestration.

## Envelope style

A common pattern is:

```json
{
  "touchType": "eventSdk",
  "content": "{\"type\":\"someAction\", ...}"
}
```

`content` is often a serialized JSON string (stringified JSON inside JSON).

## Common `touchType` values

- `eventSdk`
- `input`
- `inputBox`
- `clipboard`
- `equipmentInfo`
- `keystroke`
- `gesture`
- `gestureSwipe`

## Important action patterns

### Input text

- `touchType: inputBox`
- `text: "<user input>"`

### Clipboard sync

- `touchType: clipboard`
- `text: "<clipboard content>"`

### Device command

- `touchType: keystroke`
- `keyCode` according to action

### UI update trigger

- `touchType: eventSdk`
- `content.type: updateUiH5`

### Screenshot remote-save trigger

- `touchType: eventSdk`
- `content.type: localScreenshot`

### Video injection

- `touchType: eventSdk`
- `content.type: startVideoInjection | stopVideoInjection`

## Incoming message keys handled by SDK

Typical parsed keys in room/user handlers:

- `message`
- `refreshUiType`
- `inputState`
- `clipboard`
- `callBack`
- `equipmentInfo`
- `inputAdb`
- `videoAndAudioControl`
- `audioControl`

## Callback protocol (`callBack` key)

`callBack` payload may include:

- `type: definition`
- `type: startVideoInjection`
- `type: stopVideoInjection`

These are mapped to app callbacks like:

- `onChangeResolution`
- `onInjectVideoResult`

## Rotation and coordinates

Touch coordinates are transformed based on:

- local render dimensions
- remote resolution
- current rotate type

This logic lives in `TouchInputHandler`.

## Best practices when extending protocol

1. Keep envelope shape consistent.
2. Add type guards before parsing nested payload.
3. Preserve backward compatibility for existing keys.
4. Version protocol fields if introducing breaking semantics.
