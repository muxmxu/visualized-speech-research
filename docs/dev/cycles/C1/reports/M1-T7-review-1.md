# M1-T7 independent semantic review 1

**FAIL.**
An export gesture starting on the floating Play button downloads the PDF and requests PCM, violating DESIGN §§9.7 and 20.
All eight source hashes matched the audit-2 manifest against base `b419b77beeddcfedb00c3654506866c83a8a7d11`.

## Blocking findings

1. `frontend/src/lanes/ExportSelection.tsx:16` captures the pointer on the original DOM target.
   Chromium dispatches a click to that button after the pointerup handler consumes the release and completes the export.
   The independent probe opened a generated WAV, created a 0.200–0.700 s ordinary time selection, selected Welch, armed PDF, pressed at the center of the selection's floating Play button, dragged 40 CSS px past the right edge and 20 CSS px below the button, and released.
   A real download completed and the 400 ms request observation returned `["/api/lanes/deb1a86a/pcm"]` against expected `[]`.
   The private `tmp/M1-T7-review1/gesture.spec.ts` and `gesture.log` preserve the reproducer and failing assertion.
   It ran under the shared checks lock with real Chromium and the existing authenticated fixture.
   Rework must isolate the export gesture through synthetic click dispatch, with a regression covering the real floating control.
2. The sole `REVIEW C1 frontend/src/lanes/ExportSelection.tsx:28` is a **defect**.
   The catch converts every failure from scene traversal, compositing, JPEG encoding, PDF construction and download into a notification and resolves the chain.
   V1#1 covers HTTP and V1#7 covers atomic file replacement.
   This browser-only operation performs neither, and §21 D40 authorizes export without defining a catch for internal implementation failures.
   Remove the blanket handler or narrow handling to a specifically authorized boundary.

## Passing evidence and scope

- Geometry uses delivered client coordinates and applies inward rounding once after intersection.
  At DPR 1.5 the scrolled Lanes bounds were [566,197,1575,706), yielding 1009 × 509, and the fractional clipped Frequency sample measured 1167 × 102.
  Release at 66.66666412353516 CSS px produced right edge 99.
- The recorder copies the existing preserved WebGL canvas, waveform and uPlot canvases and composes axis, label, colorbar, legend and selection layers.
  The floating Play buttons are panel controls excluded by §9.7, while selection fills and their handles are plot annotations.
  The scrolled reference sampled spectrogram, waveform and handle at maximum RGB differences 4, 2 and 1.
  Frequency curve, legend and label groups measured 2, 1 and 1.
  Test-side PNGs, delivered coordinates and decoded JPEGs are independent of the application composition canvas.
  Both clipped crops omitted their green chrome markers, and eight independently sampled gesture patches differed from the pre-gesture reference by at most one level in the exported raster.
- The ordinary plotted-surface gestures preserved selection, selected view, playhead and paused transport with zero observed data requests.
  The cancellation case downloaded nothing.
  The Play-origin probe above exercises a different hit target.
- The byte-based PDF writer and the auditor's reader agreed on the catalog, single-page tree, dimensions, image and content stream lengths, unique DCT image, xref and page-filling transform across eight downloads.
  Full Chromium 156 displayed both main crops upright on one page.
  The private audit-2 artifact directory contains the PDFs, reference PNGs, observations and viewer screenshots.
- Seven dedicated PDF Chromium cases, 37 Vitest cases, typecheck, lint and both builds passed in the recorded runs.
  The earlier scoped browser run had 64 passes and one failure at `m1-spectrogram.spec.ts:136` where narrow-layout brightness was 107 against expected greater than 207.
  The same failure reproduced on accepted T6 and belongs to T8 integration with its assertion intact.
- The eight paths are within the task plan and introduce no backend route, dependency, permission, audio write or protected-file change.
  This review edited no implementation or test source in the task worktree and made no Git transaction.
