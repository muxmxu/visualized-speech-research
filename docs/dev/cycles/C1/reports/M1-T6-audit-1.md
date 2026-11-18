# M1-T6 independent mechanical audit 1

Verdict: PASS for the mechanical scope and checks recorded below.
The semantic reviewer independently assesses behavioral completeness and the implementation.
The task HEAD and comparison base are `20b42ec5e870a47035aa137e62540603a1709d77`.

- Scope and protection: PASS; the worktree contains exactly the nine listed frontend source and test paths below, all within the T6 planned write set.
  No protected file, configuration, DESIGN section or tracked preexisting test file changed.
  The two new test files were untracked at this task base and have no previous task-base assertions to weaken.
- M1.7 evidence: PASS for the test's observed contract; the browser uses the normal Space path with two opened lanes and verifies all observed PCM requests target the first selected lane with selection bounds 0.1–0.8 s, frequency bounds 200–1000 Hz and originating view FFT 512, window length 256 and Hann window, even after activating the other lane.
  It also checks Welch request time bounds against the selection and the 800 px toolbar remains in the viewport.
- Long selection: PASS for the test's observed contract; a generated 21 s source exercises Space and records at least two actual PCM requests with contiguous first-chunk end and second-chunk start.
  Both carry full selection bounds 0–21 s, 200–1000 Hz, FFT 256, window length 256, Hann window and window parameter 0.
  The test checks continuity and complete selection fields, while it does not independently assert each individual chunk duration is at most 20 s.
- Interaction: the browser checks drawing, moving and resizing the rectangle, preserving it after tool change, opening the right-click selection menu and using zoom, and clearing it by a normal waveform click.
  The new unit suite covers selection coordinate calculations, including logarithmic-axis movement and boundary behavior.
- Dependency setup: `npm ci` PASS, 180 packages installed and 181 audited; npm reported 12 high-severity findings already tracked as B5.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` and `npm run build -- --mode test` PASS; `npm test` PASS, seven files and 35 tests.
  The builds emitted a chunk-size advisory.
- Browser: configured system Chromium and `npx playwright test --workers=1 tests/e2e/m1-audition.spec.ts tests/e2e/m1-frequency.spec.ts tests/e2e/m0-playback.spec.ts` PASS, 23 passed in 3.3 minutes.
  These comprise 11 M0 playback, three T6 audition and nine Frequency Analysis cases.
  The ignored task-local `frontend/test-results/screens/M1-audition.png` is a 1280 × 720 PNG; the capture was inspected and shows a selected frequency rectangle with handles, playback control and a 200–1000 Hz analysis plot.
  Its SHA-256 after the independent run is `4d77695584ab2923bb85eaa34956426ac944bc86bad37c66f1b55455da0da907`.
- Rules and whitespace: `python3 scripts/check_diff_rules.py --base 20b42ec5e870a47035aa137e62540603a1709d77` returned `0 FAIL, 0 REVIEW`; `git diff --check` returned no diagnostics.
- Public repository scan: PASS; added tracked-diff lines and all lines of the four new source and test files matched neither the host word list nor generic home path, email or IP address patterns.
- All frontend checks and browser runs were held under the exclusive checks lock.
  The nine file hashes below matched the frozen dispatch before and after these checks.

```text
9e4ea6e74d16e31c8db77447a6686e1c90e811c10eb7d60f594167b4d28140d5  frontend/src/App.tsx
38ecc448f9fd64ad799b541cc095f9e1591d2c613171016bb71a47287605ab07  frontend/src/styles.css
7bbd0c2fe132f49892fe15fc49ea5c714314b3341e9433af0b387dd5029a9b84  frontend/src/audio/playback.ts
a9387599a240600e5cf1271421c660dc46f55e8f2fd3e0f69d6b7c742bdd71b0  frontend/src/lanes/SpectralLane.tsx
a3683fe2e065be60487fec7f4eb0b6f5da381534a5feefc8b6f5da381534a5feefc8b6e75ff9eda0c914  frontend/src/lanes/TfSelection.tsx
2a8919892be7f7b21798e2d1f622db5f148d71c5cf8bf61827f14f24dc31c5c5  frontend/src/panels/FrequencyAnalysis.tsx
d1302e69cc7d167821ed3ceb0e6cbddfda8770b38c2c797abe4c02fbbac40ad6  frontend/src/state/tfSelection.ts
f27e852a94e2f797f4a7b019778dd87b0cba09a42690330145ff2a8a40738643  frontend/tests/e2e/m1-audition.spec.ts
967b447e816027525777aba18422ed2b82226a089c8fef223f616f968d859aa1  frontend/tests/tfSelection.test.ts
```
