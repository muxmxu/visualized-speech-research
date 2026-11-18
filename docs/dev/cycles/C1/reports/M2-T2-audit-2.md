# M2-T2 independent mechanical audit 2

**Verdict — PASS for the corrected frozen T2 patch.**

The independent Mechanical Auditor used `6.2-sol(medium)` against cut `84486e6ffd0209eee1d5b1e2357334f431f04a74` and verified the evidence for the [four review-1 corrections](M2-T2-review-1.md).

| Check | Result |
| --- | --- |
| Patch and scope | HEAD equals the cut and the index is unchanged. The five tracked changes and two untracked additions match the approved write set below. Independent reconstruction of the canonical binary diff matched the corrected worker patch byte for byte. All 15 manifest entries and all seven file hashes matched. The seven hashes matched again after the independent focused run. |
| Protection | DESIGN, AGENTS, LIFECYCLE, bundled skills, rule script, dependency and lock files, and frontend equal the cut. Reverse patch application and tracked and untracked whitespace checks passed. The public-repository scan found no matches in 1,335 added lines. |
| Preservation | Compared with audit 1, only the tensor interpreter, spectral route, and tensor tests changed. The existing server, spectrogram, and PCM tests equal the cut. The frame tests from the cut remain a byte-for-byte prefix. The correction preserves the earlier tensor assertions and adds a dtype assertion to the existing scale cases. The STFT branch retains its nominal `col_t0` expression and `col_dt`. |
| Pre-fix focused tests | `red.log` records eleven failures. File and framed uint8 PCM both lacked centering. Adjacent large integer path keys collapsed after JSON number conversion. The initial bytes fixture was rejected by weights-only loading. Feature and mel first-partial centers returned 0.055 and 0.00275 s, with expected values 0.05 and 0.0025 s. The raw viewport returned f16 and the four overflow batch requests returned 200. |
| Isolated bytes regression | `red-safe-bytes.log` reruns the final fixture with loadable nonempty byte keys against the previous interpreter and route. Inspection reached VSR and returned 422 with `Unsupported dictionary key in tensor file`. This verifies the pre-fix failure with the same bytes fixture that passes on the corrected tree. |
| Corrected focused tests | `green.log` records eleven passing cases. The same eleven passed independently under the shared checks lock with `uv run --no-sync --extra safetensors pytest -p no:cacheprovider -ra tests/test_tensor_lanes.py -k 'uint8 or browser_safe or first_partial or outside_half_precision or unrepresentable'`. The cases check unsigned PCM, distinct browser-round-tripped paths and selected PCM, first-partial means with constant stride, f32 raw data beyond the f16 range, and atomic rejection of four unrepresentable batches. |
| Final selected suite and static checks | The manifest-bound `uv run --extra safetensors pytest -ra tests/test_tensor_lanes.py tests/test_frame.py tests/test_server.py tests/test_spectrogram.py tests/test_pcm.py` exited 0 with 146 passed and two conditional device skips out of 148 cases. Both skips are at `tests/test_spectrogram.py:319` for unavailable CUDA and MPS. The package probe loaded task source and safetensors 0.8.0. Ruff lint and format exited 0, with 151 files already formatted. The independent and final selected runs reported the Starlette TestClient deprecation warning. |

The independent rule check exited 0. The sole REVIEW marks the conditional skip for the declared optional safetensors package. Both safetensors format cases ran in the final selected suite. Semantic disposition remains with the Task Reviewer.

```text
REVIEW T1 tests/test_tensor_lanes.py:117: safe = pytest.importorskip("safetensors.torch", reason="safetensors is an optional extra")
0 FAIL, 1 REVIEW
```

```text
3c41ef382611951fed6f06bbf9424887183021b7b965045789f596c0cf0aac2b  worker.patch
a56c13adb71db9a59186c941a9f5cd072434fb4934e725efb61c50aaecae06c4  primary-evidence.sha256
b7412d0b765764796ff21a310b7929203d4dbe8d529d41d5df09b25891f127a4  src/vsr/frame.py
142dad4f06a58d247c38fa760f641d31a2a2067f44dba7ef5b7c29c64bfeced9  src/vsr/io/tensors.py
c1cf803ce0d79a7901023b2e1ff789788753c86d89fc7c07a88a9197eb400baa  src/vsr/server/app.py
c906b1cf208d1a0d72ba196a0ab448a9abd6d499c0f61cca82943a6aec9fbf68  src/vsr/server/routes_spectrogram.py
fc7e6b635c4e61208d14743b58232b51e291e3653771c1f6b4ae359d39726b78  src/vsr/server/session.py
b8c37517679fa9db6d26c26bbb9eb22457ce970322a8961f60e45d300cb3151e  tests/test_frame.py
64f5cd690d4587e73cfaf852d0c55a06fb1a241fb42f0e2e83b3fa182d3aabc1  tests/test_tensor_lanes.py
```
