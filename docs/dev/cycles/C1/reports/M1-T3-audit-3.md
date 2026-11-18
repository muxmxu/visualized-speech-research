# M1-T3 mechanical audit 3

Verdict: PASS for the executed mechanical checks and four-path scope.
The semantic reviewer owns the two conditional-skip rule REVIEW dispositions.
The exact review-2 PCM test file was not available for bytewise comparison, as explained below.

The frozen worktree HEAD and task cut were `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
The tracked binary diff SHA-256 before and after checks was `0e5fd4b2c0cec5e0ef4034f087602ca2d4da034caa63b9f3a1940f5bc2566f90`.
The complete changed path list and SHA-256 values before and after checks were:

- Untracked `src/vsr/dsp/edit.py`: `0a7332101f7816ee210b6073b996b109238e64eab87dd1d8c85721391ca47f17`.
- Modified `src/vsr/server/app.py`: `4580aba28684a102a992420c414701b22bbe21e8a17b075d7405ac3b083d0a4f`.
- Modified `tests/test_pcm.py`: `e42f93d11831b913a6443e3b7f0d85400da9fdccb0875ceeeef36e1145b22ceb`.
- Untracked `tests/test_spectral_mask.py`: `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f`.

These are exactly the permitted paths, so no protected file or DESIGN section changed.
The unchanged `edit.py` and `test_spectral_mask.py` hashes match review 2.
Reversing the two changed destination-bound expressions in the current `app.py` in memory produces the review-2 SHA-256 `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb`.
The base-to-final PCM test diff contains 447 added lines and no deleted lines, preserving all base assertions.
The review-2 PCM test bytes were not preserved in the task tree or an accessible Git blob; removing the final parametrized test from the current file does not reproduce the review-2 SHA-256 `0a09ed3b66e8fee489fb12c2947e1a5565c7905e1855c91ef62e946d943d02ae`.
Consequently an exact bytewise comparison against review-2 PCM tests and a definitive mechanical statement that none of those added assertions changed cannot be made from the available evidence.
The review-1 regression tests and their strict assertions remain present and pass.

The final parametrized authenticated regression exercises the six amendment intervals for both ordinary and masked PCM, with exact shape, float32 type, sample rate and first-sample assertions, plus error below `1e-6` for nonempty outputs against the ordinary source or independent whole-lane masked oracle.
The preserved pre-correction log records 12 failures, one for each interval and mode, each with HTTP 500 and `OverflowError: cannot convert float infinity to integer`.
The log shows the review-2 route's original rounding expressions; it does not independently establish the complete review-2 test file identity.

Independent final-tree checks:

- `uv run pytest -ra tests/test_pcm.py tests/test_spectral_mask.py tests/test_server.py`: 45 passed, 6 skipped, 1 warning in 8.48 s.
- Targeted skips were three CUDA and three MPS cases, with explicit unavailable-device reasons.
- `uv run pytest`: 118 passed, 36 skipped, 1 warning in 37.76 s.
- `uv run ruff check .`: all checks passed.
- `uv run ruff format --check .`: 98 files already formatted.
- `git diff --check 70d7f5c45e18b78777883bd1e6a2207704f6265f`: clean; `git diff --no-index --check /dev/null` for each untracked file emitted no whitespace diagnostics.
- `python3 scripts/check_diff_rules.py --base 70d7f5c45e18b78777883bd1e6a2207704f6265f`: 0 FAIL, 2 REVIEW.
- REVIEW T1 `tests/test_spectral_mask.py:11`: conditional CUDA skip, reason `CUDA unavailable`.
- REVIEW T1 `tests/test_spectral_mask.py:15`: conditional MPS skip, reason `MPS unavailable`.

The warning was the Starlette TestClient deprecation warning.
