import { test, expect } from "@playwright/test";

// US5 E2E (T069). PENDING LIVE RUN — requires `npx playwright install`, a
// running Vite dev server + Convex, two browser contexts with fake media
// (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), and
// both users in the same voice channel.
//
// Flow: both join a voice channel → connect (tiles appear) → toggle mic/camera
// and assert the muted/speaking/video indicators update for the other peer →
// leave and assert disconnection. Skipped until the E2E media stack is wired up.
test.skip("two clients connect in a voice channel and toggle media", async () => {
  expect(true).toBe(true);
});
