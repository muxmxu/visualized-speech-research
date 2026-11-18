# M1-T2 mechanical audit 1

Verdict: PASS for the mechanical checks on the frozen tree; the C1 REVIEW requires semantic disposition by the Task Reviewer before acceptance.

## Scope and identity

The cut and HEAD are `eb1e595e43538a6719cc29a73c25f5c39a965b3c`.
The working-tree status contains exactly the five allowed paths: three modified tracked files and two untracked new files.
The untracked files were included in the inspection, rule check, whitespace checks, and hashes below.
No protected file or existing test was changed, so no existing numerical tolerance or assertion was weakened.
The tracked diff preserves the public `stft_db` signature and does not change configuration, dependencies, or bundled presets.
A scan of the two new files found no home paths, email addresses, URLs, IP addresses, or private-key markers.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `533cf40522f1143cd171d79fd0b224d811cd0bcde3340a03a2de9270b848538a` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `0afb4500785c0097f642767d0153e6dfaffb23581e8cf9aa2835fcdcef95b708` |

Hashes matched before and after the checks.

## Independent checks

Under the exclusive checks lock, `uv run pytest -ra -s tests/test_spectrogram.py tests/test_spectral_dsp.py tests/test_server.py` returned 53 passed, 30 skipped, and one Starlette dependency deprecation warning in 25.55 seconds.
All 30 skips identify unavailable CUDA or MPS devices, including one of each in the new spectrogram test.
The cold test generated a PCM16 mono 48 kHz, 600-second fixture and used a fresh CPU child with isolated `VSR_HOME`, the default 2 GiB cache, an authenticated app, and a cold full-lane request.
The child decoded f16 shape `(171, 586)` and checked the independent frequency and time metadata; it exited 0.
Linux `ru_maxrss` was 1,294,848 KiB = 1,325,924,352 bytes = 1.234863 GiB, strictly below 1,610,612,736 bytes (1.5 GiB), without baseline subtraction.

Under the same lock, `uv run ruff check .` passed, `uv run ruff format --check .` passed for 96 files, and `git diff --check` against the cut passed.
Separate `git diff --check --no-index /dev/null` checks of both untracked files produced no whitespace diagnostics.
The only `clamp` occurrence in the changed DSP file carries the DESIGN §8.1 formula reference.

`python3 scripts/check_diff_rules.py --base eb1e595e43538a6719cc29a73c25f5c39a965b3c` returned `0 FAIL, 3 REVIEW`:

- `REVIEW C1 src/vsr/server/routes_spectrogram.py:83: except BaseException as exc:`: semantic disposition required; the handler removes the in-flight reservation, forwards the exception to waiters, and re-raises it. V1 restricts exception handling to listed boundaries while the rules retain resource cleanup; the Reviewer must decide whether this implementation is permitted and whether cleanup can be expressed within the allowed boundary.
- `REVIEW T1 tests/test_spectrogram.py:310`: CUDA conditional skip states `CUDA unavailable`.
- `REVIEW T1 tests/test_spectrogram.py:314`: MPS conditional skip states `MPS unavailable`.

The semantic review remains responsible for numerical equivalence, cache and concurrency behavior, transport, and the final dispositions of all REVIEW lines.
