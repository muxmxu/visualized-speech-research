# M1-T2 semantic review 1

- Verdict **FAIL**.
- Required action **modify**.
- Covered state is the frozen uncommitted `task/M1-T2` tree cut at `eb1e595e43538a6719cc29a73c25f5c39a965b3c`.

## Required fixes

1. `src/vsr/server/routes_spectrogram.py:129–133,192–205` changes DESIGN §8.3 log-band membership and metadata in two cases.
   - For an odd FFT, the upper bound is reduced to the highest bin center, which the last half-open band then excludes.
     A 72-sample float WAV at 9 kHz with samples `cos(2π·4i/9)/3`, Hann, `n_fft=win_length=hop=9`, times 0.00395–0.00405 s, and a 1700–4400 Hz log viewport of height two returns `f_axis.hi=4000`, row centers 2105.48275593 and 3229.66311685 Hz, and an upper-row value of −15.5625 dB.
     DESIGN gives `f_axis.hi=4400`, centers 2156.25371248 and 3468.97953459 Hz, and −6.13671875 dB for the upper row from the 4 kHz bin of an independent centered STFT.
   - The current geometric spacing routine also shifts a mathematically exact shared edge and puts the coincident bin in the wrong band.
     A float WAV with eight 160-sample periods of the 200 Hz tone `cos(2π·2i/160)/3` at 16 kHz, Hann, `n_fft=win_length=hop=160`, times 0.0399–0.0401 s, and a 100–400 Hz log viewport of height two produces an internal edge of 200.00000000000003 Hz and rows [−9.5390625, −15.5625] dB.
     The exact 200 Hz edge belongs to the upper band, so the centered reference yields [−15.5625, −9.5390625] dB.
   - Implement the DESIGN log-band bounds, geometric centers, and inclusive-low/exclusive-high membership for these valid requests.
     Add independent HTTP regressions for both cases and check decoded row values and metadata.
2. `src/vsr/server/routes_spectrogram.py:19–31,208–219` emits invalid JSON for a supported file that yields zero centered frames.
   - A zero-sample mono PCM16 WAV at 9 kHz opens through `POST /api/open` with 200.
     A matching authenticated GET with `n_fft=9`, `win_length=6`, `hop=9`, −1–1 s, linear 0–4500 Hz and height two returns 200 with f16 shape `[2,0]` and literal `"lane_db_max":-Infinity` in its framed header.
     The Python decoder accepts the token, whereas the JSON header format in §6 and browser `JSON.parse` reject it.
   - Resolve the no-frame case with a valid §6 frame or the existing structured HTTP error boundary and add a regression that checks the wire format with strict JSON parsing for any framed success.
3. `src/vsr/server/routes_spectrogram.py:154–173` retains every chunk’s per-frequency maximum in the scalar-only viewport path, then copies those vectors again into a stack.
   - With an 8-byte cache, a 512-sample float WAV at 48 kHz, `n_fft=32768`, `win_length=32`, `hop=1`, width and height one, times 0–0.02 s, and linear 0–1 Hz, the real authenticated request produces a single output value and caches only the scalar.
     An observer on the real stack call recorded three live f16 vectors totaling 98,310 bytes before the stack allocation.
     For a group with `m` chunks this temporary storage grows as `m × 2F`, even though every chunk has already reduced the same frequency bins.
   - Keep one running maximum per output column across chunks so the scalar-only reducer’s auxiliary storage stays bounded independently of the number of chunks.
     Preserve f16 maxima and the same absolute frame coverage.
4. `src/vsr/server/routes_spectrogram.py:70–87` uses a blanket internal exception handler outside the V1 boundaries.
   - The observed owner and waiter behavior is correct for an injected ordinary build error, and all waiters still need to receive the original failure.
   - Refactor completion so the shared flight propagates the original failure to its waiters and resource cleanup releases the reservation without the internal `except BaseException`.
     A managed task or future can carry the outcome with a `finally` for reservation cleanup.
     Keep the existing structured HTTP 500 handler as the error boundary and cover a failed flight followed by a fresh independent request.

## Rule dispositions

| Rule output | Disposition |
|---|---|
| `REVIEW C1 src/vsr/server/routes_spectrogram.py:83` | Defect. `cached_entry` is an internal cache helper, and the handler surrounds the build plus LRU insertion and publication. V1#1 authorizes the HTTP boundary in `app.py`. Cleanup remains required and can use normal future completion with reservation cleanup. |
| `REVIEW T1 tests/test_spectrogram.py:310` | Allowed by T1 and DESIGN §20. The CUDA skip is conditional on unavailability and states its reason. |
| `REVIEW T1 tests/test_spectrogram.py:314` | Allowed by T1 and DESIGN §20. The MPS skip is conditional on unavailability and states its reason. |

## Evidence

- Independent CPU probes ran under the checks lock using generated audio and isolated temporary VSR state.
  All f16 base, ×8 and ×64 values exactly matched direct reductions of independent whole-lane centered STFTs across even and odd FFT and window lengths, including an odd 1025-point transform with a peak at the unaligned 8176-frame chunk cut and a partial final group.
- Absolute time groups use inclusive frame centers, complete intersecting absolute groups and nominal grid midpoints as specified in the task plan.
  Linear row grouping uses inclusive bin centers and outer bin edges with clipping at the physical frequency bounds.
  The audited overlap, exact/nonbinary endpoint, linear group and in-band log interpolation cases passed.
  The two independent log boundary failures above keep the complete M1.3 criterion from passing.
- The audited numeric LRU admits a 378-byte full entry exactly at the 756-byte half-budget limit and uses scalar-only at 755 bytes.
  The audited tests cover hit recency, eviction order, fixed lane maximum across viewport pans, changed channel and transform keys, changed lane version and pure offset reuse.
  Device settings clear the numeric LRU and the generation check prevents an earlier in-flight entry from repopulating it.
- Two controlled same-key authenticated requests produced one real computation and matched distinct whole-reference absolute-group slices.
  The unrelated ready hit and authenticated ping both completed while the build and waiter were held.
  Injecting a build failure returned the same HTTP 500 detail to both requests with one build, and a later independent request succeeded.
  M1.11 passed for this frozen tree.
- Independent HTTP probes returned 401 for a bad token, 404 for an unknown lane, and structured 422 bodies for eight invalid requests including nonfinite time, invalid channel/window/hop and a single column exceeding the chunk limit.
  The normal frame used f16 payload, `application/octet-stream` and `Cache-Control: no-store`.
- Mechanical audit 1 measured the first authenticated 600-second 48 kHz mono PCM16 wideband view in a fresh CPU child with an isolated VSR home and default 2 GiB budget.
  The child checked the f16 `[171,586]` response and independent frequency and time metadata, then exited 0 at an absolute peak of 1,294,848 Linux KiB, or 1,325,924,352 bytes and 1.234863 GiB.
  The peak is strictly below the 1.5 GiB threshold, passing the cold part of M1.10 on this tree.
  T8 owns the warm timing measurement.
- Mechanical audit 1 recorded 53 passed and 30 skips with explicit CUDA and MPS unavailability reasons, plus one dependency deprecation warning.
  CPU was the available device for the independent numerical review.

## Frozen identity

All five SHA-256 hashes independently matched mechanical audit 1 before review and after the probes.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `533cf40522f1143cd171d79fd0b224d811cd0bcde3340a03a2de9270b848538a` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `0afb4500785c0097f642767d0153e6dfaffb23581e8cf9aa2835fcdcef95b708` |
