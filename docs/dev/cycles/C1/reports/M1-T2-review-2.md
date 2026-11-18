# M1-T2 semantic review 2

- Verdict **FAIL**.
- Required action **modify**.
- Covered state is the frozen uncommitted `task/M1-T2` fix-1 tree cut at `eb1e595e43538a6719cc29a73c25f5c39a965b3c`.

## Required fixes

1. `src/vsr/server/routes_spectrogram.py:129–130,193–208` can exclude the bin at the advertised inclusive log lower edge.
   - Use a 16 kHz float WAV with eight nine-sample periods of `cos(2πi/9)/3`, Hann, `n_fft=win_length=hop=9`, a one-row log viewport ending at 3500 Hz and a time interval around frame four.
     An authenticated request with `f_lo=0` returns `f_axis.lo=1777.7777777777778` Hz and −9.5390625 dB, which matches the first bin of the independent centered transform.
     Requesting that same advertised lower edge, `f_lo=1777.7777777777778`, returns the same `f_axis.lo` and −11.96875 dB because the route excludes bin one and interpolates.
     The request value one float above the lower edge correctly excludes that bin.
   - The calculation compares the exact rational `Decimal(sr)/n_fft` with `Decimal(str(f_lo))`.
     For the representable physical edge above, this yields a bin index offset of +1.25 × 10⁻¹⁷, larger than the code’s 10⁻⁴⁰ snap.
     The snap classifies the exact 200 Hz internal edge correctly in the tested case and preserves the membership change across the neighboring input floats, but it leaves the mixed-representation endpoint error in place.
   - Enforce the §8.3 request minimum `f_lo >= max(20, sr/n_fft)` at the HTTP boundary.
     §7 exposes `f_lo` as a request parameter, and the task plan repeats the physical limit for effective bounds without defining a below-limit request mode.
     At and above the lower limit, compare the query edges and bin centers at a consistent numeric representation, retaining the exact inclusive-low and exclusive-high comparisons.
     For example, validate against the representable bin-one frequency, convert both accepted endpoints and the matching bin centers with `Decimal.from_float`, and resolve exact geometric ties from the boundary relation instead of snapping near-integer bin indexes.
     Add authenticated coverage at the representable physical minimum and at its two neighboring float inputs, and preserve the repaired 200 Hz exact-edge and near-edge behavior.
2. `src/vsr/server/routes_spectrogram.py:217–225` extrapolates empty odd-FFT log bands above the highest bin.
   - With the independently checked 9 kHz, nine-point Hann fixture from review 1, change the log query to 4050–4400 Hz, height two.
     The 200 response gives row centers 4134.7993 and 4309.7618 Hz, above the highest FFT center at 4000 Hz.
     The route clamps the pair to bins at 3000 and 4000 Hz and uses weights 1.1348 and 1.3098.
     The returned values are −4.8671875 and −3.216796875 dB, beyond both source dB values (−15.5625 and −6.13671875 dB) and the full-lane maximum (−6.13859415 dB).
   - Keep §8.3 interpolation within adjacent bins that bracket the geometric center.
     At the HTTP boundary, give requests requiring unbracketed empty bands the structured 4xx response unless the project explicitly defines another behavior.
     Replace the extrapolation expectation in `tests/test_spectrogram.py:635` with the supported boundary behavior.
     Retain the valid 1700–4400 Hz odd-FFT case in which the 4 kHz bin belongs to the upper band.

## Review-1 dispositions on fix-1

- The original 1700–4400 Hz odd-FFT case now preserves `f_axis.hi=4400`, reads the expected centers and returns −6.13671875 dB in the upper row.
  The 100–400 Hz even-FFT case assigns exactly 200 Hz to the upper band, and an independent check with the adjacent lower and higher representable high endpoints confirmed the half-open membership change.
  The two findings above prevent M1.3 from passing.
- A zero-sample PCM16 WAV now opens and returns a valid strict-JSON framed header and f16 shape `[2,0]` with both maxima null for the odd transform.
- The real scalar-only 513-frame request at `n_fft=32768` matched an independent whole-lane transform reduction on two requests.
  One scalar scan and one three-chunk pass per viewport used ranges `[0,255)`, `[255,510)`, `[510,513)`, and the reducer retained a running maximum without stacking chunk summaries.
- The managed future and `finally` remove the review-1 C1 defect.
  Two controlled same-key requests still produced one real transform and independently matched distinct absolute frame pools, and a ready hit and authenticated ping completed while they waited.
  The injected failure reached both requests through structured HTTP 500 responses, the reservation was removed, and a subsequent request succeeded.
- An independent 1025-point, odd-window Blackman HTTP probe matched the whole-lane f16 oracle at p=1, 8 and 64 across the 8176-frame seam and physical partial terminal group, with correct time metadata and linear `f_axis`.
  The device-generation check discarded a late cache publication after the Settings request cleared the prior cache.
  Audit 2 also passed the LRU byte-limit, eviction and cache-key invalidation cases.
- Mechanical audit 2 recorded 60 passed and 30 device skips.
  The cold CPU child decoded the required 48 kHz mono PCM16 wideband view, returned f16 shape `[171,586]` and exited 0.
  Its absolute peak was 1,295,280 Linux KiB, or 1,326,366,720 bytes and 1.235275 GiB, strictly below 1.5 GiB.

## Rule dispositions

| Rule output | Disposition |
|---|---|
| `REVIEW T1 tests/test_spectrogram.py:325` | Allowed by T1 and DESIGN §20. The CUDA skip conditions on device unavailability and states its reason. |
| `REVIEW T1 tests/test_spectrogram.py:329` | Allowed by T1 and DESIGN §20. The MPS skip conditions on device unavailability and states its reason. |

## Frozen identity

All five SHA-256 hashes matched audit 2 before and after the independent checks under the project checks lock.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `d19fa70b78781ee2c92a0f392092b08e754a17aa0a3a7533474919b55da389df` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `bae542c489030ab89db41b5951a87c8aa821b634a558744cac1fc851637a1531` |
