# C3 arch-M7 — RIR arrival inspection

Start from accepted M6 `f478d71d9d1cb6745557f8bc874c8191686fbe05`. Bind that exact DESIGN baseline and D55 to H48/B4 and H49. Plan Review uses the exact frozen Chinese insertion SHA-256 `66b523827a5dac0ea807b067e4e0dd352df22abf0899211de8b49f45eba9ab01` in ignored state. H48 authorizes the coefficient/arrival view, and H49's C50 and T20 remain part of §14. The phase has one spec task with a normal-risk estimate of seven invocations, including one independent Astra Plan Review.

## A1 — Deliver the approved §14.1 addition

Write set is `docs/DESIGN.md` only. Insert the three bullets verbatim after §14.1's existing RIR panel bullet and before §14.2. Append a single numbered §21 decision recording the H48/B4 view, the existing onset as the initial direct reference and the reuse of framed waveform reads. The approved §19 text, §9.7 capture domains, public signatures, endpoints, settings, dependencies and hardware instructions are outside this diff. M7 verifies H48 in its own acceptance report.

Worker `6.2-sol(high)`, independent Mechanical Auditor `6.2-sol(medium)` as the existing fallback and Task Reviewer `sol(high)`. Audit checks are the exact insertion, append-only decision, LIFECYCLE DESIGN section comparison and public-repository scan, `git diff --check <cut>`, and `python3 scripts/check_diff_rules.py --base <cut>`. Require changes confined to §§14 and 21 with identical preamble and headings. Carry forward checks with unchanged runnable inputs under H59. The D38 executor integrates the accepted spec patch and verifies equality on master. Cut M7 from the delivered spec delta.

## Independent H48 acceptance for M7

Generate a mono 48 kHz FLOAT impulse response with zero elsewhere and the three exact pulse samples below. Open it in the real browser, analyze it with `use_lundeby=false` and verify the initial marker is the §14.1 onset even with a stronger later negative pulse.

| Sample | Coefficient | τ | Δτ from sample 240 |
| --- | --- | --- | --- |
| 240 | +0.5 | 5.000 ms | 0.000 ms |
| 480 | −0.75 | 10.000 ms | 5.000 ms |
| 840 | +0.125 | 17.500 ms | 12.500 ms |

Drive time zoom until the visible section returns raw waveform samples with `first_sample`. Click the later pulses using the fixture's sample positions and plot coordinates, then assert the signed values, exact chosen samples and delays shown in the table. Move the direct reference to sample 480 and verify the remaining later marker reads 7.500 ms relative delay. Check the existing EDC and fit region and the C50/T20 result entries remain present, with the same results before and after marker changes, including the same unavailable C50 indication and reason when every pulse is before 50 ms.
