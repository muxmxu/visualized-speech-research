# M1-T1 mechanical audit 1

Verdict: PASS for mechanical checks; the independent semantic review must dispose the two REVIEW lines below.
The examined task tree is based on `350508d74bdc8b892beeb05492752cd53c9818fb`; the tracked diff SHA-256 is `7466a41ae304549c0208c7cf34ca90a8780197903638084d6b50d30a90112491`.
The tracked diff hash excludes untracked task deliverables; the following hashes bind all eight changed files:

```text
711abc7fde15da18eac94794cc8a32d9679d667e37215d87ffa0cb27b62518f7  src/vsr/__init__.py
b19d8f47ad658dd69d3ad7919c1d934234217322f6675b003b2ca3b1ea867fdd  src/vsr/dsp/__init__.py
4d143a77399913e712bbf9c3d6c092770b1b440d0e4e2286494faf8128147a29  src/vsr/dsp/stft.py
7d7b029753efb1e2fab54cc3f8154bfd7210c98e83e7af0ab93280aaa12c9fa9  src/vsr/dsp/spectrum.py
b6c68cef79cba5377f3b95b0c121ef3ad089a1e3292a9d788582818e416e9521  src/vsr/presets.py
b24bde117e535cfd5a309298134f12d9ca76200a93ccd276b045bd46d874177a  src/vsr/server/app.py
96c1e87fec916cce506ce74dd76522cabe94cbc4ac736f65347e53b7fd5a6192  tests/test_spectral_dsp.py
563cc5b6ebb2c96628157bd9938323706f28cd89cc399247b76e16255e06a364  tests/test_presets.py
```

The changed paths match the T1 write set exactly; no protected files, generated artifacts, binary fixtures, or existing tests changed.
The new tests generate their inputs, use seeded random generators, and test calibration, SciPy Welch, preset conversions, statistics and both routes.
A public-content pattern scan found only the intentionally synthetic `secret` test token; no credential was found.
`git diff --check 350508d` passed.

Under the exclusive checks lock, `uv run pytest -ra tests/test_spectral_dsp.py tests/test_presets.py tests/test_server.py` returned 37 passed and 16 skipped in 3.44 seconds; the skips were unavailable CUDA and MPS devices, with reasons.
`uv run ruff check .` returned `All checks passed!`; `uv run ruff format --check .` returned `94 files already formatted`.
An initial signature probe used incorrect names and raised `AttributeError: module 'vsr' has no attribute 'stft'`; a corrected `inspect.signature` probe under the lock produced:

```text
resolve_preset (name: str, sr: int, **overrides) -> dict
spec_line (params: dict) -> str
stft_db (x, sr, **params) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]
welch (x, sr, stats=('mean',), unit='dbfs', **params) -> tuple[torch.Tensor, torch.Tensor]
active_frames (x, sr)
```

`python3 scripts/check_diff_rules.py --base 350508d74bdc8b892beeb05492752cd53c9818fb` returned:

```text
REVIEW T1 tests/test_spectral_dsp.py:20: marks=pytest.mark.skipif(
REVIEW T1 tests/test_spectral_dsp.py:26: marks=pytest.mark.skipif(
0 FAIL, 2 REVIEW
```

Both are device availability skips with explicit reasons; the Task Reviewer must give each its disposition.
The DSP protection scan found four clamps, all annotated with a DESIGN section: `stft.py:48`, `spectrum.py:52`, `spectrum.py:87`, and `spectrum.py:91`; their semantic correspondence to the formulas requires reviewer verification.
Device scan found numerical input and window tensors use `compute_device()` and float32, with public outputs moved to CPU; available-device execution is covered by the parameterized tests above.
No stage, commit, merge or push was performed.
