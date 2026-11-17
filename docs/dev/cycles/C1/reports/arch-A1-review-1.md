# C1 arch A1 semantic review 1

**Verdict** FAIL.
**Required action** 修改.
**Report** `docs/dev/cycles/C1/reports/arch-A1-review-1.md`.

## Required fixes

1. **DESIGN §9.7, lines 376–378, omits the visible Frequency Analysis plot.**
   H45, B3 and A1 cover visible workspace plots, and §§8.4 and 9.1 put a user-facing Frequency Analysis plot in a separate M1 dock panel.
   Make the same screenshot tool usable on the visible Lanes plotting surfaces and the visible Frequency Analysis plot, with its displayed curves, axes, labels and any displayed plot legend.
   Clip to the render surfaces and their visible ancestors, excluding dock tabs, panel controls, surrounding chrome and the gesture overlay.
   Add a Frequency Analysis crop to the §20 pixel test while keeping the waveform, spectrogram and annotation checks.
   T7 already follows the tasks that supply this panel.
   If its plot root or plotted layers need explicit capture references, supply them in T5's existing `frontend/src/panels/FrequencyAnalysis.tsx` write set or add that one path to the T7 plan before dispatch.

2. **DESIGN §20, lines 720–721, drives the drag with the already rounded expected crop.**
   At DPR 1.5, a Playwright drag sent to CSS x = 100 / 1.5 produced `pointerup.clientX = 66.66666412353516` and a right edge of floor(x × 1.5) = 99, although the precomputed right edge was 100.
   Drive the gesture with unrounded CSS coordinates chosen away from device-pixel ties, including one edge beyond a visible clip.
   Compute expected half-open device bounds independently from those inputs and the measured clipping geometry exactly once, using the same directly observed pointer inputs if needed to account for delivery precision.
   Put the excluded chrome marker within the raw drag and beyond the eligible plot boundary so the negative case exercises clipping.
   Specify the independent reader smoke as opening the saved PDF in full Chromium with its PDF viewer enabled.
   The locked Playwright package chooses the headless shell by default when it launches headlessly without a channel or executable override, so the smoke should identify the full browser separately from the standard pixel-test launcher.

3. **DESIGN §7, line 207, leaves part of masked query validation and audition behavior implicit.**
   A finite complete mask group can still pass the listed checks with `win_length > n_fft`, a zero `win_length // 4` hop or an unknown window.
   Require 4xx for those invalid combinations under §8.1 and §15, and specify the required finite `window_param` representation for windows without a parameter and how configured §8.1 defaults are transmitted.
   Preserve the original §7 audition meaning explicitly by keeping the rectangle's T-F content and assigning zero mask weights beyond its §15 transition, with ISTFT and resampling as specified.

## Evidence

- The cut and HEAD were `398b31605ff100c178213a73c78aaabacd05dcfe`, with one unstaged change to `docs/DESIGN.md`.
  The SHA-256 of `git diff --binary 398b31605ff100c178213a73c78aaabacd05dcfe` was `058d43aeaa794b6cf6a9b02ce12df925ed13ae14bdb5162fcc66a3adb77799ff`, matching the independent mechanical audit.
- The chapter comparison confirmed exactly §§1, 7, 9, 19, 20 and 21 changed, with the original preamble and H2 headings preserved.
  The protected changes are the H45-authorized additive scope bullet and appended M1.13 criterion.
  The prior twelve M1 criteria and historical §21 lines are intact.
  The auditor recorded `0 FAIL, 0 REVIEW`, so no REVIEW dispositions are required.
- On a synthetic fixture at DPR 1.5, existing Playwright and Chromium decoded a 300 × 180 viewport PNG and a 64 × 32 JPEG using `createImageBitmap` and Canvas2D.
  At the sampled interior positions, RGB was [231, 167, 51] in the PNG and [230, 167, 51] in the JPEG.
  Full Chromium also loaded its built-in viewer for a generated one-page JPEG-backed PDF, and the recon separately rendered a synthetic PDF with an independent reader.
  These checks establish feasibility of the dependency-free raster comparison and reader paths.
  Actual workspace composition and downloaded-PDF fidelity belong to M1.13.
- D43 correctly separates the finite increasing project-time `selection_t0,selection_t1` pair from the half-open returned chunk `t0,t1`.
  The server evaluates mask frames on the absolute lane grid after offset conversion, and the scheduler carries the same full rectangle through continued and looped requests of up to 20 seconds.
  The whole-lane fixed-hop mask followed by one resample and destination slicing distinguishes the true edge at 20 seconds from a seam inside a 40-second rectangle.
  M1.12 retains strict sample-wise error < 1e-6, and T3 applies it to the unequal-rate, off-phase unmasked case and both masked references.
