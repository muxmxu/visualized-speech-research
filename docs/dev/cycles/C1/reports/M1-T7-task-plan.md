# M1-T7 task plan for visible-region PDF export

## Scope and dispatch

Deliver M1.13 by downloading a one-page raster PDF of a rectangle drawn on a visible Lanes plot or the visible Frequency Analysis plot, following DESIGN §§9.3, 9.7, 19 and 20 and the H45 authorization recorded in B3 and D40.
Read `AGENTS.md`, `LIFECYCLE.md`, the effective `ORCHESTRATION.md` CODEX contract, the `impl` skill, `phase-M1.md`, `phase-arch.md`, `recon-M1.md` and `arch-A1-review-2.md` before implementation.
Run T7 serially after independently accepted, committed T4, T5 and T6, and cut `task/M1-T7` from the accepted T6 commit that contains both upstream tasks.
Use the phase plan's high-risk multi-module browser composition and PDF task assignment of `terra(high)` Worker, independent `luna(xhigh)` Mechanical Auditor or the declared CODEX fallback, and independent `astra(medium)` Task Reviewer for the particularly complex cross-layer and file-format checks.
Use the phase budget and recorded authorization, with the baseline T7 seats covering Task Planner, Worker, Auditor, Reviewer and the separate D38 Git executor.
Bind the task cut SHA, clean isolated worktree and actual model assignments in the private dispatch ledger after the dependencies are accepted.
Give the task one exclusive worktree writer and acquire the shared `checks` lock for build, audit and browser execution with one Playwright worker, isolated browser profile and cache, temporary `VSR_HOME` and ephemeral loopback ports.
Use the targeted independent `terra(medium)` Fact Check from the phase plan for any material unresolved dependency or platform fact before dispatch.

## Exact write set

Write only `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/state/pdfSelection.ts`, `frontend/src/lanes/SpectralLane.tsx`, `frontend/src/lanes/ExportSelection.tsx`, `frontend/src/render/spectrogram.ts`, `frontend/src/render/workspaceCapture.ts`, `frontend/src/render/pdf.ts`, `frontend/tests/pdf.test.ts` and `frontend/tests/e2e/m1-pdf.spec.ts`.
Keep implicit writes in the assigned worktree or its allocated temporary directories, including installed dependencies, tool caches, `src/vsr/web/`, `frontend/test-results/`, `frontend/playwright-report/`, generated WAVs, saved PDFs and temporary browser profiles.
Consume the T5 and T6 Frequency Analysis capture contract from the reviewed dependency tree and leave `FrequencyAnalysis.tsx`, backend code, package declarations, lockfiles, test configuration and protected files outside the write set.
Keep the existing authenticated entry points, browser permissions, data and audio write paths, and keep implementation and tests within the locked runtime and test dependencies.
Use a local browser download from a generated Blob and release its object URL after handoff to the browser, with no backend route, screen capture permission, user audio write, remote service, M2 interface or static `vsr.plot` output.

## Bind before dispatch

From accepted T4, bind the actual plot roots for waveform-only, spectral-only and combined Lanes views, their shared axes and colorbar bounds, selectors or refs, and the scrollport and dock ancestors clipping each root.
From accepted T4, bind CSS paint order and canvas backing-store mapping for the shared WebGL framebuffer and waveform canvas, including the viewed plot geometry, DPR rounding, WebGL viewport and scissor origin, render scheduling and the exact point where the currently displayed draw is readable.
From accepted T4, bind which visible backgrounds, axes, labels, colorbars and annotations are Canvas2D, DOM or other painted content and where their placement and styling originate.
From accepted T5 as retained by T6, bind the Frequency Analysis eligible root and the concrete uPlot curve and axes canvas, visible DOM labels and displayed legend or any other plotted layer, including their backing sizes, clips, stacking and stable loaded-state selectors.
From accepted T6, bind the time and T-F selection and playhead ownership, paint order, visible shapes and current pointer and keyboard routing, along with the stable UI fields or DOM attributes that independently expose the exact rectangle, originating view and effective play state.
From accepted T5 and T6, bind the frame-mode hover and pointer-leave handlers and pending response behavior so export entry, drag and exit can intercept the gesture without initiating analysis or changing selection or play state.
Confirm that all required T5 and T6 surfaces are reachable within the T7 write set and carry any missing capture reference through the predecessor or an approved plan amendment before dispatch.
Bind the exact fixture entry points and e2e selectors from accepted dependency tests, the §20 pixel-test Chromium and a separately identified full Chromium binary with the built-in PDF viewer enabled for the independent reader smoke.

