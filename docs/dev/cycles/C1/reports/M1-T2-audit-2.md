# M1-T2 mechanical audit 2

Verdict: PASS for the mechanical checks on the frozen fix-1 tree; semantic review and the two REVIEW dispositions remain required.

## Scope and identity

HEAD and task cut are `eb1e595e43538a6719cc29a73c25f5c39a965b3c`.
Status contains exactly the five allowed paths, including two untracked new files; no protected paths or pre-existing tracked tests changed.
The prior untracked test file was recovered from the fix-1 log and its SHA-256 matched audit 1; comparison found no removed or weakened assertions or tolerances.
The existing coalescing test changes its waiter observation to follow the new future implementation, and seven test cases are added.
The five hashes below matched the Worker report and remained unchanged after the independent checks.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `d19fa70b78781ee2c92a0f392092b08e754a17aa0a3a7533474919b55da389df` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `bae542c489030ab89db41b5951a87c8aa821b634a558744cac1fc851637a1531` |

## Independent checks

Under the exclusive checks lock, `uv run pytest -ra -s tests/test_spectrogram.py tests/test_spectral_dsp.py tests/test_server.py` returned 60 passed, 30 skipped, and one Starlette dependency deprecation warning in 27.44 seconds.
All skips identify unavailable CUDA or MPS devices.
The failure-flight test establishes the waiting request before releasing a failing build, observes two HTTP 500 responses with the original `flight failed` detail and one build, then observes a successful fresh request and a second build.
The current owner path uses a Future and a `finally` that removes the reservation and shuts down its executor; the previous internal `except BaseException` is absent.

The cold test generated a PCM16 mono 48 kHz, 600-second fixture and used a fresh CPU child with isolated `VSR_HOME`, default 2 GiB cache, authenticated app and cold full-lane request.
The child checked the f16 `(171, 586)` payload and independent frequency and time metadata and exited 0.
Linux `ru_maxrss` was 1,295,280 KiB = 1,326,366,720 bytes = 1.235275 GiB, strictly below 1,610,612,736 bytes (1.5 GiB), without baseline subtraction.

Under the checks lock, `uv run ruff check .` passed, `uv run ruff format --check .` passed for 96 files, and `git diff --check` against the cut passed.
Separate `git diff --no-index --check /dev/null` checks of the two untracked files produced no whitespace diagnostics.
The rule check against the cut returned `0 FAIL, 2 REVIEW`:

- `REVIEW T1 tests/test_spectrogram.py:325: marks=pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA unavailable"),`
- `REVIEW T1 tests/test_spectrogram.py:329: marks=pytest.mark.skipif(`, with the MPS-unavailable condition and reason on the following line.

Both are conditional device skips with explicit reasons; the Task Reviewer supplies their final dispositions.
The semantic review also covers the log lower-bound handling and the Decimal near-integer adjustment.
