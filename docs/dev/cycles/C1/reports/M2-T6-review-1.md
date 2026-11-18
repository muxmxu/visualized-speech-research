# M2-T6 independent semantic review 1

**Verdict PASS for the frozen phase tree.** The [independent mechanical audit](M2-T6-audit-1.md) passed. M2.C1 remains open for the prescribed post-squash regression and patch comparison on `master`.

- M2.1 passes on CPU, the only available compute device. The maximum relative power error against calibrated librosa was `1.3508737e-6` above the specified power threshold. M2.2 covers all five layouts, four axes and six value scales, including rejection of a `.pt` containing an arbitrary Python object. [T1 review](M2-T1-review-1.md) · [T2 review](M2-T2-review-3.md)
- M2.3 shows the independently pushed lane in Chromium and verifies named lanes from a dictionary. The benchmark starts with a ready production browser and separate Python sender and measures through first visibility of each named lane. The CPU observations were 224.29, 385.16 and 115.96 ms, establishing the local §17 row-7 median of 224.29 ms. [T4 review](M2-T4-review-2.md) · [T5 review](M2-T5-review-1.md)
- M2.4 verifies shared source-panel dB range and time axes, the symmetric zero-centered difference and PNG `vsr-spec` metadata. M2.5 verifies lazy plotting import and hostname mismatch handling. M2.6 verifies both skill symlinks and preservation of conflicting destinations. [T3 review](M2-T3-review-2.md) · [T4 review](M2-T4-review-2.md)
- Phase regression recorded 233 pytest passes, 23 CUDA skips and 23 MPS skips with both extras installed, 37 Vitest passes and 74 passes in a single actual Chromium worker. Browser coverage includes cold and warm CLI tensor opening, M0/M1 regressions, and the mel and raw feature PDF crop, pixel comparisons, retained selection and zero export requests. Poppler opened nine downloads and confirmed one upright page with one JPEG each. Both rendered Chromium viewer screenshots show page 1 of 1. [T5 review](M2-T5-review-1.md) · [T5a review](M2-T5a-review-1.md) · [M2 acceptance](../../../../acceptance/M2.md)
- M2.C2 records each exit, screenshot paths, performance and deviations. M2.C3 preserves the DESIGN preamble and §§0–20 and appends only D46–D48 to §21, with D49 present exactly once. The protected files match the cut.

The phase rule check returned `0 FAIL, 5 REVIEW`. The T6 increment returned `0 FAIL, 0 REVIEW`. The five inherited findings retain their accepted dispositions.

| Phase location | Disposition |
|---|---|
| `frontend/src/panels/TensorInterpretation.tsx:53` | V1#1 for the HTTP request error boundary. [T5 review](M2-T5-review-1.md) |
| `tests/test_mel_dsp.py:17` and `:23` | DESIGN §20 for the CUDA and MPS availability skips, respectively. [T1 review](M2-T1-review-1.md) |
| `tests/test_plot.py:9` | AGENTS T1 and V5 and DESIGN §§16 and 18 for the optional Matplotlib extra. The phase suite installed it. [T3 review](M2-T3-review-2.md) |
| `tests/test_tensor_lanes.py:196` | V1#8, V5 and DESIGN §§10 and 18 for the optional safetensors extra. The phase suite installed it. [T2 review](M2-T2-review-3.md) |

```text
2e3394bc759ac18b5188f5e622c3733d9936864f                          phase cut
ecd394c76e63282df460e464e49de2cee5a095a3                          merged HEAD
6dd3c1634a446efc4c193160c7fd62f0290137ba                          frozen tree
e85385a8d5787244cba6044d1480505ed69237ed86d28c728a1b7d6ac4b01abd  phase.patch
97e64ae4b95303e6a890b4fb88bd7136048e105045540893a6843b8d467daa1e  worker.patch
fce71d672953682d7fe4c8efbb76165db57737643907a8c9fd7ac36bcb1a6de8  primary-evidence.sha256
c46bec1520991cc8ebaaf5d4ab21f926a6a76a3b64fbdd726b1d2f7506f640df  docs/DESIGN.md
a1d21aec834f31b8f85abbca17d0b6051c96aa3f60639d56ac6965ca07cf6a9f  docs/acceptance/M2.md
2fab06934c94821713cb9bdce0f03742ae762c05ca11a2d606c79987c81d9a8b  tests/bench/m2_show.py
111b6ab4763ee5ee642f618d56332ea4b33357388b0adf7e6c3804220c478b37  tests/bench/m2_show.ts
```
