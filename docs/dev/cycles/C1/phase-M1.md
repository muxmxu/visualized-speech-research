# C1 phase M1 executable plan

## Entry and dispatch

M0 passed all nine exits in [its acceptance report](../../../acceptance/M0.md), and its committed code is `99286649b43569fea9153c9a5ecd6753886f4377`.
Use the Controller's fresh private dispatch ledger for the actual tip, clean task tree, branch base, authorization, model availability and host bindings.
[Reconnaissance](reports/recon-M1.md) verified the existing M0 entry points, a headless Chromium WebGL2 context and a synthetic Canvas2D JPEG wrapped in a one-page PDF and opened by an independent reader.
The browser probe establishes feasibility for those components, while M1.13 requires real application rendering, composition, clipping and download evidence.
The implementation uses the current project and host execution path validated in M0, with no external compute provisioned.
Keep generated fixtures, build outputs, screenshots, reader artifacts, caches and browser profiles in the assigned worktree or its allocated temporary directories.
Leave the existing untracked root npm files outside the worktrees, npm commands and Git transactions.

H45 authorizes the PDF additions specified in the [architecture plan](phase-arch.md), with the tracked scope and decision in [B3](../../backlog.md) and [D40](../../decisions.md).
The same architecture phase integrates [D43](../../decisions.md), which specifies the complete T-F rectangle separately from each returned PCM chunk for T3 and T6.
H48 and B4 remain assigned to C3 M7.
M1 work begins after the arch delta is independently accepted and integrated, and M2 begins after all M1 exits pass.
The original first twelve DESIGN items retain their order and thresholds, and M1.13 is the appended H45 item.
Use `AGENTS.md`, `LIFECYCLE.md`, the effective ignored `ORCHESTRATION.md` CODEX table, the `impl` skill, the applicable DESIGN sections, D38 and this plan in each dispatch.
Record the standing authorization boundary and source references in each handoff, and use the local host contract for browser selection and resource bindings.
The independent `astra(medium)` [M1 Plan Review](reports/plan-review-M1.md) returned FAIL.
This is the sole Planner amendment and binds all four findings to arch A1 or the tasks below.
Dispatch follows the CODEX amendment rule and the listed dependencies.
The Controller records the proposal, scope and base for the authorized protected-section exception before dispatching A1.
T4 also implements the H54 workspace repairs from [the UI consultation](reports/ui-design-consult-H54.md), using existing DESIGN §9 controls, palette and dependencies.

## Execution and checks

| Task | Depends on current PASS and committed tree | Worker and CODEX task type | Risk | Semantic Reviewer | Task Plan and Fact Check |
|---|---|---|---|---|---|
| A1 | M0 | `terra(medium)`, documentation and spec delta | high | `sol(xhigh)` for protected requirements | No separate Task Plan, completed PDF preflight supplies feasibility |
| A2 | A1 | `terra(high)`, final integration | normal | `sol(high)` | No, use LIFECYCLE Integration |
| M1-T1 | A2 | `terra(high)`, multi-module DSP and public API | high | `sol(high)` | No, numerical cases below and recon |
| M1-T2 | M1-T1 | `terra(high)`, multi-module cache and transport | high | `sol(xhigh)` | Task Planner `sol(medium)` for chunk, pyramid and coalescing boundaries |
| M1-T3 | M1-T2 and the A2 D43 contract | `terra(high)`, multi-module mask and PCM | high | `sol(xhigh)` | Task Planner `sol(medium)` for absolute grids and resampling margins under D43 |
| M1-T4 | M1-T3 | `terra(high)`, multi-module rendering, view state and H54 workspace design | high | `sol(high)` | Task Planner `sol(medium)` for viewport/scissor, request timing, responsive layout and browser pixel evidence |
| M1-T5 | M1-T4 | `terra(high)`, multi-module analysis panel | normal | `sol(high)` | No, use §8.4 and the completed recon |
| M1-T6 | M1-T5 | `terra(high)`, multi-module selection and transport | high | `sol(high)` | No, use §9.2, §9.4, §9.6 and T3 contract |
| M1-T7 | M1-T6 | `terra(high)`, multi-module browser composition and PDF | high | `astra(medium)` for the particularly complex cross-layer and file-format verification | Task Planner `sol(medium)` with the accepted arch delta and recon |
| M1-T8 | M1-T1 through T7 | `terra(high)`, final integration and benchmark | high | `sol(high)` | No, use LIFECYCLE Integration and the benchmark definitions below |

