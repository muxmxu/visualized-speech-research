# M1-T2 semantic review 3

- Verdict **PASS**.
- Issues **none**.
- Required action **none**.
- Covered state is the frozen amended `task/M1-T2` worktree at cut `eb1e595e43538a6719cc29a73c25f5c39a965b3c` with the five hashes below.

## Log-frequency boundaries and transport

Independent authenticated HTTP probes used generated audio and a whole-lane centered Torch STFT with periodic SciPy windows.
The successful responses matched the independent f16 data, accepted `f_axis` endpoints, geometric `row_freqs`, time coordinates and both dB maxima.

| Probe | Observed response |
|---|---|
| 16 kHz, odd `n_fft=9`, `f_hi=3500` Hz, height 1 | `f_lo=0` and `1777.7777777777776` returned structured 422. The representable minimum `1777.7777777777778` included bin one and returned −9.5390625 dB at 2494.438257849294 Hz. One float above at `1777.777777777778` used the bracketed interpolation and returned −11.96875 dB at 2494.4382578492946 Hz. |
| 1.6 kHz, `n_fft=160`, `f_hi=35` Hz | One float below 20 Hz returned structured 422. The exact 20 Hz edge included that bin and returned −9.5390625 dB at 26.457513110645905 Hz. |
| 16 kHz, `n_fft=160`, `f_lo=100` Hz, height 2 | With `f_hi=400` Hz or one float below, the rows were [−15.5625, −9.5390625] dB. One float above moved the 200 Hz bin to the lower row, yielding [−9.5390625, −15.5625] dB. The one-row 100–200 Hz request excluded the 200 Hz bin and returned −15.5625 dB. |
| 9 kHz, odd `n_fft=9`, height 2 | The 1700–4400 Hz viewport kept `f_axis.hi=4400` and centers 2156.2537124838295 and 3468.979534594585 Hz, with the 4 kHz bin contributing −6.13671875 dB to the upper row. The 4050–4400 Hz request returned structured 422, with detail `Log band center outside frequency bins`. |

All rejected requests had exactly the §7 `error`, `detail` and `traceback` fields.
The even and odd boundary cases from review 1 still pass, and the amended assertions retain exact f16 expectations for the valid lower-edge cases while checking structured rejection of the same `f_lo=0` request.
The Worker recorded failing regressions on the old tree before the repair, and the amended tests preserve the original numerical tolerances.
The zero-sample PCM16 case opened successfully and returned `application/octet-stream`, `Cache-Control: no-store`, f16 shape `[2,0]` and a strict JSON header with both maxima null.

## Numerical, cache and concurrency evidence

- The case with odd `n_fft=1025`, odd `win_length=241`, Blackman, a nonbinary hop and a nonzero offset matched direct whole-lane f16 reductions exactly for p=1, 8 and 64 across absolute chunk cut 8176 and the partial terminal group.
- Authenticated cache probes confirmed a 378-byte full entry at the 756-byte half-limit, an 8-byte scalar entry at a 755-byte limit, and hit recency and oldest-entry eviction at 800 bytes.
- Changing channel, window length or lane version used a new key, and moving only the offset reused the entry and changed `col_t0`.
- A Settings request cleared the LRU, and a held old-generation build still completed for its caller without publishing its cache entry.
- With an 8-byte cache and `n_fft=32768`, two one-column viewports exactly matched an independent whole-lane f16 reduction and observed a single scalar scan plus one viewport pass per request, each using `[0,255)`, `[255,510)` and `[510,513)`.
- The scalar reducer kept one running f16 maximum and performed no stack of per-chunk summaries.
- The controlled same-key success case had one real transform and two independently verified absolute viewport outputs, with identical shared columns.
- The unrelated ready-cache request and authenticated ping completed while the owner and waiter were held.
- The controlled failed flight made one build and both structured HTTP 500 responses carried the original exception and detail, then the reservation cleared and a later independent request succeeded.
- The fresh CPU child opened the 600 s, 48 kHz, mono PCM16 wideband fixture with the default 2 GiB cache, checked the first full-lane f16 `[171,586]` response and its frequency and time metadata, and exited 0 at an absolute peak of 1,296,272 Linux KiB, or 1,327,382,528 bytes and 1.236221 GiB.
- M1.3, the cold RSS portion of M1.10, and M1.11 passed on this tree.
- Audit 3 reports 65 passed and 30 device-specific skips in the required suite, with CPU the available device for the applicable M1.5 tests.

## Rule dispositions

The rule check returned `0 FAIL, 2 REVIEW` with no C1 review lines.

| Rule output | Disposition |
|---|---|
| `REVIEW T1 tests/test_spectrogram.py:325` | Allowed by T1 and DESIGN §20 because CUDA is conditionally skipped only when unavailable and the reason is explicit. |
| `REVIEW T1 tests/test_spectrogram.py:329` | Allowed by T1 and DESIGN §20 because MPS is conditionally skipped only when unavailable and the reason is explicit. |

## Performance observation

A primed-cache CPU diagnostic used authenticated in-process HTTP requests and response decoding for a 16 kHz, 2048-point transform over 40–8000 Hz.
Across three measurements over 99–101 columns, the 256-row and 1024-row log median durations were 0.102235 s and 1.966223 s.
The corresponding linear median durations were 0.006993 s and 0.015931 s.
The exact log boundary comparisons in `src/vsr/server/routes_spectrogram.py:91` and the per-row work at `src/vsr/server/routes_spectrogram.py:208` run on ready-cache requests and are relevant to the §17 pan and zoom timings.
These are server diagnostics under the checks lock, and T8 owns the prescribed browser measurements for §17 and the separate warm full-view timing for M1.10.

## Frozen identity

Each SHA-256 matched mechanical audit 3 before and after the independent probes.

| Path | SHA-256 |
|---|---|
| `src/vsr/server/app.py` | `0d9d5e0e9bcd21d8183064768dd903bddc72a30e63946f6313793a65297e62a4` |
| `src/vsr/server/routes_spectrogram.py` | `fb73e8527ac65b6245df8aed0419228a08f5133bb6129c23b179b1896b4ad1ee` |
| `src/vsr/server/session.py` | `825ab9e3fd949312b166a66bab3278872448b0b42da15d562ffb97f3f93925b2` |
| `src/vsr/dsp/stft.py` | `9746eec6c5389236e649064af68891727c4eabd9b1296b48dcee6e0b53f68bfb` |
| `tests/test_spectrogram.py` | `e8d422ebff3437738dd3d9f02c61d824f13f75d730c8414034eff28dd95d04f7` |
