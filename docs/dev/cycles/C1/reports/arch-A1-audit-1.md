# C1 arch A1 mechanical audit 1

Verdict: **PASS**.
The frozen `task/arch-A1` worktree has HEAD and recorded cut `398b31605ff100c178213a73c78aaabacd05dcfe`, with one unstaged tracked change and no other status entries.
The SHA-256 of `git diff --binary 398b31605ff100c178213a73c78aaabacd05dcfe` is `058d43aeaa794b6cf6a9b02ce12df925ed13ae14bdb5162fcc66a3adb77799ff`.

- `git diff --check 398b31605ff100c178213a73c78aaabacd05dcfe`: PASS, no output, exit 0.
- `git diff --name-only 398b31605ff100c178213a73c78aaabacd05dcfe`: PASS, only `docs/DESIGN.md`.
- `git diff --unified=0 398b31605ff100c178213a73c78aaabacd05dcfe -- docs/DESIGN.md`: PASS for the mechanical scope check.
- A section-by-section comparison against `git show 398b31605ff100c178213a73c78aaabacd05dcfe:docs/DESIGN.md` found exactly §§1, 7, 9, 19, 20 and 21 changed, with the preamble and every existing H2 heading identical.
- The only protected edits are one added §1 PDF scope bullet and one added §19 M1 criterion following M1.12, with all old lines in both sections preserved in order.
- H45 authorization for those two additive edits is recorded in `phase-arch.md` and the independent plan review, and the additions match its specified scope.
- §21 retains the entire original section as an exact prefix and appends D40 and D43.
- `python3 scripts/check_diff_rules.py --base 398b31605ff100c178213a73c78aaabacd05dcfe`: PASS, exit 0, `0 FAIL, 0 REVIEW`.
- REVIEW dispositions: none required.

This audit covers mechanical scope and preservation only; the independent Task Reviewer owns semantic review.