An independent `luna(xhigh)` Mechanical Auditor precedes the named semantic Reviewer for every task.
Record the actual model and effort, and dispatch an independent `terra(medium)` Auditor under the CODEX fallback if the runtime lacks Luna.
Run a targeted independent `terra(medium)` Fact Check if an open dependency or the cause of a failed platform check rests on an unverified fact.
A failed PDF composition trial goes through D40 design consultation with the recorded browser evidence.
An ambiguity requiring an API or acceptance change is a Scope finding, and the Controller continues any independent work under the dependency and resource rules.

Tasks are serial because routes, workspace entry points, playback and generated outputs share resources.
Each task takes an exclusive worktree writer lock, including formatters and generators, and each audit or browser check takes the single `checks` lock.
Use one browser worker per run and one device benchmark or memory measurement at a time.
Readers and audit subprocesses use that task's isolated temporary directories, caches, a temporary `VSR_HOME` and ephemeral loopback ports.
Keep GPU work serial if any local GPU is available, and return the Worker output contract with owned subprocesses stopped.
Implicit writes include `.venv/`, `.ruff_cache/`, `.pytest_cache/`, `__pycache__/`, `frontend/node_modules/`, `frontend/test-results/`, `frontend/playwright-report/`, `src/vsr/web/`, ignored tool caches and temporary generated fixtures.
Run Python commands from the worktree root and frontend commands from `frontend/`.
Use the existing Chromium path from the host contract through `VSR_E2E_CHROMIUM` or the Playwright install procedure in DESIGN §20.

Use `task/arch-A1`, `phase/arch`, `task/M1-T1` through `task/M1-T7` and `phase/M1`, preserving branch creation bases in the ledger.
The first task branches from the integrated phase baseline, and each successor branches from its reviewed dependency as prescribed in LIFECYCLE Integration.
D38 reserves Git commits and integration to the authorized independent top-level executor, with the integration Worker as final-tree writer and the Controller coordinating records and authorized pushes.
The Auditor verifies the allowed paths, checks evidence on the current diff, runs `python3 scripts/check_diff_rules.py --base <recorded-cut-commit>` and performs the LIFECYCLE protection and public-repository checks.
The Reviewer supplies every REVIEW disposition, and a FAIL blocks merge.
Preserve a prior PASS only for unchanged covered state, and apply the contract's two consecutive failure rounds and one task amendment before a further failure becomes BLOCKED.
Write reports via the Controller under `reports/<task>-<seat>-<attempt>.md` using the contract's existing report format.
A practical smoke command for any browser task is `npm run build && npx playwright test --workers=1 <test path>`.

## M1-T1 — Shared spectral numerics and presets

Deliver the shared §8.1, §8.4 and §8.6 DSP, the §16 public interfaces and the authorized preset and spectrum endpoints.
Implement STFT dB and times/frequencies with the specified periodic windows, plus frame, Welch and full spectrum, statistics, units and activity filtering.
Read the bundled preset TOML with `importlib.resources` and implement §16 rounding, axis bounds and spec formatting.
Use the same kernels for public APIs and routes, with selected-device float32 computation and CPU public results.
Bind to the existing device accessor, authenticated FastAPI registrations, lane-time conversion and Python framed encoder from recon.
Write `src/vsr/dsp/{__init__,stft,spectrum}.py`, `src/vsr/{__init__,presets}.py`, `src/vsr/server/app.py`, `tests/test_spectral_dsp.py` and `tests/test_presets.py`.
Run `uv run pytest -ra tests/test_spectral_dsp.py tests/test_presets.py tests/test_server.py` and verify the §16 signatures with `inspect.signature`.
Check the two new routes for authentication, request validation, preset response shape and framed spectrum frequencies, units and statistics.
Provide M1.1, M1.2, M1.4 and the relevant M1.5 evidence.

