# C1 M1-T4 executable task plan

## Dispatch and write set

Deliver the H54 workspace repair together with per-view spectrogram rendering, Display and spectral hover under DESIGN §§7, 8.1, 8.3, 9, 16, 19 and 20.
Branch `task/M1-T4` from the independently accepted and committed `task/M1-T3` tip after the Controller binds the exact base SHA and verifies its ancestry through reviewed M1-T2 commit `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
T4 is serial after T3, precedes T5, and supplies the active view and hover for T5, view identity and geometry for T6, and actual plot surfaces and layer order for T7.
Dispatch the high-risk multi-module Worker as `terra(high)`, an independent Mechanical Auditor as `luna(xhigh)` or the CODEX `terra(medium)` fallback, and an independent Task Reviewer as `sol(high)` per the M1 phase plan.
Use the existing M1 budget with one Task Planner, one Worker/Auditor/Reviewer round and one D38 Git executor in the nominal T4 sequence.
The Controller binds the clean task worktree, exact base, dependency environment, Chromium selection and one exclusive worktree-checks lock in the private dispatch ledger, using a bounded Fact Check only if a material bound fact is unresolved.

The exact tracked write set is listed below.

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/api/client.ts`
- `frontend/src/api/types.ts`
- `frontend/src/state/spectralViews.ts`
- `frontend/src/state/viewport.ts`
- `frontend/src/lanes/SpectralLane.tsx`
- `frontend/src/render/spectrogram.ts`
- `frontend/src/render/colormap.ts`
- `frontend/src/panels/Display.tsx`
- `frontend/src/audio/testHook.ts`
- `frontend/tests/spectrogram.test.ts`
- `frontend/tests/viewport.test.ts`
- `frontend/tests/e2e/m1-spectrogram.spec.ts`

Keep implicit writes to the task-local dependency and build outputs, browser results and caches, and generated audio and temporary VSR_HOME allocated by the existing fixture with a random loopback port.
Keep packages, configuration, backend and framed codec outside the write set and use the existing audited Git handoff under D38.
If implementation reveals an open design choice under AGENTS.md, report its proposed decision to the Controller for an explicit record and any required write-set amendment before editing protected or unlisted paths.
Frequency Analysis, the E tool, audition, floating playback and PDF export belong to T5–T7, and mel and feature-lane support belong to M2.

## H54 workspace repair

1. Group available transport, tools and measurements in the fixed top bar with tight spacing inside groups and a visible separator or larger gap between them.
Use Tabler icons with accessible action names, available shortcut tooltips, pressed state for toggles and a visible keyboard focus indicator, and retain existing Play, Pause, Stop and shortcut behavior.
Show playhead time as `h:mm:ss.mmm` and keep numeric Start, End and Duration fields at stable tabular widths with millisecond rest-state precision, full internal precision and direct editing.
2. Align editable lane names, muted metadata with units, row actions, Gain and Offset in a consistent header grid.
Mark the active view with a narrow blue edge and indicate its W, S or W+S mode visibly and with a pressed state.
Add view creates a separate row for the same source lane and independent display settings, with playback, time selection, gain, mute, solo, lane offset and multichannel playback selection continuing to use lane identity.
3. Measure one shared CSS-pixel plot origin and width for ruler marks, overview, waveform and spectrogram, reserving aligned gutters for frequency labels and the colorbar.
Keep tick labels inside the available width without shifting the tick positions, map overview endpoints into its full-lane extent, and use the amber playhead and the specified selection fill and edge colors across the view plot.
Start rows at 160 px, give W+S a 30/70 split and implement the row-bottom and W+S divider drags.
Keep T/V gestures and time-selection handles on the common per-view plot surface across waveform and spectrogram, so the existing M0 absolute-pointer regression also exercises the 160 px W+S row.
4. Apply all DESIGN §9.5 colors to the dock tabs, dividers, plot chrome and inspector, with 12 px base type, 24 px controls, dim secondary labels and aligned labels and values.
Place Display in the Properties/Settings group and activate it for a fresh layout.
For a saved M0 layout add exactly one Display tab to the existing inspector group, persist the migrated JSON and keep existing tabs, active tab, locations and sizes.
5. Group the Files path entry, parent navigation and Go, align Files and Recent row spacing, and ellipsize long paths while exposing the full path on focus or hover.
Keep existing navigation, file-open and upload entry points.
6. Reflow the top bar by whole groups and derive initial side widths from available space so the plot and inspector work at both target sizes.
Keep pane resize and explicit docking functional and retain saved proportions and focus during live resizing, with scrolling inside the inspector and lane list.
Reuse existing interaction conventions under DESIGN §9.6 and use the repository's palette, typography and Tabler assets throughout.

