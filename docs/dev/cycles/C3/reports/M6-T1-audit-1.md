# M6-T1 independent mechanical audit 1

**PASS for the frozen dataset backend task.**

- HEAD and index matched `8d602fdc42eb8e98ad7d2d8920e271050aa7a36c`. Exactly eight approved Python paths changed. Their hashes matched. Independent reconstruction, reverse application, and application to the base reproduced the candidate tree. Whitespace, protected paths, locks, frontend, and configuration checks passed.
- The rule checker returned `0 FAIL, 2 REVIEW`. The C1 entry at `scan.py:221` is the analyzer execution and per-row error boundary under V1#2 and V1#6. The C1 entry at `routes_datasets.py:129` reports a terminal scan-job error to the client with the standard error fields under V1#1. The privacy scan and inspection of 1,004 additions found no private content. One vocabulary match was an ordinary loop variable.
- Retained evidence records one focused SQL and scanner pytest pass, one existing TestClient deprecation warning, and successful Ruff lint and formatting on all eight paths. No passing check was repeated.

```text
199231212a30452efea47a181fc5efaf1984d8b8                          candidate tree
c3492b349110a075b60ebd90579adc3c52503912b4cce5362c9c992a467108ee  M6-T1.patch
fd3e78147eca4cd8a5ca7990331c323b5909abbe4167927f562642f5ea4e6a11  audit evidence manifest
```
