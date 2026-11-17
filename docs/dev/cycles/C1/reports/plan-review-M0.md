# M0 Plan Review

verdict: fail
required_action: replan
report_path: docs/dev/cycles/C1/reports/plan-review-M0.md

## Covered state

The reviewed HEAD is `8bd532d91f777c42a074175eaa812f7ca4a5732e`.
The phase plan was untracked at review time, with SHA-256 `1de28cdbfda40e1dc8d00fa14c67e1564a6ba882c9518758da94e513b75679f0`.
The cycle plan had SHA-256 `827d9d7f070ee4109b3a07fed7505678c60198b9bd1ac529270556fcb966a0c0`.
The observed working tree also contained a modified `docs/dev/worklog.md` and untracked root npm metadata.
This review changes only this report and does not review or accept application implementation.

## Issues

1. Location: `docs/dev/cycles/C1/plan.md:41`, R1.7 and the cycle's Human requirement mapping.
   The cycle explicitly promises no push or publication, while the current LIFECYCLE Integration Push and Delivery sections require the authorized milestone and records pushes, release tag push, and conditional GitHub Release creation under H34–H36.
   Required fix: amend the cycle delivery criteria and requirement mapping to the current runbook and recorded authorization, retaining the existing PyPI boundary and the specified NOT RUN outcome when the release prerequisite is unavailable.
   This is reconciliation to accepted requirements, not a new publishing authorization request.
2. Location: `docs/dev/cycles/C1/phase-M0.md:21`, Sources and observed baseline, and T1 bound facts.
   The plan explicitly says independent recon remains due and supplies no recon outcome, whereas ORCHESTRATION Recon requires that invocation before the first plan and makes its facts the planning input.
   Required fix: obtain independent recon, then have the Planner bind its report and reconcile the existing plan in the single amendment before dispatch.
   Preserve dispatch blocks for any facts recon cannot establish, rather than treating this review as confirmation of tool or dependency availability.

## Required action

The Controller should return these issues to the Overall Planner for the contract's one amendment after recon.
The amended plan should carry any unclosed issue as an explicit affected-task constraint and dispatch block, without a second routine Plan Review.
The existing git-executor conflict must remain a block on task commits, dependent branch creation, and T6 until an authorized execution channel is recorded.
The present report does not authorize Controller merges, subagent git mutations, changes to protected instructions, or starting M1.

## Evidence

All six DESIGN §19 M0 acceptance items and all three common exits have explicit task owners and observable evidence in the phase exit table.
The cycle assigns M0–M3 acceptance sets and release criteria, while the original product requirements outside C1 are explicitly assigned to later cycles.
T1–T6 contain deliverables, commands, expected outcomes, role and effort selections, risks, dependencies, explicit and implicit write sets, resource ownership, bound-fact sources, and verification requirements.
The dependency chain is acyclic and serial, so the overlapping App, session, cache, and generated-web write sets are not concurrent write conflicts.
Independent audit followed by semantic review is specified for every implementation task, including final phase and main trees.
T1's protected configuration initialization has a source document and a checked Rules authorization in the lifecycle-selected private state directory.
Later tasks are expressly prohibited from modifying those protected blocks, and T6 includes protected-content, rule, public-repository, and final-tree checks.
The framing and self-check metric proposals are explicitly unratified until numbered Controller decisions are supplied to T2 and T3.
The raw waveform example gives samples `[1,-1]` from indices 1 through 2, and the PCM example gives `[0,-1,0,1]` from indices 2 through 5.
Independent Python arithmetic recomputed both four-sample waveform bins as min=-1, max=1, RMS=0.75.
Independent Python `struct.pack` recomputed the i16 bytes as `01 00 fe ff ff 7f` and the f32 bytes as `00 00 00 00 00 00 80 3f 00 00 00 c0`.
The cancellation and mute ratios in the numeric table correctly express the specified strict 60 dB and inclusive 40 dB amplitude reductions.
The resampling reference is the independent whole-lane scipy result and the self-check threshold remains strictly below `1e-4`.
The invocation arithmetic is 21 baseline invocations plus 7 reserve invocations, totaling 28, and the stated 1.5-times threshold is 42.
M0 performance evidence is correctly limited to §17 row 1, with three measurements per available device and later rows deferred by the lifecycle allocation.
No application tests were run because this assignment reviews the plan before implementation.

## Notes

The stated initial count of eight sol invocations exceeds the seven explicitly named seats consisting of one Planner and six Task Reviewers.
The amendment should label the extra seat or correct the allocation without changing the total reserve silently.
The git-executor conflict is already accurately acknowledged in the plan and is not evidence that human git authorization is missing.
The ordinary M0 code and test write sets are bounded, and the unrelated root npm files are explicitly excluded.
The current review makes no finding about implementations, dependency compatibility, or browser availability that have not yet been observed by recon.
