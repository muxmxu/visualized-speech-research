# C1 arch A2 frozen phase semantic review 1

**Verdict** PASS.
**Findings requiring correction** None.
**Integration disposition** The authorized D38 executor may squash the frozen phase revision.

## Reviewed revision and scope

The `phase/arch` worktree was clean at `d4c3cdb59062874dc9b7db40cb43249996cdc737`, with recorded phase cut `d39a22c5ab8ffb8ed58947dc6577b71d8ff0cf35` as its first parent and reviewed A1 commit `4ce9c573d7db21bd4897b8a93e32a859085b1f70` as its second parent.
The sole tracked delta is `docs/DESIGN.md`, and its full-index binary diff is byte-identical to the A1 delta from `398b31605ff100c178213a73c78aaabacd05dcfe` to `4ce9c573d7db21bd4897b8a93e32a859085b1f70`.
The committed A1 diff also matches the SHA-256 recorded in [A1 audit 2](arch-A1-audit-2.md) and [A1 review 2](arch-A1-review-2.md).
An independent section comparison confirmed changes only to §§1, 7, 9, 19, 20 and 21, with the existing preamble and headings preserved.
The H45-authorized §1 and §19 additions preserve all previous text and order, including the original twelve M1 criteria and their thresholds, and append M1.13 immediately after M1.12.
Section 21 keeps its historical text as an exact prefix and appends D40 and D43.

## Integrated contracts

- **H45 and D40.** Sections 9.7 and 20 define an independent crop gesture starting in a visible Lanes or Frequency Analysis plot, composition of the existing rendered layers through the plot and ancestor clips, exclusion of interface chrome and the gesture, and native download of a one-page raster PDF at the cropped device-pixel dimensions. The contract preserves audio interactions, adds no runtime dependency, DSP work, backend route or audio write, and specifies reuse for M2 mel and feature views.
- **M1.13.** Sections 19 and 20 require a real Chromium crop of both eligible plot types, independent pre-gesture screenshot and pointer geometry evidence, one device-pixel rounding step, a nonunit-DPR precision case and a scrolled fixture. The automated checks cover page and image geometry, corresponding pixels within RGB tolerance, chrome and gesture exclusion, preserved selections and zero export-triggered requests, with a separate full-Chromium PDF-reader check. M1-T7 and T8 own this implementation evidence.
- **D43.** Sections 7 and 9.4 retain the PCM route, plain PCM behavior and 20-second scheduling. Masked queries carry a validated group including the originating view parameters and the complete rectangle on every continued or looped read. The independently testable reference evaluates the §15 mask on the absolute lane grid after lane-offset conversion, with hop `win_length // 4`, followed by one resample and a destination slice. The 20-second true edge and the 40-second rectangle's interior seam remain distinct cases under M1-T3 and M1-T6, and M1.12 retains its strict sample error threshold of `< 1e-6`.

## Check evidence and rule dispositions

[A2 audit 1](arch-A2-audit-1.md) reports the full AGENTS suite passing on this same frozen revision under the checks lock, including `uv sync`, 35 pytest tests, Ruff lint and format, `npm ci`, frontend typecheck, 18 Vitest tests, ESLint, production build and 19 Chromium Playwright tests.
The host-contract Chromium path satisfies the DESIGN §20 alternate browser procedure.
The audit records a pytest deprecation warning, npm advisories and a bundle-size warning, with exit 0 for the affected commands.
The frozen tree's Playwright last-run record confirms a passing run, and the accepted A1 audit's public-repository scan covers the byte-identical delta.
The phase diff passed `git diff --check`; the independent rule check recorded `0 FAIL, 0 REVIEW`, so there are no REVIEW dispositions.

The D38 executor still needs to record the pre-squash and new `master` revisions, verify master diff equality and repeat the required checks on the new master tree before M1 dispatch.
