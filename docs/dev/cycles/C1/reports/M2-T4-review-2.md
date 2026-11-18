# M2-T4 independent semantic review 2

**Verdict PASS.**
The task cut is `153cedca0c842d5a17c1f9b48fab09f255ab8a85`.
The corrected patch, both task files and all twelve primary evidence entries match the [independent mechanical audit](M2-T4-audit-2.md).

- The runtime branch checks the hostname and PID before selecting a direct opener with an empty proxy map for the loopback URL (`src/vsr/__init__.py:33–41`).
  The explicit `VSR_URL` branch still uses the default urllib opener and `VSR_TOKEN`, and both branches still send the Bearer header on the framed POST. [Semantic review 1](M2-T4-review-1.md)
- The new regression gives a separate `vsr.show` process an HTTP proxy environment with both proxy exclusions cleared (`tests/test_show.py:200`).
  On the original implementation, the proxy recorded one POST and returned HTTP 502.
  The corrected run recorded zero proxy POSTs, completed the push, and verified the named lane and exact decoded same-rate f32 PCM through the authenticated server. [Mechanical audit 2](M2-T4-audit-2.md)
- The selected final suite recorded 84 passed and two existing optional `safetensors` skips.
  The existing explicit-URL token, dtype parity, feature, layout, hostname and import cases were preserved and passed in that run.
  The rule check recorded `0 FAIL, 0 REVIEW`. [Mechanical audit 2](M2-T4-audit-2.md)

```text
8f48bfa403b1e8a080ff55dc6985d174d8ff3765200ea1f4c64ffefd0fb3c2a4  worker.patch
f1fc8821e41c8feff5bbafe683aac287557d681568554882f2b8cb3c6ed0b98a  primary-evidence.sha256
5705d08ce0530ed91505bbc5d47d89ab9b07d521afff0f13adf88897518760f2  src/vsr/__init__.py
91e04714336c6fc619a67cdf386384ced281d5f2a70d6bb4b646c56a31334039  tests/test_show.py
```
