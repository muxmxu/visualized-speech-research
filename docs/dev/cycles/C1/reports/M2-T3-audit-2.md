# M2-T3 independent mechanical audit 2

**Verdict — PASS for the frozen M2-T3 correction.**

The independent Mechanical Auditor ran at `6.2-sol(medium)` against task cut `dff75fbe4272d87d52627a20b0ea894ed10f2cd3` and compared the correction to [audit 1](M2-T3-audit-1.md) and [semantic review 1](M2-T3-review-1.md).

| Check | Result |
| --- | --- |
| Patch and evidence identity | HEAD and the index equal the cut. The diff contains exactly the four approved paths whose hashes appear below. Independent reconstruction reproduced the frozen patch byte for byte. All 14 evidence manifest entries and all four worktree file hashes matched. Reverse application and tracked and untracked whitespace checks passed. |
| Correction scope | The previously audited plotting sources were reconstructed from the original patch and matched their recorded hashes. Only `src/vsr/plot.py` and `tests/test_plot.py` changed. The source delta validates the static spectrogram palette and converts tensor waveforms to CPU float32 before NumPy conversion. The test delta adds seven palette cases and one two-channel bfloat16 waveform case, with zero deletions or edits to existing test lines. The CLI and its tests match audit 1 byte for byte. |
| Red and green | The pre-correction run failed the eight new cases. Six disallowed palettes were accepted, `heat` was rejected by Matplotlib with its own error, and bfloat16 waveform conversion raised `TypeError`. The corrected run passed all eight. Each run deselected the same nine existing plot cases. |
| Final selected suite and static checks | `uv run --extra plot pytest -ra tests/test_plot.py tests/test_cli.py tests/test_presets.py` exited 0 with 38 passed. All 17 plotting cases ran with Matplotlib 3.11.2 and all four public T3 signatures match DESIGN §16. Pytest reported one Starlette TestClient deprecation warning. Ruff lint and format exited 0, with 153 files already formatted. |
| Protected and public-repository content | DESIGN, AGENTS, LIFECYCLE, the bundled skill, dependency and lock files, frontend, and the rule checker match the cut. Manual inspection of the correction and the frozen patch scan found no public-repository findings in 571 added lines using the 19 host-contract vocabulary entries and generic path, email, address, agent command and model patterns. |

The independent rule checker exited 0. The original conditional Matplotlib import remains the sole REVIEW and moved by one line after the torch import. The bound run exercised the full plotting suite.

```text
REVIEW T1 tests/test_plot.py:9: pytest.importorskip("matplotlib", reason="Static plots use the optional 'plot' extra")
0 FAIL, 1 REVIEW
```

```text
edee8c8afdde7b7fe1d615396003d005d3a848efae5ff59bfd0812f436ef309f  worker.patch
33d4d5513fd8abc4d8a8b03abf822c698f6d1349d92b947f2e065fcf3a3d6702  primary-evidence.sha256
26ea7ee7d52e27a02004553a96b98a740c4010068a3891478bbee474eba6fda4  src/vsr/cli.py
50b912eb2a998154cf93b1a582a64f1c3ada840a54a71fc0bf011ec87de39f70  src/vsr/plot.py
db4389b035ebec95e41312e89f3df466fcc10ddc43d2e3b2cef778ed59e2f5c1  tests/test_cli.py
e93558202760301fa7de4bd85e6b5b74afcebe564577abf6802c05bbd41d9ee0  tests/test_plot.py
```
