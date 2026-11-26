# M7-T1 independent mechanical audit 1

**PASS for the frozen analysis and static plot slice.**

- HEAD and the index matched the approved base `dea5c46512cedb1ef3550a2dbb6d68eb5426c241`. The four approved paths matched their frozen hashes and blob modes. Independent application of the patch and reconstruction from worktree files produced the same candidate tree in temporary Git storage. Reverse application and whitespace checks passed. The DESIGN, protected files, dependency manifests and locks had no changes.
- The retained rule check returned `0 FAIL, 0 REVIEW`. Reading and scanning the 348 additions found no public-repository privacy issues.
- The final focused pytest log records eight passes. Six exercise the specified T30 matrix for M7.1, one compares C50 and D50 with finite analytic sums for M7.2, and one verifies measured DRR through the cutoff. The retained pre-fix DRR run failed with 0 dB against an expected 4.0824 dB. Final Ruff lint and formatting both passed.

```text
fd23ab132d431065b5f21a869f80fa99db35cd97                           candidate tree
a5b1769777aaa89b0b1fd49a4a1d3cbe0952929af5c0aacb48d147da335a6651  frozen patch SHA-256
```
