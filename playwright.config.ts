import { defineConfig, devices } from "@playwright/test";

// E2E config. Real-time flows use two browser contexts (User A / User B).
// Assumes `npm run dev` (Vite) and `npx convex dev` are running.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // Grant + fake camera/mic so getUserMedia resolves headlessly (US5 calls).
    permissions: ["microphone", "camera"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
