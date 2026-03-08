# 05 - Troubleshooting

## 1) `onInit` failed

Common causes:

- Expired STS token
- Wrong `baseUrl` region
- Invalid `padCode`/`userId`

Check:

- Print full `onInit` payload
- Verify token freshness from your backend

## 2) No video rendered

Check:

- `viewId` exists in DOM
- Container has non-zero width/height
- `start()` is called after `onInit` success

## 3) Autoplay blocked

- Register `onAutoplayFailed`
- Trigger start/play from user gesture (button click)

## 4) React duplicate connect behavior

- Create SDK in `useEffect`, not during render
- Cleanup with `await sdk.stop()` in effect return
- Re-init only after previous instance is stopped

## 5) Input/gesture issues

- Verify `disableContextMenu`
- Verify `keyboard` mode (`pad` / `local`)
- Ensure no overlay blocks pointer events

## 6) AK/SK security

- Do not expose AK/SK in production frontends
- Frontend should receive short-lived STS token from backend
- For local testing, use `.env.local` and never commit secrets

## 7) Large bundle size

Vendor RTC is heavy. Consider:

- Lazy-loading SDK by route
- Dynamic import for cloud-phone page
- Splitting app bundle by feature