## M1-T2 — Bounded spectrogram cache and viewport response

Deliver the §8.3 STFT spectrogram endpoint from the T1 kernel, with a byte LRU, f16 chunks and pyramids, absolute pooling and same-key coalescing.
Bind the design cache key to lane id, version, selected channel and transform parameters using `Session`, and use the existing `cache_bytes` configuration.
Exercise the oversized-matrix scalar and viewport path, lane maximum stability, cache invalidation on changed version and coalescing with overlapping requests.
Verify odd framing boundaries and log rows using the supplied independent numeric examples.
Keep the §8.3 STFT intermediate computation on the selected device and cache the specified f16 representation.
Write `src/vsr/server/{app,routes_spectrogram,session}.py`, `src/vsr/dsp/stft.py` where the shared kernel needs chunk addressing, and `tests/test_spectrogram.py`.
Run `uv run pytest -ra tests/test_spectrogram.py tests/test_spectral_dsp.py tests/test_server.py`.
Use a fresh subprocess and cold cache for the first full-viewport calculation on the M1.10 fixture defined below and measure the process peak RSS in GiB.
Assert RSS is strictly less than 1.5 GiB and record the full-lane calculation evidence.
Provide M1.3, M1.10 RSS, M1.11 and the relevant M1.5 evidence.

## M1-T3 — T-F mask and PCM chunk continuity

Deliver the §15 shared T-F mask and the §7/D43 masked PCM mode through the existing authenticated route with the window parameters from the originating view.
Preserve ordinary PCM behavior and sample-rate conversion, and use one absolute source/sample grid across expanded analysis and resampling margins to preserve the specified slice equivalence.
Bind the server to `t0,t1` as the returned chunk bounds and `selection_t0,selection_t1` as the full rectangle bounds, all in the project timeline.
Use lane-relative absolute STFT centers and the fixed `win_length // 4` mask hop, so a 20 s chunk seam inside a rectangle has continuous mask weights.
The Task Planner binds the analysis and polyphase margins, lane edges and centered padding against the accepted D43 reference before dispatch.
Write `src/vsr/dsp/edit.py`, `src/vsr/server/app.py`, `tests/test_pcm.py` and `tests/test_spectral_mask.py`.
Run `uv run pytest -ra tests/test_pcm.py tests/test_spectral_mask.py tests/test_server.py`.
Use a generated 44 s lane at 44.1 kHz, requested 48 kHz (`up=160, down=147`), nonzero lane offset and an off-phase destination start such as sample 100003.
Send authenticated requests for adjacent 20 s ranges `[100003,1060003)` and `[1060003,2020003)`, expressed through the normal lane offset and timeline conversion.
For unmasked PCM, compare the joined output to the corresponding slice of `scipy.signal.resample_poly` on the entire lane.
For masked PCM, generate an in-band tone through the seam and build the reference independently of the chunk helpers from a whole-lane centered STFT, the §15 cosine mask evaluated once at the true rectangle time and frequency edges, ISTFT and one whole-lane `resample_poly` pass.
Compare both chunks of the 40 s rectangle to that reference and compare the identical first chunk requested as a complete 20 s rectangle to its own reference.
Require a detectable difference between those first-chunk outputs near the real 20 s edge and max absolute sample error <1e-6 for each comparison, including samples on both sides of the interior seam and separate lane-edge cases.
Exercise invalid masked query bounds at the HTTP boundary and calculate M1.6 band amplitudes independently from output.
Provide M1.6, M1.12 and the relevant M1.5 evidence.

## M1-T4 — Spectrogram rendering and per-view controls

