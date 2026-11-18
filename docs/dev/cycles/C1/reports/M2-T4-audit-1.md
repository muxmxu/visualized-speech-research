# M2-T4 independent mechanical audit 1

**Verdict — PASS for the frozen M2-T4 patch.**

The independent Mechanical Auditor ran at `6.2-sol(medium)` against task cut `153cedca0c842d5a17c1f9b48fab09f255ab8a85` and checked the [T4 plan](../phase-M2.md#t4--python-push-and-import-boundary) and [plan review amendment A1](plan-review-M2.md#required-amendment-a1).

- HEAD and the index matched the cut, and the worktree contained exactly the approved edits to `src/vsr/__init__.py` and `tests/test_show.py`.
- Independent diff reconstruction matched the frozen patch byte for byte, and all ten evidence manifest entries and both worktree file hashes matched.
- Reverse patch application and whitespace checks passed for the tracked edit and the untracked test.
- The frozen worker run of `uv run --extra plot pytest -ra tests/test_show.py tests/test_frame.py tests/test_tensor_lanes.py` reported 83 passed, two existing optional `safetensors` skips, and one Starlette TestClient deprecation warning.
- The frozen Ruff lint and format checks exited zero, with 154 files already formatted.
- The focused independent run of `tests/test_show.py` under the shared checks lock passed all seven cases in 24.98 s.
- An isolated loopback server and separate sender processes exercised authenticated push and the same-rate f32 PCM endpoint, and integer `[-16384, 16384]` decoded to `[-0.5, 0.5]` while float32 `[-1.25, 0.375]` kept both amplitudes.
- The signed integer, float32 and uint64 midpoint-neighbor PCM values matched equivalent files opened via `/api/open` and `/api/open_tensor` on the same server.
- The remote-credential path returned HTTP 401 and left the session empty with the incorrect token, then created the two dictionary lanes in key order and the two feature lanes in four successful POSTs with the correct token.
- The focused tests verified feature axis metadata and complex magnitude, inferred and explicit audio layouts, hostname rejection before connecting, and the startup command for missing and stale runtime files.
- A fresh interpreter left all four restricted dependencies unloaded after `import vsr` and loaded Matplotlib on `vsr.plot` access.
- DESIGN, AGENTS, LIFECYCLE, the bundled skill, dependency and lock files, frontend and rule checker all matched the cut, and the independent rule checker reported `0 FAIL, 0 REVIEW`.
- Manual inspection and the public-repository scan covered all 408 added lines and found four loopback address references and no private-content findings.

```text
0f0210315a5d8315f32783cf93de712c032c0522a7b9ee4e4df13d36b8edf11b  worker.patch
45967673f01bbaa92a7112b6df5d66c9809d7cba71b5da5cff21ff82442acc0c  primary-evidence.sha256
d3909ee4faeda5bca783e7965e809703565d5a1a24becbe4247b77aa830d5af7  src/vsr/__init__.py
842899d2e9dbe40a2dc5eeb0b2f8b49a16dad3f346b5d49ad043fdd8b8f1319c  tests/test_show.py
262f3c62d59f2b307a95c0680d09078f3fc534ec849594b3f6c661e5aad84080  M2-T4-audit-1-probe.log
```
