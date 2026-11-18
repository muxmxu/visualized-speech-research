# M1-T4b semantic review 1

Verdict **FAIL**.
Required action **modify** the tab styles, the toolbar wrapping and the focused browser regression within the four-file task scope.

## Issues

1. `frontend/src/styles.css:82` increases horizontal padding on every dock tab, leaving the Properties and Settings labels almost entirely hidden at 800 × 600.
   On a fresh 800 px workspace in Chromium, their label boxes measured 12 and 9 px, down from 32 and 25 px on T4, while the full labels need 59 and 47 px.
   After reloading the same workspace with a saved 120 px inspector, their label boxes measured 1 and 0 px, down from 21 and 16 px on T4.
   The condensed labels have no title tooltip.
   Dockview's more specific selectors also override the requested foreground and background colors, leaving an inactive inspector tab at RGB 98 on RGB 45 and its selected tab at RGB 143 on RGB 30 when Files has focus.
   Keep narrow dock tabs identifiable at the existing saved widths and apply the §9.5 colors through effective theme variables or selectors.
   Add a focused browser assertion for the visible labels and computed selected tab colors on a saved narrow inspector.
2. `frontend/src/styles.css:70` applies `nowrap` to the time fields at every viewport width.
   In real Chromium at 480 × 600, T4 had a 480 px document and its Duration field fit, while T4b had a 499 px document and the Duration field ended at x = 498.84 px.
   Allow the measurement group to wrap when it cannot fit and preserve whole groups at 800 px.
   Add a focused regression for visible Duration and no document overflow at the reproduced width.
3. `frontend/tests/e2e/m1-spectrogram.spec.ts:113` checks keyboard access to the last lane, while the captured two-view fixture selects the first lane.
   Scope the Lane name, Gain and Offset locators to `.lane.selected-view` so the test checks the required active controls.

## Observations

Both T4b captures show stronger lane names, distinct pressed toolbar and mode controls, blue active-tab underlines and Spectrum, Frequency and Color sections in Display.
The desktop capture shows all Display actions, and the 800 px capture places time fields on a second row and continues Display in a panel that the existing test successfully scrolls to Copy spec.
The dock positions and horizontal plot alignment match the T4 captures at both sizes.
Direct RGB comparison showed zero changed pixels over the two inner plot rows in both fixtures after accounting for the toolbar moving them down 3 px at 1280 × 720 and 2 px at 800 × 600.
The compared crops covered 195,570 desktop pixels and 97,308 narrow pixels, including waveforms, spectra, selection and playhead.
The code retains the rendering paths, 160 px initial row height, 30/70 split, layout restoration, file actions and Display handlers.
The test diff retains all previous assertions, and the independent mechanical audit recorded all 40 Chromium and 29 Vitest cases passing.
The review ran only the focused Chromium comparisons and the rule and whitespace checks.
The rule check returned `0 FAIL, 0 REVIEW`, with no dispositions needed.

## Covered state

The reviewed base and task HEAD are `411e0cf9a65614d9a3374bb5a4a8b08ea025b170`.
All four source and test hashes and both screenshot hashes matched the independent mechanical audit.

```text
2c1602090e4a01f5bfef563454f8aff578267ec2bf7d8b32f8e8355748d2f64c  frontend/src/App.tsx
ecb5bda20dbf05e55f3f8f423ad105236e11c9c8c88ed117b36a9e2cf226c3cb  frontend/src/styles.css
eb2c2f80baecdb77ae1f3bd2c8ba027d37553f47a1f43334a58d456483969708  frontend/src/panels/Display.tsx
b7aa9fcd78ec75ff92b30ca2f92b248a89e624eed69f7b62e76d80355e82ddfe  frontend/tests/e2e/m1-spectrogram.spec.ts
a3ab58718fcf3c4cdfa3c8e8268b0cea47514744e47374be9f9470166f6413d8  frontend/test-results/screens/M1-ui-desktop.png
18ba6f057c37b0ef05d36926f80797c32d8996ca99887a9704ce51b2513ad46e  frontend/test-results/screens/M1-ui-narrow.png
```