Deliver spectrogram workspace views, Display controls and frequency hover through the committed T1–T3 frontend-facing contracts.
Reuse M0 waveform scheduling and shared time coordinates, preserve lane playback identity, and keep channels, FFT/display settings and active view identity consistent.
Implement W, S and W+S, Add view, separable view FFT settings, frequency bounds/zoom, specified axes and colorbar, colormaps, presets and Copy spec.
Use a single WebGL2 context with view scissor, R16F with unpack alignment 1, CSS-pixel requests, shared time viewport with buffered texture reprojection, and §9.3 scheduling and cancellation.
Use framed returned row and column coordinates and f16 hover values marked approximate.
Create Display in the initial right inspector group and make it the active inspector on first use.
On restored `vsr-layout`, add Display once alongside the existing Properties/Settings tabs while preserving loaded panels, group sizes and selected tabs.
Seed localStorage with a serialized M0 layout containing the original `lanes`, `files`, `properties` and `settings` panel IDs, a resized side group and active Settings.
Assert the existing docking, size and active tab persist and the Display tab is reachable exactly once after reload.
Use two audio lanes and Add view to verify that changing a view leaves the other view's FFT independent, then invoke the §9.1 Apply to all lanes action and verify the chosen setting reaches both lanes.
Check both the zero-fetch display-color path and the exactly-one-request FFT change on the single mono view fixture.
In real Chromium, render two rectangles for the same generated mono lane with disjoint frequency ranges or distinct palettes and a tone/quiet pattern whose bright regions have predictable pixel positions.
Require an observed odd `cols` for at least one uploaded texture, using a fixture and viewport that yield an odd unpooled frame count.
Sample the real browser screenshot, using the browser's image decoder, for contrasting in-view regions and the background outside each view's clip before and after a scroll or pan.
Assert the expected placement and absence of cross-view color bleed independently of framed metadata and request counts.

Implement the H54 repairs in `App.tsx`, `styles.css`, `SpectralLane.tsx`, `Display.tsx` and `m1-spectrogram.spec.ts`.

1. Group transport, tools and measurements within the fixed bar, with consistent gaps, Tabler icons for available actions, shortcut tooltips, accessible names and distinct pressed and keyboard-focus states.
   Format the playhead as `h:mm:ss.mmm` and use stable tabular widths and readable display precision for editable selection fields.
2. Align lane names, metadata and units, action rows, Gain and Offset in one header grid.
   Use the §9.5 blue accent and pressed W/S/W+S state to identify the active Display target.
3. Align the ruler, overview, waveform and spectrogram to the same plot origin through dock and lane resizing.
   Use one viewport transform for the ruler and visible signals, and map its endpoints into the overview's full-lane extent.
   Keep readable edge tick positions, the amber playhead, distinct selection edges, the 160 px initial lane height and the draggable 30/70 waveform/spectrogram split.
4. Apply the §9.5 palette, 12 px typography and 24 px controls to dock tabs, dividers, inspectors and plot surfaces.
   Use readable active tabs, muted secondary labels and aligned inspector rows, and keep the Settings self-check reason reachable.
5. Group Files path input, parent navigation and Go.
   Use consistent Files/Recent row spacing and visually truncate long paths while exposing their complete value on focus or hover.
6. Reflow the fixed bar by control group on narrow windows and size initial side docks from available width.
   Preserve user docking and resizing, and give the inspector and lane list their own scrolling regions.

Capture generated mono audio with audible and quiet intervals, a time selection and two independently configured views at `frontend/test-results/screens/M1-workspace-desktop.png` (1280 × 720) and `frontend/test-results/screens/M1-workspace-narrow.png` (800 × 600).
Also resize a live desktop workspace to 800 × 600 and check that focus and selection survive.
At both sizes assert no horizontal document overflow or transport/time-field overlap, actionable Play/Stop, positive visible plot widths, shared ruler/signal time coordinates and the corresponding overlay position on the overview.
Verify that clicking each view updates Display's target and FFT, keyboard focus allows time-field editing, and Settings exposes the forced self-check reason.
The independent reviewer inspects both screenshots and records observed UI evidence under §20, alongside the objective browser checks.
Write `frontend/src/{App.tsx,styles.css}`, `frontend/src/api/{client,types}.ts`, `frontend/src/state/{spectralViews,viewport}.ts`, `frontend/src/lanes/SpectralLane.tsx`, `frontend/src/render/{spectrogram,colormap}.ts`, `frontend/src/panels/Display.tsx`, `frontend/src/audio/testHook.ts`, `frontend/tests/{spectrogram,viewport}.test.ts` and `frontend/tests/e2e/m1-spectrogram.spec.ts`.
Run `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m1-spectrogram.spec.ts tests/e2e/m0-workspace.spec.ts`.
Provide M1.8 and M1.9, browser evidence for viewport and hover, and the committed rendering surfaces for T6 and T7.

