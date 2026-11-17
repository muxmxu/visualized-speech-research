# C1 phase M0 executable plan

This plan implements the M0 skeleton in DESIGN §19 and does not start M1 before M0 acceptance.
The original Overall Planner seat uses `sol(high)`, and this single post-review amendment uses the contract's `sol(xhigh)` amendment seat.
The independent Plan Reviewer used `astra(medium)` once and returned FAIL with required_action `replan` in `docs/dev/cycles/C1/reports/plan-review-M0.md`.
Amendment A1 binds the subsequently completed independent recon and reconciles the cycle delivery criteria without a second routine Plan Review.
The review's FAIL remains the historical verdict, and the affected dispatches remain BLOCKED until the prerequisites below have evidence.

## Amendment A1 dispositions

- Review issue 1 is closed as a plan defect by the R1.7 and H34–H36 mapping amendment in `docs/dev/cycles/C1/plan.md`, following the current LIFECYCLE Integration Push and Delivery rules.
- Review issue 2 is closed as a missing planning input by binding `docs/dev/cycles/C1/reports/recon-M0.md` below, while its unresolved environment and execution facts remain affected-task dispatch blocks.
- The invocation note is resolved by identifying seven baseline `sol` seats and charging this amendment to the existing seven-invocation reserve rather than adding an unexplained eighth baseline seat.
- This amendment changes neither product scope nor authorization, and it does not resolve the git-executor conflict or authorize M1.

## Sources and observed baseline

- Product scope and acceptance come from `docs/DESIGN.md` §0–§9, §17–§20 and `LIFECYCLE.md`.
- The cycle and human-requirement mapping come from `docs/dev/cycles/C1/plan.md`.
- Current handoff and authenticated authorizations are in the state directory selected by `LIFECYCLE.md` State and records.
- H38 authorizes this interactive run, H40 requires unattended progress, and H41 grants git operations within the run.
- The Rules gate approval is the checked third item under the startup authorization supplement in the state directory's `human-inputs.md`.
- The independent input is `docs/dev/cycles/C1/reports/recon-M0.md`, covering HEAD `8bd532d91f777c42a074175eaa812f7ca4a5732e` through read-only repository and local-tool inspection.
- Recon observed design, lifecycle, development rules, the rule checker, records, and the protected visualization skill, with no application implementation, `frontend/`, `tests/`, Python project metadata, or Python lockfile.
- Recon observed `master` one commit ahead of `origin/master`, modified worklog, and untracked phase-plan, report, and root npm files, which remain distinct from accepted application changes.
- The root `package.json` contains `{}` and the root `package-lock.json` contains an empty npm packages object, with ownership unresolved in recon and recorded as predating takeover in the private handoff.
- Those root npm files are outside every task write set and remain untouched because their ownership has not been established.
- Recon observed Linux aarch64 and PATH versions Python 3.15.2, uv 0.12.10, Node 26.13.1, npm 11.20.0, and system Chromium 156.0.8078.79.
- PATH-selected Python had no discoverable torch module, which establishes neither failure nor availability in a future project environment or another interpreter.
- Recon confirmed configured git identity and origin fetch/push metadata, but did not verify remote access or an authorized git execution channel.
- The host-selected Chromium executable remains a private host-contract value, and neither its launch nor Playwright compatibility was verified by recon.
- The Controller records the actual HEAD, status, instruction identity, and task-base commit hashes in the private session ledger before dispatch.
- Recon occurred after the original plan and failed Plan Review, and this amendment repairs the planning input without claiming that the original Recon ordering was satisfied.
- A change from the covered HEAD or inspected environment requires the affected facts to be refreshed before dispatch, while unchanged observations are reused.

## Recon unknowns and dispatch blocks

The Controller records closure evidence in the private dispatch ledger and supplies its path in the affected handoff.
Any additional environment preflight uses an independent `terra(medium)` Fact Agent from the existing reserve, with temporary environments under the state directory and no application or protected-file edits.
No task is dispatched with an unresolved bound fact, and executable presence, this plan amendment, and the previous Plan Review are not substitutes for verification.

