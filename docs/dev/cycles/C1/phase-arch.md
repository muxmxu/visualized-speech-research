# C1 arch phase for visible-region PDF and masked PCM

The prerequisite is accepted [M0](../../../acceptance/M0.md), and the successor is [M1](phase-M1.md).
Use the CODEX dispatch, resources, checks and budget in [the M1 phase plan](phase-M1.md).
The arch exit A1 is an independently reviewed specification for H45 and the D43 masked PCM clarification, integrated by A2.
H45 in the private `human-inputs.md` from LIFECYCLE State and records grants the scope decision for this specific change to DESIGN §§1 and 19.
B3 and D40 are the tracked scope and decision references, and [M1 recon](reports/recon-M1.md) is the browser feasibility input.
[D43](../../decisions.md) applies H42, H44 and H46 to the technical clarification of the documented masked `/pcm` mode in DESIGN §§7 and 9.4, using the same route and existing 20 s scheduling.
The M0 implementation and accepted DESIGN form the comparison baseline for the delta.
This is the sole Planner amendment following the [arch Plan Review](reports/plan-review-arch.md) FAIL and includes the upstream contract needed to close the [M1 Plan Review](reports/plan-review-M1.md) PCM finding.

## A1 — Visible-region PDF and masked PCM specification

Deliver the Chinese DESIGN amendment that binds M1-T3/T6 masked PCM and M1-T7 PDF export to executable contracts.
The write set is `docs/DESIGN.md` §§1, 7, 9, 19, 20 and append-only §21 in `task/arch-A1`.

### H45 visible-region PDF

In §1 add a v1 scope bullet for a rectangular crop of visible workspace plots downloaded as a single-page raster PDF.
In §9 define entry, drag, commit and cancellation, the eligible visible workspace bounds, clips and scroll, and how to preserve the selected physical pixels and aspect ratio through raster composition and export.
Define the treatment of plot axes, labels, colorbars and visible waveform, spectrogram and interaction layers inside the crop, the exclusion of surrounding chrome and the export gesture overlay, and the reuse by M2 mel and feature views when implemented.
The screenshot selection has independent state and preserves existing playback, time and T-F selections.
Define how to capture WebGL output while it is available and combine the currently shown layers without adding DSP, a backend route, a user audio write, a runtime dependency or a screen-capture permission.
In §19 append the real-browser M1.13 criterion after M1.12, preserving original items and numbering.
In §20 specify how a real Chromium test freezes the view, independently captures a browser screenshot before the export gesture, and compares the downloaded page's decoded raster at the same crop-relative positions for the spectrogram, waveform and a visible annotation.
Define a portable method to decode both images and calculate the device-pixel crop independently from the gesture and browser geometry, including rounding, a nonunit DPR and scroll clipping.
Require stable, separated high-contrast regions, corresponding interior pixel checks with a stated encoding tolerance, and excluded chrome or gesture pixels.
Preserve the tests for crop and page dimensions, unchanged audio selections and zero export-triggered data requests.
Use the recon's native browser PDF evidence when choosing raster encoding and reader checks, define one concrete portable automated test path and record an independent reader smoke check on the generated PDF.
In §21 append a dated D40 entry with the rationale and scope.
Keep RIR placement under H48/B4 outside this amendment.

### D43 masked PCM

In §7 document `selection_t0` and `selection_t1` as query fields for `GET /api/lanes/{id}/pcm`, required together as a finite, increasing pair when masking is requested.
The existing `t0,t1` specify the half-open chunk to return at requested `sr`, including the existing lane-offset and sample-boundary conversion.
The new pair specifies the complete T-F rectangle in the same project timeline, with §15 mask centers evaluated on the absolute lane STFT grid after subtracting lane offset.
Keep the frequency bounds, originating view window parameters, optional channel, response framing and plain PCM query behavior.
Define §7 boundary validation for an incomplete or invalid masked query.
In §9.4 specify that the scheduler supplies the complete rectangle unchanged on every masked chunk, including a continued or looped read, while each requested chunk still spans at most 20 s.
For a rectangle ending at 20 s, the first chunk has a true mask edge there, and for a rectangle ending at 40 s the first chunk has an interior seam at 20 s despite identical chunk bounds.
The reference is to apply one §15 audition mask to the entire source lane on its fixed `win_length // 4` hop, resample once, then slice the requested destination samples.
In §21 append dated D43 with the two-rectangle ambiguity and a reference to the continuity criterion in §19.

### Independent verification

The Mechanical Auditor runs `git diff --check <cut-commit>`, `git diff --name-only <cut-commit>`, `git diff --unified=0 <cut-commit> -- docs/DESIGN.md`, and `python3 scripts/check_diff_rules.py --base <cut-commit>`.
Run the LIFECYCLE section comparison against the recorded cut commit and require exactly §§1, 7, 9, 19, 20 and 21 to differ, with existing H2 headings and DESIGN preamble preserved.
Match the only protected edits to H45, require additive scope and M1.13 bullets, and check that historical §21 lines remain intact.
The independent Task Reviewer checks H45 and the browser pixel contract against D40 and the recon, verifies the D43 request cases and full-reference contract against §§7, 9.4 and 15 and M1.12, and records A1's precise reviewed diff and verdict.

## A2 — Integrate the reviewed architecture delta

Deliver the exact reviewed A1 change in the architecture baseline used for M1.
The only tracked write is A1's accepted DESIGN diff, with authorized worktree and Git metadata changes as implicit writes.

1. The top-level D38 integration Worker holds the final-tree and Git transaction locks, merges the committed, independently accepted A1 into `phase/arch` per LIFECYCLE Integration, and stops writing after recording the phase cut commit and freezing the clean merged revision.
2. The independent Mechanical Auditor runs the full AGENTS check suite and A1 delta, protection and rule checks on that frozen phase revision against the phase cut commit, and verifies the DESIGN change against A1's reviewed task diff.
3. After Auditor PASS, the independent Task Reviewer reviews the same frozen phase revision and records PASS for the integrated DESIGN scope, acceptance numbering and mask contract.
   A failure returns to the phase worktree for correction and fresh evidence.
4. After both frozen-revision verdicts pass, the authorized top-level D38 executor records the immediate pre-squash `master` SHA and squashes the frozen revision using LIFECYCLE Integration.
   Stage only the reviewed DESIGN delta and keep records commits separate.
   Require byte equality between the output of `git diff --no-ext-diff --no-color --binary --full-index <phase-cut> <frozen-phase> -- docs/DESIGN.md` and the same command with `<pre-squash-master> <new-master>`.
   Repeat the full AGENTS checks and applicable protection and rule checks on the new master revision against its own baseline.
5. Record both bases and final revisions, the independent pre-squash verdicts, diff equality and post-squash checks in the Controller ledger.
   Dispatch M1 only after that evidence passes and the M1 Plan Review amendment is recorded.
