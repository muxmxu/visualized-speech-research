# M6-T3 independent mechanical audit 1

**PASS for the frozen M6 phase tree.**

- The first-parent merges from `5897cd7c7a67e99d53d5299efd27e3a2f0580837` use the accepted T1 and T2 tips in order, ending at `81751b5596b8313e1a5930f8e84c546fbd63e364`. The 16 source and test paths match the accepted patches. The only remaining changes are the approval report and DESIGN's one-line D54 append. Independent reconstruction and application produced the exact frozen patch and tree.
- Protected paths and prior DESIGN bytes matched. Whitespace and the public-scope scan on 1,747 additions passed. The rule checker returned `0 FAIL, 6 REVIEW`; the four frontend HTTP boundaries and two backend analyzer/scan error boundaries use their task dispositions. Public signatures passed after correction of an audit expectation, with no runtime change.
- The retained runner exited zero for locked setup, full pytest, Ruff, npm install, typecheck, Vitest, ESLint, both builds, both browser groups, and restore and cleanup. It records 268 pytest passes, 46 device skips, 37 Vitest passes, and 78 distinct Chromium passes across 12 files. The JSON inventories establish the real dataset case and 77 prior cases are disjoint. The original orchestration process exited 143, while its detached runner completed with all command exits zero.
- The real Dataset flow covers scan, filtering grouped LTAS curves, and CLI-equivalent export. The frozen screenshot is `frontend/test-results/screens/M6-datasets.png` (1440 × 960). Tested product and test modes and blobs match the freeze. The audit reused retained test evidence.

```text
628dba7661f260ed475e8cb3ee204438c2537436                          candidate tree
81f4598a7c6fc887be741480db197da54ce0a8eeda96b7a68aa45583c58957b4  phase.patch
6dca10866c5615c3eb9270a969c37ca91613489fcdb830df5459fae28cc27504  candidate.sha256
1b91c6b36ddc85ebd0534b5531f2919a160d7a27df87dd307042b78a1dcc8552  M6-datasets.png
```
