# C1 M1-T2 executable task plan

## Scope and handoff

Deliver the audio STFT spectrogram viewport in DESIGN §§4, 6, 7 and 8.3 with the existing §16 STFT calibration, covering M1.3, the cold RSS portion of M1.10, M1.11 and the applicable M1.5 device cases.
Start `task/M1-T2` from `eb1e595e43538a6719cc29a73c25f5c39a965b3c`, the clean, reviewed `task/M1-T1` commit whose eight changed-file hashes match the T1 final audit and review.
The Controller binds the live task worktree and cut commit, temporary home, dependency environment, devices and exclusive locks in the dispatch ledger.
M2 owns mel DSP, mel views and feature-lane rendering under DESIGN §19.
T3 owns the masked PCM path, T4 owns rendering, and T8 owns the separately measured cached M1.10 full-viewport time and §17 platform comparisons.

The only tracked write paths are `src/vsr/server/app.py`, `src/vsr/server/routes_spectrogram.py`, `src/vsr/server/session.py`, `src/vsr/dsp/stft.py` and `tests/test_spectrogram.py`.
The last file also owns the fixture generator and cold subprocess harness.
Keep the worker's ignored tool caches, VSR_HOME, generated WAV and subprocess output in its worktree or assigned temporary directories.
Use one writer, one exclusive checks lock and one device run at a time.
Preserve all existing routes and public signatures, the config schema and defaults, the bundled presets, the acceptance thresholds and the locked dependencies.
Inherited authorization limits and D38 apply to Git transactions, and the Worker supplies the reviewed diff and evidence to the Controller.

## Existing entry points

- Register the designed `GET /api/lanes/{lane_id}/spectrogram` before the existing static catch-all using the app's authentication and error handlers.
- Use a synchronous endpoint or the existing threadpool boundary for blocking work and waiter synchronization so the ASGI event loop can continue serving other requests.
- Use `load_config()["cache_bytes"]` at app creation and the existing `Session` and shared `_heavy_compute` semaphore in `server/app.py`, which T1 already uses for Welch.
- Validate finite times and frequencies, positive dimensions and hop, selected channel, the STFT window and compatible transform settings at the HTTP boundary.
- Under `Session.lock`, use the same missing-lane and channel error conventions as existing rendering routes and capture the selected CPU data reference, sample rate, version and project offset.
- Hold only bounded source slices for compute and leave the lock before waiting on a computation or doing DSP, pooling or encoding.
- Convert the viewport against the captured offset and add it to the returned time coordinate.
- Use `encode_frame` for one C-order f16 matrix, with `application/octet-stream`, `Cache-Control: no-store` and the §8.3 metadata fields.
- Derive `rows`, `cols` and `view_db_max` from the outgoing f16 matrix, with `row_freqs`, `f_axis`, `col_t0` and `col_dt` describing that matrix.
- Use the existing HTTP error body for malformed requests, including a transform whose single f16 column exceeds the specified 8 MiB chunk cap.
- Represent off-lane views with zero columns, following the existing waveform treatment of empty coverage, and use JSON null for the empty viewport maximum.

## Chunked transform and cache

1. Reuse the T1 periodic SciPy window and calibrated magnitude-to-dB calculation in a shared internal STFT path, preserving `vsr.dsp.stft_db(x, sr, **params)`, its defaults and CPU result tuple.
2. Compute `F = n_fft // 2 + 1` and `T = 1 + (N + 2 * (n_fft // 2) - n_fft) // hop` when a frame fits the real padded length, as in the whole-lane centered Torch transform.
3. For a block of absolute frames `[k0,k1)`, extract source samples in `[k0*hop-q,(k1-1)*hop-q+n_fft)` with `q = n_fft // 2` and zero-fill only the portion outside the physical lane.
4. With this support, an uncentered block STFT has the same centers and centered in-frame window as the whole-lane reference, including odd FFT and window lengths.
5. Bound each chunk to `floor(8*2**20/(2*F))` f16 columns, transfer the bounded float32 result to CPU, quantize on CPU, write into a preallocated CPU f16 base, and build ×8 and ×64 CPU f16 maxima while traversing the chunks.
6. Split completed pyramid groups on absolute frame multiples and merge a group spanning two chunks before publishing the immutable entry.
7. Compute the lane maximum across the calibrated float32 chunks before f16 rounding and use the same definition for full and scalar-only entries.
8. Key by lane id, content version, selected channel, mode and the resolved STFT parameters, with transform-specific mel parameters applicable when M2 implements mel.
9. Exclude project offset and viewport geometry from the key, so a metadata-only lane move changes coordinates without changing the source transform.
10. Account for owned numeric bytes of the base, both pyramids and the scalar under the Session LRU, updating recency on hits and evicting the oldest entries until the insertion fits.
11. Determine admission from the projected full entry size before any base allocation, and if it exceeds half the configured budget, run the absolute chunk loop once in scalar-only mode and store its scalar in the same bounded LRU.
12. For oversized entries calculate only the absolute groups intersecting each request, including their boundary frames and source support, and reduce them in bounded chunks into the viewport with the same arithmetic as the cached path.
13. Use ×8 for `8 <= p < 64` and ×64 for `p >= 64` on full-cache hits, and group from absolute frame zero for both pyramids.
14. Snapshot or synchronize device selection through the existing compute-device accessor and serialize full-lane work with the shared semaphore.
15. Clear full and scalar entries at the existing Settings device-change seam, and coordinate invalidation and in-flight publication so an earlier device result cannot repopulate the cleared generation.
16. Keep the existing compute-device self-check and report behavior, and allow already-started requests to hold their consistent snapshot through completion.

