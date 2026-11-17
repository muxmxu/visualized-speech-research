# M0-T6 Mechanical Audit 1

Verdict: PASS.

## Final trees and benchmark evidence

- Phase `HEAD` is `48df41ecf330f1f5a188ebdbeced83f24108ac6b` with tree `d46e1d1d4546a5b9384294340b1662ae0cb37793`.
- Main `master` is `556e4d24f095dd040e1584dc055489eb30560c53` with tree `06f28a65f151ddd1dba3acd775b5f89f93d7c4c7`.
- Comparing the two committed trees shows only the expected four-line M0.C1 acceptance-row update; the implementation and benchmark files match.
- The main squash commit contains the phase implementation, benchmark files, acceptance report, and M0 §21 updates. It does not contain root `package.json`, root `package-lock.json`, `docs/dev/performance.md`, `node_modules`, generated web output, or test artifacts.
- The root package files remain untracked from before T6. The untracked `docs/dev/performance.md` is the required post-squash record and uses main commit `556e4d24f095dd040e1584dc055489eb30560c53`; it remains unstaged.
- The benchmark source generates a 600-second, 48 kHz, two-channel WAV and measures from the CLI open invocation to an observed waveform Canvas draw in Chromium. The integration log records CPU observations of 4.173128272, 4.187923942, and 3.720843174 seconds, with median 4.173 seconds.
- The benchmark ran while phase `HEAD` was `e79798dc2224fc0a0896a3052b72c0bbabbfecaa`; the final phase commit `48df41ecf330f1f5a188ebdbeced83f24108ac6b` was created afterward. The acceptance wording identifies the benchmark-time phase revision, not the final phase commit, so this is not a factual mismatch.
- This is the platform's first recorded CPU measurement; the acceptance report and performance record state that there is no prior same-platform value.

## Acceptance evidence

| Exit | Result | Evidence |
|---|---|---|
| M0.1 | PASS | The benchmark's real CLI invocation starts the browser and waits for an actual waveform Canvas draw; the workspace test verifies an unauthenticated session request returns 401. |
| M0.2 | PASS | The workspace browser test checks sample-level points; the generated ten-minute stereo benchmark records the three observations above. |
| M0.3 | PASS | Playback browser tests cover selection transport, aligned loops, mute, solo, and cancellation across two long loops using actual master RMS. |
| M0.4 | PASS | Backend fixtures and benchmark runs use temporary `VSR_HOME` and dynamically assigned loopback ports. |
| M0.5 | PASS | Frame Vitest coverage checks Python/TypeScript round trips, dtype, shape, metadata, and payload. |
| M0.6 | PASS | CPU device selection, forced self-check failure fallback, and visible Settings reason are covered by pytest and browser evidence. |
| M0.C1 | PASS | Worker logs record 35 pytest, 18 Vitest, Ruff, typecheck, lint, build, and 18 Playwright tests on both final trees. The main Worker Playwright invocation used two workers despite T6's one-browser resource; I independently ran `VSR_E2E_CHROMIUM=/usr/bin/chromium npx playwright test --workers=1` on main and all 18 tests passed in 2.6 minutes. |
| M0.C2 | PASS | The acceptance report lists all nine exits, evidence, screenshots, platform measurement, and comparison status. |
| M0.C3 | PASS | DESIGN §21 adds D33, D36, and D37; protected-section comparison shows only the allowed §21 additions; rule check reports 0 FAIL and five REVIEW lines with prior independent V1#1 dispositions. |

The exact five REVIEW dispositions are:

- `frontend/src/App.tsx:18` — V1#1, asynchronous HTTP action errors are shown by notifications.
- `frontend/src/App.tsx:58` — V1#1, waveform HTTP errors are shown and AbortError is the cancellation required by DESIGN §9.3.
- `frontend/src/App.tsx:88` — V1#1, overview HTTP errors are shown and the owned request is cancelled on cleanup.
- `frontend/src/audio/playback.ts:103` — V1#1, PCM request errors are visible and failed-generation resources are cleaned.
- `frontend/src/audio/playback.ts:196` — V1#1, active-play resources are cleaned before the error is rethrown to the visible caller.

## Screenshots, scans, and cleanup

- Main screenshots exist at `frontend/test-results/screens/M0-cli.png`, `frontend/test-results/screens/M0-workspace.png`, and `frontend/test-results/screens/M0-playback.png`. The main one-worker Playwright run cleared the ignored CLI screenshot; I restored that generated artifact from the matching phase tree after confirming the source trees match outside the acceptance row.
- Worker completion logs record the fixed-base rule check, protected-content comparison, public-repository scan, and `impl check` passing. The task diff scan reported no public-identifier findings.
- The main one-worker Playwright command exited successfully. Post-run checks found no VSR server, benchmark, browser process, or `vsr-e2e-*`/`vsr-bench-*` temporary directory.
- Main has only the expected untracked root package files and post-squash performance record. No staging or Git mutation was performed by this audit.

## Check sources

- I independently ran the required single-worker main Playwright suite: 18 passed.
- I reused unchanged final-tree Python and frontend check results from `agent_workspace/2026-11-16-autonomous-dev/tmp/m0-t6-complete.log`.
- Phase and main commit SHAs and tree comparison were read directly from Git; the acceptance, performance, benchmark, review, and screenshot evidence was checked against the final files and Worker logs.
