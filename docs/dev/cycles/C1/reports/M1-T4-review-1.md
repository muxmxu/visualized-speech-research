# M1-T4 semantic Task Review 1

Verdict **FAIL** for the frozen 12-file diff against `9cb96340880a521f5bba7c0354704db3e8735b34`.
The independent mechanical audit passed on the same hashes, including 29 Vitest and 32 real Chromium tests.
The bounded probes below used the task's existing test-mode bundle, authenticated real backend, generated one-second PCM16 WAVs, a temporary VSR_HOME, and a random loopback port.

## Findings

1. Frequency viewport gestures discard cached spectra and exceed the 150 ms request bound in DESIGN §9.3 and the task plan.
   At 1280 × 720, open an 8 kHz stereo 440 Hz tone, fit time, and wait for both channel responses.
   With Alt held, send ten `deltaY=-18` wheel events at the center of the top channel with 25 ms pauses between calls.
   The gesture took 504 ms with zero spectral requests and an empty latest-frame map before the trailing response.
   The first replacement requests appeared at +557 and +558 ms.
   `frontend/src/lanes/SpectralLane.tsx:42–44` disposes its scheduler and removes its displayed frame on every frequency bound change, so each gesture update starts a new deadline and clears cached coverage.

2. Alt+wheel does not anchor to the frequency under the pointer for stereo plots as required by DESIGN §9.2.
   In the same reproduction, the pointer was halfway down the top channel at 2000 Hz on its 0–4000 Hz axis.
   The final request used 912.5310949702131–3703.2363992543374 Hz, placing 2307.88 Hz at the same channel midpoint.
   `frontend/src/App.tsx:289–299` derives the anchor from the full two-channel stack instead of the pointed channel's rectangle.

3. Display-only updates re-upload the spectral matrix in violation of the uniform/LUT-only path in DESIGN §9.3.
   On the settled stereo tone, switch Palette from heat to viridis.
   Instrumentation of real WebGL2 `texImage2D` calls counted the R16F matrix uploads increasing from 3 to 5 and palette uploads increasing from 3 to 5, with zero spectral HTTP requests.
   `frontend/src/render/spectrogram.ts:91–99` uploads both textures on each draw.

4. The hover footer lacks the approximation symbol required by DESIGN §9.3 and gives a stale spectral reading over a different surface.
   At 0.500 s and 440 Hz on the settled tone, the footer read `tone.wav · 0.500 s · 4000 samples · 440 Hz · -8.8 dB`.
   Moving vertically into the waveform left the same footer, including the spectral Hz and dB values.
   A second probe set the visible axis to 410–465 Hz on an 8 kHz mono tone with FFT 256.
   The one returned row covered 421.875–453.125 Hz, yet hovering the uncovered 413 Hz position still reported -8.8 dB.
   `frontend/src/App.tsx:337–346` returns without clearing the reading outside the spectral surface and formats dB without `≈`.

5. The ruler, overview and waveform cease to use a shared plot width when the lane list acquires a conventional scrollbar.
   Run Chromium without its automation-only `--hide-scrollbars` default, open the tone at 1280 × 720 and fit time.
   The overview and waveform were both 615 CSS px with one view.
   After four Add view actions, the lane list had a 15 CSS px scrollbar, the overview stayed 615 CSS px and the waveform became 600 CSS px.
   The final ruler mark was at x=1030 while the waveform ended at x=1015.
   The ruler and overview rely on fixed gutters in `frontend/src/styles.css:23–27`, while the waveform measures the reduced inner width of the scrolling list.

6. A valid saved M0 layout can crash the workspace during Display migration.
   Save the layout with the user-closable Properties tab closed and Settings still present, then load that saved configuration in T4.
   The browser probe used the persisted JSON after closing Properties and removed just the T4 Display tab from the serialized group and panel map to produce the M0 panel set `lanes, files, settings`.
   Reload emitted `TypeError: Cannot read properties of undefined (reading 'group')` and the body was blank.
   `frontend/src/App.tsx:232–236` assumes Properties still exists even when Settings is available as the inspector group reference.

