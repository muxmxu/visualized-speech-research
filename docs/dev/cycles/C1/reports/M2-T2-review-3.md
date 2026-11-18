# M2-T2 independent semantic review 3

**Verdict PASS.**
The reviewed cut and task HEAD are `84486e6ffd0209eee1d5b1e2357334f431f04a74`.
The frozen seven-file patch is `979d0ba8b7c670d30d669a540739cff6a793546bcdb40f452d62ceb63b19b4ad`.
The review confirmed every source and test hash and all 16 entries in the evidence manifest identified by `00b4d9fd8cafffb148a531e688f25e3f9b2d99ccf723dc43d5b91906b2ff775d`. [Mechanical audit 3](M2-T2-audit-3.md)

## Amendment findings

- The shared file and push interpreter flips the unsigned sign bit at the original bit width and views the result as a same-width signed integer before converting to float32 (`src/vsr/io/tensors.py:172`).
  In two's-complement representation this is exact subtraction of the original dtype's midpoint.
  The stored float32 samples are divided once by that midpoint, and the signed and floating-point paths retain their existing normalization.
- Both authenticated file-to-PCM tests failed on the review-2 code, where the midpoint and its two neighbors all became zero.
  Both tests passed on the amended code with exact float32 PCM `[-2**-31, 0, 2**-31]` for uint32 and `[-2**-63, 0, 2**-63]` for uint64 (`tests/test_tensor_lanes.py:570`).
  The format suite retains exact signed, uint8 and float32 assertions.
- The change from review 2 is limited to this conversion and the two new test cases.
  Browser-safe key paths, raw f32 viewport values, finite f16 validation before lane publication, first partial group centers, and the constant `col_dt` contract remain as reviewed.
  T5 must consume raw f32 frames and the existing f16 frames for dB-like scales.
  Response headers and the STFT path retain their accepted contracts. [Semantic review 2](M2-T2-review-2.md)
- The final selected suite passed 148 tests with two unavailable-device skips, and the independent focused format and PCM suite passed 14 tests.
  Ruff, whitespace, scope and protection checks passed.

## Rule disposition

`REVIEW T1 tests/test_tensor_lanes.py:117` is allowed under V1#8, V5, DESIGN §§10 and 18.
The conditional skip states its dependency and both safetensors cases executed in the bound suite.
