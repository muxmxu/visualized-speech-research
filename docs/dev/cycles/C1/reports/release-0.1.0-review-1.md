# C1 release candidate independent semantic review 1

**PASS for the frozen local 0.1.0 candidate.**

- Mechanical audit 1 passed for the exact two-document patch. The candidate keeps the executable, configuration, dependency, and test inputs identical to delivered M3. Reuse covers 260 pytest passes, 46 device skips, 37 Vitest passes, and 75 distinct Chromium passes across the full run and the corrected locator rerun.
- The wheel was built with the hashed M3 production assets and inspected for those assets and the packaged skill. The successful install uses that wheel in a fresh Python 3.12.14 environment with the selected CPU torch and locked dependencies. Dependency validation passed. The acceptance report preserves the initial offline resolution failures and the successful sequence.
- The installed-wheel smoke imports `vsr` from the temporary environment, starts the installed CLI using a temporary `VSR_HOME`, and records HTTP 401 and 200 for unauthenticated and authenticated session requests. The static page returns 200 and contains the expected production asset reference. Preset resolution and packaged resource reading pass, and the server terminates.
- The §17 table matches the seven three-sample medians in `waveform_open.log`, `m1_spectrogram.log`, and `m2_show.log` and compares against the prior Raspberry Pi 5 CPU values. It records the changes for rows 1, 4, and 6 in the slower direction. The performance ledger append remains part of local integration.
- The acceptance report covers R1.1–R1.8, the M0–M3 drift check, B5, and the smoke and benchmark results. R1.7 and R1.8 remain pending for public delivery because B2 and the Human's final repository scan are outstanding and preflight found historical commit metadata hits. The release tag and release page remain pending.
- H59 applied. The review used the recorded evidence without rerunning smoke, regression, or benchmarks.

```text
1763550487dcf726ad46623c0a0d1228f8b0d23ea32083c0bdfbc21d1f0d0436  release-docs.patch
e22cdb5361f24185d748ba508799435b54e65c50b57f5a3fda5c1ff4c8e9565f  visualized_speech_research-0.1.0-py3-none-any.whl
```
