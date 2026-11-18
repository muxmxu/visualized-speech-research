# 0.2.0 independent mechanical audit 1

**PASS for the local C2 release candidate.**

- The patch on base `8d602fdc42eb8e98ad7d2d8920e271050aa7a36c` changes exactly four approved files. Package metadata and the root lock entry change only from 0.1.0 to 0.2.0. The prior changelog section, locked dependencies, DESIGN, and protected configuration are byte-identical. Independent reconstruction and application reproduced the frozen patch and tree. Whitespace and the public-scope scan of 97 additions passed. The rule checker returned `0 FAIL, 0 REVIEW`.
- The executable, test, and frontend inputs match accepted M5. The retained evidence covers 267 distinct pytest passes after the targeted correction, 46 device skips, 37 Vitest passes, and 77 distinct Chromium passes. The locked metadata checks, routes, signatures, package layout, and plugin example compilation passed.
- The actual 0.2.0 wheel matched its archived hash and passed CRC inspection. All 32 tracked package files and all three web assets matched the accepted inputs. The clean-venv install and dependency check passed. Installed smoke verified HTTP 401/200 for unauthenticated/authenticated session access, HTTP 200 and exact bytes for the home page and production assets, package version, imports, preset resources, and server teardown. The sdist produced before the final documents is retained as intermediate build evidence.
- All three benchmark scripts exited zero. Independent medians from their raw samples match acceptance rows 1–7: 4.459 s, 3.4347 s, 71.3 ms, 6.9 ms, 601.0 ms, 35.74 fps, and 139.861 ms. Rows 1, 4, 5, and 6 regressed beyond the prior sample range. The initial temporary-directory cleanup reported a nonzero exit and its follow-up passed.
- R2.7 remains pending the Human-owned licensing and attribution decision, historical metadata disposition, and final publication scan. The preflight findings are retained locally.

```text
fda06116015df1d36e2eddd584c8910e379d4da9                          candidate tree
fb3ec564477b1302dc6f9781f685b92071747b7c833b643f439a900c88a4e37b  candidate.patch
ce5567c59f016b2508c6fc276e49aeb8a265fa6dec48004bd9b5a512eda64b9b  wheel
f855c308a83d3ee35e28c0c3d14fb582211d0349eda9ceda4157b69dda7f6afe  audit evidence manifest
```
