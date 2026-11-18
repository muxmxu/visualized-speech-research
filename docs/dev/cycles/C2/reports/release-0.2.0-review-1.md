# C2 release candidate independent semantic review 1

**PASS for the frozen local 0.2.0 candidate `fda06116015df1d36e2eddd584c8910e379d4da9`.**

- Mechanical audit 1 passed for the exact four-path patch. The project and root lock entry advance to 0.2.0. The executable, dependency, frontend build and test inputs match reviewed M5, which supports reuse of 267 Python passes, 46 device skips, 37 Vitest passes and 77 distinct Chromium passes.
- The clean temporary environment installed the newly built wheel with locked dependencies and CPU torch. The installed distribution reported version 0.2.0 and imported the analyzer and DSP modules. The actual CLI served HTTP 401 and 200 at the session endpoint, and the page and production asset bytes matched accepted M5 hashes. Preset resolution, bundled resource access, dependency validation and server teardown passed.
- The seven published three-sample medians match all three benchmark logs and the C1 comparison. Rows 1, 4, 5 and 6 moved beyond the prior sample ranges in the slower direction, and row 7 became faster. The acceptance report preserves the resolved cleanup failure and leaves the main-worktree performance ledger update to local integration.
- The acceptance report preserves pending M4 hardware outcomes and distinguishes WORLD example compilation from execution. Formal R2.7 remains pending B2 licensing and attribution, the historical metadata disposition and the Human publication scan. This review reused retained evidence without rerunning checks.

```text
fb3ec564477b1302dc6f9781f685b92071747b7c833b643f439a900c88a4e37b  candidate.patch
ce5567c59f016b2508c6fc276e49aeb8a265fa6dec48004bd9b5a512eda64b9b  wheel
```