## M1-T5 — Frequency Analysis panel

Deliver the docked frequency analysis UI using the committed framed spectrum endpoint and uPlot, with frame, Welch and full methods, supported statistics/units, linear/log frequency axis and multi-lane overlays.
Bind to T4 active views and hover and preserve each lane's source/clock and analysis configuration.
Add Frequency Analysis below Lanes on first use and when a restored workspace lacks that panel, keeping its existing group positions and tabs.
Seed the T5 browser regression with the original M0 panel IDs in `vsr-layout`, open Frequency Analysis from the restored layout, verify it plots data, and check it persists once beside the retained M0 panels and Display after reload.
Throttle hover frame requests to animation frames and abort superseded frame requests.
Use the single-lane fixture and a multi-lane fixture to assert data, plotted curve counts, stable identities, unit/axis labels and request behavior across hover and method changes.
Expose the actual Frequency Analysis plot root and its rendered curve, axis, label and visible legend layers in `FrequencyAnalysis.tsx` for T7 capture and clipping.
Write `frontend/src/{App.tsx,styles.css}`, `frontend/src/api/{client,types}.ts`, `frontend/src/panels/FrequencyAnalysis.tsx`, `frontend/tests/frequencyAnalysis.test.ts` and `frontend/tests/e2e/m1-frequency.spec.ts`.
Run `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m1-frequency.spec.ts`.
T6 attaches T-F time/visible-band constraints to the resulting analysis input.

## M1-T6 — T-F selection, analysis limits and audition

Deliver the E tool's lane- and view-bound rectangle, move/resize, editable bounds, audition transport, playback toolbar and M1 context actions.
Bind audition to the T3 PCM contract and the selected view's n_fft, win_length, window and window_param, with only the selected lane sampled while auditioning and existing M0 chunk scheduling preserved.
Use T4's control styling for the E tool and floating playback action.
Bind Frequency Analysis to the T-F rectangle's time interval and display frequency bounds while leaving the underlying FFT calculation unchanged.
Preserve T/V tools, normal selection, keyboard transport, lane-offset alignment and playback tests.
Write `frontend/src/{App.tsx,styles.css}`, `frontend/src/state/tfSelection.ts`, `frontend/src/lanes/{SpectralLane,TfSelection}.tsx`, `frontend/src/audio/{playback,testHook}.ts`, `frontend/src/panels/FrequencyAnalysis.tsx`, `frontend/tests/{tfSelection,playback}.test.ts` and `frontend/tests/e2e/m1-audition.spec.ts`.
Run `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m1-audition.spec.ts tests/e2e/m1-frequency.spec.ts tests/e2e/m0-playback.spec.ts`.
Provide M1.7 evidence by checking the normal Space path, selected lane and actual bound query fields.
With a rectangle longer than 20 s, capture the first two prefetched PCM requests and require contiguous chunk `t0,t1` values with unchanged `selection_t0,selection_t1`, frequency bounds and originating view parameters.

## M1-T7 — Visible-region PDF export

