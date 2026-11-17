# M0-T5 Mechanical Reaudit 2

Verdict: PASS for the focused reaudit of the audit-1 playback failure.

## Evidence

- Base: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
- The implementation changes remain within the T5 write set; changed code paths are `frontend/src/App.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.
- The audit-1 failure was that loop state showed playback active while the real master Analyser RMS was zero.
- The fix2 log records the new busy-UI regression failing before the playback repair: after main-thread blocking crossed the one-second audio boundary, `playing()` remained true and RMS was `0` instead of the asserted `> 0.05`.
- The fix2 log records three post-fix passes each for the runtime loop-toggle case and the busy-UI regression, followed by the full four-test T5 browser suite passing.
- Source inspection confirms `App.tsx` installs the key handler in `useLayoutEffect` so it captures current lane state, while `Playback.play()` exits before becoming active when there are no lanes.
- For a one-chunk selection, `Playback` now starts a looped source at the current buffer offset if the original source has ended before the loop toggle is handled.
- The busy-UI regression uses the real backend, generated audio, AudioContext output graph, and master Analyser; it does not mock the playback graph.
- The browser fixture uses a temporary `VSR_HOME`, requests port `0`, discovers the assigned port from `runtime.json`, and generates its WAV input in code.

## Independent checks

- Ran the full T5 browser file with one Chromium worker: 4 passed, 0 failed.
- The passing browser assertions include mute attenuation at least 40 dB, two-loop cancellation more than 60 dB below baseline, solo audibility, selection-end position, the runtime L toggle, the busy-UI restart, and offset cancellation across a 21.25 s selection through 42.9 s.
- `python3 scripts/check_diff_rules.py --base 000c608d3f7cc8330c7523242fe7cc4f3908cd00`: PASS, `0 FAIL, 0 REVIEW`.
- `git diff --check`: PASS.
- Protected paths, frontend lint/type/only configuration, and `docs/DESIGN.md` are unchanged; the public-repository scan found no findings in added lines.
- No matching test server or browser process and no `/tmp/vsr-e2e-*` directory existed before or after the independent browser run.
- The fix2 log records final-tree PASS for typecheck, playback Vitest, lint, and production build; these unchanged checks were not rerun in this focused reaudit.
- The `__vsr_test` production exclusion passed in audit 1; its test-hook guard is unchanged in this fix.

No further T5 rework is required by this mechanical reaudit.
