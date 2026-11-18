# M2-T3 independent semantic review 1

**Verdict FAIL.**
The task HEAD equals the cut `dff75fbe4272d87d52627a20b0ea894ed10f2cd3`.
The frozen four-file patch is `0f450066c6bc8137c7b43c8de8d341f19d7a1ae84cafb2500c562d1197f8f766`.
Before correction began, all four worktree file hashes and all eleven entries of the primary evidence manifest `45883d9a5f02c387dc6451cb051ca1f0debc1951ba75d71a13b58e6fedcf1f36` matched [mechanical audit 1](M2-T3-audit-1.md).

## Blocking findings

1. **Static spectrograms accept palettes that the bundled skill prohibits.** `src/vsr/plot.py:89` passes the preset or override directly to Matplotlib.
   Under the shared checks lock, a generated 1 kHz sine at 8 kHz rendered successfully with each of `cmap="jet"`, `cmap="rainbow"`, and `cmap="hsv"`.
   Each mesh used the supplied palette, and Pillow recovered it in the saved PNG's `vsr-spec` text.
   DESIGN §16 requires static colormaps to follow the bundled skill, which explicitly prohibits these palettes and specifies `magma` and the `gray_r` print option.
   Add regression coverage that the forbidden overrides fail while the supported default and print palettes remain usable.
2. **The optional comparison waveform rejects speech tensors that the shared DSP accepts.** `src/vsr/plot.py:168` converts raw tensors to NumPy at their original dtype.
   Under the shared checks lock, the same generated sine cast to `torch.bfloat16` returned a `1 × 129 × 63` calibrated tensor from `vsr.dsp.stft_db` and produced a comparison with the default `waveform=False`.
   `plot.compare({"GT": tensor}, 8000, waveform=True)` raised `TypeError: Got unsupported ScalarType BFloat16`.
   The optional waveform must support the same floating-point signal and preserve its sample amplitudes and shared time axis.

## Verified behavior

- The four changed paths match the phase plan's plotting and installer write set.
  The protected DESIGN, bundled skill, and dependency declarations match the cut.
  All four T3 function signatures match DESIGN §16. [Mechanical audit 1](M2-T3-audit-1.md)
- The spectrogram and spectrum delegate calculations to shared `stft_db`, `mel_db`, and `welch` and use the packaged preset resolver.
  The executed plotting tests check the labeled millisecond and second axes, the labeled logarithmic Hz axis, HTK mel channel centers with Hz ticks, F0 overlay coordinates in Hz and mel, and colorbar units.
  The LTAS test checks its calibrated dB/Hz peak against the analytic sinusoid result and asserts a p10–p90 interval.
- M2.4's standard comparison cases pass.
  Each source panel uses the same preset, common auto80 limits `[-80, 0]` dBFS in the 2:1 sine fixture, and a shared time axis.
  The signed difference follows the requested pair order, reads approximately `±6.0206` dB at the calibrated bin, and uses a symmetric `RdBu_r` normalization with zero at the midpoint.
  The executed tests also cover identical inputs, mismatched sample counts and channel counts, and scale sharing across displayed channels.
  Independent PNG and PDF reads recovered the recorded spec lines through the save wrapper, and the test confirmed that plain `fig.savefig` omits `vsr-spec`. [Mechanical audit 1](M2-T3-audit-1.md)
- M2.6 passes.
  The actual CLI installed both temporary-home links to the bundled skill directory and accepted a repeat invocation.
  A directory conflict failed with a nonzero exit and preserved the existing contents while leaving the other destination absent.
  The executed CLI tests also confirmed broken-link preservation. [Mechanical audit 1](M2-T3-audit-1.md)

## Rule disposition

`REVIEW T1 tests/test_plot.py:8` is allowed under AGENTS T1 and V5 and DESIGN §§16 and 18.
The conditional `pytest.importorskip` gives the reason tied to the declared Matplotlib extra.
The bound task command included that extra and executed all nine plot tests among its 30 passes. [Mechanical audit 1](M2-T3-audit-1.md)
