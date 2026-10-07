import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "../artifacts/test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.BAXI_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.BAXI_BROWSER_CHANNEL || "chrome",
      },
    },
  ],
  webServer: process.env.BAXI_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173 --strictPort",
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
