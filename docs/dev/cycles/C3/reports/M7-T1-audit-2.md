# M7-T1 independent mechanical audit 2

**PASS for the corrected analysis and static plot slice.**

- The full frozen patch applied to `dea5c46512cedb1ef3550a2dbb6d68eb5426c241`, the correction patch applied to `eda1e03e4a5bbad8b04a42fae1dd0a03f80d06fc`, and the four worktree files reconstructed the same candidate tree in temporary Git storage. The correction changed only `src/vsr/dsp/rir.py`. Manifest digests, file hashes, blob modes, reverse application and whitespace matched. DESIGN, protected files, dependency manifests and locks had no changes.
- The retained rule check returned `0 FAIL, 0 REVIEW`. Reading and scanning the 362 additions found no public-repository privacy issues.
- The final focused pytest log records eight passes, including M7.1, M7.2 and the DRR regression. Final Ruff lint and formatting passed. This run used CPU. The corrected source performs broadband power and onset calculation and each band's reverse cumulative energy integration as Torch operations on the selected device.

```text
2b4accafc59212f665ec604f6cfb4ca19ab8e707                           candidate tree
fb2dae91c3fad6037fd2b873f1374e1a200058acd0911e8a0191c3220d3768c7  full frozen patch SHA-256
66d07db138fd939d00ed25b21ee16b8a2e761d21d680cd529d18c15bca928e7a  correction patch SHA-256
```
