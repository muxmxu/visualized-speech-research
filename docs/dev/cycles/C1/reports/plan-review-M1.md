# C1 M1 independent Plan Review

Verdict: fail
Required action: replan
Report path: `docs/dev/cycles/C1/reports/plan-review-M1.md`

## Covered state

HEAD was `3ce4478bedabee7f6707b13814bdb0ca9948c067`.
The reviewed working-tree M1 plan had SHA-256 `9323968697d0bb8839890388d990c20486335b35b64df1850e29e5b910c101d7`.
The cycle plan was modified, the two phase plans and recon were untracked, and DESIGN still contained the original twelve M1 checklist items.
This review checked planning evidence and did not run implementation checks.

## Issues and required fixes

1. **The T3 masked chunk reference needs information absent from its HTTP inputs.**
   DESIGN §7 supplies one pair of time bounds, §9.4 limits the chunk to 20 seconds, and §15 applies a two-frame time transition at the selection boundary.
   A request for the same first 20 seconds can be the entirety of one selection or the first half of a 40-second selection.
   Its samples near 20 seconds then need different transitions despite identical query parameters and source audio.
   Phase M1 lines 87–94 recognize the issue but leave the interface fact until T3, after the architecture baseline closes.
   Task planning must distinguish the bounds of the selected rectangle from the delivered chunk, exhibit both cases through the approved normal entry point, and bind the masked reference to the same sample-wise tolerance at the seam.
   Resolve the contract before dispatching the dependent writer or explicitly retain a blocked T3 constraint and route any necessary spec delta through the applicable gate.
   The unmasked reference should use unequal source and destination rates with nontrivial polyphase alignment.

2. **The planned full-view timing can use the wrong signal and transform.**
   M1.10 concerns the ten-minute 48 kHz mono wideband fixture, whereas T8 row 2 uses stereo, FFT 2048 and hop 512 and row 3 permits a resized or panned view of that cache (phase M1 lines 82, 165 and 199–200).
   Make T8 time a full-lane viewport request for the exact M1.10 fixture, state the cache condition and viewport size, and keep the §17 row 3 cached interaction measurement identified separately.
   Keep the separate-process RSS ceiling at strictly less than 1.5 GiB.

3. **T4 and T5 omit an existing normal entry path for their new panels.**
   The committed workspace restores a saved dock layout through a separate branch and only creates panels in the fresh-layout branch (`frontend/src/App.tsx` lines 123–132).
   An existing M0 layout contains neither Display nor Frequency Analysis.
   T4 and T5 should bind how both panels become reachable when reopening that layout and include a regression using saved M0 panel IDs.
   The same T4 fixture should check the §9.1 Display action to apply settings across lanes, alongside the existing independent-view check.
   Both fixes fit the declared App and e2e write sets.

4. **T4’s real-browser rendering evidence does not distinguish correctly placed pixels from correct requests and metadata.**
   Phase M1 lines 100–106 and 163–164 cover the single context, scissor, upload alignment, hover and requests as implementation requirements but give no multi-view rendering oracle.
   Bind a browser observation with distinct content in two view rectangles, an odd texture width and a scroll or pan, and require correct screen placement with no bleed.
   T7 should compare the decoded PDF crop to independently observed pixels from the same frozen browser view across the spectrogram, waveform and a visible annotation, using interior regions or an encoding-appropriate tolerance for JPEG.
   This makes shifted or stale content detectable even when the download has the correct dimensions and contains every expected color.
   Keep the independent reader smoke check and leave its portable procedure to the reviewed A1 spec.

## Remaining coverage and evidence

- The matrix at phase M1 lines 156–171 assigns M1.1–M1.12, H45 M1.13 and C1–C3 to evidence owners.
- The three window checks, SciPy spectrum/density relations, log and absolute-column examples, preset dimensions, attenuation bounds and per-device parameterization match DESIGN §§8, 16, 19 and 20.
- T2 owns the single-key concurrent calculation and independent-process peak RSS, and T8 owns three-observation medians per device for §17 rows 2–6.
- A2 acceptance and integration precede T1, and T7 depends on T4/T6 rendering and interaction contracts.
- The task chain is acyclic and the serial writer, checks, browser, device and worktree locks cover shared paths and generated output.
- Each write task has a named independent audit and semantic seat, with the CODEX fallback explicitly identified.
- The arch arithmetic is 8 baseline plus 2 reserve and M1 is 39 baseline plus 11 reserve, yielding 60 combined and respective overrun checkpoints of 15 and 75.
- H45, B3 and D40 cover the visible-region single-page raster export and the narrow architecture prerequisite.
- Recon verified WebGL2 context creation, a synthetic JPEG download in a one-page PDF, and independent PDF rendering.
- Application-layer fidelity remains an implementation acceptance item.

## Notes

The contract permits one planner amendment followed by dispatch subject to remaining task constraints.