## Gesture and scene capture

Add an accessible toolbar screenshot action using the existing tool styling, tooltip and pressed state, and keep the capture selection and pointer lifecycle in `pdfSelection.ts` and `ExportSelection.tsx`.
Intercept the gesture on the eligible plotting surface before existing lane, chart, hover or shortcut handlers act, retaining the source surface selected by the initial pointerdown even when the drag crosses chrome or another panel.
Use client coordinates, capture the initiating pointer, commit on release and clear the gesture on Escape, pointer cancellation or empty crop without changing the active lane or view, selection values, playhead, playback or scroll position.
Keep the transient crop overlay out of the capture layers and avoid moving or reflowing the scene when arming, committing or dismissing the tool.
In `workspaceCapture.ts`, intersect the normalized drag with the initiating plot, the browser viewport and each visible clipping ancestor, using the actual scrollport and content clip and the axes, labels, colorbar or legend within that plot.
Consider viewport-relative content coordinates once so an already scrolled DOM rectangle is never offset a second time, and apply the matching local clip at each layer to preserve overlap and scissor boundaries.
Start with the visible plot background and follow the committed screen paint order through clipped waveform Canvas2D, shared WebGL spectrogram, visible curves and plot annotations, including axes, text, colorbars or legends, selection fills and edges, playhead and other displayed plot annotations where they overlap the crop.
For Frequency Analysis use the same capture flow with the currently painted uPlot canvases and any visible DOM plot labels or legend, retaining their displayed text, swatches, opacity, backgrounds and measured positions.
Use actual rendered canvas layers and reproduce visible DOM plot annotations from current paint values, measured placement, fonts and borders.
Copy the shared framebuffer into the composition while the existing renderer's current draw is readable, using a synchronous copy during its paint from the current cached state if required by the committed buffer lifetime.
Map each source canvas through its actual backing size and client rectangle, and when using `readPixels` convert bottom-left WebGL rows to the top-left viewport orientation exactly once.
Keep other GL surfaces, clips and transparent overlays aligned by converting from each source's physical coordinate system to the common crop origin without resampling the selected viewport pixels.
Use the source plot's displayed background for the opaque JPEG and omit dock tabs, panel controls, surrounding chrome, the crop overlay and pixels hidden by scrolling or clipping.
Use only the current browser scene and cached draw state, without queuing a fetch, DSP run or analysis recomputation, and verify the live renderer timing under scroll and after a display change before relying on it for capture.

## Physical bounds and file format

After intersecting in CSS coordinates, form half-open physical bounds with `left = ceil(cssLeft * dpr)`, `top = ceil(cssTop * dpr)`, `right = floor(cssRight * dpr)` and `bottom = floor(cssBottom * dpr)`.
Use `right - left` and `bottom - top` for canvas, raster and page sizes and cancel when either is nonpositive, including a nonzero CSS drag with no complete device pixel.
For a DPR 1.5 drag from `(34.2,28.2)` to `(130.2,69.2)` in a plot `[20.2,10.2,120.75,80.75]` clipped by `[25.1,24.1,112.4,74.4]`, require physical bounds `[52,43,168,103)` and width 116 by height 60.
For a delivered `pointerup.clientX` of `66.66666412353516` from a target of `100 / 1.5` at DPR 1.5, require right edge 99 when the release edge is the minimum right clip.
In `pdf.ts`, encode the crop with Canvas2D JPEG and write byte-accurate PDF objects, image stream lengths, xref offsets, trailer and `startxref` using existing typed arrays and Blob primitives.
Define one page with `MediaBox [0 0 w h]` in points and one `DCTDecode` image of `w × h` physical pixels painted across that page at matching aspect ratio and correct orientation.
Keep `pdf.test.ts` focused on observable crop geometry and PDF structure, including reverse direction, clipping, an empty physical crop, fractional precision and stream lengths and xref offsets across binary bytes.

## Independent browser and reader evidence

