# M2-T1 independent mechanical audit 1

**Verdict — PASS for the frozen T1 patch.**

The independent Mechanical Auditor ran at `6.2-sol(medium)` against task cut `cfd52461f186978e4ec05f8bd6b1fdc97706c576`.

- The index was empty and the working tree contained exactly the four approved paths. The tracked binary diff and the two untracked-file binary diffs, concatenated in path order within each group, reproduced the worker patch byte for byte. Reverse application, whitespace and the added-line public-repository scan passed. Protected files, DESIGN including every section and heading, the bundled skill, and the existing spectral, spectrogram, preset, PCM and spectral-mask tests equal the task cut.
- All 11 entries in the frozen worker evidence manifest matched. The prescribed pytest run exited 0 with 51 passed and 40 device-conditional skips. The supplemental PCM and spectral-mask run exited 0 with 26 passed and six device-conditional skips. Both runs reported the Starlette TestClient deprecation warning. Ruff lint and format checks exited 0. CPU was the only available compute device.
- The independent CPU probe ran under the shared checks lock. For three seeded fixtures it inverted the float32 dB output and compared the result to centered, constant-padded Hann librosa mel power times `(2 / sum(window)) ** 2`, using the strict mask `reference > reference.max() * 1e-6`. The fixture geometries and error results are below. The probe also verified CPU float32 return values, frame times, Slaney and HTK channel centers, and byte-identical whole and split STFT output against the task cut.
- A fresh interpreter confirmed that `import vsr` leaves `vsr.dsp` unloaded and that both `import vsr` and explicit DSP import leave `fastapi`, `sounddevice`, `librosa` and `matplotlib` unloaded. The public signature is `(x, sr, **params)`.

| FFT | Samples | Channels | Cells compared | Max relative error vs. librosa | Max relative chunk error |
|---:|---:|---:|---:|---:|---:|
| 640 | 4212 | 2 | 1480 / 2738 | `1.3508737e-6` | `1.1554581e-6` |
| 513 | 931 | 2 | 666 / 1036 | `1.3350939e-6` | `1.1745601e-6` |
| 513 | 169 | 1 | 111 / 111 | `9.8148769e-7` | `1.1344946e-6` |

The rule checker returned the following lines for semantic disposition.

```text
REVIEW T1 tests/test_mel_dsp.py:17: marks=pytest.mark.skipif(
REVIEW T1 tests/test_mel_dsp.py:23: marks=pytest.mark.skipif(
0 FAIL, 2 REVIEW
```

The two markings condition execution on CUDA and MPS availability and state the corresponding reasons under DESIGN §20.
Semantic disposition remains with the Task Reviewer.

```text
3ec5d0a11aa06bc5f2e51a3fb420e93ed76ed255a173f33a6ef177f51a3b6a5e  worker.patch
efe69faaa2bc0ba17a543f887e89a9b1cafd907476a04bb6cd4f19a84aff8d59  primary-evidence.sha256
2497e056a9035933e5ae09d02eea59dada69809ed2ce6d61135c16852055588d  src/vsr/dsp/__init__.py
db35758ac74c1c3d2f10409799c30cdbc48ed63caa3a91cb534d356f717f4b5d  src/vsr/dsp/mel.py
ee840bedbfb2bb9eb53431b3e7c982ba81fd3bec64f8259f73e811ac6f7c2736  src/vsr/dsp/stft.py
8c50d19c092944f9911f991bc07cba22909eeb7fa68cffb39759d3f549342048  tests/test_mel_dsp.py
```
