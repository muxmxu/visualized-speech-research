# M1-T6 semantic review 2

Verdict **PASS**.
Required action **none**.

## Review 1 findings

1. `frontend/src/App.tsx:187` clears the selection when its lane or exact originating view disappears.
   Closing the source lane or one view of a lane in independent Chromium removed the rectangle and Low Hz control and restored ordinary PCM on Space.
   Closing one view left the surviving view of that lane open.
2. `frontend/src/lanes/TfSelection.tsx:22` consumes moves only during a T-F drag.
   With loaded spectrogram data and no drag, the same browser probe observed both frequency and dB on the status bar using either T or E.
3. `frontend/src/App.tsx:84` adds a floating Play button along the top edge of the selected view's time highlight.
   Clicking it in independent Chromium requested ordinary PCM for the selected interval `[2.52, 6.30)` s without a mask and produced measured RMS 0.166.

## Regression evidence

The retained Chromium logs show four failures before the corrections and four passes after them.
Mechanical audit 2 independently passed all 27 planned Chromium cases and 35 Vitest cases.
The first 84 lines of the final browser test reconstruct the review 1 file byte for byte with its original SHA-256 `f27e852a94e2f797f4a7b019778dd87b0cba09a42690330145ff2a8a40738643`.
The T-F coordinate unit test hash also remains unchanged.
This preserves the original assertions for originating view FFT, single-lane masking, Welch time limits, selection movement, resizing and context zoom.
The independent Chromium probe again observed `[0, 20)` and `[20, 21)` s requests with complete mask bounds `[0, 21)` s on both chunks.
The inspected screenshot shows the T-F handles, floating Play and the Welch display from 200 to 1000 Hz.
The independent rule check returned `0 FAIL, 0 REVIEW`, and the whitespace check returned no diagnostics.
The focused browser probe used the frozen served assets without repeating the full suites.

## Covered state

Task HEAD and comparison base are `20b42ec5e870a47035aa137e62540603a1709d77`.
The nine changed file hashes and screenshot hash match mechanical audit 2.

```text
3865dee30f3eb4ff9055e469bb1db9aeb62abb2ed18f1f8a5ecae7d11808f5d7  frontend/src/App.tsx
d0c6b9714709bc10d6a283cceee7d882d272b897ac39472e65597438966b095d  frontend/src/styles.css
7bbd0c2fe132f49892fe15fc49ea5c714314b3341e9433af0b387dd5029a9b84  frontend/src/audio/playback.ts
a9387599a240600e5cf1271421c660dc46f55e8f2fd3e0f69d6b7c742bdd71b0  frontend/src/lanes/SpectralLane.tsx
e8d0f0930b48e33109930ec4a190325bcbd3deed78994aa571715343ec0769bd  frontend/src/lanes/TfSelection.tsx
2a8919892be7f7b21798e2d1f622db5f148d71c5cf8bf61827f14f24dc31c5c5  frontend/src/panels/FrequencyAnalysis.tsx
d1302e69cc7d167821ed3ceb0e6cbddfda8770b38c2c797abe4c02fbbac40ad6  frontend/src/state/tfSelection.ts
48a1a7aca94b5a78c912949d4e7d5c7e84016d52fba1a67d84d039cb1ef530f3  frontend/tests/e2e/m1-audition.spec.ts
967b447e816027525777aba18422ed2b82226a089c8fef223f616f968d859aa1  frontend/tests/tfSelection.test.ts
3edeae5ffd35fb57ba0637139946e73ab361a152c46a5b5f3066bb44fd4aa766  frontend/test-results/screens/M1-audition.png
```
