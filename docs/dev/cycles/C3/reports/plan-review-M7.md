# M7 plan review

The disjoint write sets, public signatures, three existing routes, H48 interaction and M7.1–M7.5 numerical and manual criteria match the accepted scope.
One measurement correction is required before dispatch.

T2 currently calls for blocking playrec followed by raw-file saving, while §14.2 requires the raw recording to be written during capture.
Bind a viable simultaneous capture and raw-write path using sounddevice, retain captured raw samples on failure, and make any overflow or underflow invalidate the entire measurement even when another repetition succeeds.
Keep the existing M7.3 and M7.4 evidence and tolerances.

No tests were run.
