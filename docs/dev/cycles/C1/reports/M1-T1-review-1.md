# M1-T1 semantic review 1

**Verdict** FAIL.
**Required action** Modify the implementation and add focused regression coverage for the findings below.

## Findings

1. `src/vsr/dsp/spectrum.py:83–95` applies the §8.1 dBFS floor after PSD conversion, although §8.4 defines PSD directly from unfloored power.
   A 16 kHz, 1 kHz tone of amplitude `1e-10` gave −200 dB/Hz at bin 32, while the matching SciPy density gave −219.719711 dB/Hz.
   Apply the floors in their specified domains and test the quiet PSD against the independent reference.
2. `src/vsr/dsp/spectrum.py:65–82` compares rounded float32 seconds for the inclusive ±5 ms activity match.
   An active frame centered at sample 320 and a Welch frame centered at sample 400 at 16 kHz are exactly 5 ms apart, but the measured float32 subtraction was 0.005000001 s and Welch excluded that frame.
   Compare the centers on the sample grid and cover the inclusive edge.
3. `src/vsr/dsp/spectrum.py:13–21,65–95` and `src/vsr/server/app.py:295–301` leave empty activity sets to reductions.
   An authenticated, otherwise valid Welch request over silence with `active_only=true` produced a 200 response with all NaNs for mean and a 500 from the empty quantile reduction for median.
   At 16 kHz, zero samples and 100 samples raised from `unfold` in `active_frames` before classification, and 320 silent samples correctly gave one inactive frame at 10 ms.
   A signal shorter than 20 ms has zero complete activity windows, and §8.6 defines no activity padding or substitute spectrum.
   Represent that empty classification explicitly and have the public Welch and HTTP boundaries report that no eligible frames exist before calculating statistics.
4. `src/vsr/dsp/spectrum.py:47–55` silently truncates full-mode input above the FFT cap.
   On an input of `2**24 + 1` samples with a unit impulse only at the last sample, the response contained 8,388,609 bins and every value was −200 dB.
   Preserve the full interval's contributions on the permitted FFT grid or resolve the cap contract explicitly before returning a result for such an interval.
5. `src/vsr/dsp/spectrum.py:47–95` and `src/vsr/server/app.py:289–307` apply Welch options to frame or advertise them for full.
   An offset-lane frame request with `unit=db_per_hz` returned −19.719713 dB/Hz at a bin where §8.4 requires a single calibrated frame near 0 dBFS.
   A full request for `["mean","p90"]` returned one row at the expected uncalibrated 48.164803 dB, with two statistics in the header.
   Make frame and full return one row with truthful dBFS and dB units and row metadata, and keep Welch aggregation and its two units on the Welch path.
6. `src/vsr/server/app.py:64–68,286–301` rejects a positive hop longer than the window even though §8.4 defines complete frames stepped by hop, and applies a rounded interval-length requirement to frame even though the FFT is centered on `t0`.
   Validate the inputs needed by each method at the HTTP boundary and verify that a valid frame center does not depend on a selected interval containing a complete sample.
7. `src/vsr/dsp/stft.py:50` and `src/vsr/dsp/spectrum.py:53–55,68–72,97–99` depend on the caller's global Torch dtype for coordinates.
   With `torch.set_default_dtype(torch.float64)`, both public DSP interfaces returned float64 frequencies, and the shared framed encoder supports f32 frequencies but has no f64 encoding.
   Keep the coordinates float32 where floating-point values are required, including both frequency axes.
8. `src/vsr/__init__.py:1–5` lacks the lazy DSP attribute required by §§4 and 16.
   A fresh process found `hasattr(vsr, "dsp") == False` directly after `import vsr`, even though explicit `from vsr.dsp import ...` works.
   Expose `vsr.dsp` lazily through the specified entry point and preserve the light import boundary.
9. `src/vsr/dsp/stft.py:11–17,29–36` and `src/vsr/dsp/spectrum.py:102–103` leave the public operation and input contract underspecified in code.
   A reversed NumPy audio view of a supported shape raises from `torch.as_tensor`, STFT and public Welch accept the full-only boxcar window, and `welch(..., method="full")` can dispatch to full FFT through `**params`.
   Support NumPy audio views and apply the specified operation-specific validation at the public entry points.
10. `src/vsr/server/app.py:278–301` does not implement the §7 no-store header for GET presets and hard-codes the list that §16 sources from the TOML.
    The authenticated response returned 200 without `Cache-Control`.
    Return all bundled preset definitions from that source with the specified header.
