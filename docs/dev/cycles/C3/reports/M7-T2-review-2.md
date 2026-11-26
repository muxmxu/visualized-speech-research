# M7-T2 independent semantic review 2

**PASS for candidate tree `a97f3e8db2f8c37e7edd5cc53048707a204ae111`.**

- The correction closes the negative-lag finding. After the full-recording inverse FFT, the signed nonnegative range bounds the loopback peak search and acoustic cropping. The result shifts by the selected loopback delay and zero-pads to the requested length.
- The signed-lag regression supplies both positive acoustic arrivals and stronger wrapped coefficients. Before the fix, the loopback index was 248 instead of 7. The final run retained the positive arrival at the last nonnegative bin, chose loopback index 7 and excluded wrapped bins. M7.3 measured −50.47 dB relative IR error and zero loopback sample error. M7.4 still passed.
- Mechanical audit 2 passed on the same six-path patch. The retained final pytest run passed three cases, and the rule check returned `0 FAIL, 0 REVIEW`. This review reused the retained checks.

```text
217bb794b3cbbbb8b6cf6a2bbd4fdbb84fc8758e02566a148ffb4dca41a08751  frozen patch SHA-256
```
