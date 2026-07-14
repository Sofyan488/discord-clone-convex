import { test, expect } from "@playwright/test";

// US1 E2E (T026): two-client presence online → offline.
//
// PENDING LIVE RUN. Requires `npx playwright install`, a running Vite dev
// server and Convex. Two users must share a server to see each other's
// presence, so this builds on the servers flow. Presence uses a ~20s staleness
// window (research R3); the offline assertion allows for that timing.
//
// This is a scaffold to be fleshed out when the E2E stack is running; it is
// intentionally skipped so the suite stays green until then.
test.skip("a user goes offline for peers after their session closes", async () => {
  expect(true).toBe(true);
});
