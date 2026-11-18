# M2-T3 independent mechanical audit 1

**Verdict — PASS for the frozen M2-T3 patch.**

The task worktree HEAD was `dff75fbe4272d87d52627a20b0ea894ed10f2cd3`. The index matched the cut. The diff contained exactly `src/vsr/cli.py`, `src/vsr/plot.py`, `tests/test_cli.py` and `tests/test_plot.py`, all within the phase plan's approved write set.

| Check | Result |
| --- | --- |
| Patch and evidence identity | The tracked and untracked binary diffs reproduced the worker patch byte for byte. Reverse application and tracked and untracked whitespace checks passed. All eleven entries in the primary manifest and all four file hashes matched. The four file hashes matched again after the independent focused probe. |
| Protected and public-repository content | DESIGN, including the preamble and each section, AGENTS, LIFECYCLE, the bundled skill, dependency and lock files, frontend, and the rule checker match the cut. Manual inspection and the scan of 547 added lines found no personal or machine information. The scan used the 19 host-contract vocabulary entries and generic path, email, address, agent command and model patterns. |
| Prescribed worker checks | `uv run --extra plot pytest -ra tests/test_plot.py tests/test_cli.py tests/test_presets.py` exited 0 with 30 passed, including all nine plotting cases with Matplotlib 3.11.2. Pytest reported one Starlette TestClient deprecation warning. Ruff lint and format exited 0, with 153 files formatted. |
| Public signatures and figure outputs | The independent probe used the task environment with the Agg backend under the shared checks lock. All four T3 signatures matched DESIGN §16. A sample-aligned comparison with waveforms produced five shared time-axis panels, common spectrogram limits of `[-80, 0]` dBFS, a symmetric difference range with zero at the midpoint, and a central-bin difference of `6.02060032` dB. An independent PNG read recovered the exact `vsr-spec` string and `pdfinfo` recovered both spec lines in PDF Keywords. |
| Installer | Running the actual `vsr skill install --claude --codex` console entry point in a temporary user home created both symlinks to the bundled skill and accepted a second invocation. In a separate temporary home with a pre-existing destination, the command exited 2, preserved the destination content, and left the other destination absent. |

The independent rule checker exited 0. Its sole REVIEW flags the reasoned conditional import of the declared optional `plot` extra. The bound run exercised every plotting test. Semantic disposition remains with the Task Reviewer.

```text
REVIEW T1 tests/test_plot.py:8: pytest.importorskip("matplotlib", reason="Static plots use the optional 'plot' extra")
0 FAIL, 1 REVIEW
```

```text
0f450066c6bc8137c7b43c8de8d341f19d7a1ae84cafb2500c562d1197f8f766  worker.patch
45883d9a5f02c387dc6451cb051ca1f0debc1951ba75d71a13b58e6fedcf1f36  primary-evidence.sha256
26ea7ee7d52e27a02004553a96b98a740c4010068a3891478bbee474eba6fda4  src/vsr/cli.py
26ebf01395f9c5edc05453c4bb2874e79da9e317cb7a47ac2826b06bc6c18520  src/vsr/plot.py
db4389b035ebec95e41312e89f3df466fcc10ddc43d2e3b2cef778ed59e2f5c1  tests/test_cli.py
aa92d1969003afd48366c98edabaf989891943fc96572a28d74f6a3fbaec3522  tests/test_plot.py
```
