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
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();

  // Grab the invite link.
  await alice.page.getByRole("button", { name: /QA Server/ }).click();
  await alice.page.getByRole("menuitem", { name: "Invite people" }).click();
  // The link is populated by an async query — wait for it to resolve.
  const linkInput = alice.page.locator("input[readonly]");
  await expect(linkInput).toHaveValue(/\/invite\//);
  const link = await linkInput.inputValue();
  expect(link).toContain("/invite/");
  // Close the invite modal so it doesn't overlay later interactions.
  await alice.page.keyboard.press("Escape");

  // Bob opens the invite and joins.
  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  // Alice sees Bob in the member list, then removes him.
  const bobRow = alice.page.getByRole("listitem").filter({ hasText: "Bob" });
  await expect(bobRow).toBeVisible();
  // The remove button is revealed on row hover; the action prompts
  // window.confirm — auto-accept it.
  alice.page.on("dialog", (dialog) => dialog.accept());
  await bobRow.hover();
  await bobRow.getByRole("button", { name: "Remove Bob" }).click();
  await expect(alice.page.getByText("Bob")).toHaveCount(0);
});
