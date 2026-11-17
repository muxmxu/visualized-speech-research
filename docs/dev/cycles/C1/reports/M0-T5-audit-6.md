# M0-T5 Mechanical Audit 6

Verdict: FAIL. Queued HTTP 500 cleanup is covered, but a network-level PCM request rejection is swallowed without a visible error.

## Finding

At `frontend/src/audio/playback.ts:99-105`, the optional `failed` callback catch handles every rejection from `request()`. For an HTTP error response, `frontend/src/api/client.ts:15-18` displays the response notification before rejecting, so the queued-load callback can stop the matching playback generation and return `null` without an unhandled rejection. For a network failure where `fetch()` rejects at `client.ts:14`, there is no HTTP response and no notification; the same catch still invokes cleanup and returns `null`, swallowing the error. Since the queued Promise is detached, no App-level `run()` handler reports it. This violates the requirement to preserve visible failure handling and C2's no-swallow rule for this request path.

The generation and queue-version guards do prevent a stale failed request from stopping a newer playback. The finding is specifically the missing visible error for a network-level queued request rejection. Required action: preserve cleanup for the failed generation while ensuring a fetch rejection reaches a user-visible error path without duplicating the HTTP 4xx/5xx notification, and add a real-browser network-rejection regression.

## Evidence

- The Worker fix6 log records old-code RED for the later queued HTTP 500 regression, fixed GREEN behavior, typecheck, playback Vitest, lint, production build, diff check, and all 10 T5 Playwright tests passing.
- I independently ran `npm run typecheck` and `npm test -- --run tests/playback.test.ts`; both passed.
- I independently ran the fixed-base rule checker; it returned `0 FAIL, 2 REVIEW`: `C1 frontend/src/audio/playback.ts:102` and `C1 frontend/src/audio/playback.ts:192`.
- Suggested disposition for the REVIEW at `playback.ts:102`: defect. Although the catch performs needed cleanup after a notified HTTP error, it also consumes a network `fetch()` rejection and returns `null` without notification, so the whole catch is not covered by V1#1.
- Suggested disposition for the REVIEW at `playback.ts:192`: V1#1. This catch cleans up a rejected active play attempt and rethrows the error to the caller's visible error handler.
- `git diff --check` passed, the protected-path/config diff was empty, the task write set contains only the five declared T5 paths, and no `vsr-e2e-*` temp directory or task-owned browser/server process remained.
- Production-hook exclusion is unchanged from audit 5: `App.tsx` and `testHook.ts` hashes match audit 5, and the fix6 Worker log records a passing production build.
- I did not rerun lint, build, or the full browser suite after source inspection because the network-error finding blocks this tree; their fix6 Worker results above are recorded as Worker evidence, not independent audit runs.
- The new network-rejection behavior is source-audited; the fix6 browser regression injects HTTP 500, not a rejected `fetch()`.

## Final file hashes

- `frontend/src/App.tsx`: `260246d9e1e281f7514b25a14e32761b7bdefa59004799689233e1cfd2a94211`
- `frontend/src/audio/playback.ts`: `69a2a230d3795526e520a0a1ddd5882f9deb58b48931a5a466983450d0598823`
- `frontend/src/audio/testHook.ts`: `17cf527b99c93edc682efe5b1bb2607135756716df363af4cbfa21ddc7d012e7`
- `frontend/tests/playback.test.ts`: `d8e887e4f382133b962acc3f872e5a6b82af12d3fc49307b2c316d7655d00dea`
- `frontend/tests/e2e/m0-playback.spec.ts`: `48e98296223f64f7dc32bcdb0740f45b06e665d020179640de229648b6fb0472`
