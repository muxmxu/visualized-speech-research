# M3-T2 independent semantic review 1

**PASS for the frozen frontend patch.**

- Mechanical audit 1 passed for the seven approved frontend files on base `b1e46e3f595c0790817dd64846d90a66a5876924` and the frozen patch below.
- M3.2 passed in real Chromium against the accepted M3-T1 backend. The E-tool test draws a rectangle around the generated 440 Hz tone, presses Delete and `ControlOrMeta+z`, and checks the decoded f16 means in the same time and frequency bounds from three matching `/spectrogram` URLs. The assertions require a drop of at least 30 dB and restoration within 0.5 dB. The frozen result records one passing case and the thresholds are in the test source. Individual means were not captured.
- The normal editing paths use the existing time selection and T-F owner view and channel, and bind the §15 operations to keyboard commands, lane and selection menus, and the floating Play, Delete, gain-on-release, and Extract controls. Source inspection confirmed the grouped time edit payload, editable selection values, shortcut help, 300 ms busy indicator, and `lanes_changed` redraw path.
- The browser case also redoes the edit and uses Save As with an explicit WAV destination and FLOAT subtype. It verifies the output WAV signature, the cleared dirty marker, and byte-identical original audio. Source inspection confirmed the explicit overwrite prompt for Save, dirty last-view close confirmation, and the server-side rejection of Save As paths resolving to an open source.
- `App.tsx:445` is allowed under `V1#1`. The edit action boundary reports request failures through notifications and uses the HTTP client's existing notification for `ApiError`.
- `App.tsx:487` is allowed under `V1#1` and DESIGN §15. The implicit Save HTTP 400 opens Save As, and other errors propagate to the request notification boundary.
- H59 applied. The review reused `playwright-last-run.json`, `M3-edit.png`, `rules.log`, and `worker-checks-attestation.txt` from `M3-T2-audit-1-evidence`. The Worker attested to passing TypeScript, ESLint, and production build. The preserved screen is `frontend/test-results/screens/M3-edit.png` in the task worktree.

```text
a958f25de9c9859ef3048eed1e522ed3d01725d3706ac1b9a2a24c9385683d44  worker.patch
99da2a15480c7ea118158d749dbee318991c56d445915ae016e0878e1ee32fc3  primary-evidence.sha256
```
