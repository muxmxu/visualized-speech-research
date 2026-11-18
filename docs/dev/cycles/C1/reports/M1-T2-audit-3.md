# M1-T2 mechanical audit 3

Verdict: PASS for the mechanical checks on the final amended tree; independent semantic review and the two REVIEW dispositions remain required.

## Scope and identity

HEAD and task cut are `eb1e595e43538a6719cc29a73c25f5c39a965b3c`.
Status contains exactly the five allowed paths, including two untracked files; no protected paths or pre-existing tracked tests changed.
The fix-2 log and final tests show that the previously accepted below-minimum and unbracketed extrapolation cases were replaced by structured 422 assertions as required by the amendment; the equal minimum and neighboring valid inputs retain independent numeric coverage.
No tolerance was loosened in the inspected amended tests.
The five hashes below matched the Worker report and remained unchanged after independent checks.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `fb73e8527ac65b6245df8aed0419228a08f5133bb6129c23b179b1896b4ad1ee` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `e8d422ebff3437738dd3d9f02c61d824f13f75d730c8414034eff28dd95d04f7` |

## Independent checks

Under the exclusive checks lock, `uv run pytest -ra -s tests/test_spectrogram.py tests/test_spectral_dsp.py tests/test_server.py` returned 65 passed, 30 skipped, and one Starlette dependency deprecation warning in 27.35 seconds.
All skips identify unavailable CUDA or MPS devices.
The suite includes the failed-flight, strict-JSON, cache, pooling and amended log-boundary tests.

The cold test generated a PCM16 mono 48 kHz, 600-second fixture and used a fresh CPU child with isolated `VSR_HOME`, default 2 GiB cache, authenticated app and cold full-lane request.
The child checked the f16 `(171, 586)` payload and independent frequency and time metadata and exited 0.
Linux `ru_maxrss` was 1,294,336 KiB = 1,325,400,064 bytes = 1.234375 GiB, strictly below 1,610,612,736 bytes (1.5 GiB), without baseline subtraction.

Under the checks lock, `uv run ruff check .` passed, `uv run ruff format --check .` passed for 96 files, and `git diff --check` against the cut passed.
Separate `git diff --no-index --check /dev/null` checks of both untracked files produced no whitespace diagnostics.
The rule check against the cut returned `0 FAIL, 2 REVIEW`:

- `REVIEW T1 tests/test_spectrogram.py:325: marks=pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA unavailable"),`
- `REVIEW T1 tests/test_spectrogram.py:329: marks=pytest.mark.skipif(`, with the MPS-unavailable condition and reason on the following line.

Both are conditional device skips with explicit reasons; the Task Reviewer supplies their final dispositions.
