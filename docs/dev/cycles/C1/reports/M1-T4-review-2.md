# M1-T4 semantic Task Review 2

Verdict **PASS** for the frozen 12-file tree at base and task HEAD `9cb96340880a521f5bba7c0354704db3e8735b34`.
The focused browser probes used the unchanged test-mode assets, real Chromium, an authenticated backend on a random loopback port, generated PCM16 WAVs, a temporary VSR_HOME, and the worktree-checks lock.
All seven review-1 reproductions passed.

## Review-1 findings

1. **Sustained frequency gestures.** Ten real upper-channel Alt+wheel events with `deltaY=-18` and 25 ms pauses spanned 466.8 ms on an 8 kHz, one-second stereo tone after fitting time.
   Both channel frames remained available at every event.
   The first requests began at +6.6 and +7.4 ms, followed by four request pairs with the streams paced at approximately 150 ms during the burst and a trailing replacement.
   The scheduler's unchanged fake-clock test checks two sends by 300 ms during 30 ms updates.
2. **Pointer anchoring.** The upper channel's measured pointer position corresponded to 2036.5066 Hz before and after the linear gesture, ending at 615.6842–3406.3895 Hz.
   A separate lower-channel Alt+wheel gesture on the log axis preserved 1137.9485 Hz at the measured pointer position.
3. **Palette updates.** Heat to viridis issued zero spectral requests, held the R16F upload count at 12, and raised the palette LUT upload count from 37 to 39 across two channels.
4. **Hover readout.** At 0.500 s and 440 Hz, the footer displayed `tone.wav · 0.500 s · 4000 samples · 440 Hz · ≈-8.8 dB`.
   At 413 Hz on a 410–465 Hz viewport whose returned coverage was 421.875–453.125 Hz, and over the waveform, the footer read `tone.wav 0.000 s`.
5. **Classic scrollbar geometry.** At 1280 × 720, the ruler, overview, waveform and spectrum initially spanned x=415–1030 CSS px.
   After four Add view actions opened a 15 px vertical scrollbar, all four spanned x=415–1015.
6. **Saved M0 layout.** Closing Properties through the actual tab action and removing the T4 Display entry from the saved JSON produced the M0 panel set `files`, `lanes`, `settings`.
   Reload kept Settings active with the forced self-check reason, exposed one working Display tab, persisted Display across a second reload, and emitted zero page errors.
7. **Mixed-rate Apply to all lanes.** The initially distinct 8 kHz and 48 kHz lanes were set to 3500 and 10000 Hz respectively to force a new destination request.
   Applying from the 48 kHz lane produced an actual destination request with `f_lo=0`, `f_hi=4000` and HTTP 200, preserved a nonempty displayed frame, and showed 4000 Hz in the destination inspector.

## Tests and rules

- Mechanical audit 2 independently passed 29 Vitest and 40 real Chromium tests on the same hashes.
- The current regression tests cover all seven findings, with a separate lower-channel logarithmic test.
  The mixed-rate test checks the inspector and a populated frame, while the independent probe above also forces and checks a fresh HTTP response.
- The M0 browser tests are byte-identical to the base, and the tracked viewport test retains its original assertions.
  The unchanged spectrogram unit test file matches review 1's SHA-256.
  The current M1 browser file retains assertions for the grid, tone pixels, CSS request dimensions, cached time reprojection and cancellation, local display changes, FFT request counts, hover, independent views, clipboard and migration reported in review 1.
  The untracked review-1 M1 browser file was unavailable by bytes, so only the recorded coverage and hash could be compared with the current tests.
- `REVIEW C1 frontend/src/lanes/SpectralLane.tsx:37` is allowed under **V1#1**.
  The handler shows a notification for failed HTTP requests and response decoding at the frontend boundary, and ignores the expected AbortError from replacing or disposing a viewport request.
- The preexisting duplicate-source DELETE 500 remains assigned to T4a.

## Workspace evidence

- `frontend/test-results/screens/M1-workspace-desktop.png` in the task worktree is 1280 × 720 and has SHA-256 `820071c43ea145531bf98e3cd4f59551aa21f7551ef9d5a5b25d0fea2f45b4b8`.
- `frontend/test-results/screens/M1-workspace-narrow.png` in the task worktree is 800 × 600 and has SHA-256 `58199807f3209cb4f050faf07f1022b77054e10d0ab61bbb639f4ba67619c92d`.
- Both inspected images show both waveform/RMS bands and spectral tone regions, both selection edges, the playhead, frequency labels, and colorbars.
  The narrow image wraps measurements onto their own toolbar row, ellipsizes inactive inspector tabs, and keeps the bottom Display actions in its scroll area.
- A separate keyboard probe reached End via Tab, measured a 2 px accent outline, edited the endpoint to 0.625 s, and measured retained focus and the same input value after a live resize to 800 × 600.

## Reviewed SHA-256 hashes

```text
b11bbb04d73018448f0c24b27a4717e8fe7ada816f06f94d41eb56eea1832813  frontend/src/App.tsx
a6fd318eab3a2c8135a566af40211133435dcbeb67883477a1a9df556df417c0  frontend/src/audio/testHook.ts
ad42ea6ae694125f13d259253c31304b66833aef7b6458cc89e4c5678391726e  frontend/src/lanes/SpectralLane.tsx
1d58d7dad227a5c322b2d87dc2f333f86d6edb825ec0230b4463b698e33341ed  frontend/src/panels/Display.tsx
b992037da955fac75d4a49a4cc75d9d132b9899154c80e61dae9c6726e9493e7  frontend/src/render/colormap.ts
94c14d5f349a700ef4911a5cee9945b6ec102fc2b8e3f37ef192f60d76f8f314  frontend/src/render/spectrogram.ts
8bc5f835499c8ed12d4723d6aafaf03b13370bd58d7420a12d4d9a6c33ce7fbd  frontend/src/state/spectralViews.ts
e51b5e48d26ddc62663f21b76734bd0bc4b3b84d99e0d94e449be39846241ea3  frontend/src/state/viewport.ts
334261c9cb2165c5104e75c495ea148e03372203c2c10b25498ac9f188040347  frontend/src/styles.css
f5ac714934bee66464bf9ffe06c9dbac637bf4882f828c0d0fc408a40d8729fc  frontend/tests/e2e/m1-spectrogram.spec.ts
47ca85640832ed701ef9dcf27cba61261f1df3dc1d14899432f32c312ce8a9f2  frontend/tests/spectrogram.test.ts
ccd8cbed93ae0b8d4d0328bbf1df8e06b61b25c7142966cbeb671f54d3499a64  frontend/tests/viewport.test.ts
```