## Request coalescing and absolute grid

Reserve a single in-flight result under the cache lock before cold computation and publish or complete it exactly once for that key.
Release the lock before waiting or taking the shared semaphore, and allow ready cache hits to slice and pool without that semaphore.
Requests with different viewports and the same key share the full result or scalar scan and each use their own viewport geometry afterwards.
Clear the in-flight reservation on failure, propagate the original error to current waiters through the app's existing HTTP boundary, and allow a later independent request to acquire the key.
Avoid a request retry, a background job surface or a new route.

Select existing frame centers in the inclusive project-time interval, with float64 coordinate arithmetic and the captured lane offset.
Compute p from that count, with p = 1 up to the width and the next power of two of count / width otherwise.
Return every absolute p-wide group touched by those centers, including available group members outside the requested interval.
Reduce the physical lane's partial terminal group using its available frames and keep the nominal absolute group midpoint in the uniform coordinate grid defined by `col_t0` and `col_dt`.
Select linear bin centers inclusively, pool successive groups of `ceil(bin_count/height)` when needed, and derive the row frequencies and axis bounds from the selected frequency support.
Build log bands from the effective low and high bounds with the physical lower limit `max(20,sr/n_fft)`.
Use a half-open log band maximum when it has bin centers and otherwise interpolate the time-pooled dB at the geometric center in Hz between adjacent bins.
Use CPU calculations for reductions on stored f16 data and a float32 or higher interpolation value before the final f16 encoding.

## Independent numeric oracles

| Input | Expected result calculated before implementation |
|---|---|
| Odd framing on 32 samples at sr=32, n_fft=9, win_length=6, hop=4. | q=4, F=5 and T=8, centered at samples 0, 4, …, 28. Chunk `[3,6)` reads samples `[8,25)` and produces centers 12, 16 and 20. The first frame uses four left zeros and sample 32 is absent. The even n_fft=8 companion has T=9 and includes center 32. |
| Off-phase interval on frames 0–31, h/s=0.125 s, offset=0.5 s, width 4, with selected centers 5–17. Use a 0.25-frame margin around each endpoint to place the query edges between centers. | n=13 and p=4. Groups 4–7, 8–11, 12–15 and 16–19 return `cols=4`, `col_t0=1.1875` s and `col_dt=0.5` s. Shift the interval by 0.5 s to select centers 9–21, then require the first window's last three columns to equal the second window's first three columns. Give frames 4 and 19 distinct maxima to expose viewport-edge truncation. |
| Log at sr=16000, n_fft=512, 40–80 Hz, height 2, with dB at bin centers `-80+f/10`. | Boundaries are 40, 56.5685424949 and 80 Hz. Row frequencies are 47.5682846001 and 67.2717132203 Hz. The first band interpolates between bins at 31.25 and 62.5 Hz, giving −75.24317154 dB or −75.25 after f16 rounding. The second band uses the 62.5 Hz bin and gives −73.75 dB. |
| Linear at sr=16000, n_fft=512, 25–160 Hz, height 2. | Centers 31.25, 62.5, 93.75, 125 and 156.25 Hz form one group of three and one group of two. Expected row centers are 62.5 and 140.625 Hz, with independently computed max in each group. |
| F=5 and T=32 at n_fft=8, hop=4, N=124. | Base 320 B, ×8 layer 40 B, ×64 layer 10 B and scalar 8 B give 378 B of numeric payload. A limit of 756 B admits an entry exactly at half, allowing two. At 755 B the same entry is scalar-only. Warm A, fill B, hit A, then fill C at 800 B to evict B. |
| Cold M1.10, 600 s × 48000 Hz, n_fft=1024, hop=48. | N=28800000, F=513 and T=600001. A full chunk holds at most 8176 columns. The base uses 615601026 B, ×8 uses 76951026 B and ×64 uses 9619776 B before the scalar. The complete entry fits below half the default 2 GiB budget. |
| M1.10 viewport, width 1024, height 256, linear 0–8000 Hz and offset 0. | p=1024, with 586 columns, 171 rows and payload shape `[171,586]`. First and last row frequencies are 0 and 7968.75 Hz. `col_t0=0.5115` s and `col_dt=1.024` s; the last group starts at frame 599040 and contains existing frames up to 600000. |

