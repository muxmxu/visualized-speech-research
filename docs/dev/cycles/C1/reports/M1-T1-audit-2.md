# M1-T1 mechanical audit 2

Verdict: PASS for the mechanical checks below; semantic disposition remains with the independent Task Reviewer.
The audited tree is based on `350508d74bdc8b892beeb05492752cd53c9818fb`, and its tracked diff SHA-256 is `7f949155637c91726f728b718d03544c08aa0aa3bab288c680dcb6c8a2746e9c`.
The tracked diff excludes untracked deliverables; the following hashes cover all eight changed files and were identical before and after the checks:

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

Changed paths match the T1 write set exactly; no protected file, existing test, generated file or binary fixture is changed.
`git diff --check 350508d` passed.
Compared with audit 1, the numerical tolerance assertions for the specified calibration and Welch checks were tightened to strict absolute bounds; no existing test assertion was removed or weakened.
New tests cover quiet PSD against SciPy, the inclusive activity edge and empty activity, full cap behavior, method-specific response metadata, long hop and short frame interval, float32 coordinates under changed default dtype, lazy DSP import, reversed NumPy input, operation-specific window validation, preset response resources and no-store header, axis bounds and spec formatting.
The full-cap test asserts rejection above the cap; the Task Reviewer must determine whether that behavior resolves the prior finding and DESIGN contract.
No focused test exercises the semaphore and event-loop behavior raised in finding 12; the revised route is synchronous and uses a bounded semaphore for Welch, and semantic review must assess this evidence gap.

Under the exclusive checks lock, `uv run pytest -ra tests/test_spectral_dsp.py tests/test_presets.py tests/test_server.py` returned 47 passed, 24 skipped and one dependency deprecation warning in 8.02 seconds.
All 24 skips were for unavailable CUDA or MPS devices and stated the reason.
`uv run ruff check .` returned `All checks passed!`; `uv run ruff format --check .` returned `94 files already formatted`.

`python3 scripts/check_diff_rules.py --base 350508d74bdc8b892beeb05492752cd53c9818fb` returned:

```text
REVIEW T1 tests/test_spectral_dsp.py:20: marks=pytest.mark.skipif(
REVIEW T1 tests/test_spectral_dsp.py:26: marks=pytest.mark.skipif(
0 FAIL, 2 REVIEW
```

The two lines remain the CUDA and MPS availability skips, each with a reason; the Task Reviewer must disposition each on this revised tree.
A full DSP scan for `nan_to_num`, `errstate`, `clip(` and `clamp(` returned only four annotated clamps: `stft.py:52` (§8.1), `spectrum.py:60` (§8.4), `spectrum.py:108` (§8.1), and `spectrum.py:114` (§8.1 and §8.4).
The Task Reviewer must verify the formula correspondence and other numerical guards in the changed DSP code.
No source edits, staging, commit, merge or push were performed.