| Unresolved fact from recon | Affected dispatch | Evidence required to unblock |
|---|---|---|
| A selected Python ≥3.11 interpreter compatible with torch and the locked Python stack, plus frontend dependency installation with the observed Node/npm and approved TypeScript constraint. | T1, and therefore dependent implementation tasks. | Independent temporary-environment resolution, installation and import/build-tool evidence identifying the actual interpreter and package versions, without substituting libraries or adding runtime dependencies. |
| Available torch compute devices. | T3 device implementation and T6 per-device measurements. | Availability observations from the verified torch environment, with actual self-check results later supplied by T3 rather than inferred from architecture. |
| Loopback binding and access. | T3, T4, T5 and T6 server-dependent execution. | A task-owned random-port loopback probe with actual bound port and successful local access, followed by process cleanup. |
| Playwright installation, host-selected Chromium launch/compatibility and Web Audio availability. | T4 and T5 browser work, and T6 e2e and browser measurement. | Independent temporary-browser launch and Web Audio probe through the approved executable configuration, followed by cleanup, with missing prerequisites retained as NOT RUN rather than skipped or accepted. |
| An authorized non-subagent git executor. | Task commits, dependent branch creation, and T6. | A recorded executable channel satisfying LIFECYCLE and impl role restrictions, without treating H41 as proof that a channel exists. |
| Remote reachability and credential/access readiness. | Required milestone/session pushes and release delivery. | Access evidence through an authorized execution channel, with H34–H36 retained as the existing human authorization rather than reopened. |

No M0 test, measurement or application-behavior result was established by recon.
The separate unattended-driver session command remains unresolved and is not a prerequisite for the H38-authorized interactive run.

## Decisions and unresolved execution boundary

1. Before T2 dispatch, the Controller records a numbered internal decision for framed padding and offsets in `docs/dev/decisions.md`.
   The proposed convention is that header padding aligns the payload to eight bytes from the message start and each multi-array offset is measured from the payload start.
   This proposal does not become authority until the Controller records its decision, after which the decision number is included in T2's handoff.
2. Before T3 dispatch, the Controller records a numbered decision for the relative-error calculation used by the four device self-check operations.
   The proposed calculation is `norm(actual-reference, 2) / norm(reference, 2)` on identical nonzero synthetic inputs, with each operation satisfying DESIGN §4's strict `< 1e-4` threshold.
   This proposal does not become authority until the Controller records its decision, after which the decision number is included in T3's handoff.
3. The project-specific AGENTS and LIFECYCLE commands select native `uv` and npm execution for this repository through the impl skill's project-rules precedence.
   The unrelated Docker GPU execution sentence and research-only document names in the host orchestration template do not replace these explicit project commands or create new project prerequisites.
4. T6 is presently BLOCKED on its git execution channel.
   LIFECYCLE Integration requires an integration Worker to merge and squash, prohibits the Controller from merging, and the installed impl skill prohibits subagents from staging, committing, or pushing.
   The Controller reports only a collaboration subagent channel and no configured independent top-level Worker session command.
   A Planner or consultant must resolve this execution conflict before T6 dispatch without assuming permission to change protected instructions.
   T1–T5 may produce reviewed diffs, but task-branch commits and dependency branching also need an authorized non-subagent git executor before dependent tasks can start from those commits.
   A dedicated authorized top-level Worker channel is one possible resolution, not an available fact.
   This plan does not authorize a subagent to run git mutations and does not substitute Controller merges for T6.
5. The Controller retains sole ownership of STATUS, HANDOFF, worklog, decisions, and audit-report transcription.
   Workers return reports through their outcome instead of editing shared process records.
   Product decisions recorded by the Controller are appended to DESIGN §21 only by T6 on its branch line.

## Scope and phase exits

M0 includes CLI lifecycle and authentication, FastAPI and WebSocket session notifications, framed transport, audio file browsing/open/upload, waveform DSP, shared time viewport, selections, playback, dockview dark layout, and runtime device settings.
M0 implements the audio-relevant parts of the §5 lane model and only the §7 routes needed by those behaviors.
Tensor interpretation, push clients, STFT displays, presets, spectral tools, edit actions, recording, analyzers, dataset analysis, and RIR remain assigned to later milestones by §19.
There are no placeholder HTTP routes, disabled future controls, or configuration keys for those later milestones.
The supplied skill and presets remain read-only throughout this phase.
No new runtime library outside the locked stack is permitted.
Package author, maintainer, license, and copyright fields remain absent until the human resolves the project license gate.

