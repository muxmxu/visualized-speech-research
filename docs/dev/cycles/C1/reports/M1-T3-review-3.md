# M1-T3 semantic review 3

## Verdict

PASS on the frozen tree after the sole task amendment.
All six amended chunk-bound cases passed in ordinary and masked PCM, and the review-1 reproductions, M1.12 seams and M1.6 preset checks remained within their thresholds.
The Controller can hand the reviewed tree to the D38 Git executor. [Task amendment](M1-T3-task-plan.md#t3-task-amendment-after-semantic-reviews-1-and-2) [Mechanical audit 3](M1-T3-audit-3.md)

## Finite chunk bounds

The shared route subtracts the lane offset, scales on the requested sample grid and clips each endpoint to `[0,L]` before applying Python's nearest-sample rounding.
The end still has a lower bound of `start`, and coincident bounds bypass masked synthesis and resampling while retaining `first_sample=start`.
The mask rectangle still uses its own project times with the same lane offset subtracted.
The boundary tests retain rejection of nonfinite and unordered query bounds. [DESIGN §§7 and 9.4](../../../../DESIGN.md)

Reversing only the two endpoint expressions in memory reproduced the review-2 `app.py` SHA-256 `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb`.
The reconstructed route returned HTTP 500 with `OverflowError` and detail `cannot convert float infinity to integer` for each of the 12 authenticated requests. [Semantic review 2](M1-T3-review-2.md)

On the final route, the same 12 requests all returned HTTP 200, `application/octet-stream`, and `Cache-Control: no-store`.
An independent binary reader checked the exact framed f32 metadata and payload lengths at 8,000 Hz, including no sample payload for all four empty responses.
Ordinary PCM was compared to the generated FLOAT WAV samples, and masked PCM was compared to a whole-lane centered Hann STFT, unit mask and matching ISTFT.

| Project interval (s) | Destination slice | `first_sample` | Shape | Ordinary max error | Masked max error |
|---|---|---:|---|---:|---:|
| `[-1e308, 1]` | `[0,8000)` | 0 | `[1,8000]` | 0 | 0 |
| `[0, 1e308]` | `[0,24000)` | 0 | `[1,24000]` | 0 | 0 |
| `[-1e308, 1e308]` | `[0,24000)` | 0 | `[1,24000]` | 0 | 0 |
| `[1, 1e308]` | `[8000,24000)` | 8000 | `[1,16000]` | 0 | 0 |
| `[-1e308, -1]` | `[0,0)` | 0 | `[1,0]` | Empty | Empty |
| `[4, 1e308]` | `[24000,24000)` | 24000 | `[1,0]` | Empty | Empty |

A second authenticated probe selected channel 1 of a 32,001-sample stereo signal with project offset 0.375 s and resampled from 8,000 to 8,192 Hz.
The independently resampled destination length was 32,770, and exact half-sample positions 10.5 and 21.5 rounded to 10 and 22.
Both modes returned the expected slices `[0,10)`, `[10,22)`, `[22,32770)` and `[10,10)` for the left-clipped, interior, right-clipped and rounded-empty requests.
All six nonempty responses matched the full-lane reference with zero maximum error, and both empty responses had `first_sample=10` and shape `[1,0]`.

The new regression asserts the six exact intervals for each mode, uses the independent whole-lane Hann oracle and retains the strict `<1e-6` test for every nonempty slice.
Removing both the appended regression and its new `import pytest` from `tests/test_pcm.py` in memory and restoring the single terminal newline reconstructed the exact review-2 hash `0a09ed3b66e8fee489fb12c2947e1a5565c7905e1855c91ef62e946d943d02ae`.
This verifies that all earlier PCM assertions and tolerances are byte-identical to review 2 and resolves the comparison open in audit 3. [Semantic review 2](M1-T3-review-2.md#frozen-identity) [Mechanical audit 3](M1-T3-audit-3.md)

## Preserved review evidence

The original review-1 reproduction script produced zero maximum error for both Hann slices and both narrow Gaussian slices, with zero difference on samples shared by the full and short requests in each fixture.
The original extreme finite selection returned HTTP 200, and the additional test of extreme finite time and frequency rectangle edges gave a maximum unit-mask error of `5.9604645e-08`.
The NOLA-valid Gaussian fixture still reached reference peak `123.84543`, and the separate odd-FFT case with unusable overlap at the physical end returned 422 with the three specified error keys. [Semantic review 1](M1-T3-review-1.md) [DESIGN §15](../../../../DESIGN.md)

The M1.12 ordinary chunks, masked chunks, joined result, seam and shorter-rectangle result each had zero maximum reference error.
The maximum errors at the clipped left and right lane edges were respectively `0` and `5.9604645e-08`, and the shorter and full rectangles differed by `0.014776662` over the first chunk's final 2,048 samples.

| M1.6 preset | 500 Hz change (dB) | 3 kHz change (dB) |
|---|---:|---:|
| analysis | −173.76093454 | −0.00000011 |
| wideband | −128.09228709 | −0.00003561 |
| narrowband | −166.59881613 | −0.00000070 |

`PYTHONDONTWRITEBYTECODE=1 uv run --no-sync pytest -p no:cacheprovider -q -ra -s tests/test_pcm.py tests/test_spectral_mask.py` returned 26 passed, six skipped and one Starlette TestClient deprecation warning in 7.83 s.
CPU was the available compute device, with three cases each skipped for CUDA and MPS.

- **Allowed T1 REVIEW at `tests/test_spectral_mask.py:11`.** The CUDA case skips if `torch.cuda.is_available()` is false and gives reason `CUDA unavailable`. [DESIGN §20](../../../../DESIGN.md#20-测试约定)
- **Allowed T1 REVIEW at `tests/test_spectral_mask.py:15`.** The MPS case skips if `torch.backends.mps.is_available()` is false and gives reason `MPS unavailable`. [DESIGN §20](../../../../DESIGN.md#20-测试约定)

CUDA and MPS execution were unavailable, and T6 owns browser scheduling and audition evidence.
Mechanical suite and protection checks are recorded against the same frozen bytes. [Mechanical audit 3](M1-T3-audit-3.md)

## Frozen identity

HEAD and the task cut were `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
The tracked binary diff SHA-256 was `0e5fd4b2c0cec5e0ef4034f087602ca2d4da034caa63b9f3a1940f5bc2566f90`.

| Path | SHA-256 |
|---|---|
| `src/vsr/dsp/edit.py` | `0a7332101f7816ee210b6073b996b109238e64eab87dd1d8c85721391ca47f17` |
| `src/vsr/server/app.py` | `4580aba28684a102a992420c414701b22bbe21e8a17b075d7405ac3b083d0a4f` |
| `tests/test_pcm.py` | `e42f93d11831b913a6443e3b7f0d85400da9fdccb0875ceeeef36e1145b22ceb` |
| `tests/test_spectral_mask.py` | `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f` |
