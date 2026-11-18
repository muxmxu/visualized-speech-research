# M2-T2 independent mechanical audit 3

**Verdict — PASS for the frozen T2 amendment.**

The independent Mechanical Auditor used `6.2-sol(medium)` against cut `84486e6ffd0209eee1d5b1e2357334f431f04a74` and compared the amendment to the [audit-2 tree](M2-T2-audit-2.md) and the [review-2 finding](M2-T2-review-2.md).

| Check | Result |
| --- | --- |
| Identity and scope | HEAD equals the original cut, the index is unchanged, and the working diff contains exactly the seven approved paths below. Independent reconstruction reproduced the frozen patch byte for byte. All 16 evidence entries and seven file hashes matched. The seven file hashes matched again after the focused run. |
| Amendment delta | The previous audited blobs and the final blobs reproduce `amendment.diff` byte for byte. Only `src/vsr/io/tensors.py` and `tests/test_tensor_lanes.py` changed. The interpreter now flips the offset-binary sign bit at source integer precision before converting to float32 and applying the source-width divisor. The test delta adds one parameterized test with uint32 and uint64 cases. It removes and changes zero existing test lines. The other five blobs match audit 2. |
| Pre-fix and corrected evidence | The pre-fix run failed exactly two cases. Both files produced f32 PCM `[0, 0, 0]` for the three neighboring midpoint samples. The green run passed both with exact f32 output `[-2**-31, 0, 2**-31]` for uint32 and `[-2**-63, 0, 2**-63]` for uint64. The two tests request authenticated same-rate framed PCM and use exact array assertions. |
| Independent focused verification | Under the shared checks lock, `uv run --no-sync --extra safetensors pytest -p no:cacheprovider -ra tests/test_tensor_lanes.py -k 'wide_unsigned_pcm or uint8 or file_formats'` exited 0 with 14 passed and 47 deselected. This covers both new cases, the two uint8 file and push cases, and ten signed int16 and float32 format cases. |
| Final selected suite and static checks | The bound Worker command `uv run --extra safetensors pytest -ra tests/test_tensor_lanes.py tests/test_frame.py tests/test_server.py tests/test_spectrogram.py tests/test_pcm.py` exited 0 with 148 passed and two skips out of 150 cases. The skips were the existing unavailable CUDA and MPS cases at `tests/test_spectrogram.py:319`. Ruff lint and format exited 0, with 151 files already formatted. The focused and selected pytest runs reported the Starlette TestClient deprecation warning. |
| Protection and public-repository scan | DESIGN, AGENTS, LIFECYCLE, bundled skills, rule script, dependency and lock files, frontend, and existing server, spectrogram and PCM tests equal the cut. The original frame tests remain an exact prefix. Reverse patch application, tracked and untracked whitespace checks, and the public-repository scan passed. The scan covered 1,352 added lines. |

The independent rule check exited 0. The sole REVIEW remains the stated conditional skip for the declared optional safetensors package. Both safetensors format cases ran in the bound selected suite and the independent focused run. Semantic disposition remains with the Task Reviewer.

```text
REVIEW T1 tests/test_tensor_lanes.py:117: safe = pytest.importorskip("safetensors.torch", reason="safetensors is an optional extra")
0 FAIL, 1 REVIEW
```

```text
979d0ba8b7c670d30d669a540739cff6a793546bcdb40f452d62ceb63b19b4ad  worker.patch
00b4d9fd8cafffb148a531e688f25e3f9b2d99ccf723dc43d5b91906b2ff775d  primary-evidence.sha256
b7412d0b765764796ff21a310b7929203d4dbe8d529d41d5df09b25891f127a4  src/vsr/frame.py
6e54a5b1c79bf5359d55bf241ca227d0efa038a162d3fd6943311d46385379e0  src/vsr/io/tensors.py
c1cf803ce0d79a7901023b2e1ff789788753c86d89fc7c07a88a9197eb400baa  src/vsr/server/app.py
c906b1cf208d1a0d72ba196a0ab448a9abd6d499c0f61cca82943a6aec9fbf68  src/vsr/server/routes_spectrogram.py
fc7e6b635c4e61208d14743b58232b51e291e3653771c1f6b4ae359d39726b78  src/vsr/server/session.py
b8c37517679fa9db6d26c26bbb9eb22457ce970322a8961f60e45d300cb3151e  tests/test_frame.py
09afb941477168a8431f5020673347cc0efb097d694724c8418a610998549baf  tests/test_tensor_lanes.py
```