| Exit | Required evidence in this phase | Owner |
|---|---|---|
| M0.1 | A CLI invocation with a generated WAV opens the browser URL and yields a rendered waveform, and an unauthenticated `/api/session` request returns 401. | T3, T4, T6. |
| M0.2 | Sample-level zoom renders sample points, and the first-waveform latency for a generated ten-minute stereo file is measured three times per available device. | T4, T6. |
| M0.3 | Playwright verifies Space transport, selection-end position, two-loop cancellation below the single-lane RMS by more than 60 dB, mute attenuation of at least 40 dB, and solo audibility through the test hook. | T5, T6. |
| M0.4 | All pytest, benchmark, and browser fixtures use temporary VSR_HOME and random ports without accessing the default state directory. | T1, T3, T4, T5, T6. |
| M0.5 | Python to TypeScript to Python and TypeScript to Python to TypeScript framed roundtrips preserve dtype, shape, metadata, and payload. | T2, T6. |
| M0.6 | CLI and Settings select available devices and a monkeypatched self-check failure produces CPU fallback with a visible reason. | T3, T4, T6. |
| M0.C1 | All AGENTS check commands pass on the final phase tree and the final main tree. | T6. |
| M0.C2 | `docs/acceptance/M0.md` contains a result and evidence for every exit, screenshots, measurements, previous-platform comparison, and DESIGN deviations. | T6. |
| M0.C3 | Product decisions are appended to DESIGN §21 and protected content is unchanged except for the explicitly approved one-time D25 configuration creation. | T1, T6. |

## Execution and verification contract

All task instructions reference the complete AGENTS, LIFECYCLE, DESIGN sections listed below, the installed impl skill, this plan, and the accepted startup authorization.
Each handoff includes the fixed constraint that actions outside the recorded human authorization boundary require approval.
Each task uses `impl task`, stays inside its declared write set, does not delegate further, and returns the Worker output contract including actual validation, partial state, read list, live processes, and unresolved issues.
Implementation is serial in the order T1 → T2 → T3 → T4 → T5 → T6 because bootstrap files, frontend entry points, backend routes, and generated build directories are shared dependencies.
No pair of Writers may run concurrently, including formatters and test processes that update caches.
The resource lock `checks` allows one suite or full regression at a time, with no GPU job or paid compute operation in this phase.
Each browser fixture chooses a loopback port dynamically and discovers the actual bound port from its own temporary runtime file.
Only `playwright.config.ts` reads VSR_E2E_CHROMIUM, whose value is obtained from the host contract rather than stored in tracked configuration.
All command paths below are relative to the assigned worktree, with frontend commands executed from its `frontend/` directory.
T1–T5 each require an independent Mechanical Auditor `luna(xhigh)` followed by an independent Task Reviewer `sol(high)` because the work crosses modules or public interfaces.
If Luna is unavailable at dispatch, the CODEX fallback is an explicitly reported `terra(medium)` Auditor invocation.
T6 uses the same independent Auditor and Reviewer after all other writers stop, and the integration writer cannot fill either seat.
Auditors compare the actual changed paths with the task write set, run the task's commands, and run `python3 scripts/check_diff_rules.py --base <task-base-commit>`.
The Reviewer gives a disposition for every REVIEW line, using `V1#n`, a recorded §21 decision, or a defect requiring rework.
Task-base hashes come from the private dispatch ledger and remain fixed even when main receives records commits.
Every audit also performs the LIFECYCLE protected-section and public-repository scans, with the host word list kept private.
Only T1 may create the pre-approved protected configuration blocks, using `docs/dev/rules-config.md` verbatim and the checked Rules authorization.
Later tasks may edit unprotected settings in those files but may not change the approved lint, strictness, forbid-only, or retry blocks.
Auditor or Reviewer failure returns the exact issues to the same Worker role, with two consecutive failure rounds followed by one Planner amendment and then BLOCKED if the amended attempt still fails.
No tests or review seats are rerun after an unchanged pass unless a dependency, covered file state, or verification configuration changes.
Report files, if saved by the Controller, use `docs/dev/cycles/C1/reports/M0-T<n>-<seat>-<attempt>.md` and stay within the contract's 150-line limit.

## T1 — Buildable Python and frontend foundation

