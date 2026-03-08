# 06 - Apply Token API

`ArmcloudEngine` internally calls apply-token before creating RTC session.

Source of truth in code:
- `src/engine/engine.ts`
- Endpoint path: `/rtc/open/room/applyToken`

## Endpoint

```http
POST {baseUrl}/rtc/open/room/applyToken
```

If `baseUrl` is missing, SDK fallback is:

```text
https://openapi.armcloud.net/rtc/open/room/applyToken
```

## Request headers

- `Content-Type: application/json`
- `token: <STS_TOKEN>`

## Request body

```json
{
  "sdkTerminal": "h5",
  "userId": "<deviceInfo.userId>",
  "padCode": "<deviceInfo.padCode>",
  "uuid": "<local uuid>",
  "expire": 86400,
  "videoStream": {
    "resolution": 15,
    "frameRate": 4,
    "bitrate": 7
  }
}
```

## Response (expected)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "streamType": 1,
    "appId": "...",
    "roomCode": "...",
    "roomToken": "..."
  }
}
```

SDK behavior:

- If `code === 200`: SDK stores `appId`, `roomCode`, `roomToken`, then creates `HuoshanRTC`.
- Otherwise: SDK triggers `onInit({ code, msg, streamType })` with failure.

## Direct call example (frontend)

```ts
const url = `${baseUrl}/rtc/open/room/applyToken`;

const payload = {
  sdkTerminal: "h5",
  userId,
  padCode,
  uuid,
  expire: 86400,
  videoStream: {
    resolution: 15,
    frameRate: 4,
    bitrate: 7,
  },
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    token: stsToken,
  },
  body: JSON.stringify(payload),
});

const json = await res.json();
```

## Backend proxy recommendation

For production, prefer calling apply-token from backend (or secure BFF):

- Frontend sends only session intent (`padCode`, desired stream profile, etc.)
- Backend injects trusted token/header and calls apply-token
- Backend returns only necessary RTC fields to frontend

This avoids exposing sensitive token-management logic in browser code.

## Common errors

- `401/403`: invalid or expired `token` header
- `4xx`: invalid `padCode`/`userId`
- non-`200` response code: check `msg` and region/baseUrl mismatch

## Minimal checklist

1. Ensure `baseUrl` matches your account region.
2. Ensure `token` is fresh and valid.
3. Ensure `padCode` and `userId` are correct.
4. Send `videoStream` fields as numbers.
