# M1-T6 semantic review 1

Verdict **FAIL**.
Required action **modify** the three behaviors below within the planned write set.

## Issues

1. `frontend/src/App.tsx:284` retains a T-F selection after the lane or originating view is closed, and its missing-owner branch then returns before scheduling playback.
   In Chromium, drawing on the first of two lanes, closing that lane and pressing Space left one lane and zero rectangles, but the Low Hz input remained and no new PCM request was issued.
   Clear the T-F selection when its lane or originating view is removed, and verify that Space resumes ordinary playback of the remaining lane.
2. `frontend/src/lanes/TfSelection.tsx:22` stops all pointer move events on the E overlay, including idle hover, before the parent waveform can update its spectrogram readout.
   In Chromium, hovering over loaded spectrum data displayed Hz and dB with the time tool active, while the same spectrogram lost both values after switching to E without drawing a selection.
   Preserve the DESIGN §§9.1 and 9.3 hover path on the E surface when it is idle, and cover the readout with the E tool active.
3. `frontend/src/App.tsx:80` renders a plain time selection and handles, while `frontend/src/lanes/TfSelection.tsx:27` supplies the floating Play action only for a T-F rectangle.
   In Chromium an ordinary waveform drag created one visible time selection with no floating Play button, while a T-F drag exposed one.
   Provide the M1 Play action above the ordinary time selection as specified by DESIGN §§9.6 and 19, and verify that it audibly plays that interval via the ordinary PCM path.

## Verified behavior

A focused Chromium probe against the built frozen tree used generated 21 s audio and the actual server.
The first two masked requests carried chunk bounds `[0, 20)` and `[20, 21)` with identical complete selection bounds `[0, 21)`, confirming the contiguous joins and the 20 s duration cap.
Dragging the waveform split changed spectrogram height from about 111.3 px to 131.3 px while preserving the rectangle's normalized top and bottom at 0.25 and 0.75.
The inspected screenshot shows a T-F rectangle, resize handles, floating Play, editable bounds and a frequency plot covering 200–1000 Hz.
The audit's 23 passing Chromium cases and 35 Vitest cases cover originating view FFT, selected-lane mask requests, move and resize, logarithmic coordinates, analysis limits, right-click zoom and the preexisting playback cases.
Production changes are limited to the frontend and use the existing authenticated framed requests.
The rule check returned `0 FAIL, 0 REVIEW` and `git diff --check` returned no diagnostics.
The focused browser probe did not repeat the unchanged full suites.

## Covered state

Task HEAD and comparison base are `20b42ec5e870a47035aa137e62540603a1709d77`.
The nine changed file hashes and screenshot hash match the independent mechanical audit.

```text
9e4ea6e74d16e31c8db77447a6686e1c90e811c10eb7d60f594167b4d28140d5  frontend/src/App.tsx
38ecc448f9fd64ad799b541cc095f9e1591d2c613171016bb71a47287605ab07  frontend/src/styles.css
7bbd0c2fe132f49892fe15fc49ea5c714314b3341e9433af0b387dd5029a9b84  frontend/src/audio/playback.ts
a9387599a240600e5cf1271421c660dc46f55e8f2fd3e0f69d6b7c742bdd71b0  frontend/src/lanes/SpectralLane.tsx
a3683fe2e065be60487fec7f4eb0b6f5da381534a5feefc8b6e75ff9eda0c914  frontend/src/lanes/TfSelection.tsx
2a8919892be7f7b21798e2d1f622db5f148d71c5cf8bf61827f14f24dc31c5c5  frontend/src/panels/FrequencyAnalysis.tsx
d1302e69cc7d167821ed3ceb0e6cbddfda8770b38c2c797abe4c02fbbac40ad6  frontend/src/state/tfSelection.ts
f27e852a94e2f797f4a7b019778dd87b0cba09a42690330145ff2a8a40738643  frontend/tests/e2e/m1-audition.spec.ts
967b447e816027525777aba18422ed2b82226a089c8fef223f616f968d859aa1  frontend/tests/tfSelection.test.ts
4d77695584ab2923bb85eaa34956426ac944bc86bad37c66f1b55455da0da907  frontend/test-results/screens/M1-audition.png
```
