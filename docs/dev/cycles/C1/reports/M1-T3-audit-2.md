# M1-T3 mechanical audit 2

Verdict: PASS for current-tree mechanical checks; the two conditional-skip rule REVIEW dispositions remain with the semantic reviewer.

The frozen worktree HEAD and base are `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
The tracked binary diff SHA-256 before and after checks was `cf112c011ead3f05653a59d01c75afc31800710c74ff591c72a22ce57ffeb62b`.
Before and after checks the complete changed path list and file SHA-256 values were:

- Untracked `src/vsr/dsp/edit.py`: `0a7332101f7816ee210b6073b996b109238e64eab87dd1d8c85721391ca47f17`.
- Modified `src/vsr/server/app.py`: `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb`.
- Modified `tests/test_pcm.py`: `0a09ed3b66e8fee489fb12c2947e1a5565c7905e1855c91ef62e946d943d02ae`.
- Untracked `tests/test_spectral_mask.py`: `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f`.

These are exactly the four permitted paths, so no protected file or DESIGN section changed.
The existing PCM test diff adds tests without removing or weakening existing assertions.
The added fractional-edge test compares full and short chunks independently to the full-lane oracle and compares their shared samples, all with strict error below `1e-6`.
The huge finite rectangle test requires HTTP 200 and unit-mask reconstruction error below `1e-6` for extreme finite bounds on both axes.
The accepted narrow Gaussian test compares both full and final-four-sample requests with the whole-lane oracle below `1e-6`.
The physical-end invalid-overlap regression separately requires HTTP 422 and all three error keys for an odd FFT.
All four tests passed in the targeted and full runs.

The review-1 report records independent reproduction of the three original failures and the SHA-256 of its untracked `edit.py`.
The Worker reported that the three new tests failed before correction, but the review-1 untracked source was not preserved and the test failures on that exact source could not be independently rerun.
A separate experiment on the task base is not equivalent to review 1: the fractional and Gaussian tests fail at import because `vsr.dsp.edit` does not exist there, while the huge-rectangle test passes because the old route returns the unmasked constant signal.

Independent final-tree checks:

- `uv run pytest -ra tests/test_pcm.py tests/test_spectral_mask.py tests/test_server.py`: 33 passed, 6 skipped, 1 warning in 8.36 s.
- The targeted skips are three CUDA and three MPS cases with explicit unavailable-device reasons.
- `uv run pytest`: 106 passed, 36 skipped, 1 warning in 38.36 s.
- `uv run ruff check .`: all checks passed.
- `uv run ruff format --check .`: 98 files already formatted.
- `git diff --check 70d7f5c45e18b78777883bd1e6a2207704f6265f`: clean; `git diff --no-index --check /dev/null` for each untracked file emitted no whitespace diagnostics.
- `python3 scripts/check_diff_rules.py --base 70d7f5c45e18b78777883bd1e6a2207704f6265f`: 0 FAIL, 2 REVIEW.
- REVIEW T1 `tests/test_spectral_mask.py:11`: conditional CUDA skip, reason `CUDA unavailable`.
- REVIEW T1 `tests/test_spectral_mask.py:15`: conditional MPS skip, reason `MPS unavailable`.

The warning was the Starlette TestClient deprecation warning.
The semantic reviewer owns the rule REVIEW dispositions and independent numerical interpretation.
