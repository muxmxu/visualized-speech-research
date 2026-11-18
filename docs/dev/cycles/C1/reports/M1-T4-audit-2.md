# M1-T4 independent mechanical audit 2

Verdict: PASS for the current-tree mechanical checks below.
The semantic reviewer must independently disposition the rule-check REVIEW and assess behavioral correctness.
The task HEAD and comparison base were `9cb96340880a521f5bba7c0354704db3e8735b34`.

- Scope: PASS; five tracked modifications and seven untracked files, all within the 14-path task write set; no protected or other tracked paths changed, and no symlinks in frontend source or tests.
- Existing baseline tests: PASS; M0 browser test files are unchanged against the base, and the tracked viewport test adds assertions without deleting existing assertions.
  The current M1 browser suite retains assertions for the previously reported grid, pixels, request counts, cancellation, hover, independent views, clipboard and migration evidence.
  The prior review-1 M1 browser file was untracked and its bytes were not archived, so a complete assertion-by-assertion comparison against that version is unavailable; its recorded SHA-256 alone cannot establish preservation.
- Review-1 regression coverage: PASS for presence and execution; seven browser tests assert retained cached frames and the initial 150 ms deadline, stereo pointer anchoring, no spectral matrix upload on palette change, approximate hover and clearing, classic-scrollbar geometry, migration without Properties, and destination Nyquist bounds.
  An additional test covers logarithmic anchoring on the lower stereo channel.
- Whitespace: PASS; `git diff --check` against the base and `git diff --no-index --check /dev/null` for each new file emitted no diagnostics.
- Rule check: `0 FAIL, 1 REVIEW`; `C1 frontend/src/lanes/SpectralLane.tsx:37` is reserved for semantic reviewer disposition.
- Public repository scan: PASS; added lines and all new files yielded zero matches for the host contract word list, generic home paths, email addresses, non-loopback IPv4 addresses and agent command patterns.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 5 files and 29 tests.
- `npm run lint`: PASS.
- `npm run build`: PASS; production output contains no `__vsr_test` match.
  The build emitted its chunk-size advisory.
- `npm run build -- --mode test`: PASS.
- Combined `npx playwright test --workers=1 tests/e2e/m1-spectrogram.spec.ts tests/e2e/m0-workspace.spec.ts tests/e2e/m0-playback.spec.ts`: PASS, 40 tests in 4.5 minutes, comprising 19 M0 and 21 M1 tests.
  The run set `VSR_E2E_CHROMIUM` to the host-selected system Chromium, version 156.0.8078.79.
  The classic-scrollbar test passes the configured project launch options to its separate Chromium launch and removes `--hide-scrollbars`; it asserts a positive scrollbar width before checking alignment.
- The checks ran under the exclusive worktree-checks lock.
- The combined run retained `frontend/test-results/screens/M1-workspace-desktop.png` at 1280 × 720, SHA-256 `820071c43ea145531bf98e3cd4f59551aa21f7551ef9d5a5b25d0fea2f45b4b8`, and `frontend/test-results/screens/M1-workspace-narrow.png` at 800 × 600, SHA-256 `58199807f3209cb4f050faf07f1022b77054e10d0ab61bbb639f4ba67619c92d` in the task worktree.
  Screenshot contents are human visual evidence under DESIGN §20; this audit checked their existence and dimensions.
- The 12 changed-file SHA-256 hashes below matched before and after the checks.

```text
b11bbb04d73018448f0c24b27a4717e8fe7ada816f06f94d41eb56eea1832813  frontend/src/App.tsx
a6fd318eab3a2c8135a566af40211133435dcbeb67883477a1a9df556df417c0  frontend/src/audio/testHook.ts
ad42ea6ae694125f13d259253c31304b66833aef7b6458cc89e4c5678391726e  frontend/src/lanes/SpectralLane.tsx
1d58d7dad227a5c322b2d87dc2f333f86d6edb825ec0230b4463b698e33341ed  frontend/src/panels/Display.tsx
b992037da955fac75d4a49a4cc75d9d132b9899154c80e61dae9c6726e9493e7  frontend/src/render/colormap.ts
94c14d5f349a700ef4911a5cee9945b6ec102fc2b8e3f37ef192f60d76f8f314  frontend/src/render/spectrogram.ts
8bc5f835499c8ed12d4723d6aafaf03b13370bd58d7420a12d4d9a6c33ce7fbd  frontend/src/state/spectralViews.ts
e51b5e48d26ddc62663f21b76734bd0bc4b3b84d99e0d94e449be39846241ea3  frontend/src/state/viewport.ts
334261c9cb2165c5104e75c495ea148e03372203c2c10b25498ac9f188040347  frontend/src/styles.css
f5ac714934bee66464bf9ffe06c9dbac637bf4882f828c0d0fc408a40d8729fc  frontend/tests/e2e/m1-spectrogram.spec.ts
47ca85640832ed701ef9dcf27cba61261f1df3dc1d14899432f32c312ce8a9f2  frontend/tests/spectrogram.test.ts
ccd8cbed93ae0b8d4d0328bbf1df8e06b61b25c7142966cbeb671f54d3499a64  frontend/tests/viewport.test.ts
```
