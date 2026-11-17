verdict: FAIL

issues:
- `frontend/tests/e2e/fixtures.ts:34` checks only `process.exitCode === null` before sending SIGTERM and awaiting a new `exit` event. Node reports `exitCode: null` and `signalCode: "SIGTERM"` when a child has already exited from a signal. In that state `process.kill('SIGTERM')` returns `false`, and the `exit` event has already fired, so the new wait never resolves and removal of the fixture's temporary VSR_HOME is skipped.

required_action:
- Track whether the child has exited, including signal termination, before cleanup. Do not wait for an already-emitted exit event; always remove the temporary VSR_HOME. Add a focused regression for a child that exits by signal before fixture cleanup and verify the fixture terminates and removes its temporary directory.

covered_state:
- Audited the final T4 worktree against base `49303ebd4e479d459629613aa6ca206d0a9c27c5`. The 11 task files remain within T4's explicit write set; protected files and DESIGN sections are unchanged.
- Selection-handle crossing now swaps the active endpoint and preserves an ordered visible interval. Numeric entry normalizes crossed endpoints. The new browser tests check both control values and visible selection geometry.
- Sample-zoom labels are checked for distinct increasing values. Ctrl+wheel uses a native non-passive listener, and the browser regression checks `defaultPrevented`.
- The fixture waits for Uvicorn's startup-complete signal before reading the runtime file; it no longer polls or catches readiness errors.
- The route-cleanup race recorded in fix2 (`route.continue: Route is already handled!`) is addressed by releasing the held request and awaiting `page.unrouteAll({ behavior: 'wait' })`. The independent run below passed without a route error.
- Pre-fix browser evidence records the selection crossing failure (expected start `0.05`, actual `0.2`, after correcting the test's initial directory wait), numeric crossing failure (expected `0.6`, actual `0.8`), duplicate sample-zoom labels (`0.516` twice), and Ctrl+wheel cancellation failure (`false`).
- `npm run typecheck` passed.
- The viewport and waveform unit evidence from audit-2 remains current: those tests and `frontend/src/render/waveform.ts` were unchanged by this semantic repair; audit-2 recorded 2 files and 7 tests passing.
- `npm run lint` passed.
- `npm run build` passed with the Vite chunk-size warning.
- Playwright without taskset, using one worker to honor the single-Chromium resource limit, passed all 5 tests with the real backend and generated audio.
- Normal Playwright cleanup left no server, Chromium, Playwright, or Vite process. A separate Node child-process reproduction produced `{ code: null, signal: "SIGTERM", exitCode: null, signalCode: "SIGTERM" }`; a subsequent kill returned `false`, and no second `exit` event arrived.
- The screenshot `frontend/test-results/screens/M0-workspace.png` exists and shows distinct sample-zoom labels, sample points, selection, and the visible forced self-check reason.
- Rule check returned `0 FAIL, 3 REVIEW`; `git diff --check` passed.

remaining_review_lines:
- `REVIEW C1 frontend/src/App.tsx:16: function run(action: Promise<unknown>) { void action.catch(report); }` — disposition `V1#1` recorded in M0-T4-review-1.
- `REVIEW C1 frontend/src/App.tsx:56: }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });` — disposition `V1#1` recorded in M0-T4-review-1.
- `REVIEW C1 frontend/src/App.tsx:85: }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });` — disposition `V1#1` recorded in M0-T4-review-1.

audit_scope:
- No task source, test, or Git state was changed by this audit. Only this report was written.
