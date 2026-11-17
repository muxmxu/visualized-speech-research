# M0-T5 Semantic Review 3

Verdict: PASS for the final post-A3 T5 state covered below.
Issues: none requiring modification within this focused review.
Required action: none.

## Reviewed evidence

The review read T5 Amendment A3, semantic reviews 1 and 2, mechanical audits 4–7, the fix5–fix7 repair evidence, and the final playback implementation, App integration, hook and browser regressions.
Audit 7 independently ran the final-tree typecheck, playback Vitest, lint, production build, hook-exclusion search and complete T5 browser file, with all eleven browser tests passing.
Its final five source hashes match this review's freshly read files exactly.
Those current independent results are reused; no unchanged suite or runtime probe was rerun by this reviewer.

## Prior issue closure and A3 behavior

Review 1 P1 remains closed by `Playback.update()` at `frontend/src/audio/playback.ts:53` and its last-lane stop at line 62.
Removing a playing lane rebuilds only the remaining original lanes after stopping the old graph, while removing the last lane publishes inactive transport.
The retained real-graph regression checks half-level output after closing one of two equal lanes, then zero lanes, inactive transport, a Play button and more than 60 dB attenuation after closing the last lane.
Review 1 P2 remains closed by App's lane/channel update effect and the channel-change reconciliation in the same update method.
The short-channel regression uses explicit selector values, measures silence on the silent channel, then measures restored audible output without a manual restart.
The long-channel regression calculates duration from file data size, block alignment and sample rate and establishes 21.25 seconds.
Its master RMS checks cover the silent selection, playhead beyond 19.5 and 20.1 seconds, and the subsequent loop wrap, before returning to the audible channel.
The earlier controlled channel-reconciliation disablement demonstrated test sensitivity, and audit 4's WAV-header correction remains valid.
The original long-loop offset cancellation, more-than-60-dB cancellation, at-least-40-dB mute attenuation, solo, selection endpoint and runtime loop-toggle assertions remain present and passed in audit 7.

Review 2's failed initial-load state is closed by `Playback.play()` cleanup at `frontend/src/audio/playback.ts:196`.
For the matching generation, this catch saves the current position, invokes stop, publishes an inactive tick, and rethrows to App's visible request handler.
Stop clears loading and active state, invalidates scheduling, clears the timer, stops and disconnects tracked sources, clears source tracking, and disconnects and clears lane gains.
The fix5 historical initial-request RED received `playing() = true` where the regression expected false, and the repaired final test verifies visible HTTP failure, silent output, a Play button and audible recovery with exactly one subsequent Play click.
The related channel-triggered asynchronous restart awaits the same play method, and its rejection reaches App's existing handled Promise path.
The restart regression begins with audible output, rejects the replacement PCM load, then verifies visible failure, inactive transport, silence and audible single-click recovery after selecting the audible channel.
The restart case's final GREEN is supported by that shared cleanup path and audit 7's full run; the retained historical initial-load RED is not described as a separate historical restart-test run.

Audit 5's detached later-chunk failure is closed by the request-boundary catch and queue failure callback at `frontend/src/audio/playback.ts:103` and line 161.
The HTTP regression holds the second PCM response until the first chunk is audibly playing, then returns HTTP 500, requiring inactive transport, silent output and single-click audible recovery.
It asserts exactly one HTTP notification, zero generic Request failed notifications and an empty pageerror collection.
Audit 6's silent network failure is closed by the non-HTTP notification at `frontend/src/audio/playback.ts:107`.
The queued network-abort regression holds and aborts the second request after audible output, then requires the visible generic notification, inactive transport, silence, an empty pageerror collection and single-click recovery.
The fix7 pre-repair RED failed because that generic notification was absent, followed by the repaired GREEN and audit 7's independent final eleven-test pass.
The HTTP request helper already notifies its plain Error response failure, so the queued catch avoids adding another generic notification for that error.
Other rejected request errors are visibly reported before the failed queue returns without scheduling replacement audio.
The generation and queue-version guards surround queued failure cleanup and the post-load scheduling continuation, and the direct play catch guards its cleanup by generation.
Consequently, an older request failure cannot stop or publish an inactive tick for a newer play attempt through these reviewed paths.
The null queued-load result represents a terminated failed attempt, and the queue returns before it can schedule that result.

## Rule dispositions

`REVIEW C1 frontend/src/audio/playback.ts:103`: allowed under V1#1.
This request-boundary handling preserves the HTTP notification, visibly reports network rejection, and terminates the matching failed scheduling attempt rather than silently continuing playback.
`REVIEW C1 frontend/src/audio/playback.ts:196`: allowed under V1#1.
This active-play boundary performs resource and transport cleanup for the matching generation and rethrows to the caller's visible error handler.
Audit 7 reports `0 FAIL, 2 REVIEW`, and both REVIEW lines therefore have dispositions.

## Covered state and scope

Base and worktree HEAD: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
The task has modified App plus the four declared untracked playback and test files, all within the original T5 write set.
SHA-256 `frontend/src/App.tsx`: `260246d9e1e281f7514b25a14e32761b7bdefa59004799689233e1cfd2a94211`.
SHA-256 `frontend/src/audio/playback.ts`: `71c81e90c5b078436c5b515eef71dcb344febe2efd3221066edd0ce26b461c64`.
SHA-256 `frontend/src/audio/testHook.ts`: `17cf527b99c93edc682efe5b1bb2607135756716df363af4cbfa21ddc7d012e7`.
SHA-256 `frontend/tests/playback.test.ts`: `d8e887e4f382133b962acc3f872e5a6b82af12d3fc49307b2c316d7655d00dea`.
SHA-256 `frontend/tests/e2e/m0-playback.spec.ts`: `47b6ed311886c894e3d60a5c4c4a7699b63f8c301fbeaa18ed8378d08dd918a6`.
The twenty-second request limit, common source start, backend-rate PCM, offset alignment and real master Analyser hook remain in the inspected code.
The test hook remains guarded by dev/test build mode, with production exclusion independently verified in audit 7.
Audit 7 verifies unchanged protected paths and configuration, no DESIGN edits, the declared source write set and the public-repository scan.

## Notes

This verdict covers T5 and its A3 repair only, and does not claim T6 or milestone integration complete.
The original two semantic FAIL reports remain historical.
This review wrote only this report, edited no task source, performed no staging, commit or push, and started no runtime process.
