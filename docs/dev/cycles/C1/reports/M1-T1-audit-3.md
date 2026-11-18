# M1-T1 mechanical audit 3

Verdict: PASS for the mechanical checks below; independent semantic review remains required.
The task base is `350508d74bdc8b892beeb05492752cd53c9818fb`, and the tracked diff SHA-256 is `7f949155637c91726f728b718d03544c08aa0aa3bab288c680dcb6c8a2746e9c`.
The tracked diff excludes untracked files; the eight changed-file hashes below were identical before and after the checks:

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

Changed paths match the T1 write set; no protected file, existing test, generated file or binary fixture is changed.
`git diff --check 350508d` passed.
The strict absolute calibration and SciPy Welch assertions remain present, along with the prior regression tests.
The new public and authenticated framed-route tests assert negative infinity across all statistics and bins for silence, and independently calculate exact-rank and interpolated mixed-frame percentile expectations.
The Worker log records the new tests failing on the old implementation with four failures, then passing on the repaired tree with four passes; each run also had four device skips.

Under the exclusive checks lock, `uv run pytest -ra tests/test_spectral_dsp.py tests/test_presets.py tests/test_server.py` returned 51 passed, 28 skipped and one Starlette dependency deprecation warning in 8.00 seconds.
All skips were for unavailable CUDA or MPS devices and stated the reason.
`uv run ruff check .` returned `All checks passed!`; `uv run ruff format --check .` returned `94 files already formatted`.

`python3 scripts/check_diff_rules.py --base 350508d74bdc8b892beeb05492752cd53c9818fb` returned:

```text
REVIEW T1 tests/test_spectral_dsp.py:20: marks=pytest.mark.skipif(
REVIEW T1 tests/test_spectral_dsp.py:26: marks=pytest.mark.skipif(
0 FAIL, 2 REVIEW
```

Both REVIEW lines are unchanged CUDA and MPS availability skips, each with a reason; review 2 allowed them under T1 and DESIGN §20, and the final reviewer must confirm their disposition.
The full DSP scan for `nan_to_num`, `errstate`, `clip(` and `clamp(` found four annotated clamps: `stft.py:52` (§8.1), `spectrum.py:60` (§8.4), `spectrum.py:108` (§8.1) and `spectrum.py:114` (§8.1 and §8.4).
Review 2 verified these four annotations against the formulas; those lines are unchanged by fix 2.
No source edits, staging, commit, merge or push were performed.
