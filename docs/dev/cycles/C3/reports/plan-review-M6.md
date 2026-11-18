# C3 and M6 plan review

C3 sequencing, M6 scope, the CLI signature and the fixed numerical tolerances match DESIGN.
Two acceptance bindings need clarification before dispatch.

- M6.4 must require finite means for both sources at every grid point from 100 Hz through 7 kHz before asserting their absolute difference is below 0.5 dB/Hz, since comparing only finite pairs can pass with missing in-band data.
- M6.5 must observe the counter in the process that executes the CLI scanner, since a subprocess recomputation cannot increment a web-server fixture's in-memory counter.
  Use the existing backend fixture to warm the cache through HTTP and call the CLI entry point in-process with the same home and instrumented file processor, then require zero additional calls and the expected CSV rows.
  Keep the planned real CLI subprocess and browser export comparison for user-facing parity.

No additional acceptance cases or changed limits are required.
