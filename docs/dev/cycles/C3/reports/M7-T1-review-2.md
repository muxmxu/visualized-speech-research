# M7-T1 independent semantic review 2

**PASS for candidate tree `2b4accafc59212f665ec604f6cfb4ca19ab8e707`.**

- The correction closes the selected-device finding. `analyze_rir` computes broadband power, peak and onset with the float32 tensor returned through `compute_device`. `band_result` runs every band's reverse cumulative sum on that device. SciPy octave filters and NumPy Lundeby estimation and fits run on the host as specified in the task plan.
- Mechanical audit 2 passed on the same full patch and correction. The retained final CPU run passed all eight tests, including the M7.1 matrix, M7.2 and the DRR regression. The rule check returned `0 FAIL, 0 REVIEW`. This review reused the retained checks.

```text
fb2dae91c3fad6037fd2b873f1374e1a200058acd0911e8a0191c3220d3768c7  full frozen patch SHA-256
66d07db138fd939d00ed25b21ee16b8a2e761d21d680cd529d18c15bca928e7a  correction patch SHA-256
```
