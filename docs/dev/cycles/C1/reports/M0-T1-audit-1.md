# M0-T1 Mechanical Audit 1

verdict: FAIL

issue:
- `python3 scripts/check_diff_rules.py --base b62fe18` exits 1 with `FAIL C5 frontend/eslint.config.js:17`; the flagged line is verbatim from the approved C.2 block and says inline `eslint-disable` directives are ineffective.
- `uv run ruff format --check .` exits 1 because Ruff reports `docs/DESIGN.md` and `src/vsr/skills/vsr-speech-visualization/SKILL.md` as unformatted; both protected files are unchanged from `b62fe18`.

required_action:
- Keep both results as FAIL and resolve the approved-comment/C5 conflict and the formatter/protected-Markdown conflict through the applicable Rules gate before accepting T1.
- Do not modify the approved protected configuration, rule checker, DESIGN, or visualization skill as part of this audit.

covered_state:
- Audited the final `task/M0-T1` worktree based on `b62fe18` and compared changed and untracked paths with the T1 write set.
- The write-set check passed, and the public scan found no whole-word matches against the private host word list.
- `AGENTS.md`, `LIFECYCLE.md`, `scripts/check_diff_rules.py`, `docs/DESIGN.md`, and `src/vsr/skills/` are unchanged from the base.

notes:
- `uv sync`, the Python import smoke check, and `uv run ruff check .` passed with Python 3.12.14 and CPU Torch 2.15.0.
- `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build` passed; the build output is under ignored `src/vsr/web/`.
- The approved ESLint block matches `docs/dev/rules-config.md` exactly; the Ruff block, pytest path, lint script, strict TypeScript setting, Vitest settings, and Playwright settings match their approved values.
- `.gitignore` preserves `/ORCHESTRATION.md` and ignores the required worktree, cache, frontend test-output, and generated web-output paths.
- No dependency-install or build process remained running after the checks.
