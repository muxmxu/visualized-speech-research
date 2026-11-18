# M2-T1 independent semantic review 1

**Verdict PASS.**
The reviewed cut and task HEAD are `cfd52461f186978e4ec05f8bd6b1fdc97706c576`.
The reconstructed four-file patch matches the frozen worker patch and independent mechanical audit.

## Findings

- DESIGN §§8.1, 8.3 and 16 and the T1 write set are satisfied.
  The public `mel_db(x, sr, **params)` accepts NumPy arrays and tensors, preserves channels, and returns CPU float32 dB, frame times and mel channel centers.
  The public and bounded chunk paths use the same periodic window, centered frame grid, calibrated amplitude, Slaney-normalized filter bank and power floor.
  The chunk kernel transfers only the selected frames' sample support to the window's compute device, and the shared STFT helper retains M1's absolute frame grid.
  D46 accounts for the default 128 bands, DC-to-Nyquist range and Slaney spacing.
  T2 owns the route, cache and viewport pooling.
- M2.1 passed on CPU, the only available compute device.
  The independent mechanical probe reported a maximum relative power error of `1.3508737e-6` against the calibrated librosa reference over cells above the prescribed threshold, and a maximum whole-to-chunk relative error of `1.1745601e-6`.
  This review also ran a focused CPU probe under the shared checks lock for strided stereo NumPy and tensor inputs, edge impulses, and asymmetric FFT window padding.
  The full transform and three absolute chunks agreed with the analytic impulse dB values within `2e-5` dB, and the full transform's maximum absolute error was `1.99628367e-6` dB.
- The recorded prescribed suite returned 51 passes and 40 device-conditional skips.
  The supplemental PCM and spectral-mask suite returned 26 passes and six device-conditional skips.
  The mechanical probe confirmed byte-identical full and split STFT results against the base, and the existing Welch regressions passed.
  Ruff, scope, import-boundary, whitespace and protected-file checks passed on the frozen tree.
  The four paths introduce no runtime dependency, HTTP route, configuration or protected drift.

## Rule dispositions

| Rule checker location | Disposition |
|---|---|
| `REVIEW T1 tests/test_mel_dsp.py:17` | Allowed by DESIGN §20. The skip condition is CUDA device availability and the test records `CUDA device unavailable`. |
| `REVIEW T1 tests/test_mel_dsp.py:23` | Allowed by DESIGN §20. The skip condition is MPS device availability and the test records `MPS device unavailable`. |

The rule check recorded `0 FAIL, 2 REVIEW`.

## Frozen inputs

```text
3ec5d0a11aa06bc5f2e51a3fb420e93ed76ed255a173f33a6ef177f51a3b6a5e  worker.patch
efe69faaa2bc0ba17a543f887e89a9b1cafd907476a04bb6cd4f19a84aff8d59  primary-evidence.sha256
2497e056a9035933e5ae09d02eea59dada69809ed2ce6d61135c16852055588d  src/vsr/dsp/__init__.py
db35758ac74c1c3d2f10409799c30cdbc48ed63caa3a91cb534d356f717f4b5d  src/vsr/dsp/mel.py
ee840bedbfb2bb9eb53431b3e7c982ba81fd3bec64f8259f73e811ac6f7c2736  src/vsr/dsp/stft.py
8c50d19c092944f9911f991bc07cba22909eeb7fa68cffb39759d3f549342048  tests/test_mel_dsp.py
```
