# M0-T5 Semantic Review 2

Verdict: FAIL for one directly introduced request-failure state defect.
Required action: modification by the T5 Worker.

## Issue

### P2 — A failed initial PCM request leaves transport stuck in loading state

Location: `frontend/src/audio/playback.ts:33`, `frontend/src/audio/playback.ts:81`, and `frontend/src/audio/playback.ts:111`.
`play()` sets `loading = true`, and the new `playing` getter includes that state, but rejection of the initial PCM request exits without resetting loading or disconnecting the newly created gains.
The existing App request boundary displays the error, but its catch does not clear this player state.
The defect was independently reproduced against the final test bundle using a generated one-second mono tone, a real backend with temporary VSR_HOME and a dynamically assigned port, and Chromium's actual Web Audio graph.
The probe opened the tone through authenticated `/api/open`, intercepted exactly the first `/api/lanes/*/pcm` response with HTTP 500 and body `{error: "Injected PCM failure", detail: "Temporary request failure", traceback: null}`, and clicked Play.
After the visible error notification appeared, `playing()` was `true`, the transport button read `Play`, and actual master RMS was `0`.
After the first subsequent Play click with normal requests restored, `playing()` became `false`, the button still read `Play`, and RMS remained `0`.
Only a second subsequent Play click started audio, with `playing()` true, button text `Pause`, and actual master RMS `0.2603219915228875`.
The first retry is therefore consumed by stopping a failed load that the UI presents as stopped.
Required fix: terminate failed loading state and release its audio resources while retaining the visible HTTP-boundary error handling under V1#1.
Required regression: reject the initial PCM request, assert inactive transport and visible failure, restore the request, and assert that one Play action starts real audible output.
This finding concerns the newly added loading lifecycle and does not request a retry or fallback feature.

## Prior issues and regression evidence

Review 1 P1 is closed in the inspected source and current browser evidence.
`Playback.update()` detects removed IDs, restarts only the remaining original playback lanes, and calls stop plus the inactive tick when none remain.
`stop()` invalidates generation, stops and disconnects tracked sources, clears scheduling state, and disconnects gains.
The close-lane regression checks two equal audible lanes, half-level master output after closing one, then zero lanes, inactive transport, more than 60 dB attenuation, and a Play button after closing the last.
The fix3 log records old-code RED with RMS `0.5164` exceeding the half-level upper bound `0.2863`, followed by passing results.
Audit 3 independently passed this browser regression, and audit 4 retains that unchanged coverage.
Review 1 P2 is also closed in the inspected source and current browser evidence.
App now updates playback when either lanes or selected channels change, and channel-change reconciliation restarts scheduling with a copied current channel selection.
The replacement play invalidates old asynchronous loads by generation, stops already queued old-channel sources, and retains the original playback clock anchor for the replacement buffers.
The short-channel regression selects an explicitly identified silent channel, requires more than 60 dB attenuation while playing remains true, then restores the audible channel and requires RMS above ninety percent of baseline.
Review 1's independent explicit-value channel probe supplies historical failing evidence, and audit 3 independently passed the repaired regression.
Early fix3 channel-test failures used an ambiguous string selector, so those failures alone do not establish that a different channel was selected.
The long-channel file contains 170,000 frames at the copied 8,000 Hz sample rate, giving 21.25 seconds.
The value 48,000 at WAV offset 28 is its three-channel byte rate, not its sample rate, which is stored at offset 24.
Audit 4 correctly supersedes audit 3's mistaken duration finding.
The final long-channel regression independently calculates duration from the file header and data size and asserts that it exceeds twenty seconds.
It measures actual master RMS on the silent channel immediately, after playhead 19.5 seconds, after 20.1 seconds, and after the loop wraps below two seconds, then requires audible output when switching back.
The fix4 controlled run with channel reconciliation disabled failed with RMS `0.2585616842000253` against threshold `0.00026011119988334576`.
That controlled run establishes sensitivity to channel reconciliation and is not a full historical-old-tree RED across a chunk boundary.
Audit 4 independently passed the final long-channel browser regression, and the fix4 final full browser run passed all seven cases.
No original RMS threshold or existing acceptance test was weakened.

## Scope and covered state

Base and worktree HEAD: `000c608d3f7cc8330c7523242fe7cc4f3908cd00`.
Reviewed paths remain `frontend/src/App.tsx`, `frontend/src/audio/playback.ts`, `frontend/src/audio/testHook.ts`, `frontend/tests/playback.test.ts`, and `frontend/tests/e2e/m0-playback.spec.ts`, all within the T5 write set.
SHA-256 `frontend/src/App.tsx`: `260246d9e1e281f7514b25a14e32761b7bdefa59004799689233e1cfd2a94211`.
SHA-256 `frontend/src/audio/playback.ts`: `cb00cef13fe0f6bb086539b32d5e439a9440885907f208b9afd9f0c1b566b003`.
SHA-256 `frontend/src/audio/testHook.ts`: `17cf527b99c93edc682efe5b1bb2607135756716df363af4cbfa21ddc7d012e7`.
SHA-256 `frontend/tests/playback.test.ts`: `d8e887e4f382133b962acc3f872e5a6b82af12d3fc49307b2c316d7655d00dea`.
SHA-256 `frontend/tests/e2e/m0-playback.spec.ts`: `a5940daa994f9c5cca86c65a5986cd8ce2da105c0ab61219d7218d0acd2f0553`.
Audit 4 reports `0 FAIL, 0 REVIEW`, so no rule-check REVIEW disposition is pending.
The hook source and dev/test guard are unchanged, and audit 4 records final production-hook exclusion, protected-path checks, and public-repository scan passing.

## Notes

This focused review did not rerun the unchanged acceptance suite or edit task sources.
The only new runtime check was the request-failure probe described above.
Its browser, server, and generated temporary directory were cleaned, and no reviewer-owned process remains.
This review wrote only this report and performed no staging, commit, push, or T6/M1 work.
