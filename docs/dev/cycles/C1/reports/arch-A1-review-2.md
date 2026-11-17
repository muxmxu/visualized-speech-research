# C1 arch A1 semantic review 2

**Verdict** PASS.
**Required action** None.
**Report** `docs/dev/cycles/C1/reports/arch-A1-review-2.md`.

## Findings

1. **H45 plot scope resolved in §9.7, lines 376–378.**
   Users can start a crop on the visible Lanes or Frequency Analysis plotting surface.
   Each crop keeps the source plot's visible curves, axes, labels and applicable legend or colorbar, clips to the plot and its visible ancestors, and excludes dock tabs, controls, surrounding chrome and the gesture overlay.
   Section 20 requires a crop of each plot type and preserves the prior waveform, spectrogram, visible-annotation, selection and request-count checks.
   The single-page raster PDF format and M2 reuse follow D40.

2. **Independent pixel geometry and reader path resolved in §20, lines 720–721.**
   The fixture uses a pre-gesture viewport PNG, raw CSS drag targets, independently observed delivered pointer coordinates, and measured clipping rectangles.
   It computes the half-open device-pixel rectangle once after intersection, with a separate DPR 1.5 precision case where the delivered CSS coordinate of 66.66666412353516 gives a device right edge of 99.
   The excluded chrome marker lies within the raw drag and outside the eligible plot, so the negative check exercises clipping.
   The declared PNG and embedded JPEG decoding path retains the per-channel tolerance of 20 and the page geometry checks.
   Review 1's synthetic probes verified browser decoding and loaded the built-in PDF viewer.
   Section 20 now specifies full Chromium with that viewer enabled for the independent read of the saved PDF, separately from Playwright's standard headless launcher.
   Workspace-layer fidelity and the saved-file smoke remain M1.13 implementation evidence.

3. **D43 request and audition behavior resolved in §7 line 207 and §9.4 line 341.**
   Masked queries explicitly reject incomplete or nonfinite groups, unordered bounds, invalid FFT and window-length combinations, a zero mask hop, unsupported windows and invalid window parameters with the standard 4xx body.
   The frontend sends 0 for parameterless windows and materializes the current Kaiser or Gaussian parameter, including the §8.1 defaults.
   Audition keeps the rectangle's T-F content and assigns zero mask weights beyond the §15 transitions before ISTFT and resampling.
   Each requested half-open chunk uses the complete selection on the lane's absolute STFT grid after offset conversion.
   Continued and looped reads carry identical rectangle bounds, distinguishing a true 20-second edge from the internal seam of a 40-second rectangle.
   The fixed-hop whole-lane mask, one resample and final slice match T3's independent references.
   M1.12 retains strict sample-wise error < 1e-6.

## Covered state and rule dispositions

The frozen `task/arch-A1` HEAD and cut were `398b31605ff100c178213a73c78aaabacd05dcfe`, with one unstaged change to `docs/DESIGN.md`.
The SHA-256 of `git diff --binary 398b31605ff100c178213a73c78aaabacd05dcfe` was `92d3a9357283e04d06ca4ddb8643535022d069f616627931c316eca09ee36fa6`.
Independent chapter and checklist comparison confirmed exactly §§1, 7, 9, 19, 20 and 21 changed.
The preamble, existing H2 headings, twelve original M1 criteria and historical §21 text are intact.
The two protected additions are H45's scope bullet and the appended M1.13 criterion.
The mechanical auditor recorded `0 FAIL, 0 REVIEW` on the matching diff, so no REVIEW dispositions are required.
