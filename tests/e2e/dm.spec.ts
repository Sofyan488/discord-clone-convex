import { test, expect } from "@playwright/test";

// US4 E2E (T058). PENDING LIVE RUN — requires `npx playwright install`, a
// running Vite dev server + Convex, and two browser contexts sharing a server.
//
// Flow: A opens a DM with B from the member list → real-time exchange → A edits
// and deletes a message → B sees the changes. Skipped until the E2E stack is
// wired up so the suite stays green.
test.skip("direct messages are real-time across two clients", async () => {
  expect(true).toBe(true);
});
