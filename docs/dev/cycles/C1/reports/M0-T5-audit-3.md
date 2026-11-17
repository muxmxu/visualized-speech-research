# M0-T5 Mechanical Reaudit 3

Verdict: FAIL; the queued channel-invalidation acceptance remains unverified.

## Scope and evidence

- Base: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
- The five changed code paths remain within the T5 write set: `frontend/src/App.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.
- Review 1's old-code RED for lane removal is recorded in `tmp/m0-t5-fix3.log`: after closing one of two audible lanes, actual RMS was `0.5164`, above the test's `< 0.55 × baseline` upper bound of `0.2863`.
- Review 1's old-code RED for live channel changes is recorded in the same log: selecting silent channel 1 expected RMS `< 0.0002589` but received `0.2588`.
- I independently ran the three affected browser tests with one Chromium worker; all three passed.
- The lane-removal test verified half-level output after removing one lane, then inactive transport and more than 60 dB attenuation after removing the last lane.
- The live-channel test verified more than 60 dB attenuation on the silent channel and restored audible output after selecting the tone channel again.
- The queue-invalidation test passed, but its generated WAV does not exceed 20 seconds: it contains `21.25 × 8,000 = 170,000` frames while its header declares 48,000 Hz, so duration is `170,000 / 48,000 = 3.5417` seconds.
- `Playback.play()` therefore receives one chunk for that WAV; waiting 22 seconds exercises repeated short-buffer loops but not queued audio across a 20-second chunk boundary.
- The separate offset-cancellation test uses 170,000 frames with the copied 8,000 Hz header and does exercise a 21.25-second, multi-chunk loop, but it does not switch channels during queued playback.
- The fix3 log contains old-code RED evidence for closing lanes and the basic live channel switch, but it contains no valid old-code RED for channel invalidation across a queued chunk longer than 20 seconds.

## Checks

- Production build: PASS; the generated production bundle contains no `__vsr_test` string.
- Focused Playwright command: PASS, 3 passed; it covered lane removal, live channel switching, and the current short-duration queue test.
- `python3 scripts/check_diff_rules.py --base 000c608d3f7cc8330c7523242fe7cc4f3908cd00`: PASS, `0 FAIL, 0 REVIEW`.
- `git diff --check`: PASS.
- Protected paths, frontend lint/type/only configuration, and `docs/DESIGN.md` are unchanged; the public-repository scan found no findings in added lines.
- No matching browser or server process and no `vsr-e2e-*` temporary directory remained after the independent browser run.
- The fix3 log records final-tree PASS for typecheck, playback Vitest, and lint; these unchanged checks were not rerun in this focused audit.

## Required action

- Correct the generated long-channel WAV so its declared sample rate and frame count yield a selection longer than 20 seconds, then demonstrate that changing channels invalidates already queued old-channel audio across that boundary.
- Record a failing old-code RED and a passing real-graph result for that corrected queued-chunk regression before T5 can pass review.
