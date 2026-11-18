# M4-T1 independent semantic review 1

**PASS for the frozen backend candidate `d20d3ac721a1ab67d467afa121e7bbed4362514d`.**

- Mechanical audit 1 passed for the exact eight-path patch. The six focused backend tests passed. Ruff lint and formatting passed, and the rule check reported `0 FAIL, 0 REVIEW`.
- Arm opens a level-only input stream. Start closes it and opens an input-only stream or a single duplex stream. The callback copies input and status into the queue and fills prepared duplex output. The writer owns the WAV handles, level and preview calculation, and timed input overflow and output underflow records. Stop stops capture, drains the queue, closes the files, publishes the recorded lanes, and restores armed monitoring.
- The injected stream failure test checks exact readback from the partial WAV, a device error event, stream closure, and idle state. Normal recording checks sample-exact WAV data from both input mappings, existing lane identity, grouped undo and redo, and byte-identical preservation of the lane's original source. Mixdown uses the atomic writer and rejects paths resolving to session sources.
- Input-only recording preserves all samples with a retained latency setting. Duplex uses the other audible lanes, reports distinct-device drift, and trims the leading compensation interval from the loaded lane at its unchanged session origin. The tests confirm the expected 10 ms loopback calibration, 80-sample trim, and output-underflow timing. Device import failure and the silent-first-second microphone notice also passed.
- This review reused the retained command and test evidence without running checks. Physical loopback, built-in microphone and hardware multichannel verification remain assigned to M4.6.

```text
1cc16d0ee651b1a76dcee7542f8c25d4d61e340970e6ae30a6efee708b9e3a4c  M4-T1.patch
```