7. Apply to all lanes sends out-of-range bounds to a lower-rate destination after a valid frequency override.
   Open independent 8 kHz and 48 kHz mono tones and set the 48 kHz view's frequency high to 10000 Hz.
   Select Apply to all lanes from the 48 kHz view.
   The 8 kHz view requested `f_hi=10000` beyond its 4000 Hz Nyquist, received HTTP 422, and lost its displayed frame.
   `frontend/src/App.tsx:318–330` copies the overridden bound without applying the destination's frequency limit.

## Verified behavior and rule disposition

- The implementation mounts one WebGL2 canvas across Lanes, intersects each full spectral plot rectangle with the lane-list and canvas bounds for the DPR-scaled bottom-left scissor, and uses R16F, HALF_FLOAT and UNPACK_ALIGNMENT=1.
- The audited e2e evidence covers the actual 129-column grid at 8 ms, each separated tone's rendered region, CSS request dimensions at DPR 1.5, cached time reprojection and cancellation, spectral colors and zero-fetch dB changes, one replacement after an FFT change, independent same-source views, the same-rate Apply to all lanes case, preset palette retention, clipboard output, migration with all M0 tabs present and normal M0 interactions.
- The f16 decoder handles normal and subnormal values and the renderer places row centers using the backend's row frequencies.
- `REVIEW C1 frontend/src/lanes/SpectralLane.tsx:37` is allowed under **V1#1**.
  The handler displays a notification for a failed authenticated HTTP transfer or frame read, while expected user-driven AbortError cancellation is silent.
- The preexisting backend duplicate-source DELETE 500 is assigned to T4a and excluded from this frontend diff verdict.

## Screenshot evidence

- `frontend/test-results/screens/M1-workspace-desktop.png` is 1280 × 720, SHA-256 `3168e8fa8f90cb13a2238fa224d7d23cf967fa4526f2ed38811fbe48779ef6df`.
  Both W+S rows show their distinct heat bands and green RMS bands, with the frequency labels, colorbars, blue active-view edge, amber playhead, and [0.200, 0.800] s selection visible.
  The transport and measurements fit on one line and Display shows FFT 512 for the selected row.
- `frontend/test-results/screens/M1-workspace-narrow.png` is 800 × 600, SHA-256 `d40699df34bfb8170bb1b1c36193e997ab2f38f7240f4817dbc67c07931215f9`.
  Both spectral plots, their scales and colorbars, and both selection edges remain visible as the transport and measurements occupy separate lines.
  The two inactive inspector titles are ellipsized and the bottom Display actions extend into its scrolling area.
- Both files were inspected directly in the M1-T4 task worktree and match the mechanical audit.
  These observations are the visual evidence under DESIGN §20.

## Covered hashes

```text
7b82b6dc9e1b47c4f6911091e7ac1ba7fecee17acfd0cabc59c55354d29d0297  frontend/src/App.tsx
a6fd318eab3a2c8135a566af40211133435dcbeb67883477a1a9df556df417c0  frontend/src/audio/testHook.ts
83a56214bc47336051052f99b97a87f6a08ddbf6eb8cf2085efa9cc35dd517eb  frontend/src/lanes/SpectralLane.tsx
1d58d7dad227a5c322b2d87dc2f333f86d6edb825ec0230b4463b698e33341ed  frontend/src/panels/Display.tsx
b992037da955fac75d4a49a4cc75d9d132b9899154c80e61dae9c6726e9493e7  frontend/src/render/colormap.ts
25ea2b56f99dd393de4032623ce92347201adbedbaf826fab21c5ec9159d4eb6  frontend/src/render/spectrogram.ts
8bc5f835499c8ed12d4723d6aafaf03b13370bd58d7420a12d4d9a6c33ce7fbd  frontend/src/state/spectralViews.ts
e51b5e48d26ddc62663f21b76734bd0bc4b3b84d99e0d94e449be39846241ea3  frontend/src/state/viewport.ts
ea1f760c5f6551b6574994778e5a37b6300178b4b3ca8efadd0926e0a81a220c  frontend/src/styles.css
7e613e6eb07f88af3219d66b1d0b19e8f1ab701e8f761815a329c431434286be  frontend/tests/e2e/m1-spectrogram.spec.ts
47ca85640832ed701ef9dcf27cba61261f1df3dc1d14899432f32c312ce8a9f2  frontend/tests/spectrogram.test.ts
ccd8cbed93ae0b8d4d0328bbf1df8e06b61b25c7142966cbeb671f54d3499a64  frontend/tests/viewport.test.ts
```
