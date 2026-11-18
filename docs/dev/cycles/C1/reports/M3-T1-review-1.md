# M3-T1 independent semantic review 1

**PASS for the frozen backend patch.**

- The accepted write set is seven files on base `eca146101a19d346272ed0a78cc403caa4c33329`, and independent mechanical audit 1 passed on the same patch and evidence manifest.
- M3.1 passed with generated audio for every §15 operation, including half-open sample bounds with a lane offset, clipboard insertion, bitwise undo of sample changes, grouped undo and redo, and aligned extraction with the source preserved.
- M3.4 passed for `analysis`, `wideband`, and `narrowband` on the available compute device, with 19–21 dB in-band attenuation, less than 0.5 dB out of band, and exact samples outside the replacement interval and on the unselected channel.
- Audition, extraction, and attenuation all call the same `spectral_mask` through `_masked_synthesis`, which uses the owner view’s FFT and window and a `win_length // 4` hop.
- The edit route uses the shared compute semaphore and session lock, and grouped snapshots have a separate `cache_bytes` budget with version, dirty, stale, and event updates on content changes.
- M3.3 passed for tensor, MP3, and shared WAV sources, and the resolved Save As alias test confirmed HTTP 400 with the source bytes preserved.
- M3.5 passed with PCM_24 within one quantization step and FLOAT exact, and the injected partial write verified unchanged original bytes, temporary-file cleanup, and preserved dirty state.
- D50 uses an omitted path for confirmed original-file Save in the browser and an explicit distinct destination for Save As, with the browser confirmation and M3.2 assigned to T2 and whole-tree checks assigned to T3.
- The frozen focused pytest log recorded 27 passes and one Starlette TestClient deprecation warning, and the frozen rule checker recorded `0 FAIL, 0 REVIEW`, so no dispositions were required.
- H59 applied and the review reused these checks without rerunning them.

```text
28be10e113c64aa084648a0cb12d97da937559692d028faaa647f37f553dd4ef  worker.patch
2ae8b85b193562342ef9805c3d82c3da1aabf52700296ba08bde89c894f2a6cc  primary-evidence.sha256
```
