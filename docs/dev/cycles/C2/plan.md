# C2 — Recording and analyzers, target 0.2.0

Begin from the accepted M3 product tree at `7cf8df9c5ee64abfbbdc9aa0b355190d1c8d5dc8`, plus any verified records or release-only changes already on `master` when cut. Under H55, H59 and D51, C1 candidate preparation and the pending external publication prerequisites are independent of M4 product delivery. Carry the full §19 acceptance criteria forward. Prefer the normal end-to-end workflow, focused checks and a single final regression for each changed product tree.

| Phase | Dependencies | Scope and exit criteria | Risk |
| --- | --- | --- | --- |
| M4 | Accepted M3 | DESIGN §11 authenticated device discovery, input meter, recording and live waveform, overdub, calibration and mixdown. M4.1–M4.6 and M4.C1–C3, with an executable Human recording checklist. [M4 phase plan](phase-M4.md). | High because recording writes user audio. |
| M5 | Accepted M4 | DESIGN §§7, 9, 12 and 18 analyzer registry, hot reload, plugin parameters, six result types and four built-ins, including overlays and Frequency Analysis integration. M5.1–M5.4 and M5.C1–C3, with the runnable F0 example in `docs/plugins.md`. | Normal. |
| Release | Accepted M5 | Prepare the 0.2.0 installable candidate and evidence R2.1–R2.6. Formal release marker and publication R2.7 follow their prerequisites. | Normal. |

M4 and M5 each use one Plan Review, two disjoint authoring slices and one integration task. The M5 plan binds its backend and browser protocol after M4 is accepted. Its criteria retain plugin discovery and reload, visible traceback with server recovery, all six output types with browser-visible counts, and the required f0 overlay and Griffin–Lim duration checks. Scope does not require an architecture phase. Record internal bindings in DESIGN §21 through the milestone integration task.

## Release criteria

| Exit | Evidence |
| --- | --- |
| R2.1 | Full AGENTS and LIFECYCLE regression evidence for the candidate, including M0–M5. Transfer prior passing checks only for proven identical inputs and run checks affected by the release version or other changed inputs. |
| R2.2 | Bidirectional DESIGN drift audit of implemented M0–M5 scope and protection and public-repository checks. Resolve concrete findings or record their dispositions and any applicable gate. |
| R2.3 | DESIGN §21, `docs/plugins.md` and the M4 portion of `docs/manual-checks.md` match the implementation. |
| R2.4 | All seven §17 rows measured under the existing checks lock on each existing run platform and available device as three-sample medians. Record comparisons with the preceding same-platform result and with C1 release data when available under LIFECYCLE. |
| R2.5 | Candidate version 0.2.0, matching changelog and `docs/acceptance/release-0.2.0.md` with milestone evidence, deviations and unresolved items. |
| R2.6 | Built wheel installed and exercised in a clean temporary environment using LIFECYCLE Delivery. Keep the wheel and logs in ignored state storage. Pin the candidate commit and artifact identity. |
| R2.7 | Formal release marker is the annotated `v0.2.0` tag on the accepted release commit. Resume this publication step after the applicable Human-owned B2 license and attribution decision and final Human public-repository scan are recorded. Tag push and conditional GitHub Release follow H34–H36 and LIFECYCLE; package-index upload requires separate authorization. Report only actions actually completed. |

H5 recording is covered by M4 and H9 visualization plugins by M5. The M6 dataset and M7 RIR milestones and B4 stay with C3. B1 remains in the backlog, B2 remains with the Human publication gates, and the C1 B5 disposition stays with C1. M4 hardware and post-M1 UI review are Human checks under project gate 4 and do not block the feature sequence. Candidate qualification and feature progression follow D51 while external prerequisites are pending.

Budget estimate is 34 invocations, including three independently reviewed phase plans, two product milestone integrations, one candidate integration, D38 Git executor transactions and three Astra-equivalent seats for the phase Plan Reviews. The M4 phase estimate is 14 invocations, including one Astra-equivalent Plan Review. No paid compute or new runtime dependencies are planned. ORCHESTRATION governs the overrun threshold and bounded rework.
