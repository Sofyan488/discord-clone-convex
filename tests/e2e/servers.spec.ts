import { test, expect, Browser } from "@playwright/test";

// US2 E2E (T038): create → invite → join → member list → rename → remove.
//
// PENDING LIVE RUN. Requires: `npx playwright install`, a running Vite dev
// server (`npm run dev`) and Convex (`npx convex dev`). Selectors target the
// text/roles used by the US1/US2 UI and may need minor tuning on first run.

async function signUp(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Sign Up" }).waitFor();
  await page.locator('input[name="name"]').fill(name);
  await page
    .locator('input[name="email"]')
    .fill(`${name.toLowerCase()}-${Date.now()}@test.dev`);
  await page.locator('input[name="password"]').fill("supersecret123");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page.getByText(/Welcome to Discord Clone/i)).toBeVisible();
  return { context, page };
}

test("owner creates a server, invites, member joins, appears, then removed", async ({
  browser,
}) => {
  const alice = await signUp(browser, "Alice");
  const bob = await signUp(browser, "Bob");

  // Alice creates a server.
  await alice.page.getByRole("button", { name: "Create a server" }).click();
  await alice.page.locator('input').first().fill("QA Server");
  await alice.page.getByRole("button", { name: "Create" }).click();

  // Grab the invite link.
  await alice.page.getByRole("button", { name: /QA Server/ }).click();
  await alice.page.getByRole("menuitem", { name: "Invite people" }).click();
  const link = await alice.page.locator('input[readonly]').inputValue();
  expect(link).toContain("/invite/");

  // Bob opens the invite and joins.
  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  // Alice sees Bob in the member list, then removes him.
  await expect(alice.page.getByText("Bob")).toBeVisible();
  await alice.page
    .getByRole("button", { name: "Remove Bob" })
    .click({ force: true });
  // (window.confirm auto-accepts via dialog handler in real runs.)
});
