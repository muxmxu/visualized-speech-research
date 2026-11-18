# C1 phase M2 executable plan

## Entry and dispatch

Start from delivered M1 code `a4b37b680e3e14f0d07d244f94f79b349a471814` and records tip `cfd5246` ([M1 acceptance](../../../acceptance/M1.md)).
The prior final run passed 119 pytest, 37 Vitest and 66 Chromium cases.
Bind the actual clean task worktree, cut commit, isolated test environment, host/browser bindings and authorization in the dispatch ledger.
Read AGENTS, LIFECYCLE, the effective CODEX orchestration contract, `impl`, the applicable DESIGN sections and the bundled skill at each dispatch.
Use D38 for authorized Git execution, D40 for PDF reuse and H58 for available 6.2 models.
Pyproject and the existing lockfile already declare the `plot` and `safetensors` extras.
Use a temporary `VSR_HOME`, loopback ports, and a temporary user home for installer tests.
Keep the existing untracked root npm files outside Git and frontend tooling.

| Task | Accepted dependencies | Worker | Semantic review | Risk |
|---|---|---|---|---|
| T1 Shared mel DSP | M1 | 6.2 `sol(high)` | 6.2 `sol(high)` | Numerical |
| T2 Tensor and spectral endpoints | T1 | 6.2 `sol(high)` | 6.2 `sol(xhigh)` | High, file and binary intake plus spectral cache |
| T3 Static plotting and skill install | T1 | 6.2 `sol(high)` | 6.2 `sol(high)` | Normal |
| T4 Python push and import boundary | T2, T3 | 6.2 `sol(high)` | 6.2 `sol(high)` | Connection and HTTP interface |
| T5 Browser mel and feature workflow | T2, T4 | 6.2 `sol(high)` | 6.2 `astra(medium)` | Complex, rendering, selection and capture |
| T5a CLI tensor launch compatibility | T5 and accepted narrow architecture clarification | 6.2 `sol(high)` | 6.2 `sol(xhigh)` | High, authenticated handoff and file paths |
| T6 Integration and measurement | T1–T5a | 6.2 `sol(high)` | 6.2 `sol(high)` | Normal |

Use an independent Plan Reviewer, 6.2 `astra(medium)`, before implementation dispatch.
Use an independent Mechanical Auditor before each semantic review, preferring `6.2-sol(xhigh)` under H58 and recording the actual model and effort.
Use the effective CODEX assignment and its availability fallback if the preferred runtime is unavailable.
One writer and one `checks` lock are active at a time, including generated outputs, dependency caches, the one-worker Chromium runs and per-device benchmarks.
Use separate worktrees for `task/M2-T1` through `task/M2-T5`, `task/M2-T5a` and `phase/M2`, with task commits and integration handled by the authorized D38 top-level executor.
Run T1–T5, T5a and T6 in order, cutting each implementation branch from its accepted predecessor after the first branch is cut from `master`.
The documented singleton and browser file workflows have bound contracts and may proceed while the separate CLI decision below is pending.
Every Auditor checks the exact write set, `git diff --check`, the rule script against the actual cut commit, protected files and public-repository content.
The semantic Reviewer resolves every REVIEW finding and checks behavior against DESIGN.
Record evidence against the frozen patch and follow the CODEX review and amendment cap.

## Interface decisions to bind

- **CLI launch and mixed-path compatibility decision.** DESIGN §§4, 7 and 10 define a multi-path `/open` request, a singular interpretation reply and a tensor dialog for opening files.
  M1 already returns `{lanes}` for audio batches, `src/vsr/cli.py` discards the running-server `/open` result, and `create_app(paths)` accepts only audio on cold start.
  Bind the exact mixed/multiple-tensor reply and the cold/warm `vsr [paths...]` browser handoff in a numbered decision and accepted narrow §7 architecture clarification before T5a.
  The consultant's proposed compatibility mechanism is a one-time in-memory handoff identified by an opaque browser fragment scrubbed at startup and consumed by authenticated `/open` using a private header.
  The independent technical consultation confirmed that a header changing `/open` behavior requires the §7 clarification under C6/V3, and exact empty/mixed request behavior remains to be bound there.
  Preserve the documented singleton replies, existing audio batches, existing authenticated routes and event names, and keep filesystem paths out of launch URLs and browser history.
  T1–T5 continue under their specified contracts while T5a waits for the clarification.
  Use the existing Scope gate if the clarification needs a protected change, and bind cold/warm and batch tests to the approved solution before dispatching T5a.
