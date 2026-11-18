# M2-T6 independent mechanical audit 1

**PASS for the frozen phase tree and pre-squash evidence.**

The cut is `2e3394bc759ac18b5188f5e622c3733d9936864f` and the final merge is `ecd394c76e63282df460e464e49de2cee5a095a3`.
The six first-parent merges follow T1, T2, T3, T4, T5 and T5a in order, with the accepted second parents, reviewed patch hashes and expected merge trees.
The accepted D49 architecture commit is an ancestor of both the cut and T5a.
The unstaged integration delta contains exactly `docs/DESIGN.md`, `docs/acceptance/M2.md`, `tests/bench/m2_show.py` and `tests/bench/m2_show.ts`.

- All 139 primary manifest entries matched. All 22 entries in `final-exits.tsv` were zero. The full check sequence installed both extras and recorded 233 pytest passes, 23 CUDA skips and 23 MPS skips, passing Ruff checks, passing front-end install, typecheck, lint and builds, and 37 Vitest passes.
- The first Chromium attempt exited 130 after test assets placed through a symlink failed the static-path check. The final single-worker run used the identical assets in a regular directory and exited 0 with 74 expected passes and zero failures, skips, flaky cases or run errors. This included the M0/M1 regressions, cold and warm Tensor CLI launch, the separate Python sender and mel and feature PDF export.
- All five screenshot paths in the acceptance report resolved to their frozen PNGs. Poppler opened and rasterized nine actual downloads and confirmed a single upright page and one JPEG of matching dimensions in each. The final Chromium viewer captures displayed page 1 of 1 for M1 `scroll-lanes.pdf` at 1009 × 509 and M2 `mel-feature.pdf` at 1010 × 512. The initial viewer captures were blank and a subsequent extension probe timed out. The successful reader evidence is the rendered captures and the Poppler exit. The auxiliary shell wrappers did not capture the raw exit from the final viewer capture.
- The CPU §17 row-7 samples were 224.288, 385.161 and 115.964 ms, with an independently computed median of 224.288 ms. The production browser and the separate sender were ready before timing a 1 s, 24 kHz mono float32 sine through first appearance of each named lane. The platform performance record confirms this is the first Raspberry Pi 5 CPU measurement for row 7.
- The protected paths and configuration matched the cut. The DESIGN preamble and §§0–20 were unchanged, and §21 appended exactly D46–D48 with one existing D49. The documented route, implemented §16 signature and §18 path checks passed. The phase rule check returned `0 FAIL, 5 REVIEW`, all with inherited dispositions from T1, T2, T3 and T5. The integration delta returned `0 FAIL, 0 REVIEW`.
- The public-content check passed. The initial scan misclassified the NumPy slice `[::2]` as an address and the documented `vsr skill install --claude --codex` command as an agent invocation. Direct inspection confirmed both are project content. The executor reported that the phase-owned check processes had exited and the check and Git locks were available.

I reproduced both frozen patches byte for byte using `git diff --no-color --no-ext-diff --binary <base>` followed by `--no-index /dev/null` diffs in path order for the three new files. The two patches independently produced the same frozen tree in the executor evidence. The acceptance report records every exit criterion and leaves M2.C1 pending the prescribed `master` regression.

```text
6dd3c1634a446efc4c193160c7fd62f0290137ba                          frozen tree
e85385a8d5787244cba6044d1480505ed69237ed86d28c728a1b7d6ac4b01abd  phase patch from 2e3394b
97e64ae4b95303e6a890b4fb88bd7136048e105045540893a6843b8d467daa1e  integration patch from ecd394c
fce71d672953682d7fe4c8efbb76165db57737643907a8c9fd7ac36bcb1a6de8  primary evidence manifest
```

The D38 integration executor must compare the squash with the audited phase patch and run the prescribed checks on `master` after the independent semantic review passes.
