# M6-T1 independent semantic review 1

**PASS for the frozen backend candidate `199231212a30452efea47a181fc5efaf1984d8b8`.**

- Mechanical audit 1 passed for the exact eight-path patch. The generated 200-file fixture passed, covering recursive and manifest sources, colliding metadata, and a corrupt file retained with its error. The clean-file fixture checks bandwidth within 93.75 Hz of 8 kHz, upsampled bandwidth below 10 kHz, 0.01 clip ratio and 0.1 s leading and 0.2 s trailing silence.
- The HTTP and CLI paths share the CPU scanner, SQLite identity and rows. The fixture checks 199 built-in calls on the initial 200-file scan and zero incremental calls on repeat and after HTTP primes the same-home CLI. It compares CSV columns and values and loads the NPZ without pickle. Paired LTAS mean vectors are finite throughout 100 Hz–7 kHz and differ pointwise by less than 0.5 dB/Hz.
- Source inspection confirmed read-only decoding and manifest reads, rejection of cache and output writes inside scanned directory sources, source-file protection on CLI export, and atomic outputs. Cache identities include thresholds and Scalar source revision, and a Scalar failure keeps the built-in result visible.
- `src/vsr/dataset/scan.py:221` is allowed under `V1#2` and `V1#6`. It isolates the chosen plugin's failure at the per-file boundary and records the error on that row. `src/vsr/server/routes_datasets.py:129` is allowed under `V1#1` as the asynchronous API job boundary. It reports the terminal failure via the standard error fields and traceback. The rule check reported `0 FAIL, 2 REVIEW`.
- The review reused the focused pytest, Ruff and rule evidence. The combined Chromium flow owns visible filtered group count and browser-to-CLI CSV parity.

```text
c3492b349110a075b60ebd90579adc3c52503912b4cce5362c9c992a467108ee  M6-T1.patch
```