Deliver the accepted A1 design using current workspace layers and browser-native raster and download primitives.
Use the independently verified T4/T6 surface geometry and rendering, including scroll, clips, actual framebuffer pixels, canvas layers and displayed annotations inside the crop.
Use T5's rendered Frequency Analysis plot root and layers for the same visible-region export, clipped to the plot and its visible ancestors.
Capture the same rendered state used on screen, with logical pointer coordinates converted once to device pixels and without extra audio API or DSP operations.
Keep export selection and cancellation independent of time and T-F selections, use the design's viewport exclusions and avoid adding interfaces for M2 features before they exist.
Write `frontend/src/{App.tsx,styles.css}`, `frontend/src/state/pdfSelection.ts`, `frontend/src/lanes/{SpectralLane,ExportSelection}.tsx`, `frontend/src/render/{spectrogram,workspaceCapture,pdf}.ts`, `frontend/tests/pdf.test.ts` and `frontend/tests/e2e/m1-pdf.spec.ts`.
Run `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m1-pdf.spec.ts`.
Freeze playback and viewport in the real Chromium fixture and capture independent browser screenshot pixels before activating the export tool.
Use the A1 reader procedure to decode the actual one-page downloaded raster, then compare each crop-relative sample against the same device-pixel position in the screenshot.
Check separated interior regions on the spectrogram, waveform and visible annotation against the accepted encoding tolerance at nonunit DPR with a scrolled plot.
Download a separate crop of a visible Frequency Analysis plot and compare its decoded curve, axis, label and displayed legend pixels to the corresponding positions in an independent Chromium screenshot under the same A1 tolerance.
Assert that clipping excludes dock tabs and panel controls along the drag.
Assert crop dimensions and excluded pixels so shifted, stale or gesture-contaminated composition fails, and check unchanged audio selections and zero export-triggered data requests.
Verify a temporary downloaded sample independently in a PDF reader available to the Auditor, with missing execution reported under project gate 2 and no conditional e2e skip.
Provide M1.13 and a screenshot of the crop interaction as human evidence.

## M1-T8 — Integration, regression, measurement and acceptance

Deliver the accepted final M1 tree and `docs/acceptance/M1.md` after T1–T7 independent evidence is current and their writers have stopped.
Write the cumulative T1–T7 implementation sets only for necessary integration fixes, `tests/bench/m1_spectrogram.py`, `tests/bench/m1_spectrogram.ts`, `docs/acceptance/M1.md` and append-only `docs/DESIGN.md` §21 as required by recorded decisions.
The post-squash write set on master is the measurement row in `docs/dev/performance.md`, which stays in the separate records commit.
Use LIFECYCLE Integration and D38 to merge reviewed attempts and freeze the phase revision.
Obtain independent Mechanical Auditor PASS on the full AGENTS commands and benchmark evidence and independent Task Reviewer PASS on that revision before the authorized executor squashes it.
Repeat the full regression on the master tree and compare its squash diff from its immediate pre-squash baseline with the reviewed phase diff from the phase cut commit.
Run `uv run python tests/bench/m1_spectrogram.py` with its browser driver on each available device and retain the observations and browser artifacts for review.
Keep evidence of all M0 and M1 regressions and rule, drift, protected-section and public-repository checks.
For M1.C3 compare with the integrated A1/A2 spec baseline, and independently verify the cycle's only approved protected delta from the M0 baseline as part of cumulative review.
Use a Chinese acceptance report with one result/evidence row per exit, unavailable-device reasons, screenshots at `frontend/test-results/screens/M1-*.png`, benchmarks and actual DESIGN deviations.
Include the T4 desktop/narrow H54 screenshots and review evidence, and capture the final desktop with Frequency Analysis and T-F selection integrated.
The screenshot review serves §20 and the project gate for Human UI feedback.
The Controller reports the phase evidence and screenshot locations through the authorized channel after integration.

## Acceptance matrix

