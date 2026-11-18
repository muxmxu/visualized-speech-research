# M2-T3 independent semantic review 2

**Verdict PASS.**
The task HEAD equals the cut `dff75fbe4272d87d52627a20b0ea894ed10f2cd3`.
The corrected patch is `edee8c8afdde7b7fe1d615396003d005d3a848efae5ff59bfd0812f436ef309f`.
All four worktree file hashes and all fourteen entries of the primary evidence manifest `33d4d5513fd8abc4d8a8b03abf822c698f6d1349d92b947f2e065fcf3a3d6702` matched. [Mechanical audit 2](M2-T3-audit-2.md)

## Findings resolved

- `spectrogram` validates the resolved palette before computing or drawing the heatmap (`src/vsr/plot.py:111`).
  It accepts `magma` and the `gray_r` print palette defined by the bundled skill.
  The seven added cases confirm that disallowed overrides leave the axes untouched.
  The existing comparison tests confirm `magma` on source panels and symmetric `RdBu_r` on signed difference panels. [Semantic review 1](M2-T3-review-1.md)
- Comparison waveforms detach Torch inputs and convert them to CPU float32 before passing their values to Matplotlib (`src/vsr/plot.py:172`).
  This matches the shared DSP's float32 input convention and exactly preserves bfloat16 sample values, with no clipping or amplitude scaling.
  The new two-channel test checks every plotted sample and a peak of `1.25`.
  The waveform samples use the existing shared time-axis calculation. [Semantic review 1](M2-T3-review-1.md)
- Only plotting source and tests changed in the correction.
  The installer and its tests retain their review 1 hashes.
  All eight new tests failed before the correction and passed afterward.
  The selected final suite passed all 38 cases, including all 17 plotting tests and the installer tests. [Mechanical audit 2](M2-T3-audit-2.md)

## Rule disposition

`REVIEW T1 tests/test_plot.py:9` is allowed under AGENTS T1 and V5 and DESIGN §§16 and 18.
The conditional `pytest.importorskip` gives the reason tied to the declared Matplotlib extra.
The required run included the extra and executed every plotting case. [Mechanical audit 2](M2-T3-audit-2.md)