11. `src/vsr/presets.py:25–34,63–77` can emit a spec line that disagrees with the §16 grammar and the bundled skill.
    The default resolved preset emitted `db=auto80`, explicitly repeating `window="hann"` on the Hann preset emitted `overrides=window`, and resolving a Kaiser override without a parameter raised `KeyError` when formatted.
    Use the actual dB bounds supplied by the analysis or caller, record the keys whose values changed relative to the preset, and format the §8.1 default parameters for parameterized windows.
12. `src/vsr/server/app.py:285–301` synchronously runs the entire Welch computation in an async handler while holding the lane lock.
    There is no shared §4 heavy-compute semaphore in the tree.
    Route Welch through the shared admission control without blocking the event loop for the duration of the FFT, and keep lane access synchronized.

## Acceptance and route evidence

- **M1.1 passed on CPU.** Independent maximum absolute interior-bin errors in dB were `5.18e-7` for Hann, `0` for Blackman–Harris and `2.49e-5` for Kaiser β=8.6, against the 0.05 dB tolerance.
- **M1.2 passed on the specified seeded CPU fixture.** Independent maximum absolute errors were `3.81e-6` dB in both units against the strict `<0.05` dB criterion, with DC and Nyquist excluded and the exact `3.0102999566` dB peak-power offset.
  The test uses `assert_allclose` with nonzero default relative tolerance and inclusive absolute tolerance, so use a strict absolute bound in the regression to enforce M1.2 exactly.
- **M1.4 passed on its five sample-rate triples and both literal examples.** The independent preset response matched the plan's analysis, wideband, narrowband and LTAS triples at 16, 22.05, 24, 44.1 and 48 kHz, and the unchanged files under the bundled skill remain the resource.
  The measured axis maxima also match the TOML rules, while the committed test asserts only `f_max_hz <= sr/2` and does not detect incorrectly low bounds.
  Add exact Nyquist and clipped-bound checks in the preset regression.
- **M1.5 T1 evidence passed on available CPU.** The [mechanical audit](M1-T1-audit-1.md) records 37 passing tests and 16 device-availability skips, and CUDA and MPS remain unverified.
- Both routes inherit bearer-token authentication, and the audited tests check unauthenticated 401 and invalid-input 422 for each.
  The independent route probe confirmed the specified error-body fields and decoded a valid offset-lane Welch response as one f32 statistics row and its frequency array through the existing frame codec.
  The separate NumPy and SciPy references for nonempty frame, Welch mean/percentiles and below-cap full are independent of the implementation.

## Rule review

- `REVIEW T1 tests/test_spectral_dsp.py:20` allowed under T1 and DESIGN §20, because the CUDA parameter skips only when CUDA is unavailable and states the reason.
- `REVIEW T1 tests/test_spectral_dsp.py:26` allowed under T1 and DESIGN §20, because the MPS parameter skips only when MPS is unavailable and states the reason.
- `src/vsr/dsp/stft.py:48` is the explicit §8.1 amplitude floor of `1e-10`.
- `src/vsr/dsp/spectrum.py:52` is the explicit §8.4 full-magnitude floor of `1e-10`.
- `src/vsr/dsp/spectrum.py:87` is equivalent to the §8.1 floor in the dBFS power domain, and its application after PSD conversion is a V2 defect.
- `src/vsr/dsp/spectrum.py:91` is the corresponding dBFS floor after the §8.4 power-domain mean, and its application to the PSD mean is the same V2 defect.

## Covered state

Task HEAD was `350508d74bdc8b892beeb05492752cd53c9818fb` and all eight frozen file hashes matched the mechanical audit.
The independent probes ran under the checks lock and used temporary audio and VSR state.
The audited pytest and lint suites were already current for these files.

```text
711abc7fde15da18eac94794cc8a32d9679d667e37215d87ffa0cb27b62518f7  src/vsr/__init__.py
b19d8f47ad658dd69d3ad7919c1d934234217322f6675b003b2ca3b1ea867fdd  src/vsr/dsp/__init__.py
4d143a77399913e712bbf9c3d6c092770b1b440d0e4e2286494faf8128147a29  src/vsr/dsp/stft.py
7d7b029753efb1e2fab54cc3f8154bfd7210c98e83e7af0ab93280aaa12c9fa9  src/vsr/dsp/spectrum.py
b6c68cef79cba5377f3b95b0c121ef3ad089a1e3292a9d788582818e416e9521  src/vsr/presets.py
b24bde117e535cfd5a309298134f12d9ca76200a93ccd276b045bd46d874177a  src/vsr/server/app.py
96c1e87fec916cce506ce74dd76522cabe94cbc4ac736f65347e53b7fd5a6192  tests/test_spectral_dsp.py
563cc5b6ebb2c96628157bd9938323706f28cd89cc399247b76e16255e06a364  tests/test_presets.py
```