Use an independent unchunked centered transform with the specified periodic window and calibrated magnitude as the framing reference.
On the T1 CPU tree a probe of the even and odd frame fixtures matched the centered reference exactly after f16 conversion, with maximum float32 differences of 0.0000114441 and 0.0000038147 dB, respectively.
For off-phase endpoint tests, compute expected indices by enumeration of reference frame centers and reduce direct slices with handwritten group boundaries, avoiding the implementation's chunk and grid helpers.
Cover endpoints that land exactly on frame centers and endpoints just outside those centers with a nonzero lane offset, including a nonbinary hop duration.
Apply the f16 conversion to the independent values and compare decoded values at the appropriate f16 precision, leaving T1's numerical tolerances intact.
Use a case that crosses a real chunk cut unaligned to ×64 and has a peak straddling that cut, and compare both pyramid paths and the clipped terminal group to direct maxima on the whole-lane reference.
Use a generated lane with quiet and loud regions, and verify full-lane max is stable across pans and between normal and forced-oversize cache budgets while local `view_db_max` changes.
Exercise the scalar-only path with two narrow viewports whose absolute groups intersect, validate their shared pixels against direct maxima, and observe the one full scalar scan plus bounded requested frame ranges on both responses.
Check a fresh transform after a real change of selected channel, content version or transform parameter, reuse after a pure offset change, and exercise device-settings invalidation through the existing route.
Use the Session boundary for a controlled replacement and version increment because M1 provides no edit HTTP endpoint for that mutation.

## Concurrent requests and cold RSS gate

Send two authenticated same-key HTTP requests with different off-phase viewports through the same app, using a barrier or events to establish that the second request has reached the in-flight entry before releasing the first computation.
Observe actual full-lane execution with a counting wrapper that calls the real code, assert one transform build and decode both responses against their independent absolute-group expectations.
Assert overlapping columns agree when p is the same, and show that no cache-lock wait or heavy build blocks an unrelated ready cache hit.
Use bounded synchronization waits so an absent coalescing path fails the test instead of hanging.

Generate the exact PCM16 WAV in the parent process using bounded arrays with samples `0.4*sin(2*pi*440*i/48000)+0.2*sin(2*pi*3000*i/48000)` for sample indices 0 through 28799999.
Use a fresh interpreter and app with an isolated temporary `VSR_HOME`, the default cache cap and one selected device, starting on CPU on the current host.
In that child, open the fixture through the real app, authenticate to obtain the lane id, and fully receive and decode its first full-lane GET for 0–600 s with the 48 kHz wideband preset (Hann, win_length 240, hop 48, n_fft 1024), channel 0, size 1024 × 256, linear 0–8000 Hz.
Use the actual authenticated ASGI application, with a loopback server on an ephemeral port if the harness uses network transport.
Assert the payload shape, f16 dtype and independently expected metadata before taking the child's absolute peak `resource.getrusage(resource.RUSAGE_SELF).ru_maxrss`.
Convert Linux KiB to bytes or use macOS bytes, record raw units and GiB, and require strictly less than 1.5 GiB (1610612736 bytes) without subtracting a baseline.
Record the child exit code, device, fixture format and duration, cache cap and cold state, dimensions, raw peak and threshold comparison.
T8 repeats the §17 measurements and records the warmed full-viewport timing separately.

## Checks and return

Run `uv run pytest -ra tests/test_spectrogram.py tests/test_spectral_dsp.py tests/test_server.py` with the cold case included and DSP device parameterization patterned after the T1 CPU, CUDA and MPS cases with stated skip reasons for unavailable devices.
Run `uv run ruff check .`, `uv run ruff format --check .`, `git diff --check eb1e595e43538a6719cc29a73c25f5c39a965b3c` and `python3 scripts/check_diff_rules.py --base eb1e595e43538a6719cc29a73c25f5c39a965b3c` on the final worker tree.
Return actual test counts, skips and reasons, RSS output, base and frozen diff identity, exact changed paths, REVIEW lines for disposition and any failing evidence to the Controller.
The independent Mechanical Auditor reruns the T2 checks and scope/protection audit, then the high-risk semantic Reviewer verifies numerical equivalence, cache memory, concurrency and transport before D38 commit.

## References

- [M1 phase plan and fixture](../phase-M1.md)
- [M1 reconnaissance](recon-M1.md)
- [T1 final mechanical audit](M1-T1-audit-3.md)
- [T1 final semantic review](M1-T1-review-3.md)
- [DESIGN](../../../../DESIGN.md)
- [LIFECYCLE](../../../../../LIFECYCLE.md)
