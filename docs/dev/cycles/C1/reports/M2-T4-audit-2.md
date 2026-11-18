# M2-T4 independent mechanical audit 2

**Verdict — PASS for the frozen M2-T4 correction.**

The independent Mechanical Auditor ran at `6.2-sol(medium)` against task cut `153cedca0c842d5a17c1f9b48fab09f255ab8a85` and compared the correction with [audit 1](M2-T4-audit-1.md) and [semantic review 1](M2-T4-review-1.md).

- HEAD and the index matched the cut, and the worktree contained exactly the two approved paths.
- Independent diff reconstruction matched the frozen patch byte for byte, all twelve evidence manifest entries and both worktree file hashes matched, and reverse application and both whitespace checks passed.
- The original worktree files were reconstructed from the audit 1 patch and matched their recorded hashes.
- The source diff changes the request opener for runtime-derived localhost connections by building it with an empty proxy map, and the explicit `VSR_URL` path still uses the original opener.
- The test diff adds two imports and one local proxy regression, and comparison of the parsed test files confirmed all existing tests and assertions were preserved.
- The red run recorded one proxy POST and HTTP 502 on the original implementation, and the regression on the corrected tree passed with zero proxy POSTs and a named lane with exact decoded PCM on the authenticated server.
- The final frozen run of `uv run --extra plot pytest -ra tests/test_show.py tests/test_frame.py tests/test_tensor_lanes.py` reported 84 passed, two existing optional `safetensors` skips, and one Starlette TestClient deprecation warning.
- The frozen Ruff lint and format checks exited zero, with 154 files already formatted.
- DESIGN, AGENTS, LIFECYCLE, the bundled skill, dependency and lock files, frontend and rule checker all matched the cut, and the independent rule checker reported `0 FAIL, 0 REVIEW`.
- Manual inspection and the public-repository scan covered the 443 added lines and found six loopback address references and no private-content findings.

```text
8f48bfa403b1e8a080ff55dc6985d174d8ff3765200ea1f4c64ffefd0fb3c2a4  worker.patch
f1fc8821e41c8feff5bbafe683aac287557d681568554882f2b8cb3c6ed0b98a  primary-evidence.sha256
5705d08ce0530ed91505bbc5d47d89ab9b07d521afff0f13adf88897518760f2  src/vsr/__init__.py
91e04714336c6fc619a67cdf386384ced281d5f2a70d6bb4b646c56a31334039  tests/test_show.py
```
