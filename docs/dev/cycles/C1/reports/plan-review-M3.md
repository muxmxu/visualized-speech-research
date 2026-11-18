# C1 M3 independent Plan Review

PASS for the frozen phase plan with SHA-256 `e4e0e037475958280810787f1346082abf36adc7af15a5efd7c838699bc7bcbe` on delivered M2 baseline `600152a`.

1. M3.1 covers every §15 operation and requires bit-for-bit restoration after undo, including grouped edits and extraction.
2. M3.2 measures the returned spectrogram in the same rectangle through browser Delete and Cmd+Z, using the required ≥30 dB drop and ±0.5 dB restoration bounds.
3. M3.3 requires HTTP 400 on implicit save for tensor, MP3 and shared WAV/FLAC sources.
4. M3.4 checks 19–21 dB attenuation and less than 0.5 dB outside change on all three presets, with the 4 kHz tone at least 80 bins above the 1.5 kHz boundary at 16 kHz.
5. M3.5 checks PCM_24 and FLOAT round trips and byte-for-byte preservation of the destination after an interrupted write.

T1 covers the shared spectral mask, atomic history groups, source eligibility for explicit and implicit writeback, and same-directory atomic replacement.
T2 connects these operations to existing selection, playhead, shortcut and lane workflows and confirms original-file overwrite and dirty-lane closure.
The two serial implementation tasks and T3 integration fit the existing edit payload, route inventory and dependencies.
The five exits and three common integration exits can proceed under H59.
