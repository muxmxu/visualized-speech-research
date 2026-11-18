# M1-T7 independent mechanical audit 1

**Verdict: FAIL** for incomplete automated M1.13 coverage on the first frozen revision.
The actual exported samples pass the independent structure and viewer checks.
The checked task base is `b419b77beeddcfedb00c3654506866c83a8a7d11`.

- **Scope and protection PASS.** The eight changed paths below are in the task write set.
  Protected files, configuration, DESIGN and preexisting tests are byte-identical to the base.
  The public repository scan covered all 532 added lines, including all lines of the six new files, and found no matches.
- **Rules and whitespace PASS with one REVIEW.** The rule check returned `0 FAIL, 1 REVIEW`.
  The Task Reviewer owns the disposition.
  Git whitespace checks found no diagnostics, including on the six new files.
- **Worker commands.** Typecheck, lint, 37 Vitest cases, and production and test-mode builds passed.
  The scoped Chromium run returned 64 passed and one failed.
  The unchanged narrow two-tone case at `frontend/tests/e2e/m1-spectrogram.spec.ts:136` expected a red-green-blue brightness sum above 207 and received 107.
  The same assertion failed with the same values on the archived T6 baseline.
  The 800 px baseline screenshot shows the Frequency Analysis pane above the second spectrogram sample coordinates, with the second spectrogram outside the Lanes scrollport.
- **Independent focused checks PASS.** Two PDF Vitest cases and seven real Chromium cases passed against a production build.
  The production bundle omitted the browser test hook.
  The DPR 1.5 case observed release at 66.66666412353516 CSS px with physical right edge 99.
- **File structure and reader PASS.** Independent parsing of the eight Worker and eight auditor downloads followed the trailer and cross-reference entries into the page tree and verified one page, matching MediaBox and JPEG dimensions, declared stream lengths and the page-filling transform for each file.
  The full Chromium 156 built-in PDF viewer displayed `1 / 1` for `scroll-lanes.pdf` (1009 × 509) and `frequency.pdf` (1198 × 197).
  Both pages were upright and showed the expected contents.
  The Lanes sample showed waveforms, spectrograms, axes, colorbars and the T-F rectangle, while the Frequency Analysis sample showed a curve, axes, labels and visible legend.
- **Observed pixels and state.** Scrolled Lanes sampled spectrogram, waveform and T-F handle patches differed from the reference by at most 5, 2 and 1 RGB levels respectively.
  The Frequency sample's curve, legend and label groups differed by at most 2, 1 and 1 RGB levels.
  Both clipped cases observed zero new data requests and zero decoded pixels matching the excluded green chrome marker.
  The scrolled Lanes test verified unchanged T-F fields of 0.200 s, 0.700 s, 660.901 Hz and 1038.270 Hz.
  The independent gesture check used the retained Worker gesture PNG and the auditor's matching crop geometry, pre-gesture PNG and export.
  On eight separated 3 × 3 patches, the visible gesture changed at least one RGB channel by 34–38 per patch and the decoded JPEG differed from the unarmed reference by at most 1.
- **Retained automated M1.13 coverage FAIL.** `frontend/tests/e2e/m1-pdf.spec.ts` saves the visible gesture screenshot and checks the green chrome marker but contains no direct assertion that the gesture itself is absent from the decoded crop.
  The Frequency fixture checks unchanged Start, End and Duration with all three at 0.000 and never creates an ordinary time selection.
  The PDF e2e's full object checks run on the separate interior crops, with fixed object IDs, while the required scrolled Lanes and clipped Frequency samples verify the image dimensions by whole-file pattern matching.
  The test does not follow the downloaded trailer's catalog reference or the page-tree and stream references for those clipped samples.
  DESIGN §§19–20 and the task plan require these checks in the automated PDF evidence.
- **Artifacts.** The interaction screenshot is named `frontend/test-results/screens/M1-pdf-crop.png`.
  The private `tmp/M1-T7-audit-1-artifacts/` directory contains the retained Worker interaction screenshot and the two viewer screenshots `viewer-scroll-lanes.png` and `viewer-frequency.png`.

```text
REVIEW C1 frontend/src/lanes/ExportSelection.tsx:28: void exportPlot(source.root, source.bounds, source.lanes, start, end).catch((error: unknown) => notifications.show({ title: 'Export failed', message: String(error), color: 'red' }));
```

The following SHA-256 values identify the revision audited here.
The source correction began after the focused run and the viewer smoke used the retained artifacts from the focused run.

```text
721bb1569c0422458581b504e59c5492bfa156889105f630d619dd1030a67ec5  frontend/src/App.tsx
bbf0ee553ffb203a96033405ca25b4aeb7a4390a1f0e9950d0a52382f696b0f0  frontend/src/lanes/ExportSelection.tsx
4e782fb7913a849fe93a4373f766ff455c46b2d7682a516df22b1fff5715efb4  frontend/src/render/pdf.ts
8f773a86af1272626d376d5208a4abd6b4e72fb945b9f23d6b0e92f7c7d6ddb4  frontend/src/render/workspaceCapture.ts
9f0a6fb68e1c7bc9f74311d59f95bc01243122b263d55cf868ab9e69620e58ac  frontend/src/state/pdfSelection.ts
91da0189d9056dbf29756f641bf999595ecb44689524466b204b69acb3d6b670  frontend/src/styles.css
263a315bffb3dc7d3132e32424fa14b4a2b78f2aac106c746093b3e7cfa9c5ca  frontend/tests/e2e/m1-pdf.spec.ts
d790f8f0cade501591aaf368625aa4e7fd59df802c9ae4bcadcd307b1d412627  frontend/tests/pdf.test.ts
```