- Task type and role row: multi-module implementation plus approved configuration initialization, `terra(high)` Worker.
- Dependency and order: first, after binding the completed independent recon, current baseline and closure evidence for T1's environment dispatch block.
- Dispatch status: BLOCKED until the selected interpreter and dependency compatibility evidence in the recon-unknown table is recorded.
- Risk: high because this task creates protected standards under the existing Rules authorization.
- Deliverable: a buildable Python package and strict React frontend with the locked dependencies and approved quality commands.
- Explicit write set: `.gitignore`, `pyproject.toml`, `uv.lock`, `src/vsr/__init__.py`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/playwright.config.ts`, `frontend/eslint.config.js`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css`, and `tests/conftest.py`.
- Implicit write set: this worktree's `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `frontend/node_modules/`, `frontend/test-results/`, `frontend/playwright-report/`, `src/vsr/web/`, Python bytecode, and temporary dependency caches.
- Resources: one dependency-install or build process under `checks`, with no fixed listening port.
- Bound facts: Python ≥3.11, hatchling, dependency names and extras from DESIGN §18, TypeScript constrained to 6.0.x, and the exact initial protected configuration text from `docs/dev/rules-config.md`.
- Bound facts: recon observed Python 3.15.2, uv 0.12.10, Node 26.13.1, npm 11.20.0 and Chromium 156.0.8078.79, but did not establish project dependency or browser readiness.
- Bound facts: the actual compatible Python interpreter and verified dependency versions must come from the independent preflight evidence in the private ledger, without assuming PATH Python has torch.
- Constraints: preserve `/ORCHESTRATION.md` ignore behavior, add required generated-output ignores, keep root npm files untouched, set pytest `testpaths = ["tests"]`, use `vsr = vsr.cli:main`, and package built web assets through the specified hatch artifact configuration.
- Constraints: never invent runtime dependencies, loosen strict TypeScript, add inline suppressions, add attribution metadata, or modify the rule checker.
- Constraints: configure dev API and WS proxying to port 8765 while tests use their own random-port real server.
- Acceptance command: `uv sync` followed by `uv run python -c 'import vsr, torch, fastapi, numpy, scipy, soundfile'`, `uv run ruff check .`, and `uv run ruff format --check .`.
- Acceptance command: in `frontend/`, run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Expected outcome: dependency locks exist, the shell builds to the ignored web directory, and the approved lint and test-runner blocks match their source exactly.
- Task Plan: not required because the explicit write set and configuration source define this bounded bootstrap.
- Fact Check: the completed independent recon report and the separate environment-block closure evidence are both required inputs, with their paths supplied by the Controller.
- Verification: Auditor `luna(xhigh)` checks commands, lockfiles, approved configuration equality, and write scope, then Reviewer `sol(high)` checks stack and authorization compliance.
- Acceptance mapping: foundation for all exits, directly M0.4 and M0.C3.

## T2 — Shared framed protocol and cross-language roundtrips

- Task type and role row: multi-module implementation, `terra(high)` Worker.
- Dependency and order: after reviewed T1 and the Controller's recorded framing decision.
- Risk: high because one binary contract carries every large array.
- Deliverable: the single Python and TypeScript framed encoder/decoder pair, with a bidirectional executable interoperability suite.
- Explicit write set: `src/vsr/frame.py`, `frontend/src/api/frame.ts`, `tests/test_frame.py`, `tests/frame_interop.py`, and `frontend/tests/frame.test.ts`.
- Implicit write set: the T1 cache and dependency directories plus temporary framed messages below the test's temporary directory.
- Resources: `checks`, with no server or browser required.
- Bound facts: dtype names, little-endian C order, single-array header, named multi-array descriptors, and eight-byte segment alignment come from DESIGN §6 and the recorded padding decision.
- Constraints: tests generate data in code, do not commit binary fixtures, and use the shared codecs rather than duplicate protocol implementations.
- Constraints: Python's test helper is a test-only bridge callable as `uv run python tests/frame_interop.py` and is not an application route or option.
- Acceptance command: `uv run pytest tests/test_frame.py` and, in `frontend/`, `npm test -- --run tests/frame.test.ts` plus `npm run typecheck` and `npm run lint`.
- Expected outcome: both roundtrip directions preserve all supported dtypes, multidimensional shapes, extra metadata, named arrays, alignment, and exact payload bytes.
- Task Plan: not required after the protocol decision is bound.
- Fact Check: not required beyond Auditor inspection of the pinned protocol and bridge invocation.
- Verification: Auditor `luna(xhigh)` executes roundtrips and rule checks, then Reviewer `sol(high)` checks protocol interpretation and test independence.
- Acceptance mapping: M0.5 and M0.C1.

## T3 — Authenticated backend, waveform, PCM, and CLI lifecycle

