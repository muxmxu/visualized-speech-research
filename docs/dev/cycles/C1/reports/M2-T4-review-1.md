# M2-T4 independent semantic review 1

**Verdict FAIL.**
The reviewed task cut is `153cedca0c842d5a17c1f9b48fab09f255ab8a85`.
The patch, primary evidence manifest and both worktree file hashes match the [independent mechanical audit](M2-T4-audit-1.md).

## Blocking finding

- The local runtime branch builds a loopback URL in `src/vsr/__init__.py:40` but sends its authenticated frame through the default urllib opener at line 124.
  With `http_proxy` set and no proxy exclusion, the default opener sends the request to the proxy after the matching-host check succeeds.
  An independent probe under the shared checks lock used a temporary runtime with the current hostname and live PID, a loopback destination listener, and a separate loopback proxy listener using a synthetic token.
  The public `vsr.show` call returned successfully, the local destination recorded zero requests, and the proxy recorded one request containing the synthetic Bearer token and the decoded f32 samples `[0.125, -0.25]`.
  This bypasses the local connection boundary in DESIGN §§4 and 10 and allows a successful return with no local lane creation.
  Route the runtime-derived connection directly and cover local lane creation with an authenticated server while the sender has a proxy configured and no proxy exclusion.
  Preserve the explicit `VSR_URL` and `VSR_TOKEN` flow.

## Other checks

- The default and explicit audio layouts match the accepted mapping, and the documented feature call uses `[F,T]` with the T2 metadata schema.
  The existing real-server cases verify local and explicit remote authentication, hostname rejection before connecting, startup guidance for missing or unreachable local runtime, and one authenticated POST per dictionary item. [T4 plan](../phase-M2.md#t4--python-push-and-import-boundary) · [Mechanical audit](M2-T4-audit-1.md)
- The worker and independent audit verified same-rate f32 parity with file interpretation for int16, unsigned midpoint neighbors and float32 amplitudes.
  The client takes complex magnitude before f32 encoding, and the feature viewport test verifies the corresponding dB values and magnitude metadata. [Plan review amendment A1](plan-review-M2.md#required-amendment-a1) · [Mechanical audit](M2-T4-audit-1.md)
- The clean interpreter case verifies the four restricted imports remain absent after `import vsr` and Matplotlib loads on `vsr.plot` access.
  The mechanical rule check has zero REVIEW findings. [Mechanical audit](M2-T4-audit-1.md)

```text
0f0210315a5d8315f32783cf93de712c032c0522a7b9ee4e4df13d36b8edf11b  worker.patch
45967673f01bbaa92a7112b6df5d66c9809d7cba71b5da5cff21ff82442acc0c  primary-evidence.sha256
d3909ee4faeda5bca783e7965e809703565d5a1a24becbe4247b77aa830d5af7  src/vsr/__init__.py
842899d2e9dbe40a2dc5eeb0b2f8b49a16dad3f346b5d49ad043fdd8b8f1319c  tests/test_show.py
```
