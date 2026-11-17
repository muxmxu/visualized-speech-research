verdict: FAIL

issues:
- P1 — `frontend/src/App.tsx:156` and `frontend/src/App.tsx:162`: the adaptive-ruler repair crashes the complete UI when layout leaves zero waveform width.
  The canvas ResizeObserver passes its actual content width to the shared width state, so a zero-width waveform makes `Math.log10(width * view.secondsPerPx / 5)` equal negative infinity and tickPrecision equal positive infinity.
  Calling `toFixed(tickPrecision)` then throws `toFixed() digits argument must be between 0 and 100`.
  Independent Chromium reproduction opened the generated one-second audio and resized the viewport: at 400 px viewport width both canvases were 20 px wide; at 300 px the exception occurred, no canvas remained, and `#root` had zero children.
  Required fix: keep the ruler calculation valid while the dock layout has no drawable waveform width, without changing waveform coordinates for positive widths.
  Add a regression that first fails on this tree, resizes through the zero-width layout, and verifies the workspace survives and can recover when widened.

required_action: 修改

covered_state:
- Focused rereview of review-1 issues, audit-3's cleanup finding, audit-4, and the directly affected App, fixture, and browser regressions.
- Task HEAD and base remain `49303ebd4e479d459629613aa6ca206d0a9c27c5`, with the same eleven-file implementation/test delta and no task Git mutation.
- SHA-256 of the sorted task delta, concatenating each UTF-8 path, NUL, file bytes, and NUL: `6e140cc5de388ae51159e69d2e0c0daf8e8bf81d4e812830a93b541ee6cec86b`.
- App SHA-256: `6da9c0c9570bfa86c145034830915551594e14fa1b1dbee5b6cdf32dd75c3514`.
- Fixture SHA-256: `b4b3c11a6d16b838c5bca80556d841ebf0b3297baa8c194d0f006a3d48cd5c5f`.
- Browser spec SHA-256: `d453c8cb0520119d71aa609308168b51ee56141ed70b0a312bd507c1a9643da2`.
- Preserved review-1's unchanged coverage of token bootstrap, authenticated requests and WS refresh, lane/file actions, framed canvas mapping, request scheduling, T4 scope, and screenshot limits.
- Independently reran the rule checker: `0 FAIL, 3 REVIEW`.
- Did not repeat the unchanged passing mechanical suites; audit-4 records the final worker's typecheck, seven unit tests, lint, build, and six-test Playwright suite passing, plus an independent signal-cleanup regression passing.
- The new layout probes used the real backend, generated audio, temporary VSR_HOME, a dynamic loopback port, and the host-selected Chromium.
- Probe-owned servers and browsers were closed and temporary directories were removed; no task file or Git state was edited.

evidence:
- Previous P1 repaired at App line 67: handle crossing preserves the fixed endpoint, switches the moving endpoint, and stores min/max in order; the regression checks two moves across the anchor and the resulting visible geometry.
- Previous numeric-entry issue repaired at App line 164: start, end, and duration inputs construct an ordered interval; the regression checks start/end/duration and visible selection bounds after crossed entry.
- Previous duplicate-label issue repaired for positive widths: tick precision now follows the visible tick interval; the sample-zoom regression checks strictly increasing observable labels.
- Previous fixture REVIEW defects repaired: startup waits for Uvicorn's startup-complete event before reading runtime.json; the ENOENT and ECONNREFUSED catches and readiness retry loop were removed.
- Ctrl-wheel repair uses a native wheel listener with `passive: false`, removes the listener on cleanup, and retains the same zoom/pan calculations; the real-wheel regression asserts defaultPrevented.
- Audit-3's cleanup issue repaired at fixture line 34: cleanup waits for exit only when both exitCode and signalCode are null, so a child already terminated by signal does not wait for a second event.
- The signal-exit regression creates its exit promise before termination, terminates the test-owned Python child and uv process, and asserts that the temporary directory was removed after fixture teardown.
- The held waveform-route regression releases its pending request before awaiting unrouteAll with behavior wait, addressing the directly related route-continuation race.

rule_dispositions:
- `REVIEW C1 frontend/src/App.tsx:16: function run(action: Promise<unknown>) { void action.catch(report); }` — allowed, `V1#1`, because HTTP action errors are surfaced through notifications.
- `REVIEW C1 frontend/src/App.tsx:56: }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });` — allowed, `V1#1`, because waveform HTTP errors are surfaced and AbortError is the cancellation required by DESIGN §9.3.
- `REVIEW C1 frontend/src/App.tsx:85: }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });` — allowed, `V1#1`, because overview HTTP errors are surfaced and cleanup cancels its owned request.

notes:
- Screenshots remain inspection evidence rather than a visual acceptance gate under DESIGN §20.
- The test-only child lookup still assumes pgrep and uv's direct-child layout, as already documented in audit-4; this rereview does not add a platform-portability blocker.
- No T5 transport, M1 spectral behavior, or T6 milestone benchmark was added to this review's scope.

report_path: docs/dev/cycles/C1/reports/M0-T4-review-2.md
