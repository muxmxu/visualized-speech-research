# M7-T2 independent mechanical audit 2

**PASS for the corrected measurement and route slice.**

- From base `dea5c46512cedb1ef3550a2dbb6d68eb5426c241`, the frozen patch and the six worktree files independently produced the same candidate tree in temporary Git storage. File hashes, blob modes, reverse application and whitespace matched. DESIGN, protected files, dependency manifests and locks had no changes.
- The retained rule check returned `0 FAIL, 0 REVIEW`. Reading and scanning the 605 additions found no public-repository privacy issues.
- Final focused pytest, Ruff lint and formatting passed. The three tests cover M7.3, M7.4 and the signed-lag regression. The recovered bandpassed IR error was −50.47 dB, with zero loopback sample error. Before the correction, the new regression measured a wrapped index of 248 instead of the positive delay of 7 samples. All three tests passed after the correction.

```text
a97f3e8db2f8c37e7edd5cc53048707a204ae111                           candidate tree
217bb794b3cbbbb8b6cf6a2bbd4fdbb84fc8758e02566a148ffb4dca41a08751  frozen patch SHA-256
```
