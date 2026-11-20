import { defineConfig, devices } from "@playwright/test";

const port = 4179;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  // Results stay out of the working tree.
  outputDir: "node_modules/.cache/e2e-results",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // E2E_CHANNEL=msedge or chrome runs an installed browser instead of Playwright's Chromium.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 }, channel: process.env.E2E_CHANNEL },
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
