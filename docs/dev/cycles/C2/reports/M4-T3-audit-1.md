# M4-T3 independent mechanical audit 1

**PASS for the frozen M4 phase tree.**

- The two first-parent merges from `6c1adbded1c8493f4677b4c94d19cbcf542f0048` use the accepted T1 and T2 tips in order, ending at `e8fd36e85a49122c61e1908687bc6617f8f989a0`. Both merge deltas match the accepted patches. The final diff contains the 14 accepted paths with A1's authorized changes to `App.tsx` and `styles.css`, plus the three approved documentation paths. Tests and PDF rendering code match the accepted merges.
- Independent reconstruction and application produced the same frozen patch and tree. All 17 file hashes and the tested input mode and blob list matched. Whitespace, protected paths, and the public-scope scan of 1,946 added lines passed. DESIGN appends only D52. The rule checker returned `0 FAIL, 0 REVIEW`. Implemented §16 signatures, §18 layout, and six M4 routes passed their recorded checks.
- Locked dependency setup, Ruff, TypeScript, ESLint, and the production and test builds exited zero. Pytest recorded 266 passes and 46 device skips. Vitest recorded 37 passes. TypeScript, ESLint, and both builds also exited zero after A1.
- All 76 distinct Chromium cases passed across the retained runs. Initial and partial recovery runs lost cases to temporary-path launch failures and interruption. The stable remainder and isolated Tensor run restored that coverage. A1 reserved header space before T-F selection, and all 17 affected Chromium cases passed with the original assertions, including the two prior PDF and spectral-delete failures. The recording scenario passed and its screenshot is `frontend/test-results/screens/M4-record.png`. Hardware outcomes remain pending the Human checks in M4.6.

```text
43e91cd0b18dd283defd8377321a06b34b9fca7d                          candidate tree
86681ba0639a3a2091176ab1608e032fea5bb72c7be7933ce29dbb29f149d76f  phase.patch
127c67c7879fc7526741162ca484d1823a17dbec74f195599e53652810fb1f64  freeze.sha256
c9b49955a67e99608c6456a32b43bf15a617141fbbd159d958fb62a722810b9f  M4-record.png
```
