# M0-T6 Final Semantic Review 1

Verdict: FAIL for one reproduced interaction between zero-width layout recovery and playback page-follow.
Required action: modification within T6's integration write set, followed by current final-tree verification and updated acceptance evidence.

## Issue

### P2 — Starting playback at zero waveform width corrupts the shared viewport

Location: `frontend/src/App.tsx:146`.
The playback tick captures the waveform width at the moment Play is invoked, computes `span = width * old.secondsPerPx`, and uses `Math.floor(position / span) * span` as the next viewport origin.
When the waveform width is zero, this stores NaN in the shared viewport, and restoring positive width does not restore finite timeline labels.
This combines two existing M0 behaviors covered separately by T4 Amendment A2 and T5, without involving a later milestone.

The independent focused probe used the final main tree, its test-mode web bundle, real backend, authenticated audio open, generated one-second mono tone, temporary VSR_HOME, dynamically assigned loopback port and actual Chromium playback.
Reproduction: open the generated tone at the normal browser width, resize the browser viewport to 300 by 720, wait for observed waveform client width zero, click Loop, click Play, wait 500 ms, widen to 1280 by 720, then wait another 500 ms.
Before starting playback, observed waveform width was `0` and all six ruler labels were `0.000`.
After widening, observed waveform width was `620`, all six ruler labels were `NaN`, and the real playback hook still reported `playing() = true`.
The pageerror collection was empty, so this is a corrupted displayed viewport rather than a captured exception.
These observations are the failing pre-repair evidence from the reviewed committed state.

The existing `workspace survives zero waveform width and recovers when widened` test resizes without starting playback, while the playback tests start at positive width, so neither covers this combination.
Required fix: keep the shared viewport finite when playback begins without drawable waveform width, and make subsequent page-follow use the current visible viewport width after resizing.
Required regression: open generated audio, reach observed zero waveform width, start playback, widen again, and assert finite increasing ruler labels and restored real waveform drawing while transport remains active.
Retain the original A2 resize regression and existing transport and numerical assertions.
Do not treat the current acceptance report's no-deviation statement or M0 completion as final until this defect is repaired and verified.

## Review coverage and retained evidence

The review read AGENTS, LIFECYCLE, the current state records, relevant DESIGN §§0, 4–9 and 16–21, phase tasks T1–T6 with A2/A3, the M0 acceptance report, performance record and final mechanical audit.
The whole phase implementation was inspected against the M0 scope in both directions, including CLI/configuration, device selection, HTTP/WS/session, file input, framed codecs, waveform/PCM computation, frontend workspace and transport, browser fixtures and benchmark sources.
Later public APIs, spectral rendering, tensor interpretation, editing, recording, analyzers, dataset and RIR behavior remain assigned to their later milestones and were not expanded into this review.
The approved stack and strict/forbid-only configurations remain present, and no additional M0 runtime service or future placeholder route was found in the inspected implementation.
The initial protected configuration creation is the recorded T1 authorization, while the integration DESIGN change only appends D33, D36 and D37 to §21.
Audit 1's protected-content and public-repository scans are reused.

CLI source binds loopback by default, selects an ephemeral port in the tests, stores token-bearing runtime data with mode 0600, and removes that runtime file during server teardown.
API middleware checks the bearer token, WS checks its query token before accepting, the client strips the bootstrap token from the address bar, and browser state uses sessionStorage for it.
The backend does not import sounddevice during startup, does not add tensor loading in M0, reads opened audio without rewriting its source, and places uploads under its VSR_HOME with upload-name validation.
The backend tests cover missing/wrong HTTP and WS token, source preservation, safe upload naming, visible error payloads, finite parameter validation and real CLI runtime metadata.
Framed tests compare independent expected bytes and cross-language round trips, including dtype, shape, metadata and exact storage bits.
Waveform tests check explicit analytical min/max/RMS values, raw samples and out-of-file coverage, and PCM tests compare adjacent chunk results directly with whole-source scipy resampling.
Device tests use candidate-versus-CPU relative errors, and fallback reasons are checked in both backend and Settings browser evidence.
The T5 source and retained tests preserve the previously reviewed lane-removal, live-channel, loop-alignment and failed-request cleanup/recovery behavior.

The benchmark generates an actual 600-second, 48 kHz stereo WAV in temporary storage.
Its timing begins before the real CLI open process and ends after instrumented Canvas fillRect executes on the actual waveform renderer, rather than merely observing an attached canvas.
The timed path suppresses the redundant browser-open call while using the real already running server and open request, and the separate browser-check path invokes the CLI's browser launch command and waits for a waveform draw.
The three recorded CPU observations are 4.173128272, 4.187923942 and 3.720843174 seconds, with median 4.173 seconds and CLI startup included.
The report identifies the benchmark-time phase revision and correctly states that there is no previous same-platform CPU measurement.
The post-squash performance record uses the final main commit and leaves later performance rows unmeasured.
The performance difference from the DESIGN reference is a measurement, not an acceptance failure.

The three referenced screenshots were visually inspected: CLI stereo waveforms, sample-level workspace points and Settings fallback, and selection/playback state are visible.
The CLI screenshot contains the default home-directory listing, while the workspace and playback screenshots browse generated temporary audio directories.
These generated screenshots are ignored artifacts and are not in the commit; screenshot appearance is not an acceptance gate.

Audit 1 records 35 passing pytest tests, 18 passing Vitest tests and the remaining required commands passing on both final trees.
Its independent main Playwright run used one worker and passed all eighteen tests, correcting the integration Worker's earlier two-worker resource usage.
Those checks remain valid evidence for their covered behavior and were not repeated by this semantic reviewer.
The only new runtime check was the focused failing zero-width playback probe described above.

## Rule REVIEW dispositions

`frontend/src/App.tsx:18`: V1#1, request Promise failures reach a visible notification.
`frontend/src/App.tsx:58`: V1#1, waveform request failures are visible and owned AbortError cancellation follows DESIGN §9.3.
`frontend/src/App.tsx:88`: V1#1, overview request failures are visible and cleanup aborts the owned request.
`frontend/src/audio/playback.ts:103`: V1#1, request-boundary error visibility and failed-generation cleanup.
`frontend/src/audio/playback.ts:196`: V1#1, generation-guarded active-play cleanup and rethrow to the visible caller.
The five rule-check REVIEW lines are allowed under those dispositions; they do not close the viewport defect.

## Covered state

Phase HEAD: `48df41ecf330f1f5a188ebdbeced83f24108ac6b`, tree `d46e1d1d4546a5b9384294340b1662ae0cb37793`.
Final main HEAD: `556e4d24f095dd040e1584dc055489eb30560c53`, tree `06f28a65f151ddd1dba3acd775b5f89f93d7c4c7`.
The phase and main committed implementation and benchmark files match, with only the expected acceptance-row update differing.
The whole M0 squash diff was reviewed against main's preceding `f1b6a38` records commit.
Expected untracked root package files, post-squash performance record and audit report were preserved.
This review wrote only this report and did not edit implementation, acceptance or process records, stage, commit, push, or ask for human action.
The probe browser, backend and generated temporary directory were cleaned, and no reviewer-owned runtime process remains.
