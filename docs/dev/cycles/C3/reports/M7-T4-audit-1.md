# M7-T4 independent mechanical audit 1

**PASS for phase tree `d0bf515eba76007b0429c3719b5e53800fc07bff`.**

- The `master` base was `9bd9c93a4b555a1c872c8e9fbcb2b5a01d47bf21`. Phase HEAD `5c2694b3a3e5917b092b52a5d4bbedb8ed975cb8` has tree `ffcfed53a082f7c4836473b0f75dcb7f7240564e` and merges the exact accepted T1, T2 and T3 tips in order. All 17 changed code and test paths match the accepted task blobs and modes.

| Task | Accepted reports | Merged tip | Accepted task tree |
| --- | --- | --- | --- |
| T1 | `M7-T1-audit-2.md`, `M7-T1-review-2.md` | `37be2aebff628338434b8d182fa8f84828eca014` | `2b4accafc59212f665ec604f6cfb4ca19ab8e707` |
| T2 | `M7-T2-audit-2.md`, `M7-T2-review-2.md` | `abb69ebb1f6f8b6d15cdeb3e8fe2b206ab83ec18` | `a97f3e8db2f8c37e7edd5cc53048707a204ae111` |
| T3 | `M7-T3-audit-1.md`, `M7-T3-review-1.md` | `bcc31fa8d07ad421b4de66ec98b876849720c934` | `1c26753ba96b1b2399e63afc225f919b70fe3616` |

- The phase index matched HEAD. The temporary audit index captured the only two worktree changes, `docs/DESIGN.md` and `docs/manual-checks.md`. DESIGN matches the base byte for byte through D55 and appends one D56 line in §21. Protected configuration, the bundled skill, dependency manifests and lockfiles match `master`.
- The phase-root rule check returned `0 FAIL, 4 REVIEW`, and `git diff --check master` passed. The four C1 entries at `Rir.tsx:173` and `RirArrival.tsx:80`, `:89` and `:171` match the V1#1 dispositions in `M7-T3-review-1.md` for the analysis, waveform, automatic reference and manual sample request boundaries.
- Retained integration evidence under `tmp/M7-T4-evidence.2/` records runner exit 0 and all 16 command and cleanup exits at 0. Pytest reported 279 passes and 46 unavailable CUDA/MPS cases, including eight RIR-analysis passes and three measurement passes. Vitest reported 37 passes. Locked uv and npm installs, Ruff lint and formatting, TypeScript, ESLint and both frontend builds passed. Chromium reported one H48 pass and 78 passes in the disjoint regression run. This audit used those recorded suite exits.
- The retained `screens/M7-rir.png` and phase `frontend/test-results/screens/M7-rir.png` match at SHA-256 `dcc41f053dfcd4c64fd3c1fd58bb10563ba918dcae3eebfbf09bede77d9dd672`. The embedded test manifests match the test-build manifest, the restored production manifest matches the original, and the current embedded production files verify against it. The browser temporary directory was removed.
- M7.5 provides the physical measurement procedure for the Human. The acceptance report and final squash identity check are outside this audited tree.
