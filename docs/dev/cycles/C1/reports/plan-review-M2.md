# C1 M2 independent Plan Review

Verdict: FAIL, one bounded planner amendment before T4.

The reviewed phase plan has SHA-256 `1235b7a94415b03545628a67797b82f4c370741fe628525eb7c079d476f8d8e7`.
The delivered code baseline is `a4b37b680e3e14f0d07d244f94f79b349a471814` and the records baseline is `cfd5246`.

## Required amendment A1

Bind the order of dtype interpretation and f32 encoding for integer audio in T4 and verify the values through the normal Python client.
DESIGN §10 specifies bit-depth normalization for integer audio and a float32 client payload.
The current plan assigns integer scaling to T2 and asks T4 to cast the input and check lane metadata.
Once a sender casts int16 samples to f32, the receiver cannot recover their original bit depth, and the metadata check would accept full-scale errors.
For an int16 input containing −16384 and 16384, require a separate process to call `vsr.show`, retrieve same-rate PCM for the resulting lane, and observe −0.5 and 0.5 at those sample positions.
Require the same samples from the T2 file path, keep float32 input amplitudes unchanged, and apply integer scaling exactly once while the audio dtype is still known.
This fits the existing T2 and T4 write sets, dependencies and public interface.
T1 can proceed independently.

## Remaining checks

The six numbered exits match DESIGN §19 in order and keep the strict mel relative-error threshold and power mask.
The three common exits cover final-tree checks, acceptance evidence and protected sections.
The periodic Hann sum, power calibration, absolute pooling times, four-row frequency labels, scale conversions and aligned sinusoid difference match the supplied formulas.
T1 shares its pre-pooling kernel across the public API and T2, and T2 retains the accepted STFT paths and cache boundaries.
Serial cuts from accepted predecessors and the single writer and checks locks cover the overlapping paths and browser and device work.
The Plan Reviewer, independent mechanical and semantic seats, risk assignments, frozen diff checks, REVIEW dispositions and amendment cap are bound at dispatch.
T6 can reuse the existing Python and Node benchmark arrangement to time a ready sender through a rendered named lane with three observations per available device.
The conditional T5a requires a separately accepted §7 clarification and bound cold, warm and batch tests before its writer starts.
T6 retains that dependency and the M1 audio and PDF regressions.
This review inspected the frozen plan, repository contracts, specification and baseline sources without running implementation suites.
