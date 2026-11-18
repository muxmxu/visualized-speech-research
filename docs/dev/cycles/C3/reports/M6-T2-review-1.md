# M6-T2 independent semantic review 1

**PASS for the frozen frontend candidate `964cf6f5a70a51666f4f8ef825ab09c693e79325`.**

- Mechanical audit 1 passed for the eight approved paths. The retained locked npm setup, TypeScript, and ESLint checks passed.
- The Dataset tab sends the declared directory/manifest sources, threshold, and typed Scalar settings. Progress events are indexed before the POST result can arrive. Scan, cancel, terminal failure and partial-result readback are wired to the shared API, and a healthy row opens in Lanes.
- AG Grid preserves stable server row indices through filtering and sorting. Histogram and scatter use only filtered rows, and scatter samples and labels the cap when exceeded. LTAS sends the same filtered indices in batches of at most 16 groups, aborts obsolete requests, and displays one mean and percentile band per returned group. CSV uses the same ordered columns and filtered rows.
- The real-server spec covers directory and manifest inputs, two source curves, group removal through the table filter, open-in-Lanes, and parsed CSV parity with the real same-home CLI subprocess. Browser execution remains assigned to T3.
- The four rule findings are allowed under `V1#1`: completed row readback, scan submission, cancel submission, and framed LTAS readback handle their own request failures with visible feedback. The rule check reported `0 FAIL, 4 REVIEW`.
- No checks were rerun for this review.

```text
9d8dbc8860e9c24cd9577efd2d1b5b74f4ac72be6ada10240fff5a522a8d9b97  worker.patch
```