| Exit | Evidence owner | Required outcome |
|---|---|---|
| M1.1 | T1 | At 16 kHz, 512-point FFT and 1 kHz unit sinusoid, test only unpadded interior frames and require 0 ± 0.05 dBFS for Hann, Blackman–Harris and Kaiser β=8.6. |
| M1.2 | T1 | Compare Welch mean dBFS with SciPy spectrum +3.01 dB and dB/Hz with SciPy density, using §8.4 parameters and excluding DC/Nyquist, with each error <0.05 dB. |
| M1.3 | T2 | Verify p power of two and absolute-grid shift invariance, log band boundaries and interpolation, and framed `row_freqs`, `col_t0` and `col_dt` against returned data. |
| M1.4 | T1 | Resolve all bundled presets at the five required sample rates and verify the §16 spec-line format. |
| M1.5 | T1, T2, T3, T8 | Run DSP numerical tests on every locally available compute device and record the real parameterized results and any device skip reasons under §20. |
| M1.6 | T3 | Generate 500 Hz and 3 kHz tones and select 2–4 kHz with each of analysis, wideband and narrowband, requiring the 3 kHz magnitude change <1 dB and 500 Hz attenuation ≥40 dB. |
| M1.7 | T6 | In Chromium E-drag and Space send selected-lane PCM requests with the rectangle's f_lo and f_hi, originating view parameters and the stable D43 selection bounds across successive chunks. |
| M1.8 | T4 | In a one-mono-lane, one-view fixture, dragging dB range generates zero requests and choosing a different n_fft generates exactly one spectrogram request. |
| M1.9 | T4 | Add view creates another row for the same lane, and n_fft settings remain independently selectable. |
| M1.10 | T2, T8 | The exact ten-minute 48 kHz mono wideband fixture has whole-lane calculation peak RSS <1.5 GiB in a fresh subprocess and a separately timed cached 1024 × 256 full-lane viewport request. |
| M1.11 | T2 | Two overlapping requests with the same full cache key produce one computation. |
| M1.12 | T3 | Require sample-wise error <1e-6 against the full-lane references for adjacent unmasked 20 s chunks at unequal source and output rates, the masked interior seam and the identical chunk ending at the true T-F edge. |
| M1.13 | T7, T8 | An actual Chromium workspace crop downloads a valid single-page raster PDF whose decoded pixels match the independently observed viewport crop under the accepted A1 contract. |
| M1.C1 | T8 | All AGENTS commands and the complete M0 and M1 regressions pass on the final trees. |
| M1.C2 | T8 | Acceptance report contains observed results, evidence, screenshot paths, measurements and deviations. |
| M1.C3 | T8 | Decisions are recorded in §21 and the implementation diff preserves the post-arch protected baseline. |

## Numerical inputs for Plan Review

| Unit and input | Expected value or independent reference |
|---|---|
| STFT 1 kHz, 16 kHz, 512 points, unit amplitude. | Bin 32 reads 0 dBFS after the §8.1 sum-of-window calibration and within M1.1 tolerance. |
| Welch with fixed-seed input, explicit periodic window w, identical hop and frame coverage. | For interior bins the SciPy spectrum factor is 2 or 3.0102999566 dB, and the SciPy density delta is 0 dB, each within M1.2 tolerance. |
| Activity with 16 kHz generated nonoverlapping long spans at amplitude 0.5, 0.001 and 0. | Interior 20 ms frames are active only in the first constant span, and other analyses respect the stated ±5 ms frame-center match. |
| Full FFT on 512 samples of a unit 1 kHz sine at 16 kHz with the default boxcar. | The uncalibrated bin 32 is `20 log10(256)` or approximately 48.1648 dB, with unit `db`. |
| Time pooling with available frames 0–31, hop h, sample rate s, selected centers 5–17 inclusive and width 4. | p=4, absolute groups 4–7, 8–11, 12–15 and 16–19, `col_t0=5.5h/s` and `col_dt=4h/s`, with equal overlapping maxima after a four-frame shift. |
| Log pooling at 16 kHz/n_fft=512, effective range 40–80 Hz, height 2, and input dB at bin centers defined as `-80 + f/10`. | Bands split at `40√2`, centers are `40·2^0.25` and `40·2^0.75`, the first row interpolates between 31.25 and 62.5 Hz and the second row uses the 62.5 Hz bin, allowing the specified f16 quantization. |
| PCM at 44.1 → 48 kHz with a nonzero offset and first output index 100003. | The 960000-sample chunks align with matching whole-lane resample slices. The same first chunk has a true end transition for the 20 s rectangle and continuous in-band content at the interior seam of the 40 s rectangle. |
| H45 crop at a nonunit device-pixel ratio. | Page and embedded raster dimensions agree with the independently measured device-pixel crop and corresponding screenshot regions match the downloaded image under the accepted A1 rounding and encoding rules. |

