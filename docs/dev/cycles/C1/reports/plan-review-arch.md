# C1 architecture plan review

Verdict **FAIL**.
Required action **replan**, limited to the A2 transaction order.

## Issue

1. In `phase-arch.md` lines 34–36, the executor integrates onto master before the independent Auditor and Task Reviewer verify the integrated specification.
   The task table in `phase-M1.md` lines 26–38 assigns both independent seats to A2, but neither plan places their phase-tree verdicts before the squash.
   LIFECYCLE Integration requires full phase-tree checks before squash and full master-tree checks afterward.
   The CODEX integration procedure additionally requires independent final-tree audit and review before the authorized commit.
   Amend A2 to freeze the merged phase revision, obtain the full check evidence and both independent verdicts against that revision, then let the authorized top-level executor squash the reviewed change.
   Require the post-squash full checks and verify equality of the DESIGN change using each tree's own baseline before releasing M1.
   This order preserves separate records commits on master and makes a failed phase review recoverable in the phase worktree.

## Evidence

- Private H45 explicitly requests the DESIGN addition and implementation.
  D40, B3 and Amendment A2 locate it in M1, and the private handoff records M0 acceptance.
- A1 names its single tracked file, preserves the preamble, headings and previous decisions, limits protected additions to the §1 scope bullet and the thirteenth M1 criterion in §19, and allocates the supporting detail to §§9, 20 and 21.
  Existing DESIGN §19 has twelve M1 items.
- A1 specifies a rectangular selection of currently visible plots, composition of WebGL, waveform, axes and overlays, preserved interaction state, exclusion of surrounding chrome, and a single-page raster PDF download.
  It assigns real-browser positive and negative pixel checks, dimensions, request counting and an independent reader check to the specification.
  The recon's browser download and reader rasterization used a synthetic image.
  The application fidelity check belongs to M1.13.
- The referenced dispatch table provides serial dependencies, resource locks, bounded budgets, a protected-spec reviewer, a mechanical auditor and the top-level Git execution route.
  The architecture worktree owns the DESIGN diff and the controller owns the separate records.
  A1's requested implementation constraints preserve the existing runtime dependencies and HTTP surface.

## Covered state

The reviewed master HEAD was `3ce4478bedabee7f6707b13814bdb0ca9948c067`.
The cycle plan was modified and both phase plans and the independent recon were untracked at inspection.
The existing untracked root npm files were outside review.
Notes outside scope were empty.
The report path is `docs/dev/cycles/C1/reports/plan-review-arch.md`.
