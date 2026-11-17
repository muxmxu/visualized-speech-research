# H54 workspace design consultation

## What the M0 images establish

DESIGN §§9.1–9.6 specify the dock layout, information groups, numeric typography, 12 px baseline, 24 px controls, semantic palette and interaction model.
They leave the widths, grouping, alignment, spacing and visual distinction between focused, selected and inactive items to implementation.
Section 19 calls M0 a skeleton and measures working playback, navigation, waveform rendering and device selection.
The screenshots demonstrate those interactions at particular test states, including a deliberately failed device check and sample-level zoom.
The absent spectrogram, Display and Frequency Analysis panels belong to M1.
Neither M0's acceptance results nor those fixture states explain the uneven control alignment.

Both 1280 × 720 captures show one nearly undifferentiated line of transport, tool and measurement controls, numeral fields with inconsistent precision and a 180 px lane header with Gain and Offset inputs starting in different columns.
The timeline, overview and signal have the same left edge, a useful alignment to preserve.
The selected lane has little visual identity, dock tabs use default-looking gray surfaces, and the long recent-file path competes with the filename.
App.tsx hardcodes a white playhead although §9.5 specifies amber.

## Implementation order within M1-T4

1. Group transport, tools and measurements within the fixed top bar using close spacing inside each group and a border or larger gap between groups.
   Use the existing Tabler library, accessible action names, shortcut tooltips and visible pressed and keyboard-focus states for available actions.
   Format the playhead in h:mm:ss.mmm and give selection fields stable tabular widths and a readable rest-state precision while preserving full internal time and direct editing.
2. Give each lane a consistent header grid with a prominent editable name, dim metadata with units, a compact action row and aligned numeric fields for gain and offset.
   Identify the active view with a narrow blue edge and a matching pressed state for its W, S or W+S mode so selecting a second view makes the Display target unambiguous.
3. Tie ruler, overview, wave and spectrogram to a shared plot origin and seconds-per-pixel mapping as the dock or lane header changes width.
   Keep readable tick labels inside the plot with adequate space at both ends, draw an amber playhead and keep the lighter selection edges discernible over the green RMS band and heat map.
   Retain the 160 px initial lane height and 30/70 default W+S split with the §9.2 drag affordance.
4. Apply the complete §9.5 palette to the dock tabs, dividers, inspectors and plotting surfaces.
   Use active-tab contrast, muted secondary labels and aligned label/value rows so Properties, Settings and Display can share one tab group.
   On first use open Display as the working inspector, keep Settings and the device failure reason reachable, and preserve an existing dock layout when adding the new panel.
5. Put the path entry, parent navigation and Go action together and give Files and Recent consistent row spacing.
   Let long paths truncate visually while keeping their complete value accessible on focus or hover and preserving file-opening behavior.
6. Reflow the top bar by whole groups on narrower windows and size the side docks relative to the available space on initial layout.
   Allow scrolling within the inspector for its real controls and within the lane list for additional views.
   Keep explicit user docking and resizing functional and do not reset saved sizes on every resize.

## Task boundary and verification

Absorb these six repairs in T4, whose existing ownership covers the shell, active view, Display and rendering geometry.
The exact H54 implementation write set is frontend/src/App.tsx, frontend/src/styles.css, frontend/src/lanes/SpectralLane.tsx, frontend/src/panels/Display.tsx and frontend/tests/e2e/m1-spectrogram.spec.ts.
T5 supplies the actual Frequency Analysis panel and T6 supplies the E tool and floating playback action using the same control styling.
No additional dependency, preference, branded asset or future-milestone control is required.

Use Chromium with a generated mono fixture containing audible and quiet intervals, one selected time span and the same lane in two real views with independently chosen FFT sizes.
Capture the initial desktop workspace at 1280 × 720 and a fresh narrow workspace at 800 × 600 under frontend/test-results/screens/M1-workspace-desktop.png and M1-workspace-narrow.png.
Also resize a live desktop workspace to 800 × 600 and verify focus and selection survive.
At both sizes verify document width fits the viewport, transport and time inputs do not overlap, Play and Stop are actionable, each visible plot has positive width, and the ruler and overview use the same time-to-x mapping as the waveform after resizing.
Verify a click in each view changes the target and displayed FFT in Display, tabbing to the time input allows editing it, and the Settings tab still exposes the forced self-check reason.
Retain the existing M0 workspace and playback assertions and T4 zero-fetch dB and single-fetch FFT assertions.
T8 can capture a desktop overview after Frequency Analysis and T-F selection are integrated.
Screenshot inspection supports human review under §20 and the observable checks supply the regression evidence.
