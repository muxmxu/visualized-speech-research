# M2-T5a architecture plan review

**PASS** for the revised M2-T5a proposal with SHA-256 `12a6b7fc8f1b9cae55aa2a0bf0d57022b272e1756409884ef7c2c93f76311e80`.

1. The initial review found that the CLI could route runtime discovery, settings and staging through an environment proxy.
   The revision requires direct loopback requests and a regression that observes zero requests at the configured proxy during a warm tensor launch.
2. The initial review identified a missing event-loop owner for the cold expiry callback and a cleanup gap during app construction and browser launch.
   The revision installs the callback during lifespan startup before HTTP service and requires both failure paths to release the listener and remove the runtime file.
3. The initial review found gaps in the planned capacity, expiry and failed-claim checks.
   The revision requires HTTP 429 for the 65th registration, reuse of the slot freed by expiry, continued availability of a live entry and HTTP 404 on replay after a file-processing error.

All three findings are closed at plan level.
The private handoff fits the D43 architecture procedure under §7 with an appended §21 decision and requires no additional Scope or data-security gate.
Implementation verification belongs to M2-T5a.
