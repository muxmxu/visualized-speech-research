# M1-T7 independent semantic review 2

**PASS.**
Both findings from review 1 are closed on the frozen T7 tree based on `b419b77beeddcfedb00c3654506866c83a8a7d11`.

- The old implementation initiated a PCM request for 0.200–0.700 s when a PDF drag started on floating Play.
  The tracked regression reproduced that request before repair.
  On release the corrected handler intercepts the initiating pointer and installs a capture-phase listener that consumes its synthesized click before the button's React handler receives it.
  The same path handles a zero-area release.
  Escape during a drag retains a release listener keyed to the initiating pointer after the tool unmounts, cleans it up on release or cancellation, and suppresses the associated click on release.
  An unused click listener expires on the next timer turn.
- The final real Chromium test downloaded the positive-area crop, preserved the time selection and paused transport, and observed zero PCM requests after the drag, Escape and zero-area gestures.
  Clicking floating Play normally afterward produced PCM and changed the transport to Pause.
  The independent ordinary cancellation case also verified zero downloads for Escape and zero-area gestures.
  The eight PDF cases passed in 48.3 s and all 37 Vitest cases passed.
  Typecheck, lint and both builds passed in the same final log.
- The blanket catch and its notification import have been removed from the browser-only export handler.
  The previously reviewed geometry, layer composition and PDF writer retain their audit-2 hashes.
  All six unaffected files match the audit-2 manifest.
  The final SHA-256 values are `717145841b7a0419961785f11c8cbe9fd8af039156e961557839df5dcd09e611` for `ExportSelection.tsx` and `2f432c4a45d497a26115eb07650f0d04781abfa9950fb8a8a5d95797f844a339` for `m1-pdf.spec.ts`.
- The prior narrow-layout brightness failure also reproduced on accepted T6 and remains assigned to T8 integration with the original assertion.
  This review inspected the frozen source, hash evidence and red/green logs and made no task-worktree or Git changes.
