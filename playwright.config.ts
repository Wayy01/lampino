// Browser smoke tests for the storefront checkout and the admin order flow.
// They run against a production build on the local database and assert on the
// rows they create, so: `bun run build`, then `bun run test:e2e` (the server is
// started on :3055 unless one is already running there). Tests share product
// stock, hence one worker.
import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile(".env");

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3055",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "bun run start -p 3055",
    url: "http://localhost:3055/ro",
    reuseExistingServer: true,
  },
});
