# M1-T1 semantic review 2

**Verdict** FAIL.
**Required action** Correct Welch PSD percentiles at zero power and add a regression with an independent expected result.

## Finding

`src/vsr/dsp/spectrum.py:104–119` now applies the §8.4 PSD formula without a floor, which correctly gives −∞ dB/Hz for zero power.
`torch.quantile` then interpolates infinities into NaN even when every frame at a bin has exactly zero power.
For 1,024 zero samples at 16 kHz with a 512-point Hann, 128-sample hop and `active_only=false`, the public Welch call returned `[-inf, nan, nan, nan, -inf]` for mean, median, p10, p90 and max at every bin.
An authenticated request on a silent lane likewise returned HTTP 200 with 257 NaNs in each percentile row of the framed spectrum.
A mixed silent and nonzero input also returned NaN for lower percentiles in the DC bin.
Compute the §8.4 dB-domain percentiles over valid zero and positive powers while preserving −∞ when appropriate and the existing finite-input result.
Cover exact-zero and mixed-zero PSD frames without restoring a dBFS floor to the PSD calculation.

## Disposition of review 1

| Finding | Disposition |
|---|---|
| 1. PSD floor | The quiet nonzero PSD now matches the independent SciPy density within the strict bound, and the PSD finding remains open for the new zero-power percentile regression above. |
| 2. Inclusive activity matching | Closed. Doubled integer sample coordinates preserve the exact ±5 ms boundary, and the regression exercises 80 samples of separation at 16 kHz. |
| 3. Empty activity | Closed. A signal with zero complete activity windows returns empty coordinate and boolean tensors, public active-only Welch raises a descriptive error when no frame is eligible, and the independent route probe produced the §7 client-error body with status 422. |
| 4. Full FFT cap | Closed under D44. At exactly `2**24` samples, the audited test detects a final-sample impulse at a frequency bin and asserts the full frequency count. The independent public probe at `2**24 + 1` rejected the request explicitly, and the audited HTTP regression returned 422 above the cap. |
| 5. Method metadata | Closed. An offset-lane frame request made with Welch PSD and two statistics responded with one float32 dBFS row labeled `frame` and −0.000000518 dBFS at 1 kHz. The full method returned one float32 dB row labeled `full` at 48.164803 dB at that bin. |
| 6. Method-specific interval and hop | Closed. The independent frame request succeeded on a positive interval shorter than one sample, and the audited Welch test accepts a hop larger than the window. |
| 7. Float32 axes | Closed. All three FFT paths specify float32 frequency axes on the selected device, return CPU tensors, and pass the audited regression with the caller's Torch default set to float64. |
| 8. Lazy DSP access | Closed. In a fresh process, `import vsr` loaded none of DSP, SciPy, FastAPI, librosa, sounddevice or matplotlib, and `vsr.dsp.stft_db` was callable on first access. |
| 9. Public DSP input | Closed. A reversed NumPy audio view now reaches the shared kernels, the STFT and Welch windows exclude boxcar, and public Welch rejects a method override. |
| 10. Preset resource and headers | Closed. An unauthenticated request returned 401, and an authenticated request returned all four presets with `Cache-Control: no-store`. The audited alternate-resource fixture verified that the route enumerates the TOML tables. |
| 11. Spec formatting | Closed. Actual supplied bounds use the specified format, unresolved `auto80` is omitted, equal-value overrides are omitted, and default Kaiser and Gaussian parameters are printed. |
| 12. Shared Welch admission | Closed for T1. The synchronous route snapshots the lane while holding its lock and releases it before taking the process-wide §4 `BoundedSemaphore(1)` for Welch. The instrumented independent probe observed two worker handlers enter, held the first at real DSP entry, received an authenticated `/api/ping` response on the event-loop thread, and observed the second Welch enter DSP only after release. Both requests completed with 200. No separately committed timing regression is required for this task because the source and deterministic observable probe establish the current behavior. Reuse by downstream heavy operations remains a later integration check. |

D44 is recorded in [the decision log](../../../decisions.md) and specifies that phase integration appends it to DESIGN §21.
The task tree leaves DESIGN and the bundled skill unchanged.

## Acceptance and rule evidence

- M1.1 and M1.2 pass on CPU for the specified fixtures with strict absolute bounds, using the analytic 0 dBFS tone and matching SciPy references with the mandated exclusions and offset.
- M1.4 passes the specified five sample rates, axis bounds and both literal spec examples.
- M1.5 passes for T1's available CPU evidence, and CUDA and MPS remain unverified.
- The [mechanical audit](M1-T1-audit-2.md) reports 47 passed, 24 device-availability skips and one dependency deprecation warning, with Ruff lint and format passing.
- `REVIEW T1 tests/test_spectral_dsp.py:20` is allowed under T1 and DESIGN §20 because it only skips the CUDA parameter when CUDA is unavailable and states the reason.
- `REVIEW T1 tests/test_spectral_dsp.py:26` is allowed under T1 and DESIGN §20 because it only skips the MPS parameter when MPS is unavailable and states the reason.
- The clamps at `stft.py:52` and `spectrum.py:60` match the §8.1 calibrated amplitude floor and §8.4 uncalibrated full-magnitude floor respectively.
- The clamps at `spectrum.py:108` and `spectrum.py:114` are the same §8.1 floor in the dBFS power domain, for individual frames and the §8.4 power mean respectively.

## Covered state

The frozen `task/M1-T1` HEAD was `350508d74bdc8b892beeb05492752cd53c9818fb`.
All eight changed-file SHA-256 hashes independently matched the audit, and the independent probes ran under the checks lock with temporary VSR state.

```text
6c76f7aeb72baf7282edd81e6c05f6284ee4b6289714684516b5b9718e72210a  src/vsr/__init__.py
b19d8f47ad658dd69d3ad7919c1d934234217322f6675b003b2ca3b1ea867fdd  src/vsr/dsp/__init__.py
b5f5e0ac1ddc38be933dfdd4d0851c1f1bc1ed5890b1e90358142fe0e212e950  src/vsr/dsp/stft.py
ef2e9d28227207fba0d8362d930959b43e29ec8e414e8257c208bbcd20bd0e67  src/vsr/dsp/spectrum.py
15581dea6f5186b522a20325f253acde4edd1278e118667c21ecfb4e11a34ce2  src/vsr/presets.py
3f13c6b072805deac0f9b3cc275c30c479b67de7d0cd93e6f0892b4b093af014  src/vsr/server/app.py
2f1fd0d6ff88326a03a8d6e515d1701e72489e4020906c006fb26e85cb74b6e1  tests/test_spectral_dsp.py
655c5c1b7aa68d4635618811231a1c97c346c45f4f775c7759e651739b174807  tests/test_presets.py
```