- Task type and role row: multi-module implementation, `terra(high)` Worker.
- Dependency and order: after reviewed T2 and the Controller's recorded device-error decision.
- Risk: high because token handling, user-file access, and resampled playback are trust and numeric boundaries.
- Deliverable: an executable local audio server that opens supported audio files and supplies authenticated session, waveform, PCM, device, and WebSocket behavior.
- Explicit write set: `src/vsr/cli.py`, `src/vsr/config.py`, `src/vsr/device.py`, `src/vsr/api.py`, `src/vsr/server/__init__.py`, `src/vsr/server/app.py`, `src/vsr/server/session.py`, `src/vsr/server/ws.py`, `src/vsr/server/routes_files.py`, `src/vsr/server/routes_lanes.py`, `src/vsr/server/routes_settings.py`, `src/vsr/io/__init__.py`, `src/vsr/io/audio.py`, `src/vsr/dsp/__init__.py`, `src/vsr/dsp/waveform.py`, `tests/test_cli.py`, `tests/test_config.py`, `tests/test_device.py`, `tests/test_server.py`, `tests/test_waveform.py`, and `tests/test_pcm.py`.
- Implicit write set: T1 caches, temporary VSR_HOME trees containing runtime/config/upload files, generated temporary audio, and Writer-owned loopback server processes.
- Resources: `checks` plus dynamically allocated loopback ports, with cleanup of only this task's server PIDs.
- Bound facts: CLI, runtime-file mode 0600, token generation, the ten subsequent port attempts, auto-device order, configuration keys, error payload, and import boundaries come from DESIGN §4.
- Bound facts: audio data is CPU float32 `[C, N]`, sample indices use `round(t*sr)`, and lane mutations lock session state and broadcast `lanes_changed` as defined in §5–§7.
- Constraints: implement `/ping`, `/session`, `/fs/list`, `/open`, `/upload`, lane patch/delete/reorder, waveform/PCM, `/settings`, and `/ws` only as needed by M0.
- Constraints: opening tensor files remains the M2 deliverable, so M0 must not add fake interpretation results or unsupported empty handlers.
- Constraints: waveform arrays and PCM use T2 framed codecs, waveform bounds and min/max/RMS follow §8.2 exactly, and render responses use `Cache-Control: no-store`.
- Constraints: PCM uses scipy polyphase resampling with boundary context and must equal slicing the whole-lane reference after resampling, including adjacent 20-second chunks.
- Constraints: do not import sounddevice to start the server, do not create unused recording or cache abstractions, and do not add out-of-spec recovery paths.
- Constraints: test CLI browser launch at the webbrowser boundary while separately exercising the real CLI/server process against its temporary runtime file.
- Acceptance command: `uv run pytest tests/test_cli.py tests/test_config.py tests/test_device.py tests/test_server.py tests/test_waveform.py tests/test_pcm.py`.
- Acceptance command: `uv run ruff check .` and `uv run ruff format --check .`.
- Expected outcome: generated audio opens without changing the source, HTTP and WS reject missing/wrong tokens, actual runtime ports are discoverable, PCM and waveform match the numeric table, and patched self-check failure reports CPU fallback.
- Task Plan: not required because the interfaces and numeric references are specified here and in DESIGN.
- Fact Check: not required unless an implementation claim about environment behavior is used to bypass an acceptance item, in which case an independent `terra(medium)` Fact Agent verifies it.
- Verification: Auditor `luna(xhigh)` executes the boundary and numeric suites, then Reviewer `sol(high)` checks lifecycle, auth, I/O, resampling, import boundaries, and REVIEW dispositions.
- Acceptance mapping: M0.1, M0.4, M0.6, and backend support for M0.2–M0.3.

## Numeric expectations fixed before implementation

| Unit and generated input | Expected value or independent reference |
|---|---|
| Waveform with sr=8, samples `[0,1,-1,0.5,-0.5,0,1,-1]`, t0=0, t1=1, width=2. | Each four-sample column has min=-1, max=1, and RMS=0.75, yielding shape `[1,3,2]`. |
| The same waveform with t0=0.125, t1=0.375, width=4. | Raw samples `[1,-1]`, `first_sample=1`, and shape `[1,2]`. |
| A viewport partly outside a lane. | No out-of-file samples are synthesized, and header coverage matches the returned samples or pooled columns while the frontend leaves the remainder blank. |
| PCM at sr=4 from `[0,1,0,-1,0,1,0,-1]`, requesting t0=0.5, t1=1.5 at sr=4. | `[0,-1,0,1]` with the source channel count retained. |
| A fixed-seed 48 kHz source requested at 44.1 kHz in one interval and in neighboring chunks around 20 seconds. | Output equals the corresponding slices of `scipy.signal.resample_poly` applied to the entire source, with the source and reference both evaluated as float32. |
| Device stft, istft, rfft, and matmul on the bound nonzero synthetic input. | Each result has relative error strictly below `1e-4` against CPU under the Controller's recorded metric. |
| Python/TS frame with i16 values `[1,-2,32767]`. | Payload little-endian bytes `01 00 fe ff ff 7f`, preserved exactly in both roundtrip directions. |
| Python/TS frame with f32 values `[0,1,-2]`. | Payload little-endian bytes `00 00 00 00 00 00 80 3f 00 00 00 c0`, preserved exactly in both directions. |
| Two lanes containing a generated nonzero signal x and its exact negative. | After two complete loops, master RMS is less than the measured single-lane RMS multiplied by `10**(-60/20)`. |
| The same audible lane before and after mute. | Muted master RMS is at most baseline RMS multiplied by `10**(-40/20)`. |

