# M1-T1 semantic review 3

**Verdict** PASS.
**Issues requiring correction** None.
**Required action** None.

## Zero-power PSD amendment

The PSD path still applies the §8.4 power normalization before converting to dB, without a floor.
The percentile calculation in `src/vsr/dsp/spectrum.py:119–134` returns the ordered value at an exact rank, interpolates two finite dB endpoints, and preserves −∞ for a positively weighted zero-power endpoint.
The finite-value mask implements that interpolation rule directly.

Under the checks lock, an independent CPU probe exercised public `vsr.dsp.welch` and authenticated HTTP with decoded f32 arrays.
For a silent signal, each path returned −∞ in all 1,285 values across mean, median, p10, p90 and max, with no NaNs.
The probe also used three mixed fixtures of nonoverlapping 750 Hz sine frames with known amplitudes, and computed expected bin powers from the periodic Hann coefficient `win_length / (3 * sr)`.
The results covered an exact zero rank, fractional ranks that put positive weight on zero power, exact finite ranks, and interpolation between finite dB endpoints.
Both paths agreed with the independent reference to within `2.91e-6` dB for finite values, with −∞ at every expected zero-power rank.
The HTTP cases used a nonzero lane offset and verified the method's ordered statistic labels, PSD unit, frequency coordinates and no-store header.
The new public and route regressions produced four failures on the previous tree and four passes after the repair, with four unavailable-device skips on each run. [Mechanical audit 3](M1-T1-audit-3.md)

## Prior findings and acceptance

- **Finding 1.** The zero-power regression is closed, and the five PSD statistics at the 1 kHz bin of a `1e-10` amplitude sine matched the SciPy density reference of −219.71971 dB/Hz on CPU.
- **Findings 2–4.** The integer ±5 ms comparison, empty activity handling and visible D44 rejection above `2**24` samples are unchanged and passed their rerun regressions.
- **Findings 5–7.** The method-specific frame and full metadata, accepted short frame interval and long Welch hop, and selected-device float32 frequency outputs remain covered by passing regressions.
- **Findings 8–11.** The initial lazy import, supported NumPy views and public operation validation, TOML-derived no-store preset route, and formatting of actual display bounds, effective overrides and window parameters are unchanged and retain their prior pass.
- **Finding 12.** The route code governing lane locks, synchronous worker execution and the shared Welch semaphore is byte-identical to review 2, so its independent probe still establishes serialized Welch execution and a responsive event loop. [Semantic review 2](M1-T1-review-2.md)
- **M1.1.** Independent CPU maximum interior-bin errors were `5.18e-7` dB for Hann, `0` dB for Blackman–Harris and `2.49e-5` dB for Kaiser β=8.6, all within the 0.05 dB tolerance.
- **M1.2.** The strict maximum absolute error was `3.82e-6` dB in each unit on an independent seeded CPU fixture after excluding DC and Nyquist and using the exact peak-power offset for dBFS.
- **M1.4.** The unchanged preset regression passed for the five required sample rates and both exact §16 spec-line examples.
- **M1.5.** T1's numerical coverage passed for the available CPU device, with 28 CUDA and MPS cases skipped for device unavailability.

The final targeted suite reports 51 passed and 28 skipped, and Ruff lint and format checks passed. [Mechanical audit 3](M1-T1-audit-3.md)
The D44 entry for DESIGN §21 remains assigned to M1 phase integration. [Decision log](../../../decisions.md)

## Rule dispositions

- `REVIEW T1 tests/test_spectral_dsp.py:20` is allowed under T1 and DESIGN §20, because the CUDA parameter skips only when CUDA is unavailable and states the reason.
- `REVIEW T1 tests/test_spectral_dsp.py:26` is allowed under T1 and DESIGN §20, because the MPS parameter skips only when MPS is unavailable and states the reason.
- The four math clamps remain the §8.1 calibrated and §8.4 uncalibrated magnitude floors at `stft.py:52` and `spectrum.py:60`, and the corresponding dBFS power floors at `spectrum.py:108,114`.

## Covered state

The frozen `task/M1-T1` HEAD was `350508d74bdc8b892beeb05492752cd53c9818fb`.
All eight changed-file SHA-256 hashes independently matched audit 3, with only the spectrum module and its test file differing from the review-2 hashes.

```text
6c76f7aeb72baf7282edd81e6c05f6284ee4b6289714684516b5b9718e72210a  src/vsr/__init__.py
b19d8f47ad658dd69d3ad7919c1d934234217322f6675b003b2ca3b1ea867fdd  src/vsr/dsp/__init__.py
b5f5e0ac1ddc38be933dfdd4d0851c1f1bc1ed5890b1e90358142fe0e212e950  src/vsr/dsp/stft.py
69e7d99fd07cf4354f3f469d77b45967ac665c6fc4483855a2ee4c413a141175  src/vsr/dsp/spectrum.py
15581dea6f5186b522a20325f253acde4edd1278e118667c21ecfb4e11a34ce2  src/vsr/presets.py
3f13c6b072805deac0f9b3cc275c30c479b67de7d0cd93e6f0892b4b093af014  src/vsr/server/app.py
56c0bb070f2741baf27568eb9c2a868f3ebcbc7fb932c49baf27610fe2eb024f  tests/test_spectral_dsp.py
655c5c1b7aa68d4635618811231a1c97c346c45f4f775c7759e651739b174807  tests/test_presets.py
```
