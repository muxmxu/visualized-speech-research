# C3 — Dataset analysis and RIR, target 0.3.0

Start after accepted M5, using the accepted product commit and any verified release-only or records changes on the actual cut. H55, H59 and D51 keep the feature sequence moving while formal publication prerequisites remain with their releases. Preserve the full DESIGN §19 acceptance for the first complete M7 product.

| Phase | Dependency | Scope and exits | Risk |
| --- | --- | --- | --- |
| M6 | Accepted M5 | DESIGN §§8.6, 13 and 16 dataset scanning and shared CLI cache, filtered table, plots and CSV. M6.1–M6.5 and M6.C1–C3. [M6 phase plan](phase-M6.md). | Normal. |
| arch-M7 | Accepted M6 | Specify the approved H48/B4 RIR coefficient-versus-delay view and direct/subsequent arrival inspection, its relationship to the existing RIR views, and observable acceptance under the existing H48 decision. Independently review and record the exact DESIGN delta before M7 dispatch. | Normal. |
| M7 | Accepted arch-M7 | DESIGN §14 RIR analysis and ESS measurement, §16 public DSP/plot entry points and phase arch-M7 deliverables. Include broadband/band EDC, Lundeby, T20/T30/EDT, C50/C80/D50/DRR, H48 coefficient versus delay, delay calibration, invalid-take reporting and the runnable hardware checklist. M7.1–M7.5, M7.C1–C3 and H48/B4 evidence from the approved architecture delta. | High because it measures and analyzes real audio. |
| Release | Accepted M7 | 0.3.0 installable candidate, R3.1–R3.6. Formal release marker and publication R3.7 follow the recorded prerequisites. | Normal. |

H3 is covered by M6. H10, H48 and H49 are covered by M7 and arch-M7. ARCH plans and M7 implementation are specified at their respective stage. Keep the prior feature and acceptance evidence, B1 in backlog, and B2 with the Human publication gates. The documented physical checks and UI review remain Human outcomes under project gate 4.

| Exit | Release evidence |
| --- | --- |
| R3.1 | Required AGENTS and LIFECYCLE regression for M0–M7. Reuse evidence when tested inputs match in mode and bytes, and run affected checks when they change. |
| R3.2 | Complete bidirectional DESIGN drift audit and protection, public-signature and privacy checks on the candidate. Record dispositions for concrete findings. |
| R3.3 | DESIGN §21, plugin and manual-check documentation, changelog and reports agree with the result. |
| R3.4 | Measure §17 rows 1–7 under the existing lock, three-sample medians per platform and available device. Compare to the previous same-platform result and prior release evidence when available. |
| R3.5 | Set the 0.3.0 version, changelog and Chinese release acceptance report. Pin candidate commit and artifact identity. |
| R3.6 | Build and install the wheel in an isolated clean environment, perform LIFECYCLE Delivery smoke and retain logs in ignored state. |
| R3.7 | After the applicable B2 decision and final Human public-repository scan, create the annotated `v0.3.0` marker and follow existing H34–H36 publication authorizations. Report actions and outcomes actually observed. Package-index publication requires separate authorization. |

Estimated budget is 43 invocations, including four independent phase Plan Reviews, two milestone integrations, architecture integration, release candidate preparation and associated D38 Git tasks. M6 estimates 14 invocations, including one Astra Plan Review. Use the existing environment and warm caches, and keep review/rework bounded by ORCHESTRATION.