The completed Plan Review independently recomputed the explicit RMS and byte examples, as recorded in its evidence section.
No new tolerance is substituted for a DESIGN threshold.

## T4 — Waveform workspace and device interaction

- Task type and role row: multi-module implementation, `terra(high)` Worker.
- Dependency and order: after reviewed T3.
- Risk: normal.
- Deliverable: the dark dockview audio workspace with authenticated file actions, a shared waveform viewport, time selection, and device Settings.
- Explicit write set: `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/styles.css`, `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/state/session.ts`, `frontend/src/state/viewport.ts`, `frontend/src/lanes/Lanes.tsx`, `frontend/src/lanes/LaneHeader.tsx`, `frontend/src/lanes/Timeline.tsx`, `frontend/src/lanes/Overview.tsx`, `frontend/src/render/waveform.ts`, `frontend/src/panels/Files.tsx`, `frontend/src/panels/Properties.tsx`, `frontend/src/panels/Settings.tsx`, `frontend/tests/viewport.test.ts`, `frontend/tests/waveform.test.ts`, `frontend/tests/e2e/fixtures.ts`, and `frontend/tests/e2e/m0-workspace.spec.ts`.
- Implicit write set: T1 caches and generated web output, temporary VSR_HOME/audio files, browser profiles, localStorage and sessionStorage, screenshots under `frontend/test-results/screens/M0-*.png`, and Writer-owned test servers.
- Resources: `checks`, one Chromium instance, and dynamically allocated loopback ports.
- Bound facts: layout and style values come directly from §9.1–§9.6, waveform math from §8.2, and metadata and settings requests from reviewed T3.
- Constraints: implement file browsing, recent opens, drag/drop upload, notifications, lane close/reorder/name/gain/mute/solo/offset, overview dragging/resizing, waveform sample points, and time selection needed for M0.
- Constraints: shared time zoom/pan, selection input and handles, Home/End, `=`, `-`, `0`, and `Z` follow the assigned §9 interactions, while later spectral and editing controls remain absent.
- Constraints: waveform uses per-lane Canvas2D and devicePixelRatio, with no frontend DSP and no WebGL renderer before M1.
- Constraints: store the bootstrap token in sessionStorage and remove it from the address bar, refresh session on `lanes_changed`, and persist dockview layout in localStorage.
- Constraints: use real backend browser fixtures, temporary VSR_HOME, random ports, source-generated audio, and the host-selected Chromium via the approved config path.
- Acceptance command: in `frontend/`, run `npm run typecheck`, `npm test -- --run tests/viewport.test.ts tests/waveform.test.ts`, `npm run lint`, `npm run build`, and `npx playwright test tests/e2e/m0-workspace.spec.ts`.
- Expected outcome: file open and upload produce waveform lanes, zoom reaches the specified sample-point spacing, overview and selection update observable times, device settings show fallback reasons, and M0 workspace screenshots are captured.
- Task Plan: not required because the interaction map and API are bound to DESIGN and T3.
- Fact Check: not required, and screenshots are evidence for human inspection rather than a visual pass gate.
- Verification: Auditor `luna(xhigh)` executes unit/browser checks, then Reviewer `sol(high)` checks observable behavior, request handling, task scope, and UI conformity.
- Acceptance mapping: M0.1, visual part of M0.2, M0.4, M0.6, and screenshot support for M0.C2.

### Amendment A2 — Zero-width resize and recovery acceptance

