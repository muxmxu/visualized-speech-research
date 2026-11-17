verdict: FAIL

issues:
- `frontend/src/App.tsx` cancels the pending 60 ms timer and aborts the active waveform request on each viewport update. During continuous interaction, requests can be postponed until interaction stops; this does not meet DESIGN §9.3's requirement to issue at least one request per 150 ms. It also draws only after the replacement response arrives and does not retain and redraw the last waveform response immediately for a new viewport.
- `frontend/tests/e2e/m0-workspace.spec.ts` does not assert the T4 observable outcomes for overview drag/resize, selection and handle times, sample-point zoom, or a visible device fallback reason. The screenshot is available for inspection but DESIGN §20 says visual-only evidence is not an acceptance gate.

required_action:
- Keep the last waveform response and redraw it immediately for each viewport change, then request the new visible range with the specified 60 ms debounce and a maximum 150 ms interval during continuous interaction; continue aborting superseded requests.
- Extend the real-backend Playwright coverage to assert overview and selection time changes, sample points at the required zoom, and a visible self-check fallback reason. Rerun the T4 acceptance commands and rule check on the final tree.

rule_review:
- Rule check returned `0 FAIL, 5 REVIEW`.
- `frontend/src/App.tsx:16`: proposed disposition `V1#1`; request failures are surfaced through the required UI notification boundary.
- `frontend/src/App.tsx:40` and `frontend/src/App.tsx:63`: proposed disposition `V1#1`; request failures are reported to the UI, and AbortError is the specified cancellation from DESIGN §9.3.
- `frontend/tests/e2e/fixtures.ts:24` and `frontend/tests/e2e/fixtures.ts:26`: proposed disposition `defect (C1/C2)`; both bare catches swallow any read/parse or fetch error while polling. Keep the runtime-file and server-readiness wait required by the T4 fixture, but limit handling to expected not-ready conditions and propagate other errors.

covered_state:
- Audited the T4 working tree against base `49303ebd4e479d459629613aa6ca206d0a9c27c5`, including tracked and untracked files. All 11 task files are within T4's explicit write set; no protected file or DESIGN section changed.
- `npm run typecheck` passed.
- `npm test -- --run tests/viewport.test.ts tests/waveform.test.ts` passed with 2 files and 3 tests.
- `npm run lint` passed.
- `npm run build` passed with the reported chunk-size warning.
- `npx playwright test tests/e2e/m0-workspace.spec.ts` passed with 1 real-backend browser test using temporary VSR_HOME, a random port, and generated audio.
- Screenshot `frontend/test-results/screens/M0-workspace.png` exists and shows the opened and uploaded waveform lanes, lane controls, overview, and Settings panel.
- Protected-section check passed. The public-repository scan found only the specified `127.0.0.1` loopback address in the test fixture.
- No task server, Playwright, or Vite process remained after verification. No task file was edited, staged, committed, merged, or pushed by this audit.
