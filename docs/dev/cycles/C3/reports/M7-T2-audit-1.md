# M7-T2 independent mechanical audit 1

**PASS for the frozen measurement and route slice.**

- HEAD and the index matched the approved base `dea5c46512cedb1ef3550a2dbb6d68eb5426c241`. The six approved paths matched their frozen hashes and blob modes. Independent application of the patch and reconstruction from worktree files produced the same candidate tree in temporary Git storage. Reverse application and whitespace checks passed. The DESIGN, protected files, dependency manifests and locks had no changes.
- The retained rule check returned `0 FAIL, 0 REVIEW`. Reading and scanning the 579 additions found no public-repository privacy issues.
- The retained `uv sync`, focused pytest and Ruff lint and format checks passed. The two pytest cases cover M7.3 calibrated reconstruction within the specified error bound and M7.4 invalidation with preserved raw takes and no published lane. The preview smoke rejected unauthenticated access and unconfirmed loud playback, and measured 48,000 frames at −30 dBFS on the selected output. The RIR analysis route and browser workflow are exercised with the analysis backend at integration.

```text
ac47f062adb140cb5a41c1eaece3e2b51da43242                           candidate tree
5c85fd44d4f505bf4a6fbbfa22d44fc315d3e778259c09bde1b7f31a5e0ea7f6  frozen patch SHA-256
```
