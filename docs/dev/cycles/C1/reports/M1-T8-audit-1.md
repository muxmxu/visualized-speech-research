# M1-T8 independent mechanical audit 1

**Verdict: PASS for the frozen phase tree and pre-squash evidence.**

The phase cut is `367705b99db2907f1da9def199d099b499729a43` and the accepted merge tip is `03f51dd48c6eb9f45b5d34f7b20b7e74936af109`.
All nine first-parent merges follow the plan, and their second parents and audited task file hashes match the accepted reports.
The phase index is clean, and the six integration paths below contain the complete delta from the merge tip.

- **Checks.** The frozen evidence manifest matches all 14 recorded hashes. The `uv sync` and pytest process exited 0 with 119 passed and 36 device-conditional skips, split equally between unavailable CUDA and MPS. CPU was the only available device. Ruff check and formatting passed on the final Python sources. The front-end log confirmed `npm ci`, typecheck, 37 Vitest passes, lint, and production and test builds. The final Chromium command reran typecheck and lint and recorded exit 0, 66 expected passes, zero failures, zero skips, and zero flaky cases. The first Chromium wrapper exited 143 after reporting 66 passes, and the recheck exited 1 on the fixed-offset T-F context click. The final run replaces both browser results. The final test assets match the prior test build byte for byte, and the restored production assets match the verified build and exclude the browser test hook.
- **Integration fixes.** The accepted T6 and T7 baselines reproduced second-row narrow clipping. The final 800×600 test scrolls the second plot into view and captures it separately. An independent PNG decode verified all patches inside their recorded clip, with first-row RGB sums of 591.33/93/93 and second-row sums of 93/93/592.67 on both desktop and narrow captures. The original +100 brightness inequalities passed. The T-F context-click test now clicks the visible rectangle in Chromium and retains the move, resize, menu, zoom and deselection assertions. The separate production-browser pointer drag moved the dB slider from −80 to −27, changed rendered pixels, generated zero data requests during drag, and generated one 512-point spectrogram request after the FFT change.
- **Artifacts.** The acceptance report lists all 16 required rows and its screenshot paths resolve. The eight final Chromium PDFs match the independently rendered copies byte for byte. A separate Poppler check confirmed one upright page and one JPEG raster of matching dimensions in every file, including 1009×509 for scrolled Lanes, 1167×102 for clipped Frequency Analysis and 1628×284 at DPR 2.
- **Measurements.** The benchmark exited 0 and the three CPU samples per metric independently reproduce the medians. Rows 2–6 are 3.5291 s, 71.1 ms, 5.4 ms, 565.9 ms and 43.46 fps. The palette change produced an observed WebGL color change within one frame interval with zero API requests. The cached ten-minute full-lane median is 89.02 ms, measured separately from panning. The fresh-process peak RSS on the same prescribed fixture is 1,325,268,992 B (1.234253 GiB) against the 1.5 GiB limit. These §17 rows establish the Raspberry Pi 5 CPU baseline. The prior 4.173 s entry covers row 1.
- **Scope and rules.** Protected paths and configuration match the phase base. DESIGN matches the accepted A1/A2 baseline through §20 and appends only D44 and D45, with existing §21 entries preserved. Relative to M0, the only accepted arch changes are §§1, 7, 9, 19, 20 and 21. Drift evidence confirms the M0/M1 §7 routes and WebSocket route, §16 signatures, milestone §18 paths, §4 CLI/config/device definitions and §6 transport codec. The public-repository added-line scan and whitespace check passed. The phase checker returned `0 FAIL, 9 REVIEW`, all inherited. The three V1#1 entries carry dispositions from T4 and T5, and the six conditional skips carry DESIGN §20 dispositions from T1–T3. The T8 delta returned `0 FAIL, 0 REVIEW`.

For each base, the canonical patch is the output of `git diff --no-color --no-ext-diff --binary <base>` followed, in the order shown, by `git diff --no-color --no-ext-diff --binary --no-index /dev/null <path>` for `docs/acceptance/M1.md`, `tests/bench/m1_spectrogram.py` and `tests/bench/m1_spectrogram.ts`.
The independently reconstructed patches match the frozen byte hashes.

```text
ef21e8ed09806bc8b3f98318afa17533d7e61b1d64a475e28632774f8803517a  phase patch from 367705b
2a332b6f36c7b6cddc3cd611a1e6ab29a6b383ddd9099dc93a0e78ccada7a305  T8 patch from 03f51dd
44f17cc85add89796f73fee1c58c9a37669f2007d651246d2d687693f3146cfc  docs/DESIGN.md
a0e20cd9188b2b3d9cc6742ff8d6a0b5d10e17b8717e19f069c05183f6996b87  docs/acceptance/M1.md
b0e98865bd531ca38244b2c96e51b0bb9bd60be728344c8a773ac049b25d9314  frontend/tests/e2e/m1-audition.spec.ts
bdf78446d498cbb76c8fa0a5bac3a56e1ef3b8f4b1f9f4ee008b620195d917d7  frontend/tests/e2e/m1-spectrogram.spec.ts
54b263821a29657b862a631ad332589557e0608508984445aba64ecee526193c  tests/bench/m1_spectrogram.py
3ba4d0561ed6e7d4e7fec0df56e187aae53e13499e30990911094df55c73294e  tests/bench/m1_spectrogram.ts
```

**Required action.** After semantic PASS, the D38 integration executor must compare the squash against the audited phase diff, rerun the complete regression on `master`, and record the §17 measurement row separately.
M1.C1 remains unverified until the required master checks pass.
Human visual feedback is pending under DESIGN §20.
