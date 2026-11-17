# M0-T5 Mechanical Reaudit 4

Verdict: PASS; the audit-3 duration finding was based on a WAV-header offset error.

## Correction to audit 3

- Audit 3 incorrectly treated the value at WAV offset 28 as the sample rate; the sample rate field is at offset 24, while offset 28 stores byte rate.
- The generated long-channel WAV copies the fixture header with sample rate 8,000 Hz, then writes byte rate 48,000 at offset 28 for three channels of 16-bit samples.
- The data chunk contains 1,020,000 bytes and block alignment is 6 bytes, giving 170,000 frames; at 8,000 Hz the duration is 21.25 seconds.
- Therefore the test's long selection exceeds 20 seconds and schedules multiple chunks; audit 3's 3.5417-second conclusion and resulting FAIL finding were incorrect.

## Independent evidence

- The updated test calculates duration from the generated file's data size, block alignment, and sample-rate fields and asserts that the result exceeds 20 seconds.
- It checks master Analyser RMS after switching to the silent channel, after the playhead passes 19.5 seconds, after it passes 20.1 seconds, and after it wraps below 2 seconds; it then selects the audible channel and checks that output returns.
- The fix4 log records a controlled regression run with channel-change reconciliation disabled; the real graph stayed audible on the silent channel at RMS `0.25856`, failing the `< 0.0002602` assertion.
- I independently ran `VSR_E2E_CHROMIUM=<host-selected executable> npx playwright test tests/e2e/m0-playback.spec.ts --workers=1 -g 'channel changes invalidate queued long-loop chunks'`; the test passed in one Chromium worker.
- `python3 scripts/check_diff_rules.py --base 000c608d3f7cc8330c7523242fe7cc4f3908cd00`: PASS, `0 FAIL, 0 REVIEW`.
- `git diff --check`: PASS.
- The fix4 log records final-tree PASS for typecheck, playback Vitest, lint, production build, production-hook exclusion, and the full seven-test browser suite; unchanged checks were not rerun in this focused audit.
- Protected paths, frontend lint/type/only configuration, and `docs/DESIGN.md` are unchanged; the public-repository scan found no findings in added lines.
- No matching browser or server process and no `vsr-e2e-*` temporary directory remained after the independent test.

Audit 3's factual conclusion is superseded by this report; audit 3 itself was not modified.
