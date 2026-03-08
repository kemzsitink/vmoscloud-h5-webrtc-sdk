# 10 - Maintenance Checklist

Use this checklist when modifying SDK internals.

## A. Lifecycle safety

- [ ] `start()` remains idempotent.
- [ ] `stop()` is safe to call multiple times.
- [ ] teardown clears:
  - [ ] timers
  - [ ] observers
  - [ ] DOM listeners
  - [ ] RTC listeners
  - [ ] RTC engines

## B. Type contracts

- [ ] Public API changes reflected in `src/core/types.ts`.
- [ ] Callback signatures remain consistent with runtime payloads.
- [ ] Avoid `any` / `as any` / unvalidated payload assumptions.

## C. Message protocol

- [ ] New message keys documented in `docs/09-message-protocol.md`.
- [ ] Parsing has guard + fallback path.
- [ ] Backward compatibility preserved for older payloads.

## D. React/Vue integration safety

- [ ] No required side effects during render-time in framework usage.
- [ ] Unmount path always calls `stop()`.
- [ ] No leaked listeners after remount loops.

## E. Performance

- [ ] High-frequency paths avoid unnecessary parse/stringify churn.
- [ ] Touch/input loops avoid heavy allocations where possible.
- [ ] Bundle impact assessed for new dependencies.

## F. Build and verification

Run before merge:

```bash
npm run lint
npx tsc
npm run build
```

## G. Documentation updates

- [ ] `README.md` updated if API behavior changed.
- [ ] Related docs pages updated.
- [ ] Examples still match current API.
