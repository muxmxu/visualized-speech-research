# M0-T5 Mechanical Audit 1

Verdict: FAIL; return the T5 browser playback issue to the Worker for rework.

## Scope and write set

- Base: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
- The five changed paths are `frontend/src/App.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.
- All five paths are within the T5 explicit write set; no other tracked or untracked source path changed.
- The audit wrote only this report and did not stage or commit files.

## Checks

- `npm run typecheck`: PASS.
- `npm test -- --run tests/playback.test.ts`: PASS, one test.
- `npm run lint`: PASS.
- `npm run build`: PASS; Vite emitted a chunk-size warning for bundles above 500 kB.
- Production output under `src/vsr/web/` contains no `__vsr_test` string.
- `python3 scripts/check_diff_rules.py --base 000c608d3f7cc8330c7523242fe7cc4f3908cd00`: PASS, `0 FAIL, 0 REVIEW`.
- `git diff --check`: PASS.
- Protected paths and frontend lint/type/only configuration are unchanged; `docs/DESIGN.md` is unchanged.
- Public-repository scan of added lines found no host-contract words, home paths, email addresses, or non-loopback IPv4 addresses.

## Browser evidence

- Ran the required Playwright test with the host-selected Chromium executable; Playwright used one worker and one Chromium instance.
- Result: 2 passed, 1 failed.
- `real graph maintains aligned loops, mute, solo, and selection transport`: PASS; actual master Analyser RMS met the baseline, mute `<= baseline * 10**(-40/20)`, cancellation `< baseline * 10**(-60/20)`, solo audibility, and selection-end assertions.
- `offset lanes cancel across long chunk boundaries and two loops`: PASS; generated signals with 0.25 s offset remained below the 60 dB cancellation threshold at checks through 42.9 s, while playback remained active, then solo output exceeded `baseline * 0.9`.
- `loop can be enabled and disabled during playback`: FAIL at `frontend/tests/e2e/m0-playback.spec.ts:68`; after enabling loop during playback and waiting 2.3 s, `playing()` was true but actual master RMS was `0`, failing the required `> 0.05` assertion.
- The Worker log records the old-code RED for this runtime L-toggle test: before the fix, `playing()` was false after the same wait (expected true, received false).
- The test fixture starts the real backend with temporary `VSR_HOME`, requests port `0`, reads the assigned port from its temporary `runtime.json`, and generates its WAV inputs in code.
- The fixture cleaned all three temporary homes created by this audit run; no matching server or Chromium process remained afterward.
- Before this audit, two stale `/tmp/vsr-e2e-*` directories existed; each contained only generated `tone.wav`, with no matching live process. They were not removed by the auditor.
- Screenshot inspected at `frontend/test-results/screens/M0-playback.png`; the Files pane shows the temporary generated-audio directory and its generated WAV files.

## Required action

- Worker must investigate why the real master output becomes silent while `playing()` remains true after runtime loop enablement, add or retain a focused regression, and return a passing full T5 acceptance run.
- Task owner must remove the two stale generated `/tmp/vsr-e2e-*` directories after confirming ownership; no live server process was found.
