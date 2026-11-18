# M2-T2 independent mechanical audit 1

**Verdict — PASS for the frozen T2 patch.**

The independent Mechanical Auditor used `6.2-sol(medium)` against task cut `84486e6ffd0209eee1d5b1e2357334f431f04a74`.

| Check | Evidence |
| --- | --- |
| Scope and identity | HEAD equals the cut and the index is unchanged. The five tracked changes and two untracked additions are exactly the T2 write set listed below. Independent canonical binary diff reconstruction reproduced the worker patch byte for byte. All seven source and test content hashes and all 12 manifest entries matched. Source and test content hashes matched again after the focused run. |
| Protection and public-repository scan | All of DESIGN, AGENTS, LIFECYCLE, bundled skills, rule script, dependency and lock files, and frontend match the cut. Reverse patch application and whitespace checks passed, including checks on both untracked additions. The independent host vocabulary and identifier scan returned zero matches across 1,200 added lines. |
| Selected suite and static checks | The manifest-bound Worker command `uv run --extra safetensors pytest -ra tests/test_tensor_lanes.py tests/test_frame.py tests/test_server.py tests/test_spectrogram.py tests/test_pcm.py` exited 0 with 135 passed and two skips out of 137 cases. Both skips were in the existing spectrogram suite at line 319 for unavailable CUDA and MPS. The installed-source evidence identifies the task worktree and safetensors 0.8.0. Ruff lint and format exited 0, with 151 files already formatted. |
| Independent focused run | Under the shared checks lock, `uv run --no-sync --extra safetensors pytest -p no:cacheprovider -ra tests/test_tensor_lanes.py -k 'file_formats or feature_axes or mel_rows or batch_limit'` exited 0 with 17 passed, 31 deselected and no skips. Both pytest runs reported the Starlette TestClient deprecation warning. |
| Coverage and existing assertions | Ten format/dtype cases generate `.pt`, `.pth`, `.npy`, `.npz` and `.safetensors` files. Each decodes framed same-rate PCM, checks exact int16 conversion from `[-16384, 16384]` to `[-0.5, 0.5]` or float32 preservation at `[-0.75, 0.125]`, and checks that the input bytes are unchanged. Four axis cases check feature data and row coordinates. Both mel cache budgets check the calibrated viewport against librosa and exercise p8 and p64, all selected rows, and sliced frequencies. The cached case checks mode and each mel key dimension in isolation. The full selected run also covers the five audio layouts, six feature scales, complex magnitude, absolute time groups, and unsafe-object rejection. The existing frame test file is a byte-for-byte prefix of the new file. Existing server, spectrogram, and PCM test files match the cut. |
| Runtime synchronization | The approved batch is prepared before `publish_lanes` adds it and captures metadata under the session lock. The focused batch case verifies one WebSocket notification for the 32-lane batch and no lanes or notifications after rejected 33-lane requests. The diff preserves cache lookup, update, and in-flight accounting under the cache lock. Mel cache construction and oversized viewport reduction run under the existing heavy-compute semaphore. |

The independent rule check exited 0 and returned one conditional-skip REVIEW for the Task Reviewer to dispose of. Its reason identifies the optional package and both safetensors cases executed in the selected and focused runs.

```text
REVIEW T1 tests/test_tensor_lanes.py:116: safe = pytest.importorskip("safetensors.torch", reason="safetensors is an optional extra")
0 FAIL, 1 REVIEW
```

```text
ac6e4529d274c8c54ba3cf258180fdb22a07fae0311524df4678df6296b76244  worker.patch
e471b9b6da7a9c75de0d1ed1ec205536b93bfefed499901c6fdfe0c2644903b8  primary-evidence.sha256
b7412d0b765764796ff21a310b7929203d4dbe8d529d41d5df09b25891f127a4  src/vsr/frame.py
28ed453b96d0b0e6b226db05e0445d6b1b25a6be1377949c0148455c1c9c15e7  src/vsr/io/tensors.py
c1cf803ce0d79a7901023b2e1ff789788753c86d89fc7c07a88a9197eb400baa  src/vsr/server/app.py
069727a896ea8c2837c1c3d512f14f25212e3d1ac5eb2eb574e487f0d7b09d47  src/vsr/server/routes_spectrogram.py
fc7e6b635c4e61208d14743b58232b51e291e3653771c1f6b4ae359d39726b78  src/vsr/server/session.py
b8c37517679fa9db6d26c26bbb9eb22457ce970322a8961f60e45d300cb3151e  tests/test_frame.py
60175f433c916b5857534674843ccc5f7af47038d2ef1d183f4713da3a9b91f1  tests/test_tensor_lanes.py
```
