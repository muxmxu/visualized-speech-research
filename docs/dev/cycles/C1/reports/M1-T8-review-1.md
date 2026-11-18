# M1-T8 independent semantic review 1

**PASS** for the frozen phase tree.
No finding requires a change before the D38 integration transaction.
M1.C1 awaits the required full master regression after squash and before push.

## Integration and acceptance

- The phase contains nine independently accepted task merges in dependency order, including T4a and T4b.
  The six-file integration delta adds the benchmark pair, the acceptance report and its two DESIGN decisions, and corrects two browser test interactions.
  The integrated runtime connects authenticated routes to the selected-device spectral DSP, the shared STFT viewport cache, framed spectrum and PCM responses, and the browser's WebGL and Frequency Analysis displays.
  Actual E-tool and Space input exercise masked chunked PCM with the original selection edges, and PDF browser input reaches a real raster download from the visible plots.
- M1.1 through M1.6 have their numerical and preset evidence, including 18 device-parameterized CPU cases and 18 documented conditional skips each for unavailable CUDA and MPS.
  M1.7 through M1.9 have final browser evidence for masked PCM, real range movement and request counts, and independent view settings.
  The production pointer probe changed the range value from −80 to −27, observed changed pixels and zero requests during the drag, then observed exactly one 512-point spectral request.
- M1.10 has a fresh-process cold peak of 1.234253 GiB against the 1.5 GiB limit and a separate warm full-lane measurement.
  M1.11 has the overlapping same-key test requiring one actual cache entry construction.
  M1.12 has whole-lane SciPy and masked boundary references with a maximum observed sample error of zero against the strict 1e−6 limit.
  M1.13 has eight final PDF browser cases, screenshot-relative pixel comparisons and matching independently read Poppler files, including the 1009 × 509 scrolled Lanes crop and 1167 × 102 clipped Frequency Analysis crop.
- The full phase evidence records 119 pytest passes, 36 device-condition skips, 37 Vitest passes and a final one-worker Chromium run with 66 passes, zero failures, skips or flaky results, and exit 0.
  The remaining AGENTS checks are documented as passed, using the configured system Chromium.
  The Chinese acceptance report includes M1.1–M1.13 and C1–C3, reasons for unavailable devices, measurements, deviations, H56 desktop and narrow evidence, the integrated Frequency Analysis and T-F screenshot, and PDF crop and reader screenshots.
  Its M1.C1 entry accurately records the pending master-side check.

## Browser fixture corrections

- The accepted T6 and T7 trees reproduced the narrow brightness failure when the second plot's sample fell beneath the Lanes scrollport.
  The corrected test keeps the original screenshot and samples the second plot from its own screenshot after scrolling.
  Both plots use measured geometry and every 3 × 3 sample is asserted inside the plot, its scrollport and the viewport.
  The narrow sample top edges are y=259 and y=291 inside respective visible intervals 204.6875–315.984375 and 236.6875–347.984375.
  Independent PNG decoding agrees with the test's channel sums of (591.33, 93, 93) and (93, 93, 592.67).
  All four original +100 brightness assertions and the original desktop, narrow UI and playback checks are preserved.
- The pre-fix T-F browser log shows the spectral surface intercepting the right-click at a fixed offset after moving and resizing the selection.
  The replacement uses an actionable, visible-point Playwright right-click on the selection itself and retains the assertions for movement, resize, visibility after tool change, context-menu zoom and dismissal.
  The test passed on the frozen runtime.

## Performance observations

The three CPU repetitions exercise production browser and HTTP paths with generated PCM16 fixtures.
For the initial and replacement draws, the probe matches the framed f16 response with the texture data used by an observed WebGL draw.
The warm stereo pan retains the original STFT key and measures the first channel through receipt of the complete framed body.
The color probe observes both a changed palette on draw and changed canvas pixels, and the gesture probe counts distinct frames with actual draws.
The M1.10 probe primes the default-cache full-lane key once, then times three authenticated 1024 × 256 viewport requests through complete body receipt.
The reported CPU medians are 3.5291 s for first draw, 71.1 ms for cached pan, 5.4 ms for color with zero requests, 565.9 ms for FFT replacement, 43.46 fps for gesture redraw and 89.02 ms for the separate cached full view.
The raw samples and medians agree with the acceptance report, which uses the earlier 4.173 s M0 row-1 measurement as the existing same-platform reference for that distinct operation.
The phase measurements establish the first platform baselines for rows 2–6.

## Scope and rule dispositions

The protected paths, frontend dependency manifests, tool configuration, DESIGN preamble and §§0–20 match the post-arch phase base.
The NOLA boundary and mask-edge decision D45 and full FFT length decision D44 are the only appended DESIGN lines.
The cumulative comparison from M0 has the recorded A1/A2 changes in §§1, 7, 9, 19, 20 and 21.
The recorded drift check verifies the M0/M1 routes, public API names and signatures, required paths and unchanged CLI, configuration and transport definitions.
The phase rule result is 0 FAIL and 9 REVIEW, and the integration delta has 0 FAIL and 0 REVIEW.

| REVIEW | Disposition |
|---|---|
| `frontend/src/api/client.ts:16` | V1#1, inherited from T5 review 2. Fetch network errors reach the notification boundary and other failures propagate. |
| `frontend/src/lanes/SpectralLane.tsx:37` | V1#1, inherited from T4 review 2. Request and decode failures are visible, with owned viewport aborts handled under §9.3. |
| `frontend/src/panels/FrequencyAnalysis.tsx:81` | V1#1, inherited from T5 review 2. Active HTTP and network failures are shown, superseded fetches are aborted under §9.3, and other active failures propagate. |
| `tests/test_spectral_dsp.py:20` | T1 and DESIGN §20, inherited from T1 review 3. CUDA is conditionally skipped with its unavailable-device reason. |
| `tests/test_spectral_dsp.py:26` | T1 and DESIGN §20, inherited from T1 review 3. MPS is conditionally skipped with its unavailable-device reason. |
| `tests/test_spectral_mask.py:11` | T1 and DESIGN §20, inherited from T3 review 3. CUDA is conditionally skipped with its unavailable-device reason. |
| `tests/test_spectral_mask.py:15` | T1 and DESIGN §20, inherited from T3 review 3. MPS is conditionally skipped with its unavailable-device reason. |
| `tests/test_spectrogram.py:325` | T1 and DESIGN §20, inherited from T2 review 3. CUDA is conditionally skipped with its unavailable-device reason. |
| `tests/test_spectrogram.py:329` | T1 and DESIGN §20, inherited from T2 review 3. MPS is conditionally skipped with its unavailable-device reason. |

## Covered state

Phase cut `367705b99db2907f1da9def199d099b499729a43`, phase merge HEAD `03f51dd48c6eb9f45b5d34f7b20b7e74936af109` and checked-in tree `94430040baaaeebca8d8891c9adbdce14947a55a`.
The reviewed worktree includes the unstaged integration delta and its three new files.
The independently regenerated full phase patch SHA-256 is `ef21e8ed09806bc8b3f98318afa17533d7e61b1d64a475e28632774f8803517a`.
The independently regenerated integration delta SHA-256 is `2a332b6f36c7b6cddc3cd611a1e6ab29a6b383ddd9099dc93a0e78ccada7a305`.
The acceptance report SHA-256 is `a0e20cd9188b2b3d9cc6742ff8d6a0b5d10e17b8717e19f069c05183f6996b87`.
Review verified the evidence manifest and used the frozen full-check logs and the independent audit verdict.
Review wrote this report only and reused the unchanged suite results.
