import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: "node scripts/start-production-css-test.mjs",
    env: {
      PORT: "3100",
      PALCENTER_API_INTERNAL_URL: "http://127.0.0.1:3199",
    },
    url: "http://127.0.0.1:3100/setup",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
