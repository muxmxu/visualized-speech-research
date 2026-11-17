verdict: FAIL

issues:
- P1 — `frontend/src/App.tsx:67`, `frontend/src/App.tsx:69`, and `frontend/src/App.tsx:153` allow an inverted time selection when a handle crosses the other endpoint or a numeric input passes it.
  Independent real-backend Chromium reproduction selected `[0.2, 0.6]` and dragged the end handle to `0.1`; the controls then displayed Start `0.2`, End `0.1`, and Duration `-0.1`, while the selection retained its previous `248px` CSS width because the new negative width was invalid.
  Required fix: preserve an ordered interval and consistent visible handles and numeric fields during handle crossing and direct entry, following DESIGN §§9.2 and 9.6.
  Add a regression that fails on this tree for crossing and direct-entry cases, including the resulting visible selection interval.
- P2 — `frontend/src/App.tsx:151` always formats six ruler labels with `toFixed(3)`, rather than the adaptive ruler required by DESIGN §9.2.
  After fitting the one-second fixture and pressing `=` ten times, the visible interval is `1/1024` seconds, and every displayed ruler label rounds to `0.500`.
  The existing M0 screenshot exhibits those six identical labels at sample zoom.
  Required fix: adapt tick spacing and precision to the viewport so sample-level positions remain distinguishable, and assert the observable ruler values at this zoom.
- P2 — `frontend/tests/e2e/fixtures.ts:29` and `frontend/tests/e2e/fixtures.ts:39` retain error handling and readiness retries outside the explicitly permitted V1 table.
  The narrowed ENOENT and ECONNREFUSED catches preserve other failures, but neither the table nor an existing §21 decision permits these two handlers.
  Required fix: perform the required real-server readiness synchronization without adding an unapproved exception-handling boundary, or resolve the missing rule authorization through the Controller before acceptance.

required_action: 修改

covered_state:
- Reviewed task HEAD and base `49303ebd4e479d459629613aa6ca206d0a9c27c5`, with three modified tracked files and eight untracked implementation/test files.
- Reviewed the complete eleven-file T4 source/test delta, main AGENTS.md, LIFECYCLE.md, the requested DESIGN sections, phase-M0 T4, both audits, current state handoff, and the CODEX reviewer contract.
- All eleven implementation/test files are within T4's explicit write set; no task change touches protected standards, DESIGN, runtime dependencies, application environment variables, or backend routes.
- Independently ran the rule checker against the specified base and obtained `0 FAIL, 5 REVIEW`.
- Independently launched the real backend with generated audio, temporary VSR_HOME, a dynamically allocated loopback port, and the host-selected Chromium for the selection and wheel probes.
- The first two probe launches did not reach the backend because the task-local Python environment lacked uvicorn; the completed probe used the existing dependency environment used by the recorded browser checks.
- Did not rerun the unchanged acceptance suites; audit-2 records passing typecheck, seven unit tests, lint, build, and one real-backend Playwright test.
- Inspected `frontend/test-results/screens/M0-workspace.png`; screenshots remain human inspection evidence under DESIGN §20, not an acceptance gate.
- No review-owned server or browser remains, and no task source file, stage, commit, merge, or push was changed by this review.

evidence:
- Token bootstrap stores the token in sessionStorage, removes only that query parameter with replaceState, and supplies Bearer authentication to all API requests; the WS URL carries the token and `lanes_changed` triggers a full session refresh.
- The real-backend fixture generates its WAV in code, uses an isolated VSR_HOME and port 0, monkeypatches only device self-check, and preserves the actual HTTP, WS, framed waveform, and upload implementations.
- Source inspection confirms file browsing, recent opens, uploads, lane name/gain/mute/solo/offset/reorder/close requests, and dockview layout persistence.
- Raw waveform mapping uses first_sample plus lane offset; pooled mapping uses the backend's absolute t0/t1; canvas backing dimensions use devicePixelRatio and requests use CSS width with 25 percent margins.
- The revised scheduler redraws cached data synchronously and combines a 60 ms quiet period with a 150 ms deadline measured from the last request; superseded requests are aborted.
- Unit expectations for viewport anchoring, cached coordinates, six-pixel sample spacing, and scheduling are independently calculable rather than output snapshots.
- Browser coverage exercises overview movement/resizing, outward handle adjustment, cached redraw with responses held, sample-point drawing, and the visible real-backend fallback reason.
- The Canvas arc observer forwards to the original renderer and does not replace waveform or backend behavior, but its accumulated counter alone does not verify point coordinates or all ruler/selection boundaries.

rule_dispositions:
- `frontend/src/App.tsx:16` — allowed, `V1#1`: user-triggered HTTP actions report failures through notifications rather than swallow them.
- `frontend/src/App.tsx:56` — allowed, `V1#1`: waveform request failures reach notifications; ignoring AbortError is the explicitly required cancellation in DESIGN §9.3.
- `frontend/src/App.tsx:85` — allowed, `V1#1`: overview HTTP failures reach notifications; abort on cleanup cancels the owned request.
- `frontend/tests/e2e/fixtures.ts:29` — defect, C1/C3: the filesystem-readiness handler is outside V1 and has no §21 authorization; narrowing the caught condition does not supply that authorization.
- `frontend/tests/e2e/fixtures.ts:39` — defect, C1/C3: the connection-readiness handler is outside V1 and has no §21 authorization; other errors now propagate, which repairs C2 but not C1/C3.

notes:
- A real Ctrl+wheel probe logs `Unable to preventDefault inside passive event listener invocation` from the React wheel handler at `frontend/src/App.tsx:146`.
  The probe established failed default cancellation, but did not establish a browser zoom or scrolling regression, so that observation does not independently determine this verdict.
- Web Audio transport, moving playback-head rendering, spectral controls, M1 hover behavior, and the full milestone benchmark remain assigned to T5, M1, or T6 and were not treated as T4 omissions.
- The Settings fallback shown here is an intentionally forced self-check failure and is not evidence that the host's normal device self-check fails.

report_path: docs/dev/cycles/C1/reports/M0-T4-review-1.md
