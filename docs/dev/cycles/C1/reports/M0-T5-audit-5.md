# M0-T5 Mechanical Audit 5

Verdict: FAIL. A queued PCM request can reject after `play()` returns, bypassing the A3 cleanup path and leaving transport active with audio resources retained.

## Finding

In `frontend/src/audio/playback.ts:147-170`, `queue()` awaits later chunk loads at line 149, but both queue starts at lines 168 and 170 discard the returned Promise with `void`. If such a PCM request returns HTTP 500, `request()` shows the HTTP error notification and throws at `frontend/src/api/client.ts:15-18`. The rejected queue Promise is not awaited by `play()`, so it does not enter `play()`'s catch at `frontend/src/audio/playback.ts:179-181`; that cleanup does not stop the transport, invalidate the queue, publish an inactive tick, or release its sources and gains. A multi-chunk playback therefore remains marked active after the queued request fails and can become silent when its already scheduled audio ends. The notification remains visible, but A3's required failed-request cleanup and absence of an unhandled rejection are not satisfied for this request path.

This is a source-based finding; this audit did not inject a failure specifically into a later queued chunk. Required action: handle queued PCM rejection through generation-safe transport cleanup and preserve visible HTTP error handling, with a real-browser regression that fails when a later chunk request is rejected.

## Evidence

- I ran `VSR_E2E_CHROMIUM=/usr/bin/chromium npx playwright test tests/e2e/m0-playback.spec.ts --workers=1 -g 'failed initial PCM request|failed playback restart'` in the task worktree; both tests passed (2/2) with the real backend, generated tone, temporary `VSR_HOME`, and random port fixture.
- The Worker final log `agent_workspace/2026-11-16-autonomous-dev/tmp/m0-t5-fix5.log` records old-code RED for the initial PCM failure and all 9 T5 Playwright tests passing after repair, including the initial failure, asynchronous restart failure, lane-removal and channel-switch cases, and the 21.25-second chunk test. The long suite was not rerun in this focused audit.
- The same final Worker log records typecheck, playback Vitest, lint, production build, and `git diff --check` passing.
- I independently ran the fixed-base rule checker: `0 FAIL, 1 REVIEW` (`C1 frontend/src/audio/playback.ts:179`); disposition for this reviewed direct HTTP-boundary cleanup and rethrow is V1#1. This disposition does not address the detached queue rejection above.
- I independently ran `npm run build`; it passed. Searching the resulting production bundle for `__vsr_test` returned no matches.
- `git diff --check` passed, the protected-path/config diff was empty, and no `/tmp/vsr-e2e-*` directory remained after the focused browser run.
- The current task write set is the five declared T5 paths: `frontend/src/App.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.

## Final file hashes

- `frontend/src/App.tsx`: `260246d9e1e281f7514b25a14e32761b7bdefa59004799689233e1cfd2a94211`
- `frontend/src/audio/playback.ts`: `e2d4894b3ecc802ace946a788900d81b4c95802dbac0a2aaaab150982f5df1ac`
- `frontend/src/audio/testHook.ts`: `17cf527b99c93edc682efe5b1bb2607135756716df363af4cbfa21ddc7d012e7`
- `frontend/tests/playback.test.ts`: `d8e887e4f382133b962acc3f872e5a6b82af12d3fc49307b2c316d7655d00dea`
- `frontend/tests/e2e/m0-playback.spec.ts`: `45a0c5e9f7a43006568715ef939d8ed2001ce45fd697f1148505ad2d4ae1ebd6`
