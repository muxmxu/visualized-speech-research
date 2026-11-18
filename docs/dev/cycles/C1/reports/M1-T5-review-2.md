# M1-T5 semantic Task Review 2

Verdict **PASS**.
Required action **none**.

## Resolution of review 1

1. The analysis dependency includes the lane clock, source identity and version, transform parameters and other analysis inputs, and excludes the spectrogram's display range, palette and texture filter.
   An independent Chromium probe observed zero spectrum or spectrogram requests for each of the actual dB range slider, Palette and Filter controls after the initial plot settled.
   On the same mono lane and view, changing FFT caused one spectrogram GET and one analysis POST.
2. Curves and their unit now enter the plot state together from the same response batch, and the rendered uPlot y axis and the plot's unit attribute both read that state.
   With the full request held in real Chromium, the existing visible frame curve kept its dBFS label while the panel indicated analysis was pending.
   Releasing that request yielded a full-method curve labeled dB.
3. The Welch eligibility check uses the difference of individually rounded lane-relative boundaries and applies the same sample-envelope limits as the route.
   The helper subtracts offset before multiplying by sample rate and rounds half ties to even, including negative ties, matching Python's rounding on the corresponding finite sample coordinates.
   The zero-offset browser regression passed in audit 2.
   An independent Chromium probe also set an offset of 1 s, entered 1.000055 s and 1.031956 s on the 8,000 Hz lane with a 256-sample Welch window, and observed an HTTP 200 response and a plotted mean curve.

The retained six browser cases passed in independent audit 2 and cover frame, Welch and full, mixed view settings, overlays, units and axes, hover cancellation, stereo channel choice, saved layout and error propagation.
The first 170 lines of the final browser test file reproduce the review 1 browser test SHA-256 exactly.
Removing the newly appended rounding test and its added import from the final unit file reproduces the review 1 unit test SHA-256 exactly.
The three added browser regressions have preserved red logs from the review 1 tree and a green log on the corrected tree, and all nine passed independently in audit 2.
I ran one focused Chromium probe with a temporary runtime directory under the shared check lock and verified the final diff, hashes and rule output.

## Rule dispositions

The rule check returned `0 FAIL, 2 REVIEW`.

- `REVIEW C1 frontend/src/api/client.ts:16` is allowed under V1#1 because it identifies a fetch network failure for notification and rethrows other errors.
- `REVIEW C1 frontend/src/panels/FrequencyAnalysis.tsx:77` is allowed under V1#1 because HTTP and network errors are reported through notifications, superseded requests are aborted per DESIGN §9.3, and other errors on the active request propagate.

## Covered state

The task HEAD and comparison base are `b2babb0c9fc8bc8a639a51910581dafb30075131`.
The six source hashes and the screenshot hash match audit 2.

```text
64aa6735c67642743e93e669d7d30f4838acc219ce2ff91eddb6dd28ff3c8166  frontend/src/App.tsx
c9415d87fcd3e516cddc04c289fade33d541f1704087604a310d47089055658d  frontend/src/styles.css
6de58038f0c0cca55ae46aee3b962b30b7c7263bd1cd420fdd68452eb4e4ad81  frontend/src/api/client.ts
a26f151cea578ac3ecc0d42d01a5baf246e79a13cb3dab9dc891b5334b07d91c  frontend/src/panels/FrequencyAnalysis.tsx
2c5a7bb0147f05b527258636cc7e02cf1c6a40eace94e791c3ce7a6db88a7e5e  frontend/tests/frequencyAnalysis.test.ts
b56f4812172069d20f28b696884e3c80bf2bcad25830b642d05cddd40299aab9  frontend/tests/e2e/m1-frequency.spec.ts
1a83494c60b317c1a4f5968f97edccd402adb9ad1400f4de06a507cfee221847  frontend/test-results/screens/M1-frequency.png
```
