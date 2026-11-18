# M3-T3 independent mechanical audit 1

**PASS for the frozen phase tree.**

- The cut is `703b6a170913b8fd6b80f6d6123c402fc3794439` and the final merge is `997d33105a1680dab66d32056c19151fb024e306`. The two first-parent merges use the accepted T1 and T2 tips in order. Their per-file binary diff blocks match both reviewed task freezes. Independent staged reconstruction and patch application from the cut both yielded the frozen tree below.
- The final diff contains the 14 reviewed task paths and three approved integration paths. DESIGN appends only D50. The other integration changes are the Chinese acceptance report and A1's single Gain locator substitution in the narrow M1 test. The replacement addresses the same number input by exact name and spinbutton role. All assertions, product bytes, protected paths, lockfiles, and configurations match their approved versions. Whitespace and the public-content scan of 1,330 added lines passed.
- The exit records show zero for locked Python setup, pytest, both Ruff checks, `npm ci`, TypeScript, Vitest, ESLint, both builds, and the Chromium executable check. Pytest recorded 260 passes and 46 device-availability skips. Vitest recorded 37 passes. The implemented §16 signatures and §18 paths and the four added §15 routes passed their checks. The phase rule checker returned `0 FAIL, 2 REVIEW` with both C1 dispositions inherited from T2.
- The first single-worker Chromium run exited 1 with 74 passes and one ambiguous Gain locator in the M1 narrow workspace case. After A1, that sole case, TypeScript, and ESLint for the changed file exited zero. The 75 distinct cases passed across the original and targeted runs, including the M3 spectral edit and Save As workflow. The report preserves both outcomes and the phase screenshot. Under H59, the audit reused evidence for unchanged checks.

```text
2aaf2e16a5ef90bf792e8088a03edda5d8feb0d8                          frozen tree
c569dac0f3d1278ac695094b299c37b68a359e12770f8b94f751ffa9a10374b8  final-phase.patch
e0ceabcbdc5c347ccafcfd3667ebb7c215a38105c01992463c53843eeb736ffc  audit evidence manifest
941c6ec534db366b88f5deabe7799dfef876dc697e135db6f30053a51315e86f  M3-edit.png
```
