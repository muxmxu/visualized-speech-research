# M2-T2 independent semantic review 1

**Verdict FAIL.**
The reviewed cut and task HEAD are `84486e6ffd0209eee1d5b1e2357334f431f04a74`.
The reviewed seven-file frozen patch is `ac6e4529d274c8c54ba3cf258180fdb22a07fae0311524df4678df6296b76244`, as independently reconstructed in the [mechanical audit](M2-T2-audit-1.md).
The bound Worker suite passed 135 cases with two unavailable-device skips, and the independent audit passed 17 focused cases.
The findings below were reproduced through the authenticated app using generated local fixtures under the shared checks lock.

## Required corrections

1. **Center unsigned integer audio before bit-depth normalization.**
   The common interpreter divides all integer audio by the signed full-scale magnitude without first centering unsigned samples (`src/vsr/io/tensors.py:151`).
   Both a `.npy` file and a `u8` framed push containing `[0, 64, 128, 192, 255]` returned PCM `[0, 0.5, 1, 1.5, 1.9921875]`.
   Under DESIGN §10 bit-depth normalization, the unsigned midpoint is zero and the corresponding PCM is `[-1, -0.5, 0, 0.5, 127/128]`.
   Correct the shared interpretation and cover unsigned file and framed PCM alongside A1's signed and float32 cases.

2. **Use the first returned group's actual frame-center mean for feature and mel.**
   Both new paths use the nominal midpoint of a complete pool group even when the first returned group is the final partial group (`src/vsr/server/routes_spectrogram.py:233`, `:346`).
   A seven-frame feature at 100 frames/s with `t0=0.04`, `t1=0.06` and width 1 returned the correct max of 6 with `col_t0=0.055` instead of the mean 0.05.
   A seven-frame mel request selecting the last three centers at 0.002, 0.0025 and 0.003 s with width 1 returned `col_t0=0.00275` instead of 0.0025.
   Keep the absolute group grid, the specified constant `col_dt`, and existing STFT behavior, and test the representable correction when the first returned group is partial.
   DESIGN §8.3's constant `col_dt` cannot also encode a different center for a trailing partial group when an earlier full group determines `col_t0`.

3. **Return valid framed JSON and preserve raw values.**
   A finite raw float32 feature of 70000 is accepted into the session but its viewport converts it to float16 infinity and returns HTTP 200 with `"view_db_max":Infinity` (`src/vsr/server/routes_spectrogram.py:200`, `:232`).
   The header violates DESIGN §6's JSON requirement and the browser's `JSON.parse` rejects it.
   Preserve raw values in the documented f32 frame dtype under §6 and §8.5, which specifies `raw` as the original value.
   The phase's numeric checks bind f16 for the five dB-like scales.
   For those scales, reject a tensor whose converted values cannot produce a finite f16 frame with the §7 error body before publishing the batch.
   Cover the raw 70000 viewport and the rejected conversion with unchanged lanes.

4. **Make safely loaded dictionary keys round-trip through browser JSON.**
   A weights-only `.pt` dictionary with keys `9007199254740992` and `9007199254740993` reported two numeric paths.
   Both paths resolved to the first leaf after the browser number conversion, returning PCM 0.25 for both picks where the file contains 0.25 and 0.5 (`src/vsr/io/tensors.py:89`, `:121`).
   A safely loaded `.pt` dictionary with a `bytes` key also returned 422 during inspection before listing its tensor leaf.
   Use reversible JSON encodings inside the existing `key_path` for keys that do not round-trip as native browser values, preserve the ordinary string and list-index paths, and verify each discovered key selects its own leaf.

## Rule disposition

`REVIEW T1 tests/test_tensor_lanes.py:116` is allowed under V1#8, V5, DESIGN §§10 and 18.
The skip is conditional on availability of the declared optional safetensors extra, gives its reason, and both safetensors fixtures executed in the bound runs.
