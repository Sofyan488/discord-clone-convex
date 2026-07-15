import { test, expect, Browser } from "@playwright/test";

// US1 E2E (T026): two-client presence online → offline. LIVE RUN — requires a
// running Vite dev server + Convex. Two users must share a server to see each
// other's presence. Presence uses a ~20s staleness window (research R3), so the
// offline assertion waits past that window.

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

test("a user goes offline for peers after their session closes", async ({
  browser,
}) => {
  // Allow for the ~20s presence staleness window plus render.
  test.setTimeout(60_000);

  const alice = await signUp(browser, "Pam");
  const bob = await signUp(browser, "Pete");

  // Pam creates a server; Pete joins so they share it.
  await alice.page.getByRole("button", { name: "Create a server" }).click();
  await alice.page.locator("input").first().fill("Presence QA");
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();

  await alice.page.getByRole("button", { name: /Presence QA/ }).click();
  await alice.page.getByRole("menuitem", { name: "Invite people" }).click();
  const input = alice.page.locator("input[readonly]");
  await expect(input).toHaveValue(/\/invite\//);
  const link = await input.inputValue();
  await alice.page.keyboard.press("Escape");

  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  // Pam sees Pete online in the member list.
  const peteRow = alice.page.getByRole("listitem").filter({ hasText: "Pete" });
  await expect(peteRow).toBeVisible();
  await expect(peteRow.getByLabel("online")).toBeVisible({ timeout: 15_000 });

  // Pete's session closes; after the staleness window Pam sees him offline.
  await bob.context.close();
  await expect(peteRow.getByLabel("offline")).toBeVisible({ timeout: 40_000 });
});
