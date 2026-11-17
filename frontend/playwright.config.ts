import { env } from "node:process";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: true,
  retries: 0,
  use: {
    launchOptions: { executablePath: env.VSR_E2E_CHROMIUM },
  },
});
