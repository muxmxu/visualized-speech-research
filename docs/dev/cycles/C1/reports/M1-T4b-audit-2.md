# M1-T4b independent mechanical audit 2

Verdict: PASS for the mechanical scope and checks recorded below.
The semantic reviewer independently assesses the corrected behavior and review-1 findings.
The task HEAD and comparison base are `411e0cf9a65614d9a3374bb5a4a8b08ea025b170`.

- Scope and protection: PASS; only `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/panels/Display.tsx` and `frontend/tests/e2e/m1-spectrogram.spec.ts` changed, with 134 insertions and three deletions.
  No dependency manifest, lockfile, protected file, configuration or DESIGN section changed.
  The test diff adds assertions and a screenshot call without removing any assertions from the base.
- Regression evidence: independent semantic review 1 measured the prior 800 px tab label widths and the 499 px document at a 480 px viewport before correction.
  The Worker reported failing focused tests before correction, but their raw log was not found in the task temporary directory, so this audit does not establish their chronology.
  The final test scopes Lane name, Gain and Offset to `.lane.selected-view`, requires three tab labels with visible width and full title before and after saved narrow-dock reload, verifies the active tab colors, and checks the Duration field and document fit within 480 px.
- Frontend: independent `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and `npm run build -- --mode test` PASS.
  Vitest reported five files and 29 tests passed.
  The install reported 12 high severity vulnerabilities, recorded as B5, and both builds reported a chunk-size advisory.
- Browser: independent full `npx playwright test --workers=1` on the configured Chromium PASS, `42 passed (4.7m)`.
  This includes the saved narrow-dock and 480 px regression cases, M0 playback and workspace, and M1 viewport, spectral request, hover and restored-layout cases.
- Screenshot inspection: the desktop PNG is 1280 × 720 and the narrow PNG is 800 × 600.
  Both show a selected inspector tab with blue underline, grouped Display settings and two spectral views.
  The 800 px capture shows abbreviated inspector labels, and the new test verifies their full titles and minimum visible widths after a narrow saved layout reload.
  The independent run regenerated the screenshots; the narrow hash matches the Worker's reported capture, while the desktop hash differs and shows a generated temporary fixture path.
  These observations do not substitute for the Human UI check.
- Rules and whitespace: `python3 scripts/check_diff_rules.py --base 411e0cf9a65614d9a3374bb5a4a8b08ea025b170` returned `0 FAIL, 0 REVIEW`; `git diff --check` returned no diagnostics.
- Public repository scan: PASS; the 134 added lines matched neither the host contract word list nor generic home path, email or non-loopback IP patterns.
- Checks ran under the exclusive checks lock.
  The frozen source hashes below matched the Worker report before and after the checks.

```text
96a0eb002c41a1eeb07fa61a2e94a4ef0de6778f46be6e92d7504df9e9dc24e9  frontend/src/App.tsx
c3fb26e5bf3290cdb9ef8fc347e5c740b32281cd5130c03a2601e0f672ad06fe  frontend/src/styles.css
eb2c2f80baecdb77ae1f3bd2c8ba027d37553f47a1f43334a58d456483969708  frontend/src/panels/Display.tsx
defcf51be9969b7f938d6484a5e6f00210f672f9e5cf5de85513e01afa93f067  frontend/tests/e2e/m1-spectrogram.spec.ts
866861fa83ed0d7bf50d651e709d7e4c82b60d100e912a889ce2e6b5479de322  frontend/test-results/screens/M1-ui-desktop.png
de85a04ccfd4a7134f76f0f3c3288b42a197a0b89ef0858e04e25f7bb0e699ed  frontend/test-results/screens/M1-ui-narrow.png
```
