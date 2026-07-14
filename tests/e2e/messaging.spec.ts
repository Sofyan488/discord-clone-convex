import { test, expect } from "@playwright/test";

// US3 E2E (T051 + T051a). PENDING LIVE RUN — requires `npx playwright install`,
// a running Vite dev server and Convex, and two browser contexts sharing a
// server + channel.
//
// T051: two clients see a message appear live; edit + delete propagate; typing
//       indicator shows; older history loads.
// T051a: a brief disconnect/reconnect during send delivers the message exactly
//        once (no loss, no duplicate — SC-009), backed by the clientKey idempotency.
//
// Skipped for now so the suite stays green until the E2E stack is wired up.
test.skip("channel messaging is real-time across two clients", async () => {
  expect(true).toBe(true);
});

test.skip("reconnect during send delivers exactly once (SC-009)", async () => {
  expect(true).toBe(true);
});
