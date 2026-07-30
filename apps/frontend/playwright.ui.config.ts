import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "design-system.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node scripts/start-production-ui-test.mjs",
    env: {
      PORT: "3101",
    },
    url: "http://127.0.0.1:3101/profile",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