## State, endpoints and renderer

Keep a stable view ID distinct from the source lane ID, track the active view across rerenders, preserve independent FFT, display and frequency state, and select a surviving view when its active predecessor is removed.
Use the same project clock for requests, waveform, spectrum and pointers, with lane-relative sample numbers used only for readouts.
Default audio to W+S and display C ≤ 2 in stacked channels, using one spectral request per displayed channel and the selected channel for C > 2.
Use the existing authenticated client for `GET /api/presets?sr=<source sample rate>` and `GET /api/lanes/{id}/spectrogram` with `t0,t1,width,height,f_lo,f_hi,yscale,channel,mode=stft,n_fft,win_length,hop,window,window_param`.
Read resolved presets from the server, start from analysis with heat, preserve the selected colormap when applying a preset, and resolve rate-dependent preset values at each destination rate for Apply to all lanes.
Make the common FFT dropdown changes atomic with any dependent valid parameters and keep view-only actions scoped to the active view.
Provide parameters, linear/log frequency controls, frequency zoom about the pointer with Alt+wheel, frequency-axis drag to pan, colorbar visibility, range drag, palette and LINEAR/NEAREST filtering, and format Copy spec from the active view using the exact §16 key order and omission rules.
For auto80 compute ceiling `10 * ceil(lane_db_max / 10)` and floor `ceiling - 80`; as a concrete oracle a lane max of −12.25 dB gives [−100,−20] even when the visible maximum changes.
Decode one framed C-order f16 matrix and use `rows,cols,row_freqs,col_t0,col_dt,f_axis,view_db_max,lane_db_max` from the response, including null viewport maximum and empty coverage.
Use the supplied column centers and row frequencies for placement and hover, honoring irregular terminal row spacing and the effective linear or logarithmic axis boundaries.
Place low frequencies at the bottom and share the frequency transform between axis labels, texture placement, hover and the future selection surface.
Report the displayed lane, project seconds, lane-relative sample, Hz and approximate decoded f16 dB, with hover sampling the last displayed texture and no analysis request in T4.
Add per-view latest spectral responses to the existing dev/test-only `window.__vsr_test` surface without changing the existing RMS, playhead and playing methods.

Reuse the existing viewport scheduling pattern for immediate cached UV redraw, 60 ms trailing debounce and a request at least every 150 ms during uninterrupted gestures.
Use one request owner per view/channel, abort its previous request before a replacement, ignore superseded responses and release timers, observers, textures and controllers when the owning surface leaves.
Measure width and height in CSS pixels and request a horizontal interval extended by 25% on each side at 1.5 times the visible width, using positive integer dimensions only for positive plot sizes.
As a request oracle, `t0=1`, `secondsPerPx=0.01`, `width=200` and `height=80` yield `t0=0.5`, `t1=3.5`, `width=300` and `height=80` at DPR 1 and DPR 1.5.
Limit cached reprojection to covered time and frequency, paint uncovered portions with the plot background and leave response application scoped to its view/channel.
Use one WebGL2 canvas for Lanes, one viewport per full plot rectangle and one scissor per visible intersection with its scrolling ancestors, using bottom-left framebuffer coordinates and DPR for raster geometry.
Upload f16 data as R16F with `UNPACK_ALIGNMENT=1`, draw with the DESIGN §8.3 dB normalization and §9.5 256-color LUTs, and update color range, palette and filtering locally.
Redraw on scroll, resize, data and display changes, preserving actual axes, colorbars, waves, selection and playhead surfaces in compositing order for T7.

## Objective verification and artifacts

Use Vitest for time round-trips, overview interval mapping, linear and logarithmic frequency round-trips, returned grid placement, half decoding, LUT and spec output, and scheduler behavior on fake time.
Include the independent coordinate fixtures that a [1,3] s window spans x=0–200 in the visible plot and x=40–120 in a 200 px overview of [0,5] s, and that 100, 200 and 400 Hz occupy bottom, middle and top of a 100–400 Hz log axis.
Assert f16 words `0x0001`, `0x3c00` and `0xc000` decode to `2^-24`, 1 and −2, and use the §9.5 heat endpoints `#000000` and `#fffbe6` as LUT checks.
Drive a burst at 0, 30 and 55 ms and require an immediate redraw per input and a single trailing request at 115 ms, then exercise sustained changes to verify the 150 ms bound and disposal of scheduled work.