This task-level amendment follows the two consecutive semantic-review FAIL verdicts in `reports/M0-T4-review-1.md` and `reports/M0-T4-review-2.md`, under the orchestration contract's Review cap.
T4 acceptance additionally requires the real-backend Chromium regression `workspace survives zero waveform width and recovers when widened` in the existing `frontend/tests/e2e/m0-workspace.spec.ts`.
The regression must open generated audio, resize from positive waveform width through a layout where the observed canvas client width is zero, assert that the dock workspace remains attached, then widen the layout and assert that the same waveform is visible with positive width and its timeline labels restored.
Retain evidence that this regression fails on the pre-repair tree and passes on the repaired tree, and retain the existing sample-zoom regression for distinct increasing ruler labels at positive widths.
The existing T4 acceptance commands include this regression, and independent verification must cover the zero-width repair and recovery evidence without weakening or replacing any existing test or expanding T4's scope or write set.
The two original FAIL verdicts remain historical, and any further semantic-review FAIL after A2 makes T4 BLOCKED under the Review cap.

## T5 — Synchronized browser transport and playback evidence

- Task type and role row: multi-module implementation, `terra(high)` Worker.
- Dependency and order: after reviewed T4.
- Risk: high because independent lane scheduling and looping determine numerical playback acceptance.
- Deliverable: the Web Audio transport and executable multi-lane playback acceptance suite.
- Explicit write set: `frontend/src/App.tsx`, `frontend/src/state/session.ts`, `frontend/src/lanes/Lanes.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/src/panels/Transport.tsx`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.
- Implicit write set: T1 caches and web output, temporary VSR_HOME/audio, browser profile and audio graph state, M0 screenshots, and Writer-owned test servers.
- Resources: `checks`, one Chromium instance, one AudioContext per page, and dynamically allocated loopback ports.
- Bound facts: sample-rate requests, 20-second prefetch chunks, common first `when`, per-lane and master gains, loop padding, and playhead time come from DESIGN §9.4.
- Constraints: audible lanes respect mute and solo, lane offsets align their content, and multi-channel playback selects the displayed channel when channel count exceeds two.
- Constraints: playhead uses AudioContext time and stops exactly at the selection endpoint, with page-follow behavior and Space/L transport interactions.
- Constraints: implement the master AnalyserNode and expose RMS and playhead through `window.__vsr_test` only in dev/test builds, using build configuration already defined by the spec rather than a new application flag.
- Constraints: the test hook does not implement DSP or replace the actual Web Audio graph, and e2e checks the output graph rather than internal scheduling calls.
- Acceptance command: in `frontend/`, run `npm run typecheck`, `npm test -- --run tests/playback.test.ts`, `npm run lint`, `npm run build`, and `npx playwright test tests/e2e/m0-playback.spec.ts`.
- Expected outcome: the actual master RMS and playhead satisfy every M0.3 clause after two completed loops, including mute and solo checks, with no conditional e2e skip.
- Task Plan: not required unless the Worker reports an unresolved scheduling interface, which goes to the existing Planner before edits rather than an implicit design choice.
- Fact Check: not required unless Reviewer explicitly identifies an unsupported causal claim about alignment.
- Verification: Auditor `luna(xhigh)` runs the waveform cancellation and playback tests, then Reviewer `sol(high)` checks sample alignment, observable measurements, cleanup, and test-hook exposure boundaries.
- Acceptance mapping: M0.3, M0.4, and M0.C1.

## T6 — Final phase integration, measurement, and acceptance

