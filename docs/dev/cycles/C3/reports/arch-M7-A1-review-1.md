# Arch M7 independent semantic preflight

**Verdict** PASS for the frozen patch.

- H48/B4 is covered by the selected lane and channel's signed linear `h[n]` against lane-local delay in ms, with a zero line, min/max overview and raw sample zoom.
  The existing broadband onset determines the initial direct reference, and both direct and later markers read the original signed sample at the nearest index.
  The existing framed waveform route supplies the same channel and sample indices for raw zoom and single-sample reads after one lane-offset conversion.
  Moving the direct reference retains only later markers and recomputes their relative delays.
- The 48 kHz fixture selects initial sample 240 despite the larger negative pulse at 480.
  Samples 240, 480 and 840 give 5.000, 10.000 and 17.500 ms, with the last delay changing from 12.500 to 7.500 ms when the reference moves to sample 480.
  Marker actions are independent of analytical onset, truncation, EDC, fitted decay and H49's C50/T20.
  The fixture's unavailable C50 and its reason are compared before and after the marker actions, while the prior numerical acceptance remains in §19.
- Byte reconstruction confirmed exactly the three approved §14.1 bullets and D55 in §21.
  The previous analysis panel, routes, settings, §9.7 PDF scope, physical measurement requirements and protected criteria remain intact.
  Reconfirm the base DESIGN hash against delivered M6 before application.

| Reviewed bytes | SHA-256 |
| --- | --- |
| M6 DESIGN base | `8d12d6abb93d8acf678786c1d5860510b3c96250c67ae532acd0f66fe6904489` |
| Candidate DESIGN | `15a1078507ace932cc8c1e7038361f17038ac4b23d65741a8b781c2d477a33fe` |
| `arch-M7-design.patch` | `1426f549194cdc345937187420163bc2f677e92e350760a0393b7be7acff64f5` |
| `rir-design-insertion.md` | `66b523827a5dac0ea807b067e4e0dd352df22abf0899211de8b49f45eba9ab01` |
| `phase-arch-M7.md` | `4d8ad1f20b96a811b742602d130fb5a2be6439005ad964da163420facec913f0` |
