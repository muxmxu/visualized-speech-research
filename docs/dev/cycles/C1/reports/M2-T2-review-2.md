# M2-T2 independent semantic review 2

**Verdict FAIL.**
The reviewed cut and task HEAD are `84486e6ffd0209eee1d5b1e2357334f431f04a74`.
The frozen seven-file patch is `3c41ef382611951fed6f06bbf9424887183021b7b965045789f596c0cf0aac2b`.
This review confirmed the seven source and test hashes and all 15 entries in the evidence manifest identified by `a56c13adb71db9a59186c941a9f5cd072434fb4934e725efb61c50aaecae06c4`. [Mechanical audit 2](M2-T2-audit-2.md)

## Required correction

Center unsigned samples at their original integer precision before converting to float32.
The shared interpreter currently casts to float32 before subtracting the unsigned midpoint (`src/vsr/io/tensors.py:172`).
An independent authenticated probe under the shared checks lock opened generated `uint32` and `uint64` `.npy` audio containing the three samples immediately around each unsigned midpoint.
Open and same-rate PCM both returned 200 for both files.
Both PCM replies contained `[0, 0, 0]` instead of the exactly representable `[-2⁻³¹, 0, 2⁻³¹]` for uint32 and `[-2⁻⁶³, 0, 2⁻⁶³]` for uint64.
Apply DESIGN §10 bit-depth normalization after removing the offset at integer precision and add framed PCM regressions for the two accepted file dtypes.
Retain the existing signed, uint8 and float32 amplitude assertions.

## Confirmed corrections and contract

- The previous code failed the 11 focused cases and separately rejected the final safely loadable bytes fixture with `Unsupported dictionary key in tensor file`.
  The final suite and independent audit passed all 11 focused cases.
  The selected final suite passed 146 tests with two device-availability skips.
- The covered uint8 file and framed paths now map the midpoint to zero and retain their exact endpoint values.
  Tagged byte and large-number dictionary key components round-trip within the existing `key_path` and preserve distinct PCM selections.
- The first partial pooled feature column is centered at 0.05 s and the mel column at 0.0025 s.
  `col_dt` remains the contract's constant grid spacing, which also positions a trailing partial group following a full first group.
  STFT retains its accepted position formula and all response fields remain in the existing header.
- Raw feature frames use the §6 f32 dtype and preserve `[70000, -80000, 0.125]` with a finite header.
  T5 must consume f32 raw feature frames alongside f16 for the five dB-like scales.
  The four unrepresentable dB-like inputs return the §7 error body with 422 before publishing either lane.
  Existing test assertions are preserved, and the scale cases additionally assert the encoded dtype.

## Rule disposition

`REVIEW T1 tests/test_tensor_lanes.py:117` is allowed under V1#8, V5, DESIGN §§10 and 18.
Dependency absence is a stated skip condition for the declared optional safetensors extra, and both format cases executed in the bound selected suite.
