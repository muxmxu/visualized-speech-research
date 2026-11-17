# M0-T6 Mechanical Reaudit 2

Verdict: PASS. The zero-width playback viewport defect from review 1 is fixed and covered by a real-browser regression on the final main tree.

## Final trees and parity

- Phase `HEAD` is `524f8d6fd76e618fdcbdde06746f7ed1b6e31faf`, tree `51a17c1b93369e4c88303374fa44f5b181208b5e`.
- Main `HEAD` is `99286649b43569fea9153c9a5ecd6753886f4377`, tree `13937a193fd564af8628c820f338df4c93d1446c`.
- Phase and main `frontend/src/App.tsx` and `frontend/tests/e2e/m0-workspace.spec.ts` are byte-identical. Comparing the two final commits shows only `docs/acceptance/M0.md` differs: M0.C1 changes from `未验证` to `通过` and records both final-tree check results.
- The amended fix changes `App.tsx` and adds the zero-width playback e2e regression; the accepted implementation and test match the phase tree.

## Regression and acceptance evidence

- `agent_workspace/2026-11-16-autonomous-dev/tmp/m0-t6-fix1.log` records the new test failing on the old code at the finite-ruler-label assertion, then passing after the fix. Its final phase browser run passed all 19 tests.
- I independently ran `VSR_E2E_CHROMIUM=/usr/bin/chromium npx playwright test tests/e2e/m0-workspace.spec.ts --workers=1 -g 'playback at zero waveform width recovers when widened'` on main: 1 passed. This uses the real backend, generated audio, and Chromium; it observes width zero during playback, then checks finite increasing ruler labels, restored waveform drawing, and active audible transport after widening.
- Reused the supplied final-main full-check evidence: `uv sync`, pytest (35), Ruff check and format, `npm ci`, typecheck, Vitest (18), lint, build, and Playwright (19, one worker) all exited 0. No unchanged broad checks were repeated.
- The performance row in `docs/dev/performance.md` points to main `99286649b43569fea9153c9a5ecd6753886f4377` and records 4.173 s.

## Rules, protected paths, and public scan

- `python3 scripts/check_diff_rules.py --base f1b6a38a53633819106cba4b594265cd227d99f5` reports `0 FAIL, 5 REVIEW`. The five C1 REVIEW lines have the existing V1#1 dispositions recorded in audit 1.
- The focused protected-path diff from pre-fix main `556e4d24f095dd040e1584dc055489eb30560c53` to final main has no changes to AGENTS/LIFECYCLE, protected linter/type/Playwright settings, `scripts/check_diff_rules.py`, or `src/vsr/skills/`. The existing protected-DESIGN review from audit 1 remains unchanged.
- The host-term and generic public scan of the three changed paths found zero matching added lines. A broader generic IPv4 regex also matched dotted package-version strings in unchanged `uv.lock`; those were false positives, not IP addresses. The previous audit's broader M0 public scan remains applicable to unchanged files.

## Screenshots and cleanup

- `M0-cli.png`, `M0-workspace.png`, and `M0-playback.png` are present under `frontend/test-results/screens/`. The focused Playwright command cleared the main ignored screenshot directory; I restored these generated artifacts from the matching phase tree and verified all three files.
- Post-run process and temporary-directory checks found no VSR server, Chromium/Playwright process, or `vsr-e2e-*` / `vsr-bench-*` directory.
- Main retains only the expected untracked audit/review records, post-squash performance record, and root npm package files. This audit did not stage or commit changes.
