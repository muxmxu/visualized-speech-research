# M6-T3 independent semantic review 1

**PASS for the frozen M6 phase tree `628dba7661f260ed475e8cb3ee204438c2537436`.**

- Mechanical audit 1 passed for the exact phase snapshot. The two ordered merges incorporated reviewed T1 `f6266aa` and T2 `bda8c5a` without code changes. The additional paths are the Chinese acceptance report and the D54 append to DESIGN §21.
- Integrated pytest verifies M6.1–M6.3 on 200 generated files, retaining the corrupt row. It checks 8 kHz bandwidth within 93.75 Hz, upsampled bandwidth below 10 kHz, 0.01 clip ratio and 0.1 s and 0.2 s edge silence. Of 200 rows, 199 entered built-in metrics processing on the initial scan and none did on the repeat. The scanner and CLI read source audio and manifests without writing into them. Outputs and cache location use the accepted source protections.
- M6.4 verifies finite paired LTAS means throughout 100 Hz–7 kHz and a strict pointwise difference below 0.5 dB/Hz. The real Chromium workflow displays two mean curves, applies a table filter and submits only the two stable row indices remaining in one group, then shows one curve. The screenshot is `frontend/test-results/screens/M6-datasets.png`.
- M6.5 verifies zero additional metrics calls after HTTP primes the same-home CLI, including pickle-free NPZ readback. The real browser case separately compares parsed UI and subprocess CLI CSV columns and row values in the same fixture home, checks filtered export, and opens the selected file in Lanes.
- M6.C1 passed with 268 Python passes, 46 device skips, 37 Vitest passes and 78 distinct Chromium passes across the disjoint M6 and previous-milestone groups. M6.C2 and C3 passed. The acceptance report covers each exit, binds the screenshot and lists preceding same-platform §17 measurements. The rule checker retained the reviewed V1#1, V1#2 and V1#6 dispositions.
- This review reused the frozen evidence without rerunning checks. Master delivery verification remains separate.

```text
81f4598a7c6fc887be741480db197da54ce0a8eeda96b7a68aa45583c58957b4  phase.patch
```
