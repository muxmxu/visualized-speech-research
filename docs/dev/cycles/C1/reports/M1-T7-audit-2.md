# M1-T7 independent mechanical audit 2

**Verdict: PASS** for the corrected T7 mechanical and PDF evidence on the hash set below.
The previously identified narrow workspace failure remains a separate integration finding.
The task base is `b419b77beeddcfedb00c3654506866c83a8a7d11`.

- **Scope and protection PASS.** All eight changed frontend paths remain in the planned write set.
  DESIGN, protected files, config and preexisting tests match the task base.
  Whitespace checks passed and the public scan found no matches across 587 added lines, including all six new files.
- **Checks PASS for the corrected PDF path.** The final Worker log records passing typecheck, lint and all seven Chromium PDF cases.
  The corrected source passed all 37 Vitest cases and both production and test-mode builds, with the production browser hook excluded.
  The final browser run changed the PDF e2e test after those builds and reran typecheck and lint.
  The corrected product source affects the export composition path.
- **Earlier scoped regression.** The earlier scoped browser run returned 64 passed and one failed.
  The failure at `m1-spectrogram.spec.ts:136` expected brightness above 207 and measured 107 while the second spectrogram was below the 800 px Lanes scrollport.
  The identical failure reproduced independently at the accepted T6 base, where the Frequency Analysis pane already occupies the lower viewport.
- **Fractional clipping and PDF structure PASS.** The fractional Frequency clipping red case produced 1166 × 102 from the old source and the final case produced the independently expected 1167 × 102.
  The distinct pointer precision test verified release at 66.66666412353516 CSS px and device-pixel right edge 99.
  The browser tests now follow the xref and trailer to the catalog, page and streams for both clipped PDF samples.
  The independent parser verified page tree, one DCT image, image dimensions, MediaBox, stream lengths and page transform in all eight PDFs from the final Worker run.
- **State, gesture and pixels PASS.** The scrolled Lanes crop preserved the T-F interval 0.200–0.700 s and band 660.901–1038.270 Hz, and the clipped Frequency crop preserved an ordinary 0.200–0.700 s time selection.
  The final clipped tests checked the selected view, playhead, paused state, no new data requests and no decoded chrome-marker pixels.
  In the scrolled sample, spectrogram, waveform and selection-handle sample differences were at most 4, 2 and 1 RGB levels.
  The separate Frequency curve, legend and label sample groups differed by at most 2, 1 and 1 levels.
  The tracked browser test directly compares the painted gesture against the before-gesture screenshot and decoded export for each plot.
  A separate same-run scrolled comparison found eight separated 3 × 3 patches where the gesture changed RGB by 34–38 and the export differed from the before-gesture screenshot by at most 1.
- **Full Chromium reader PASS.** The native full Chromium 156 session loaded the built-in PDF viewer for the actual final exports and showed one upright landscape page for each.
  The 1009 × 509 Lanes export showed clipped waveform and spectrogram layers, axes, colorbars and T-F selection handles.
  The 1167 × 102 clipped Frequency export showed a Welch curve, the visible axes and its legend in the expected orientation.
  The second 1198 × 197 Frequency export showed the curve, frequency axis labels and visible legend.
  The independent parser and reader ran under the exclusive shared check lock.
- **Artifacts.** The private `tmp/M1-T7-audit-2-artifacts/` copy includes the Worker PDFs, the viewport references, `viewer-scroll-lanes.png`, `viewer-frequency-clipped.png` and `viewer-frequency.png`.
  The interaction screenshot `frontend/test-results/screens/M1-pdf-crop.png` has SHA-256 `095ca568fcb4a279a8312b5b0a5226d9868689539119ef6b838f1778d6469feb`.

The final rule output was `0 FAIL, 1 REVIEW`.
The Task Reviewer owns its disposition.

```text
REVIEW C1 frontend/src/lanes/ExportSelection.tsx:28: void exportPlot(source.root, source.bounds, source.lanes, start, end).catch((error: unknown) => notifications.show({ title: 'Export failed', message: String(error), color: 'red' }));
```

```text
721bb1569c0422458581b504e59c5492bfa156889105f630d619dd1030a67ec5  frontend/src/App.tsx
bbf0ee553ffb203a96033405ca25b4aeb7a4390a1f0e9950d0a52382f696b0f0  frontend/src/lanes/ExportSelection.tsx
4e782fb7913a849fe93a4373f766ff455c46b2d7682a516df22b1fff5715efb4  frontend/src/render/pdf.ts
ed40fada14ab9b03fff4d52bf24a3c48dc3309ad0be40bb7dac6d02ca5b54588  frontend/src/render/workspaceCapture.ts
9f0a6fb68e1c7bc9f74311d59f95bc01243122b263d55cf868ab9e69620e58ac  frontend/src/state/pdfSelection.ts
91da0189d9056dbf29756f641bf999595ecb44689524466b204b69acb3d6b670  frontend/src/styles.css
7ac4e9f178b5e373d26d9b77708e79b3c6953503b32522f43a5ef41f1a3fd8f8  frontend/tests/e2e/m1-pdf.spec.ts
d790f8f0cade501591aaf368625aa4e7fd59df802c9ae4bcadcd307b1d412627  frontend/tests/pdf.test.ts
```
