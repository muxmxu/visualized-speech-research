verdict: fail

issues:
- P2 — `src/vsr/cli.py:111-118` ignores an explicit `--device` whenever a server is already running.
  `device` is passed only to the new-server branch, while the existing-server branch sends only `open` and launches the browser.
  A focused invocation of the actual `main()` with `vsr --device cpu signal.wav`, an existing runtime, and captured HTTP requests produced only `open {paths: [...]}` and no settings request.
  Therefore the CLI cannot switch an existing server's device as required by DESIGN §4 and M0.6; the current CLI test covers the same branch without a device argument and misses this behavior.
  Required fix: apply an explicit CLI device selection through the existing settings interface when reusing a server, and first add a regression that fails on the reviewed code and verifies the resulting device setting.
- P2 — `src/vsr/server/app.py:30-35` and `src/vsr/server/app.py:170-178` accept non-finite lane metadata and commit it before response serialization.
  Against a real TestClient application with a generated temporary WAV, authenticated `PATCH /api/lanes/{id}` with the JSON body `{"offset":1e400}` returned `500 ValueError: Out of range float values are not JSON compliant: inf`.
  A subsequent authenticated `GET /api/session` returned the same 500, and the waveform request returned `500 ValueError: cannot convert float NaN to integer` because the invalid offset remained in session state.
  This violates the HTTP trust-boundary validation requirement in V1#1 and the requirement that abnormal input report an error while the server continues serving usable session data.
  Required fix: reject non-finite numeric request values at the HTTP boundary before mutation, and first add a regression checking the validation response and unchanged readable session and waveform after rejection.
- P2 — `src/vsr/device.py:43-46` accepts a NaN self-check metric even though D37 requires every metric to be strictly below `1e-4`.
  A focused probe patched device availability to `[cpu, cuda:0]` and `self_check` to return `stft=NaN` with the other three metrics zero.
  Calling the actual `select_device("cuda:0")` returned `compute_device="cuda:0"`, `reason=None`, and the NaN metric because `NaN >= 1e-4` evaluates false.
  Such a failed numerical check must trigger the DESIGN §4 CPU fallback and expose a reason; it can also make the settings JSON response fail serialization.
  Required fix: require all metrics to satisfy the strict threshold, and first add a failing regression for a non-finite metric that verifies CPU fallback and a visible reason.

required_action: 修改

covered_state:
- Reviewed the final task worktree at HEAD/base `40e9400829125267a1b079cd9704648291198caf`, with no tracked diff and all 18 new source/test files untracked within the T3 write set.
- Read the main AGENTS.md, LIFECYCLE.md, ORCHESTRATION.md, current workspace HANDOFF.md and STATUS.md, the impl skill and execution contract, DESIGN §§0, 4–8, 19 M0, and the T3 phase plan and numeric table.
- Read `M0-T3-audit-1.md`, `M0-T3-audit-2.md`, and D36/D37 in `docs/dev/decisions.md`.
- Inspected all T3 source and test files and the inherited shared framed codec interface.
- SHA-256 `src/vsr/cli.py`: `52cf72df5fd6922935be290765fe9499bc9e3e545d8c03a63cc7535831dc90ce`.
- SHA-256 `src/vsr/server/app.py`: `3a1f8b9aad647235c446d8cf8430b4a413a0b248cfae127f668cb311d7a17c83`.
- SHA-256 `src/vsr/device.py`: `3b0cdddcc956a5e3934be6ca92ea336954376dd3defc180cc5366a7a7648d60f`.
- SHA-256 `tests/test_cli.py`: `9c1cf53a3334f766264238dfb64f20a00f927194a1617a01add7631ce8d7c149`.
- SHA-256 `tests/test_server.py`: `c59f4c6d0dc12025e877cc64c9f961ea5c13cd8e7c814f42e624ef809f390823`.
- SHA-256 `tests/test_device.py`: `744a60e6d645d811f953adf4858d9b1b0533fb86791129a577c0178b734e2147`.
- Audit 1 records the full T3 pytest suite passing with 11 tests and the full Ruff checks passing.
- Audit 2 records the corrected server suite passing with three tests, focused Ruff checks passing, and the rule check yielding `0 FAIL, 0 REVIEW`.
- Those unchanged acceptance checks were not repeated during this semantic review.
- New focused in-memory probes exercised the three findings against the actual modules with temporary VSR_HOME and generated audio; the device probe did not exercise CUDA hardware.
- Additional HTTP probes observed `waveform?t0=nan&t1=1&width=2` returning a structured 500 ValueError and `pcm?t0=0&t1=inf&sr=8` returning a structured 500 OverflowError.

notes:
- HTTP middleware checks tokens for the entire `/api` prefix, and WebSocket establishment rejects missing and wrong tokens before accepting the connection.
- HTTP error handlers provide the declared error/detail/traceback shape, and no CORS middleware is installed.
- Source audio is read without writeback, uploads reject path components and remain under VSR_HOME, and render responses use the shared framed encoder with `Cache-Control: no-store`.
- Waveform tests use the fixed analytic min/max/RMS and raw-sample examples, while PCM tests compare actual endpoint data with whole-source SciPy resampling and adjacent slices using a fixed seed.
- PCM resampling includes filter context and aligns the cropped source start to the polyphase period, preserving the whole-lane phase convention.
- Server startup does not import sounddevice, and source inspection found no new runtime dependency, out-of-spec route or CLI option, or protected-content change.
- No rule-check REVIEW lines require disposition in the audited state.
- No task source/test file was edited, no Git mutation was performed, and no server process was started by this review.
- This report is the only authored file, and no whole-milestone or frontend acceptance claim is made.

report_path: docs/dev/cycles/C1/reports/M0-T3-review-1.md
