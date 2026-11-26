# M7-T3 independent semantic review 1

**PASS for candidate tree `1c26753ba96b1b2399e63afc225f919b70fe3616`.**

- The bottom dock adds RIR to new and saved layouts. The selected audio lane and channel feed the analysis and arrival views. The analysis sends supported bands, Lundeby and the cutoff, and displays the broadband envelope, EDC, fits, band overlays and metric details. The existing PDF capture scope remains unchanged.
- The arrival view requests framed waveform data in session time. It plots signed min/max and raw samples, locates the initial direct reference from broadband onset, and uses the framed sample data or a one-sample read at the clicked index. Moving the direct reference retains later markers and updates their delay differences without submitting a metric request.
- The measurement form exposes the specified devices, channels, sample rate and sweep parameters. Preview invokes its fixed-level route. Measure prompts separately above −6 dBFS, reports invalid takes or uncalibrated time zero, and selects the lane after a valid take.
- Mechanical audit 1 passed on the same patch. Retained TypeScript and ESLint checks exited zero. The four C1 findings are allowed under `V1#1`. `Rir.tsx:173` handles the analysis request, and `RirArrival.tsx:80`, `:89` and `:171` handle waveform, automatic reference and manual sample reads. The rule check returned `0 FAIL, 4 REVIEW`.
- The H48 spec checks the exact signed pulse samples, raw zoom, the revised 7.500 ms difference, unchanged C50 and T20, unchanged EDC pixels and zero marker-triggered analysis requests. This review reused the retained checks. T4 owns real-browser execution and the screenshot.

```text
01d7bd93108ba8a5ac67eb204b4f252632ef79f6a6dc6eebe5b4962b548b749d  frozen patch SHA-256
```
