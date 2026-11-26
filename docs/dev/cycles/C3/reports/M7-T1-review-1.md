# M7-T1 independent semantic review 1

**CHANGES REQUESTED for candidate tree `fd23ab132d431065b5f21a869f80fa99db35cd97`.**

- §16 requires DSP to compute on the selected `compute_device`, with host filtering and fitting allowed by the task plan. `src/vsr/dsp/rir.py:250–265` validates the device input and moves it to CPU before broadband power, onset, or any other RIR computation. Run the broadband power, onset and reverse energy sum on the selected device in float32, then share their results with the host fits and SciPy filters.
- The public DSP and static plot share the §14.1 analysis and use the declared signatures. The plot draws broadband and selected octave EDCs, overlays broadband fits, and records the `rir` spec line.
- The analysis uses one broadband onset for the energy windows and a band-local onset after reverse filtering for each band decay. It gates the input before forward filtering for energy ratios. The Schroeder sum includes the Lundeby tail, and the three fit ranges return r² or a reason when unavailable. The result caps aligned curve samples across the selected bands.
- The retained final pytest run passed all eight cases. M7.1 passes the six specified combinations of T60 and sample rate with relative T30 error below 5%. M7.2 compares broadband C50 and D50 with independent finite geometric sums. The added DRR regression distinguishes the measured rest window from the tail-compensated C50 and C80 denominators.
- Mechanical audit 1 passed on the same four-path patch. The rule check returned `0 FAIL, 0 REVIEW`. This review reused the retained checks.

```text
a5b1769777aaa89b0b1fd49a4a1d3cbe0952929af5c0aacb48d147da335a6651  frozen patch SHA-256
```
