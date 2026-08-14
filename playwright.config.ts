import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: { command: "npm run dev", url: "http://localhost:4322/cavwic-solutions-lab/", reuseExistingServer: true },
  use: { baseURL: "http://localhost:4322/cavwic-solutions-lab/", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "msedge" } }
  ]
});
