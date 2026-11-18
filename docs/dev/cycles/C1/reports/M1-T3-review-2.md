# M1-T3 semantic review 2

## Verdict

FAIL. The three review-1 findings are closed on the frozen tree. A complete masked request with a valid finite chunk bound still returns HTTP 500 before lane clipping.

## Remaining finding

The destination sample calculations in `src/vsr/server/app.py:295` and `:296` multiply each finite relative chunk time by the destination sample rate and call `round` before clipping.
On a mono 24,000-sample FLOAT WAV at 8 kHz containing the constant `0.75`, leave the lane offset at zero and send authenticated `GET /api/lanes/{id}/pcm` with these query parameters.

```text
t0=-1e308&t1=1&sr=8000&selection_t0=0&selection_t1=3&f_lo=0&f_hi=4000&n_fft=16&win_length=16&window=hann&window_param=0
```

The response was HTTP 500 with `error="OverflowError"` and `detail="cannot convert float infinity to integer"`.
Replacing the chunk pair with `t0=0&t1=1e308` or `t0=-1e308&t1=1e308` produced the same output.
The first request should return HTTP 200, `first_sample=0`, and a framed array of shape `[1,8000]` equal to the corresponding slice of the unit-mask reference.
The other two requests should return the entire lane, with shape `[1,24000]` and the same first-sample metadata.
The ordinary request and the base route used the same overflow-prone arithmetic, as confirmed by loading the base route from `git show` and running it against the fixture.
The masked branch introduces its own obligation to return the clipped slice for accepted finite chunk bounds.
Clamp the destination-grid position before converting an unbounded floating-point value to an integer, preserve nearest-sample rounding for in-lane positions, and add a regression for both finite endpoints. [Task plan](M1-T3-task-plan.md) [DESIGN §§7 and 9.4](../../../../DESIGN.md)

## Review-1 regression evidence

The unchanged reproduction script in review 1 was run from the frozen task worktree.

```text
hann 200 0.0
hann 200 0.0
shared samples 0.0
reference peak 0.75000006
wide finite rectangle 200 {}
gaussian 200 0.0
gaussian 200 0.0
shared samples 0.0
reference peak 123.84543
```

For the added HTTP regressions, the Hann whole and short chunk errors and common-sample difference were all zero.
The additional test with extreme finite time and frequency rectangle edges had maximum unit-mask error `5.9604645e-08`.
The narrow Gaussian full and final-four-sample request errors were both zero.
The separate odd-FFT Gaussian test returned the requested 422 error shape for an unusable overlap at the physical end.
The reproduced defect concerns the chunk's `t0/t1`, which are distinct from the corrected `selection_t0/selection_t1` rectangle fields. [Review 1](M1-T3-review-1.md)

## PCM and device evidence

`PYTHONDONTWRITEBYTECODE=1 uv run --no-sync pytest -p no:cacheprovider -q -ra -s tests/test_pcm.py tests/test_spectral_mask.py` produced 14 passed, six skipped and one Starlette TestClient deprecation warning in 7.48 s.
The unchanged ordinary PCM assertions passed.

| M1.12 comparison | Maximum absolute error |
|---|---:|
| Ordinary first and second chunk | 0.0 each |
| Masked first, second, joined and seam samples | 0.0 each |
| First chunk with the shorter rectangle | 0.0 |
| Clipped left lane edge | 0.0 |
| Clipped right lane edge | 5.9604645e-08 |

The two rectangle lengths differed by `0.014776662` in the first chunk's final 2,048 samples.

| M1.6 preset | 500 Hz change (dB) | 3 kHz change (dB) |
|---|---:|---:|
| analysis | −173.76093454 | −0.00000011 |
| wideband | −128.09228709 | −0.00003561 |
| narrowband | −166.59881613 | −0.00000070 |

Absolute frame and bin coordinates, the cosine transitions and their outer product are computed in NumPy float64 on the CPU.
The completed coefficient array is cast to float32 before transfer to the selected device.
The route snapshots bounded source support under the session lock and obtains `api.compute_device()` for the masked transform under the shared semaphore.
The source, periodic window and float32 coefficients are on that device for the STFT, mask multiplication and inverse.
Only the reconstructed output is moved back to CPU for any required polyphase resampling and framed encoding.
Both odd and even FFT comparisons passed on CPU.

- **Allowed T1 REVIEW, `tests/test_spectral_mask.py:11`.** The CUDA parameter skips only if `torch.cuda.is_available()` is false and states `CUDA unavailable`. [DESIGN §20](../../../../DESIGN.md)
- **Allowed T1 REVIEW, `tests/test_spectral_mask.py:15`.** The MPS parameter skips only if `torch.backends.mps.is_available()` is false and states `MPS unavailable`. [DESIGN §20](../../../../DESIGN.md)

CPU was the available device, with three skips each for CUDA and MPS.
Browser scheduling and integration remain assigned to T6.
The mechanical auditor's full-suite results and obsolete-tree reproduction limits are recorded separately. [Mechanical audit 2](M1-T3-audit-2.md)

## Frozen identity

HEAD and task cut were `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
The tracked binary diff SHA-256 was `cf112c011ead3f05653a59d01c75afc31800710c74ff591c72a22ce57ffeb62b`.

| Path | SHA-256 |
|---|---|
| `src/vsr/dsp/edit.py` | `0a7332101f7816ee210b6073b996b109238e64eab87dd1d8c85721391ca47f17` |
| `src/vsr/server/app.py` | `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb` |
| `tests/test_pcm.py` | `0a09ed3b66e8fee489fb12c2947e1a5565c7905e1855c91ef62e946d943d02ae` |
| `tests/test_spectral_mask.py` | `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f` |