- The documented `show(..., kind="feature", sr=..., hop=..., freq_axis=..., value_scale=...)` example treats the 2D array as `[F,T]` with the supplied axis metadata.
  For audio, §10's explicit inference applies to 1D and the two small-dimension 2D cases, with explicit `layout` for `[B,N]` and `[B,C,N]`.
  Test all four feature axes at the file/HTTP boundary and keep the documented `show` interface.
  Complex typed features take magnitude before conversion to f32 as §8.5 requires, including before encoding a client feature in the documented form.

## T1 — Shared mel DSP

Deliver §8.3's calibrated mel kernel through `vsr.dsp.mel_db(x, sr, **params)` and the bounded pre-pooling chunk path consumed by T2.
Reuse the M1 periodic windows and centered STFT handling, apply the Slaney-normalized filter bank on the selected float32 compute device, and return CPU tensors from the public API.
Supply the server with the same channel frequencies and power-to-dB calculation, including across chunk boundaries.
Keep the existing STFT and Welch outputs under their accepted tests.

**Write set** `src/vsr/dsp/__init__.py`, `src/vsr/dsp/stft.py`, `src/vsr/dsp/mel.py`, `tests/test_mel_dsp.py`.

**Check** `uv run pytest -ra tests/test_mel_dsp.py tests/test_spectral_dsp.py tests/test_spectrogram.py`.

## T2 — Tensor and spectral endpoints

Deliver safe loading, interpretation and framed viewport data for tensor and audio-mel lanes at the existing authenticated routes.
Use the §10 whitelist, CPU-only `weights_only=True`, `allow_pickle=False`, and the declared optional safetensors extra.
Walk list, tuple and dictionary leaves with reversible key paths and publish shape/dtype metadata before interpretation.
Validate the submitted leaf, axes, batch limit, sample/frame-rate inputs and axis/value metadata before creating lanes.
Use the source dtype to normalize integer file audio by its bit depth exactly once before storing audio and feature data as CPU float32 with their documented shapes.
Publish a complete valid batch under the session lock, with array-free metadata and one existing `lanes_changed` notification.
Share interpretation with `/push` and validate its single framed array at the HTTP boundary.
Preserve float32 audio sample values from file and framed `/push` inputs.
Check required auth, rejected payloads and unchanged lane counts after a rejected request.
Implement §8.5 time pooling on absolute frame centers and row slicing in integer row coordinates, preserving row labels and all selected rows in framed output.
For audio mel, extend the M1 cache key, max pyramids, oversized-entry path, heavy-compute semaphore and selected-device handling through the T1 kernel.
Preserve existing STFT behavior, including its intervals, cache boundaries and responses.
The feature endpoint ignores STFT parameters and guards audio-only wave/PCM/spectrum routes from interpreting feature rows as audio channels.

**Write set** `src/vsr/io/tensors.py`, `src/vsr/server/app.py`, `src/vsr/server/session.py`, `src/vsr/server/routes_spectrogram.py`, `src/vsr/frame.py`, `tests/test_tensor_lanes.py`, `tests/test_frame.py`.

**Check** `uv run --extra safetensors pytest -ra tests/test_tensor_lanes.py tests/test_frame.py tests/test_server.py tests/test_spectrogram.py tests/test_pcm.py`.
Generate `.pt`, `.pth`, `.npy`, `.npz` and `.safetensors` fixtures in tests.
Read back same-rate PCM from interpreted tensor files and verify `int16` samples `[-16384, 16384]` become `[-0.5, 0.5]` and float32 samples retain their amplitudes.
Exercise all five audio layouts, all four feature axes and all six scales, complex magnitude, the 32-lane limit, time and row coordinates, mel key isolation and both cached and oversized mel views.
A `.pt` containing an inert arbitrary Python object is rejected with the documented error body, and the server continues to serve authenticated requests.
Include an object-array rejection and check that inputs opened for inspection remain untouched.

### T2 task amendment after semantic reviews 1 and 2

