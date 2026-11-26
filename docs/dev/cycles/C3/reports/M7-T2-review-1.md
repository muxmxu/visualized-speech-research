# M7-T2 independent semantic review 1

**CHANGES REQUESTED for candidate tree `ac47f062adb140cb5a41c1eaece3e2b51da43242`.**

- §14.2 requires negative-time distortion to be discarded. `src/vsr/dsp/sweep.py:49–56` slices the unshifted circular inverse FFT without bounding the result to nonnegative lags. For a permitted 0.2 s sweep with no pre-silence, 0.1 s tail and 0.29 s IR retention, a component at −20 ms occupies the index for 280 ms and is retained as positive-time energy. The loopback peak also uses the unsigned array index. Apply the signed lag bounds before retaining samples and cover the wrapped component with a numerical regression.
- The retained M7.3 case passes calibrated reconstruction with the default short retention. The retained M7.4 case passes overflow invalidation, readable raw takes and absence of a published lane. Source inspection confirmed authenticated registration, validation of the loud threshold, device locking, simultaneous raw capture and per-take status reads.
- Mechanical audit 1 passed on the same six-path patch. The rule check returned `0 FAIL, 0 REVIEW`. This review reused the retained checks.

```text
5c85fd44d4f505bf4a6fbbfa22d44fc315d3e778259c09bde1b7f31a5e0ea7f6  frozen patch SHA-256
```
