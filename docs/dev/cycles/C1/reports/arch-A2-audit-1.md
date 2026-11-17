# C1 arch A2 frozen phase mechanical audit 1

Verdict: **PASS**.
The phase worktree was clean before and after checks at frozen commit `d4c3cdb59062874dc9b7db40cb43249996cdc737`, with phase cut `d39a22c5ab8ffb8ed58947dc6577b71d8ff0cf35`.
A `cmp` of `git diff --no-ext-diff --no-color --binary --full-index` for `docs/DESIGN.md` from phase cut to frozen commit against the same diff from A1 cut `398b31605ff100c178213a73c78aaabacd05dcfe` to reviewed A1 commit `4ce9c573d7db21bd4897b8a93e32a859085b1f70` returned 0, establishing byte equality.
A1 audit 2 and review 2 both passed on that reviewed change.

- `git diff --check d39a22c5ab8ffb8ed58947dc6577b71d8ff0cf35 d4c3cdb59062874dc9b7db40cb43249996cdc737`: PASS, exit 0.
- `git diff --name-only d39a22c5ab8ffb8ed58947dc6577b71d8ff0cf35 d4c3cdb59062874dc9b7db40cb43249996cdc737`: only `docs/DESIGN.md`.
- Section comparison found only §§1, 7, 9, 19, 20 and 21 changed, with identical preamble and H2 headings.
- Existing §1 and §19 lines are preserved in order; their sole additions are the H45 scope bullet and M1.13 criterion, respectively, as verified in A1 audit 2.
- The original §21 is an exact prefix of the new section, with D40 and D43 appended.
- `python3 scripts/check_diff_rules.py --base d39a22c5ab8ffb8ed58947dc6577b71d8ff0cf35`: exit 0, `0 FAIL, 0 REVIEW`.
- REVIEW dispositions: none required.
- The identical A1 delta passed the personal vocabulary, home-path, email and IPv4 scan recorded in A1 audit 2.

The following commands ran under the exclusive checks lock in the phase worktree, with frontend commands run in `frontend/`.

| Command | Result |
|---|---|
| `uv sync` | PASS, exit 0. |
| `uv run pytest` | PASS, 35 passed, one deprecation warning. |
| `uv run ruff check .` | PASS. |
| `uv run ruff format --check .` | PASS, 87 files already formatted. |
| `npm ci` | PASS, exit 0; npm reported 12 high severity vulnerabilities. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS, 4 test files and 18 tests. |
| `npm run lint` | PASS. |
| `npm run build` | PASS, with a bundle-size warning. |
| `VSR_E2E_CHROMIUM=<host-contract Chromium> npx playwright test --workers=1` | PASS, 19 tests in 2.7 minutes. |

The host-contract Chromium binding was used, so the DESIGN §20 browser installation command was not required.