The two consecutive FAILs are recorded in [review 1](reports/M2-T2-review-1.md) and [review 2](reports/M2-T2-review-2.md).
This sole task amendment addresses the remaining DESIGN §10 normalization defect within the seven-path T2 write set above.
Review 2 reproduced three zero PCM samples from NumPy `uint32` and `uint64` `.npy` inputs containing the unsigned midpoint and its two neighbors because float32 conversion preceded centering.
First add red regressions in `tests/test_tensor_lanes.py` against the review-2 tree using generated `.npy` files, authenticated file interpretation and authenticated same-rate PCM readback.
For a `uint32` input of `[2**31 - 1, 2**31, 2**31 + 1]`, require the decoded float32 PCM to equal `[-2**-31, 0, 2**-31]` exactly.
For a `uint64` input of `[2**63 - 1, 2**63, 2**63 + 1]`, require the decoded float32 PCM to equal `[-2**-63, 0, 2**-63]` exactly.
All six expected samples are exactly representable in float32.
Limit the correction to exact centering arithmetic on the CPU source before conversion to float32 in `src/vsr/io/tensors.py` and the regressions in `tests/test_tensor_lanes.py`.
Keep stored samples and compute-device outputs float32, retain the existing public dtypes and flags, and preserve the existing uint8 file and framed PCM, signed PCM and float PCM assertions.
All other T2 requirements and verification still apply.
Record the same regressions passing after the fix and rerun the full affected T2 suite declared above on the final frozen patch for independent mechanical audit and final semantic review of the remaining finding.
Any further semantic FAIL makes T2 BLOCKED under the CODEX review cap.

## T3 — Static plotting and skill install

Deliver the M2 §16 plotting functions and the bundled skill installer, using `plot` only when imported.
Use shared DSP and preset resources for `spectrogram` (including F0 overlay), `compare`, `spectrum` and `savefig`.
Implement the bundled skill's labels, palettes, units, shared comparison scales, optional waveform and symmetric, sample-aligned dB difference.
Capture actual parameters on the Figure and write `vsr-spec` to PNG or PDF Keywords through `vsr.plot.savefig`.
Implement `vsr skill install --claude --codex` with the packaged resource directory, verify existing matching symlinks are accepted and conflicts fail without replacing the destination.
Tests cover both agent directories and a conflicting path.

**Write set** `src/vsr/plot.py`, `src/vsr/cli.py`, `tests/test_plot.py`, `tests/test_cli.py`.

**Check** `uv run --extra plot pytest -ra tests/test_plot.py tests/test_cli.py tests/test_presets.py`.
Use a non-interactive Matplotlib backend and verify shared time-axis and scale properties, numerical difference and zero-centered limits, actual file metadata and installer filesystem results.

## T4 — Python push and import boundary

Deliver `vsr.show` through the public module and connect lazy `vsr.plot` access to T3.
Reuse the Python frame codec and use existing runtime fields, hostname validation and `VSR_URL`/`VSR_TOKEN` remote flow.
Use the original dtype of integer audio to determine its bit-depth divisor and apply the scaling exactly once before encoding the contiguous CPU f32 frame, preserving float32 audio amplitudes.
Send a separate authenticated POST for each dictionary item using its key as the lane name.
Without a live server, raise with the startup instruction.
Report a mismatched local hostname before connecting.
Subprocess tests must run against a real temporary authenticated server, verify metadata from a named audio lane and a feature lane and observe separate lanes for dict keys.
Have a separate Python process call `vsr.show` with `int16` audio containing `[-16384, 16384]` and with float32 audio, then retrieve authenticated same-rate PCM for the resulting lanes through `/api/lanes/{id}/pcm`.
Assert that the decoded PCM has `[-0.5, 0.5]` at the original integer sample positions, preserves the float32 amplitudes, and matches the PCM for equivalent tensor files opened through the T2 file path on the same server.
A clean Python process must verify that `import vsr` leaves the four restricted packages absent and that access to `vsr.plot` imports Matplotlib.

**Write set** `src/vsr/__init__.py`, `tests/test_show.py`.

**Check** `uv run --extra plot pytest -ra tests/test_show.py tests/test_frame.py tests/test_tensor_lanes.py`.

## T5 — Browser mel, feature and PDF reuse

