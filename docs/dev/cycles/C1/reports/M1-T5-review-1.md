# M1-T5 semantic Task Review 1

Verdict **FAIL**.
Required action **modify** the request dependencies, response metadata binding and Welch interval eligibility in the existing task paths.

## Reproduced issues

1. `frontend/src/panels/FrequencyAnalysis.tsx:40` and `:65` depend on the full view objects, so changing display settings reruns the analysis request with identical inputs.
   With one mono lane and one view in real Chromium, changing dB range, palette and texture filter each produced exactly one POST to the lane spectrum endpoint and zero spectrogram GET requests.
   DESIGN §9.3 and M1.8 require these display updates to make zero requests.
   Changing FFT produced one spectrogram GET and one analysis POST, and the latter has a changed analysis input.
   Bind analysis requests to fields that affect their input and extend the browser regression to observe both endpoints for the display-only actions.
2. `frontend/src/panels/FrequencyAnalysis.tsx:61`, `:73` and `:90` retain prior curves while computing their axis unit from the newly chosen method or unit.
   With a real frame already plotted and the next full request held in Chromium, the panel kept one visible canvas and the previous `:frame` series while switching its declared unit from dBFS to dB.
   When the held response was released, the series became `:full` with the correct dB unit.
   DESIGN §8.4 assigns different scales to these values, so a pending transition must keep the old values and their old unit together or hide them until the new response arrives.
   Add a regression with a held distinct-method or distinct-unit response that checks the actual rendered series and its unit.
3. `frontend/src/panels/FrequencyAnalysis.tsx:43–46` rounds the Welch interval duration instead of rounding the two lane-relative endpoints as the spectrum route does.
   At 8 kHz with a 256-sample window and a zero-offset mono lane, entering 0.000055 s and 0.031956 s in the Start and End controls showed “No spectrum available for the current time or selection” and produced zero analysis requests.
   A direct authenticated POST with those exact endpoints and the same Welch settings returned HTTP 200 and a 1204-byte framed spectrum.
   The endpoints round to sample indices 0 and 256 while rounding the interval duration yields 255.
   Preserve the lane clock and match backend interval eligibility at sample boundaries, including offset and tie behavior where relevant.
   Add a browser regression with a valid boundary interval that currently suppresses its curve.

## Reviewed behavior and evidence

The client transmits the selected transform parameters and project times to the existing framed endpoint and uses the returned frequency coordinates and statistic names.
The independent audit's six scoped Chromium tests verify frame, Welch and full, known fixture peaks, multi-lane identities and different FFT settings, stereo spectrogram hover channel, hover abort, restored M0 layout, and HTTP and malformed-frame behavior.
The source coalesces hover events to animation frames and aborts superseded requests, and the tests verify that Welch does not issue requests from hover.
The screenshot shows the new docked analysis canvas, two legend entries from the same source audio, an axis in Hz and a dB axis.
The observed 10,000 Hz log tick comes from uPlot's default range padding and the plotted series end at the returned 4,000 Hz bin for the 8,000 Hz fixture.
The response coordinate handling does not fabricate out-of-band values.
The two new test files leave the existing assertions intact.
I read the Worker's red and green logs, which show the prior malformed-frame fixture failed to surface its RangeError and the corrected fixture passed.
I ran two focused real Chromium probes using isolated runtime data and the established check lock, and did not repeat the unchanged scoped suites.

## Rule dispositions

The task rule check returned `0 FAIL, 2 REVIEW`.

- `REVIEW C1 frontend/src/api/client.ts:16` is allowed under V1#1 because the handler classifies the fetch boundary's network TypeError for notification, and rethrows other errors, including cancellation, unchanged.
- `REVIEW C1 frontend/src/panels/FrequencyAnalysis.tsx:61` is allowed under V1#1 because structured HTTP errors already show a notification, network errors receive a notification here, superseded requests are canceled under DESIGN §9.3, and other errors on the current request propagate.

## Covered state

The task HEAD and comparison base are `b2babb0c9fc8bc8a639a51910581dafb30075131`.
The six source hashes and screenshot hash match the independent mechanical audit.

```text
64aa6735c67642743e93e669d7d30f4838acc219ce2ff91eddb6dd28ff3c8166  frontend/src/App.tsx
c9415d87fcd3e516cddc04c289fade33d541f1704087604a310d47089055658d  frontend/src/styles.css
6de58038f0c0cca55ae46aee3b962b30b7c7263bd1cd420fdd68452eb4e4ad81  frontend/src/api/client.ts
59568cb8430993822f938b82fd98a1aee4ebd7ddde5e55f591bf87292e41230a  frontend/src/panels/FrequencyAnalysis.tsx
8c2025ba1590a14b8da898e73338cc17c6063df32e224b7df868b3266d45b7cd  frontend/tests/frequencyAnalysis.test.ts
358c924c3bbe168bbaa10f6be981375d732716eda4307a72b84d6d3378775512  frontend/tests/e2e/m1-frequency.spec.ts
dd48ded5b7f038bac99973e39a123a7d674b2f410c832b8d7a8705060a7ce6ff  frontend/test-results/screens/M1-frequency.png
```