In `m1-pdf.spec.ts` use the real authenticated Chromium workspace and existing server fixture with deterministic generated audio, with a W+S lane containing identifiable signal and quiet interiors and a Frequency Analysis plot displaying identifiable curves, axes, labels and legend.
Build real time and T-F selections with existing controls, record their numeric values and originating view evidence before export, and pause or stop playback before taking the reference screenshot.
At DPR 1.5, scroll until a Lanes plot is partially clipped, hold viewport and layout stable until data and paints settle, and capture a device-scale Chromium viewport PNG and independently measure the plot and visible ancestor clips before arming the screenshot tool.
Repeat the independent reference capture and measured geometry for a visible Frequency Analysis plot with a displayed legend and a stable, loaded analysis configuration.
Drive each real drag with unrounded fractional CSS coordinates away from device-pixel ties, with at least one edge beyond a visible clip, and observe delivered pointerdown and pointerup client coordinates with a test-side listener that leaves event delivery intact.
Exercise the separate `100 / 1.5` precision case in Chromium, recording the delivered coordinate and verifying the independently computed edge, including edge 99 for the recorded A1 delivered value.
Derive the expected rectangle from observed events and pre-gesture geometry once in the test without reading application crop state, its composition canvas or the production geometry helper.
Place a distinct test-only chrome marker inside the raw drag and outside the eligible clip, independently verify that marker is present at the excluded viewport coordinates, and assert its absence and the gesture color's absence in the decoded export using a comparison robust to the accepted JPEG error.
Observe real requests from before arming through release and download and across the pending hover or viewport scheduling window after the gesture, requiring zero new data requests including waveform, spectrogram, spectrum and PCM.
Check unchanged time and T-F selections, originating view, playhead and paused state after each export, and verify Escape and zero-area cancellation produce no download and preserve the same state and request counts.
Wait for the real Playwright download, save it in test output, and parse its bytes in the test using Node and the PDF's `startxref`, xref, indirect object offsets and declared stream lengths independently of the production writer or unit-test fixtures.
Walk the PDF catalog and page tree to assert one actual page, verify `MediaBox`, locate the unique `DCTDecode` image and assert image dimensions, stream boundaries and the page-filling content transform.
Decode the extracted JPEG and the independent viewport PNG using Chromium `createImageBitmap` and Canvas2D `getImageData`, preserving each image's native size.
Compare multiple interior pixels in spatially separated, stable high-contrast patches for waveform, spectrogram and visible selection or playhead, and for Frequency Analysis curve, axis, label and displayed legend.
Require a maximum absolute difference of 20 per RGB channel at each compared crop-relative pixel, placing patches away from antialiased edges and verifying each target patch against nearby background so a blank, shifted or stale capture fails.
Capture the visible interaction as `frontend/test-results/screens/M1-pdf-crop.png` and retain the downloaded sample and reference PNG in task artifacts for independent review.
Have the independent Auditor open the actual saved PDF from this run in separately selected full Chromium with its built-in viewer enabled, record the visible single page, orientation and content, and keep that smoke evidence separate from the automated file and pixel assertions.
Use §20's browser selection path for the pixel tests without assuming the standard Playwright headless launcher provides the built-in PDF viewer.

## Final checks and evidence handoff

In `frontend/`, run `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m1-pdf.spec.ts` on the final task tree.
Use the captured dependency selectors for the scoped browser regression and run `npx playwright test --workers=1 tests/e2e/m1-spectrogram.spec.ts tests/e2e/m1-frequency.spec.ts tests/e2e/m1-audition.spec.ts tests/e2e/m0-workspace.spec.ts tests/e2e/m0-playback.spec.ts` against the appropriate built assets when those existing specs exercise the changed paths.
If an existing regression uses the dev/test-only hook, build its served assets with `npm run build -- --mode test` before that browser run and verify the default production build omits the hook.
From the worktree root run `git diff --check <recorded-cut-commit>` and `python3 scripts/check_diff_rules.py --base <recorded-cut-commit>`, audit changed paths and protected sections against the cut, and perform the LIFECYCLE public-repository scan.
Return M1.13 evidence for both plots with delivered coordinates, output dimensions, sampled RGB differences, excluded marker and gesture results, before-and-after selection values, data request count, reader result, artifact paths and final diff hashes.
Return the Worker output contract with actual command outcomes, touched and generated paths, unresolved facts and all owned subprocesses stopped, and leave staging, commit and push to the authorized D38 workflow.
Use project gate 2 for a missing required check or failed acceptance with its actual output, and route failed faithful composition through D40 design consultation with the real browser evidence.
Advance to T8 only after independent mechanical and semantic verdicts are current on the reviewed diff and the authorized T7 commit exists, then run the full AGENTS regression on the integrated tree under T8.
