# M0-T5 Semantic Review 1

Verdict: FAIL.
Required action: modification by the T5 Worker, with focused regressions for the two reproduced playback-state defects below.

## Issues

### P1 — Closing a lane leaves its audio playing

Location: `frontend/src/audio/playback.ts:46` and `frontend/src/App.tsx:109`.
`Playback.update()` only visits the lanes that still exist, so deleting a lane never disconnects its existing GainNode or sources.
The scheduling closure also retains the original lane list.
An independent real-backend Chromium probe opened a generated one-second mono tone, enabled looping, started playback, and clicked Close lane.
Before closing, the actual master Analyser RMS was `0.26004984702850364`.
After closing and waiting 1.5 seconds, the UI contained zero lanes, `playing()` remained true, and actual master RMS was `0.2586331734252632`.
The removed lane therefore continues emitting sound after its controls and waveform disappear.
Required fix: reconcile removed lanes with the running audio graph and pending scheduling, and stop transport when no playable lanes remain.
Required regression: close a lane during audible playback and assert the actual output changes accordingly, including silence and inactive transport after closing the last lane.
This is within T5 playback lifecycle and resource cleanup, alongside the existing M0 close-lane operation.

### P2 — Playback keeps the old channel after the displayed channel changes

Location: `frontend/src/App.tsx:108`, `frontend/src/App.tsx:180`, and `frontend/src/audio/playback.ts:77`.
Changing the C > 2 channel selector updates the waveform channel but does not update the running player or its captured `channels` argument.
An independent real-backend Chromium probe generated a three-channel file with a tone only in channel 1 and zeros in channels 2 and 3.
With looping active, the initial actual master RMS was `0.2586331734252632`.
Selecting the second channel by its explicit value `1` left that value selected, but after 1.5 seconds actual master RMS was still `0.2603431799165079` and `playing()` was true.
Stopping and restarting with the same selected channel produced actual RMS `0`, confirming that the selected channel itself is silent.
This violates the T5 constraint that multi-channel playback selects the displayed channel when channel count exceeds two, and DESIGN §9.4's current-selected-channel playback rule.
Required fix: make running playback follow the displayed channel, with correct synchronization and invalidation of old queued audio.
Required regression: switch between generated audible and silent channels during playback and assert actual master RMS follows the selector without requiring a manual restart.

## Evidence and covered behavior

The review read AGENTS, LIFECYCLE, the orchestration contract, current state handoff, the impl skill, DESIGN §§0, 5–7, 9.4, 19 M0 and 20, the T5 phase definition, both mechanical audit reports, and the final T5 sources and tests.
Audit 2 reports four passing browser cases on this source state, following audit 1's runtime-loop failure and the recorded repair.
Those tests use generated audio, authenticated requests to a real backend, and the master Analyser output rather than a replacement audio graph.
The mute assertion requires at least 40 dB attenuation, cancellation requires strictly more than 60 dB attenuation, and solo output must match the baseline within ten percent.
The initial cancellation test measures after more than two one-second loops, and the long test exercises a 21.25-second loop through 42.9 seconds with a 0.25-second lane offset.
The long cancellation checks sample the output at specified times rather than recording every boundary sample.
The selection-end test verifies the reported playhead reaches 0.5 seconds and transport becomes inactive.
The single Vitest case independently checks exact integer chunk endpoints for a nonzero start and a partial final chunk.
Source inspection confirms sample-rounded session boundaries and offsets, zero-filled common-length buffers, backend PCM at AudioContext sample rate, common first-source `when`, and no PCM request longer than twenty seconds.
Long selections repeat chunk scheduling, while short selections use the AudioBufferSource loop facility.
Live gain, mute and solo updates use lane GainNodes, and the existing tests exercise live mute and solo.
The playhead derives from AudioContext time and page-follow uses the visible time span.
The test hook reads the real master Analyser, and its call site is guarded by Vite dev or test mode.
Audit 1 verified that the production bundle excludes `__vsr_test`, and audit 2 confirms that guard was unchanged.
Playback PCM requests use the existing authenticated request helper, with framed decoding through the shared decoder.
Explicit Stop and component teardown disconnect tracked sources and gains, and teardown closes the AudioContext.
The two new probes ran serially with generated temporary VSR_HOME data and dynamically assigned loopback ports, and their browsers, servers and temporary directories were cleaned afterward.
No unchanged acceptance command was rerun in this semantic review.
The existing four browser cases do not cover lane removal or live displayed-channel changes.
Audit 2 reports `0 FAIL, 0 REVIEW` from the rule check, so there are no REVIEW dispositions to assign.

## Covered state

Base and worktree HEAD: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
Reviewed state: modified `frontend/src/App.tsx`, plus untracked `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`.
All five paths are within the T5 explicit write set.
SHA-256 `frontend/src/App.tsx`: `1a9066487ee907fe26155411c0fac70fef8bdc7ca4a44528351861822943b2ae`.
SHA-256 `frontend/src/audio/playback.ts`: `a12d7540c0d89a7fe55d88bcec9ef9f3d6cf38e8ff2b67177ed98dc1ab4f579e`.
SHA-256 `frontend/src/audio/testHook.ts`: `17cf527b99c93edc682efe5b1bb2607135756716df363af4cbfa21ddc7d012e7`.
SHA-256 `frontend/tests/playback.test.ts`: `d8e887e4f382133b962acc3f872e5a6b82af12d3fc49307b2c316d7655d00dea`.
SHA-256 `frontend/tests/e2e/m0-playback.spec.ts`: `bfe3fb807e39d84606d131402ab661fd4c72d47880cf605956cbbaf01f24339a`.

## Notes

This review changed only this report and did not edit task files, stage, commit, push, or expand into T6 or M1.
No reviewer-owned process remains running.
The previously passing mechanical checks remain evidence for their covered behavior and do not close the two reproduced semantic defects.
