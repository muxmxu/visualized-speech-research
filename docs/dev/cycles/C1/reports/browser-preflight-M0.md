# M0 browser preflight

- The phase plan requires a temporary Playwright launch with the host-selected executable and a Web Audio probe before T4 and T5 dispatch.
- DESIGN §20 specifies passing `VSR_E2E_CHROMIUM` through `playwright.config.ts` to `launchOptions.executablePath` when the platform uses a system browser.
- The private host contract selects the system Chromium executable for this platform.
- The existing isolated frontend preflight installation contains `@playwright/test` 1.65.1; the probe used its Playwright test runner and a temporary CommonJS config that reads `VSR_E2E_CHROMIUM` into `launchOptions.executablePath`.
- The first runner invocation failed because the temporary config was written into a nested temporary directory rather than the requested config location; the files were moved to the intended temporary directory and the unintended nested directory was removed.
- The subsequent command `VSR_E2E_CHROMIUM=<host-selected executable> ./node_modules/.bin/playwright test --config browser-probe/playwright.config.cjs` passed one test in 5.2 seconds.
- Playwright reported Chromium 156.0.8078.79; the test loaded a minimal page from a task-owned HTTP server bound to `127.0.0.1` on randomly assigned port 36069.
- A simulated button click created an AudioContext, oscillator and analyser connected to the destination; after resume, the context state was `running`, the sample rate was 48000 Hz, and the analyser's peak absolute sample was 1.
- The test asserted the running state and a peak above 0.01, closed the AudioContext and HTTP server, and Playwright exited successfully; a subsequent process search found no remaining probe or matching Playwright process other than the search command itself.
- This verifies a headless Web Audio graph and sampled signal, not audible physical output, the application playback graph, or M0 acceptance tests.
- The project Playwright configuration and final project dependency lock were not available to this probe; the final tree's browser and e2e checks remain to be run.
- Playwright's bundled Chromium availability was not tested.