Use the real Playwright Chromium and authenticated backend with generated PCM16 WAVs, temporary VSR_HOME and random ports through `frontend/tests/e2e/fixtures.ts`.
Begin the H54 bug fixes with observable regressions against the old tree under T2 and preserve all existing M0 test assertions.
Generate 16384 mono samples at 16 kHz with amplitude 0.5 bin-centered sines at 1 kHz over [0.125,0.375) s and 3 kHz over [0.625,0.875) s and silence elsewhere.
Fit that 1.024 s lane at desktop width, preserve hop 128 with FFT 512 and 1024 in the respective two views, and use 750–1250 Hz and 2500–3500 Hz ranges for the respective tones.
For a buffered query at width at least 129, the 129 frame centers at 0 through 1.024 s remain unpooled, giving odd `cols=129`, `col_t0=0` and `col_dt=0.008` s at zero offset.
Verify that actual framed response, request query, visible pixel placement and approximate hover readout through the app, and use a nonunit DPR case to check CSS request dimensions against independently measured DOM rectangles.
Decode a real viewport screenshot with Chromium's image decoder and Canvas2D, then sample small interior regions at analytic tone coordinates away from note edges, text and selection overlays.
Require each tone's patch to be brighter than its same-band quiet patch, require the other time band to stay dark in that view, and sample outside the spectral clips for the underlying background before and after scrolling or panning.
Keep a real replacement response pending while panning and verify cached content shifts to the matching position and newly exposed uncovered regions show the background before allowing the current response through.
Count requests and observe cancellation around actual UI interactions, with any temporary endpoint hold forwarding the real request and releasing it on cleanup.

For M1.8 start with a single mono view, let the initial requests and debounces settle, drag the dB range and require zero data requests and changed rendered colors, then change n_fft once in its dropdown and require exactly one spectral request with the new value and one replacement draw.
Also assert that palette and filter changes use the local path and that an axis or frequency-range change requests the new bounds.
For M1.9 click Add view, require two rows for the same source ID, edit their FFT values independently, and click each view to verify Display's target and the displayed FFT.
Open a second source lane, invoke Apply to all lanes and verify the selected setting reaches both source lanes through real requests.
Exercise preset selection, retained palette and Copy spec by reading the Chromium clipboard after granting the test context clipboard permission.
Seed a serialized M0 `vsr-layout` with `lanes`, `files`, `properties` and `settings`, a resized side group and active Settings, and verify layout geometry, active Settings and one reachable Display after navigation and reload.

Capture a fresh desktop layout at 1280 × 720 and a fresh narrow layout at 800 × 600 with a generated mono lane, two independently configured views, a visible selection and Display active.
Use two 160 px W+S rows with the fixture's two distinct tone bands, heat and the common [0.20,0.80] s selection, keeping both plotted tone interiors, the selection edges and the amber playhead visible without scrolling at capture time.
Position the playhead with the selection gesture at its start, leaving the other selection edge and quiet intervals visible so the screenshot shows waveform, RMS band, spectrogram texture, frequency labels, colorbar and contrasting view state.
At both sizes assert document width fits, transport and time fields have nonoverlapping bounds, Play and Stop act on real playback, and each visible plot has positive width.
Compare measured ruler marks and waveform/spectral playhead or selection positions using the same project time, compare the overview box edges to the independently normalized viewport bounds, and repeat after resizing a live desktop page to 800 × 600.
Use keyboard Tab to focus a time field, edit its value, and establish a selection before resizing, then verify focus and selection survive and the new geometry still aligns.
Verify the Settings tab exposes the fixture's forced self-check reason and then restore Display for the workspace captures.
Save `frontend/test-results/screens/M1-workspace-desktop.png` and `frontend/test-results/screens/M1-workspace-narrow.png` in the task worktree and record their actual paths for the independent reviewer.
Use screenshots as human evidence under §20 alongside the objective browser checks.

Run `npm run typecheck && npm test && npm run lint && npm run build` from `frontend/`, and verify the production bundle excludes the test hook.
Before browser execution build the test-mode served assets with `npm run build -- --mode test`, then run `npx playwright test --workers=1 tests/e2e/m1-spectrogram.spec.ts tests/e2e/m0-workspace.spec.ts tests/e2e/m0-playback.spec.ts` with the host-selected Chromium when required by §20.
Use the verified T3 cut SHA for the rule check, run `git diff --check`, and audit scope, protected sections and the public-repository scan under LIFECYCLE.
Return M1.8 and M1.9 request counts, viewport and hover observations, measured geometry and pixel evidence, checks and dispositions, screenshot paths and changed-file hashes for independent verification.
The Controller advances to T5 only after current independent verdicts and the D38 task commit.