Deliver tensor interpretation from the Files panel and file drop, audio STFT/mel switching, and feature-only spectral lanes on the shared time axis.
Use server metadata and row positions for transforms and hover labels.
Display row index, linear Hz or mel channel/Hz as appropriate, label raw color/range controls `value`, and emit the matching Copy spec line.
Preserve time selection, existing audio interactions and per-view state, and send playback and PCM requests only for audio lanes.
Reuse the M1 WebGL2 context and D40 capture compositor for both mel and feature.
Changing palette/range/filter redraws without requesting data, while changing transform settings requests the correct viewport.
Exercise the existing WS-to-session refresh when a separate `show` process adds lanes.

**Write set** `frontend/src/App.tsx`, `frontend/src/api/types.ts`, `frontend/src/lanes/SpectralLane.tsx`, `frontend/src/panels/Display.tsx`, `frontend/src/panels/FrequencyAnalysis.tsx`, `frontend/src/panels/TensorInterpretation.tsx`, `frontend/src/render/spectrogram.ts`, `frontend/src/render/workspaceCapture.ts`, `frontend/src/state/spectralViews.ts`, `frontend/src/styles.css`, `frontend/tests/spectrogram.test.ts`, `frontend/tests/e2e/m2-tensors.spec.ts`, `frontend/tests/e2e/m1-pdf.spec.ts`.

**Check** `npm run typecheck && npm test && npm run lint && npm run build && npx playwright test --workers=1 tests/e2e/m2-tensors.spec.ts tests/e2e/m1-pdf.spec.ts` from `frontend/`.
Use generated browser fixtures and actual requests.
Verify modal confirmation, multi-leaf selection, raw range labeling, mel controls and hover, feature-only/audio-plus-feature layouts, WS refresh and zero display-only network requests.
Save representative mel and feature screenshots through the existing Playwright artifact path.
Extend the §20 independent viewport-PNG comparison to correlate the mel and feature heatmaps, labels and colorbar in the downloaded PDF with their observed page pixels.
Preserve page dimensions, clip, selection and zero-export-request assertions.
Use the standing independent-reader smoke for the integrated export.

## T5a — CLI tensor launch compatibility

Blocked pending the accepted §7 architecture clarification described above.
Deliver cold and warm `vsr [paths...]` tensor opening through the approved handoff while preserving audio-only launch and the accepted Files and upload workflows.
Only this task owns the launch bridge, and writes to the previously reviewed server, CLI and App files occur serially after T5.
Check the approved mixed-batch behavior, both launch paths, exactly-once opportunity to interpret each file, authorization and path visibility in actual Chromium.

**Write set** `src/vsr/cli.py`, `src/vsr/server/app.py`, `frontend/src/App.tsx`, `tests/test_cli.py`, `tests/test_tensor_lanes.py`, `frontend/tests/e2e/m2-cli-open.spec.ts`.
Confirm the set and exact targeted examples against the accepted clarification before dispatch.

**Check** `uv run pytest -ra tests/test_cli.py tests/test_tensor_lanes.py` and, from `frontend/`, `npm run build && npx playwright test --workers=1 tests/e2e/m2-cli-open.spec.ts tests/e2e/m2-tensors.spec.ts`.

## T6 — Final integration and benchmark

Deliver a reviewed `phase/M2` and `docs/acceptance/M2.md` using LIFECYCLE Integration and D38.
Integrate accepted T1–T5a, append the numbered product decisions to DESIGN §21 only, and run AGENTS checks on the final phase tree and after the authorized milestone squash on `master`.
After `uv sync`, use `uv sync --extra plot --extra safetensors` before pytest on each final tree so both extras are exercised.
Use one Chromium worker, the established host Chromium binding and final-tree evidence including M0/M1 regressions.
Run the existing rule, protection, public-repo and implemented §16 signature checks and verify frozen patch equality across squash.

**Write set** `tests/bench/m2_show.py`, `tests/bench/m2_show.ts`, `docs/acceptance/M2.md`, and append-only `docs/DESIGN.md` §21 for decisions already recorded under D34. Conflict resolution is limited to the approved union. The integration executor appends `docs/dev/performance.md` in the main worktree after squash for the separate records commit.