- Task type and role row: multi-module integration and final-tree verification, `terra(high)` integration Worker after its execution channel is resolved.
- Dependency and order: last, after T1–T5 have current independent PASS evidence and every other Writer is stopped.
- Dispatch status: BLOCKED until the unresolved git executor channel in the decision section is resolved and recorded.
- Risk: high because this task integrates the only accepted tree and produces milestone evidence.
- Deliverable: accepted M0 final tree with `docs/acceptance/M0.md` and the M0 benchmark evidence.
- Explicit write set: the union of T1–T5 implementation write sets for necessary integration fixes, `tests/bench/waveform_open.py`, `tests/bench/waveform_open.ts`, `docs/acceptance/M0.md`, and append-only `docs/DESIGN.md` §21.
- Explicit post-squash records write set: `docs/dev/performance.md` on the main working tree only, as required by LIFECYCLE Performance budget.
- Implicit write set: all earlier generated directories, temporary benchmark WAV files, test VSR_HOME trees, browser profiles/screenshots, authorized task/phase worktrees and git metadata, and task-owned server processes.
- Resources: exclusive final-tree ownership, `checks`, one browser, and dynamically allocated loopback ports, with no paid compute.
- Bound facts: integration branch `master`, task branches `task/M0-T<n>`, phase branch `phase/M0`, task and phase base hashes from the dispatch ledger, and the current authorization records from the state directory.
- Bound facts: benchmark platform/device facts come from recon plus actual `device.py` availability, while previous measurements are read from main's `docs/dev/performance.md` if that file exists.
- Constraints: merge only reviewed current task attempts in dependency order through the exact no-ff and squash procedure in LIFECYCLE Integration once the git execution channel permits it.
- Constraints: do not edit protected standards, replay approved initial configuration changes as new exceptions, stage unrelated root npm files, or include generated web assets in a commit.
- Constraints: append the Controller's recorded product decision numbers to §21 without rewriting existing decision rows.
- Acceptance command: run the entire AGENTS command sequence on the phase tree, including `uv sync`, pytest, both ruff checks, frontend `npm ci`, typecheck, all vitest tests, lint, build, and all Playwright tests.
- Acceptance command: use host-selected VSR_E2E_CHROMIUM or install Playwright Chromium as specified in DESIGN §20, without conditional browser-test skips.
- Acceptance command: run `uv run python tests/bench/waveform_open.py` to launch the generated ten-minute 48 kHz stereo first-waveform benchmark, with `waveform_open.ts` as its browser measurement driver.
- Acceptance command: run `python3 scripts/check_diff_rules.py --base <phase-base-commit>`, the complete protected-content checks, public-repository scan, and `impl check` after all writers stop.
- Acceptance command: after the authorized squash commit, run the full AGENTS sequence again on the main final tree and verify no generated artifacts entered the commit.
- Expected outcome: every M0.1–M0.6 and M0.C1–C3 row has real current-run evidence, with unavailable checks retaining FAIL or NOT RUN and preventing an unsupported completion claim.
- Measurement: create the WAV in a temporary directory, measure CLI open request to first actual Canvas waveform draw in the real browser, and take the median of three runs for each locally available compute device.
- Measurement: record the three observations, median, platform description without hostname/path, commit, device, and comparison to the previous same-platform/device observation in the acceptance report.
- Measurement: when there is no prior same-platform value, state that fact and establish the first platform reference, without treating the §17 reference as a pass threshold.
- Measurement: append only M0's §17 row-1 measurement on main after squash, leaving rows 2–7 explicitly unmeasured until their assigned milestones.
- Report: write the Chinese human-facing `docs/acceptance/M0.md` with screenshots at `frontend/test-results/screens/M0-*.png`, actual test names and output summaries, skipped pytest-device reasons, performance comparisons, and DESIGN deviations.
- Task Plan: not required after the execution-channel conflict is resolved because LIFECYCLE prescribes the integration procedure.
- Fact Check: not required by default, but an independent `terra(medium)` Fact Agent is required if a benchmark failure explanation depends on an unverified platform claim.
- Verification: independent Auditor `luna(xhigh)` checks both final trees and benchmark outputs, then independent Reviewer `sol(high)` checks the whole phase diff, all exit evidence, drift within M0 scope, and every REVIEW disposition.
- Acceptance mapping: all nine exits, with no M1 dispatch until they are satisfied.

## Budget and continuation

The phase estimate remains 28 agent invocations, comprising 21 baseline invocations and the unchanged seven-invocation reserve.
The baseline is one recon, one Planner, one Plan Reviewer, six Workers, six Auditors and six Reviewers, with seven `sol` seats consisting of one Planner and six Task Reviewers and one `astra` Plan Reviewer seat.
Amendment A1 consumes one `sol(xhigh)` invocation from that reserve, bringing the currently allocated `sol` seats to eight and leaving six reserve invocations for environment preflight, bounded rework or execution-channel resolution.
At most two further `sol` or `astra` invocations remain within the original reserve allocation of three such invocations, and all actual usage remains cumulative in the Controller's ledger.
There is no declared paid-compute cost and no project budget cap in the host contract.
The orchestration estimate-overrun rule still applies at 42 invocations, equal to 1.5 times this phase estimate, unless the Controller records a contract-authorized resolution before that threshold.
The current step finishes at the threshold, after which new dispatch stops and a Budget gate request is recorded.
The single Plan Review and recon are complete, and this amendment exhausts the allowed plan-amendment round without commissioning a second routine Plan Review.
The first implementation dispatch still waits for current baseline facts and T1's recorded environment-block closure, and every later task retains its own dispatch blocks.
The integration-channel conflict is tracked explicitly and does not authorize silently changing the project runbook or the installed skill.
