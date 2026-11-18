# M1-T3 mechanical audit 1

Verdict: PASS for mechanical checks; the two rule REVIEW dispositions remain with the semantic reviewer.

The frozen worktree HEAD and base are `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
The tracked binary diff SHA-256 is `f6bb714a3012e143540df8500e1c938b2e67d49ee737a05dd758a56e4b0ab4d2`.
Before and after checks, the only changed paths and their SHA-256 hashes were:

- Untracked `src/vsr/dsp/edit.py`: `47a52cf1d99ec942e8f35f88f0e92a68c3568e720953f33d706e7fdff5b28baa`.
- Modified `src/vsr/server/app.py`: `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb`.
- Modified `tests/test_pcm.py`: `e95f357087cbe7a24a0107cc6613e4ca7020e665cfb6aa04bd680a5124b66801`.
- Untracked `tests/test_spectral_mask.py`: `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f`.

These are exactly the allowed paths; no protected file or DESIGN section changed.
The existing PCM test diff only adds tests and does not remove or weaken existing assertions.
`tests/test_pcm.py::test_gaussian_rejects_missing_overlap_at_physical_end` exercises the actual physical end with an odd FFT and asserts HTTP 422 and the error keys.
The Worker reported contemporaneously, before implementation, that `test_masked_pcm_suppresses_outside_frequency` failed on the old route with 500 Hz RMS `0.70710677` against `< 0.01`.
The final test contains that assertion; the pre-change transcript was relayed by the Controller and no separate execution log was supplied, so its execution was not independently reproduced in this audit.

Independent checks on the frozen tree:

- `uv run pytest -ra tests/test_pcm.py tests/test_spectral_mask.py tests/test_server.py`: 30 passed, 6 skipped, 1 warning in 8.23 s.
- The six targeted skips are three CUDA and three MPS cases, with explicit unavailable-device reasons.
- `uv run pytest`: 103 passed, 36 skipped, 1 warning in 37.81 s.
- `uv run ruff check .`: all checks passed.
- `uv run ruff format --check .`: 98 files already formatted.
- `git diff --check 70d7f5c45e18b78777883bd1e6a2207704f6265f`: clean; both untracked files also passed `git diff --no-index --check /dev/null` with no whitespace diagnostics and an independent trailing-whitespace scan.
- `python3 scripts/check_diff_rules.py --base 70d7f5c45e18b78777883bd1e6a2207704f6265f`: 0 FAIL, 2 REVIEW.
- REVIEW T1 `tests/test_spectral_mask.py:11`: conditional CUDA skip with reason `CUDA unavailable`.
- REVIEW T1 `tests/test_spectral_mask.py:15`: conditional MPS skip with reason `MPS unavailable`.
- Both conditions are device availability checks with explicit reasons; final disposition is reserved for the semantic reviewer.

The Worker reported ordinary full-lane oracle maximum error 0; masked chunk, joined, seam and short-rectangle errors `5.9604645e-08`; left and right edge errors `2.9802322e-08` and `5.9604645e-08`; and short-edge difference `0.014776662`.
The Worker reported 500 Hz changes for analysis, wideband and narrowband of `-173.76094`, `-128.08937` and `-166.59881` dB, and corresponding 3 kHz changes of `-0.00000011`, `-0.00003561` and `-0.00000070` dB.
Independent pytest execution passed the numerical assertions but captured those printed values, so the values above are Worker-reported rather than independently measured here.