**Check** Full AGENTS command sequence with the existing extras installed, the LIFECYCLE checks and `uv run python tests/bench/m2_show.py`.
Measure §17 row 7 with a ready server and browser and a preinitialized separate Python sender.
Use a fixed one-second 24 kHz mono float32 sine, launch the `show` call from the prepared sender, and time through first appearance of the uniquely named browser lane, including POST, WS, session GET and render.
Record fixture, browser, active device, three observations and their median for each available device.
Compare against the same operation on the same platform and device, or establish this platform's row-7 baseline per D33.
Keep the performance reference advisory.
Preserve screenshots, rule dispositions, device skip reasons, command exits, reader evidence and any deviations in the acceptance report.

## Objective exits

| Exit | Required evidence |
|---|---|
| M2.1 | T1: convert public f32 mel dB back to power. On every locally available compute device, all elements with reference power greater than `max × 1e-6` have relative error `< 1e-4` against `librosa.feature.melspectrogram(center=True, pad_mode="constant", power=2.0, window="hann") × (2/Σw)²`. |
| M2.2 | T2: exercised loading for every layout, axes and value scale. Safe `.pt` loading rejects an arbitrary Python object. |
| M2.3 | T4–T6: a second Python process calls `vsr.show`, the new lane appears in the browser, dict push produces multiple named lanes and the §17 row-7 duration is measured and recorded. |
| M2.4 | T3: all comparison spectrogram panels use the same dB range and share time axes, `vsr.plot.savefig` produces PNG `vsr-spec` text metadata, and `diff=` produces a symmetric panel centered on zero. |
| M2.5 | T4: a clean `import vsr` leaves `fastapi`, `sounddevice`, `librosa` and `matplotlib` absent from `sys.modules`, access to `vsr.plot` imports Matplotlib and a mismatched runtime hostname causes `vsr.show` to fail. |
| M2.6 | T3: `vsr skill install --claude --codex` creates both symlinks, while a conflicting destination produces an error and is preserved. |
| M2.C1 | T6: all prescribed checks pass on the final trees and prior milestone regressions remain green. DESIGN §§8.3, 8.5, 9.7 and 10 behavior has current coverage, including D40 reuse by both mel and feature and the T5a CLI launch behavior. |
| M2.C2 | T6: the acceptance report records each result, its test/command and observed evidence, screenshots, performance and deviations. |
| M2.C3 | T6: all adopted implementation decisions have their append-only §21 lines, and the protection checks match the M1 baseline. |

## Numeric inputs for Plan Review

| Fixed input | Independent expected result |
|---|---|
| Periodic Hann of 256 samples, sr 16000, hop 64, n_fft 512, 40 mel bands over 0–8000 Hz, deterministic two-channel signal. | `Σw = 128`; each channel's uncalibrated librosa mel power is scaled by `1/4096`; frame `k` occurs at `k/250` seconds; the filter centers are `librosa.mel_frequencies(42, fmin=0, fmax=8000)[1:-1]`. Include HTK and short/end frames in the case matrix. |
| Feature frame indices 1–5 selected at width 3, `offset=1.25`, `frame_t0=0.005`, `frame_rate=100` and a four-row matrix indexed 0–3. | `p=2`; pool groups `[0,2)`, `[2,4)`, `[4,6)`; `col_t0=1.26` and `col_dt=0.02`. A row request 1–3 includes indices 1, 2 and 3 even when height is 1. A linear `f_max=6000` labels those rows 2000, 4000 and 6000 Hz. |
| Scale fixtures `0.1` magnitude, `0.01` power, `-20` dB, `ln(0.1)` ln magnitude, `-1` log10 magnitude and `7` raw. | The first five display as `-20` in the framed viewport, with the specified f16 representation. The raw case remains `7` and carries the `value` label in the UI. Complex `3+4j` gives magnitude `5` and `20 log10(5)` before f16 conversion. |
| Two sample-aligned sinusoids with amplitude ratio `2:1`, exact interior STFT bin and same preset. | Absolute difference at that bin is `20 log10(2)` dB, and the plotted difference normalization has `vmin = -vmax` with zero centered. |

## Budget

Estimate 48 implementation-phase invocations.
The baseline is 30, comprising one Overall Planner, one Plan Reviewer, seven Worker/Auditor/Reviewer triplets, six authorized task commit executors and one post-verdict integration continuation.
Reserve 18 for the interface fact/consultation and its record, complex task planning where needed, and bounded correction rounds with independent checks.
Track actual usage and apply the CODEX 1.5× estimate-overrun checkpoint at 72 invocations with any applicable recorded authorization.
The plan adds no paid compute or third-party spending.