Preset triples below are ordered `(win_length, hop, n_fft)`, from §16 and the unmodified bundled TOML.

| sr | analysis | wideband | narrowband | ltas |
|---|---|---|---|---|
| 16000 | (512,128,512) | (80,16,512) | (512,80,1024) | (1024,256,1024) |
| 22050 | (1024,256,1024) | (110,22,512) | (706,110,2048) | (2048,512,2048) |
| 24000 | (1024,256,1024) | (120,24,512) | (768,120,2048) | (2048,512,2048) |
| 44100 | (2048,512,2048) | (221,44,1024) | (1411,221,4096) | (4096,1024,4096) |
| 48000 | (2048,512,2048) | (240,48,1024) | (1536,240,4096) | (4096,1024,4096) |

## Performance observations

| DESIGN §17 row | T8 measurement under normal entry points |
|---|---|
| 2 | Generate the ten-minute 48 kHz stereo WAV and time opening to the first drawn n_fft=2048, hop=512 spectrogram, including initial cache fill. |
| 3 | With the stereo fixture's matching STFT key cached, time a real pan or zoom request from browser dispatch to completed framed response. |
| 4 | With the same ready view, measure control change to first redrawn color or dB range and record observed frame and request counts. |
| 5 | Generate a 60 s 48 kHz mono fixture and time a changed n_fft control to actual replacement draw. |
| 6 | Measure redraw timestamps over a controlled sequence of pan and zoom events and report achieved frames per second. |

For both M1.10 measurements generate a 600 s, 48 kHz mono PCM16 WAV with samples from `0.4 sin(2π·440t) + 0.2 sin(2π·3000t)` at `t=i/48000`.
Use the 48 kHz wideband preset (`hann`, `win_length=240`, `hop=48`, `n_fft=1024`), linear 0–8000 Hz and a 1024 × 256 CSS-pixel request over `t0=0,t1=600` and the single channel.
T2 opens that fixture and requests the full lane in a fresh subprocess with an empty cache.
For T8, prime the exact STFT key once under the default cache limit and record three authenticated full-lane requests against that populated cache, timing dispatch through receipt of the complete framed body.
Report the full-view median separately from row 3's pan/zoom median, with fixture, transform, viewport and cache state attached to both evidence entries.
Use three observations and their median for each row and available device, and record operation, platform, device, commit and measurement endpoint.
Read the previous same-platform/device record from `docs/dev/performance.md`; for rows 2–6 without a previous value establish this platform's baseline as LIFECYCLE directs.
The 4.173 s CPU row-1 result is the existing M0 reference for its distinct operation.
Record material performance differences and observed bottlenecks without changing any acceptance threshold.

## Budget

The combined estimate is 60 agent invocations, comprising 49 baseline and 11 reserve.
The arch estimate is 10, with nine baseline invocations for a Plan Reviewer, the A1 and A2 Worker/Auditor/Reviewer triplets, an A1 D38 Git executor and an A2 post-verdict D38 continuation, plus one reserve.
The M1 estimate is 50, with 40 baseline invocations for one completed Recon, two Overall Planners including the interrupted attempt, one Plan Reviewer, four Task Planners, eight Worker/Auditor/Reviewer triplets, seven task-level D38 Git executors and a T8 post-verdict D38 continuation, plus ten reserve.
The baseline includes 15 `sol` and three `astra` invocations.
The combined Planner amendment and H54 consultation consume two M1 reserve invocations, with the remaining reserve available for targeted fact checks, bounded rework and required verification.
Track actual usage by role and phase, including Git executors and interrupted attempts.
The 1.5× estimate-overrun checkpoints are 15 invocations for arch and 75 for M1 under the CODEX contract, with the Controller applying any recorded authorization covering the current phase before further dispatch.
D42 records M0 continuation after its estimate, and the plan adds no paid compute or external cost.
