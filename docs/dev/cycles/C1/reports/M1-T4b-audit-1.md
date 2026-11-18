# M1-T4b independent mechanical audit 1

Verdict: PASS for the mechanical scope and checks recorded below.
The semantic reviewer independently assesses the implementation and behavior.
The task HEAD and comparison base are `411e0cf9a65614d9a3374bb5a4a8b08ea025b170`.

- Scope and protection: PASS; only `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/panels/Display.tsx` and `frontend/tests/e2e/m1-spectrogram.spec.ts` changed, with 83 insertions and two deletions.
  No dependency manifest, lockfile, protected file, configuration or DESIGN section changed.
  The test diff adds assertions and a screenshot call without removing prior assertions.
- Frontend: independent `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and `npm run build -- --mode test` PASS.
  Vitest reported five files and 29 tests passed.
  The install reported 12 high severity vulnerabilities, already recorded as B5, and both builds reported a chunk-size advisory.
- Browser: independent full `npx playwright test --workers=1` on the configured Chromium PASS, `40 passed (4.6m)`.
  The two generated-image cases include the added heading, computed label font size, selected view and mode, top-bar group geometry, action scrolling and narrow-screen focus assertions.
  The other cases include M0 playback and workspace and M1 viewport, spectral requests, hover and restored layout regressions.
- Screenshot inspection: the desktop PNG is 1280 × 720 and the narrow PNG is 800 × 600.
  Compared with the prior T4 captures, both show a blue underline on the active dock tab, a blue active toolbar button, stronger lane names, aligned lane fields and Spectrum, Frequency and Color sections in the Display panel.
  The 800 px capture places the time fields on a second toolbar row and shows the Display panel continuing below the viewport; the automated case scrolls to its final action.
  Both captures show two spectral views and a positive visible plot region.
  These observations do not substitute for the Human UI check.
- Rules and whitespace: `python3 scripts/check_diff_rules.py --base 411e0cf9a65614d9a3374bb5a4a8b08ea025b170` returned `0 FAIL, 0 REVIEW`; `git diff --check` returned no diagnostics.
- Public repository scan: PASS; the 83 added lines matched neither the host contract word list nor generic home path, email or non-loopback IP patterns.
- Checks ran under the exclusive checks lock.
  The frozen source hashes below matched before and after the checks.

```text
2c1602090e4a01f5bfef563454f8aff578267ec2bf7d8b32f8e8355748d2f64c  frontend/src/App.tsx
ecb5bda20dbf05e55f3f8f423ad105236e11c9c8c88ed117b36a9e2cf226c3cb  frontend/src/styles.css
eb2c2f80baecdb77ae1f3bd2c8ba027d37553f47a1f43334a58d456483969708  frontend/src/panels/Display.tsx
b7aa9fcd78ec75ff92b30ca2f92b248a89e624eed69f7b62e76d80355e82ddfe  frontend/tests/e2e/m1-spectrogram.spec.ts
a3ab58718fcf3c4cdfa3c8e8268b0cea47514744e47374be9f9470166f6413d8  frontend/test-results/screens/M1-ui-desktop.png
18ba6f057c37b0ef05d36926f80797c32d8996ca99887a9704ce51b2513ad46e  frontend/test-results/screens/M1-ui-narrow.png
```
