import { test, expect, Browser, Page } from "@playwright/test";

// US3 E2E (T051). LIVE RUN — requires a running Vite dev server + Convex and
// two browser contexts sharing a server + channel.
//
// T051: two clients see a message appear live; edit + delete propagate.
//
// T051a (reconnect exactly-once, SC-009) stays a documented manual/unit-covered
// check: it is exercised by the `messages.test.ts` clientKey idempotency test,
// and reliably faking a mid-send socket drop in a real browser is out of scope
// for this suite.

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

async function inviteLink(page: Page, serverName: string) {
  await page.getByRole("button", { name: new RegExp(serverName) }).click();
  await page.getByRole("menuitem", { name: "Invite people" }).click();
  const input = page.locator("input[readonly]");
  await expect(input).toHaveValue(/\/invite\//);
  const link = await input.inputValue();
  await page.keyboard.press("Escape");
  return link;
}

test("channel messaging is real-time across two clients", async ({
  browser,
}) => {
  const alice = await signUp(browser, "Amy");
  const bob = await signUp(browser, "Ben");

  // Amy creates a server (default #general channel).
  await alice.page.getByRole("button", { name: "Create a server" }).click();
  await alice.page.locator("input").first().fill("Chat QA");
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();

  // Ben joins via invite and lands in the server's #general channel.
  const link = await inviteLink(alice.page, "Chat QA");
  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  const composer = "Message #general";
  await expect(alice.page.getByLabel(composer)).toBeVisible();
  await expect(bob.page.getByLabel(composer)).toBeVisible();

  // Amy sends a message; Ben sees it live.
  await alice.page.getByLabel(composer).fill("hello from amy");
  await alice.page.getByLabel(composer).press("Enter");
  await expect(bob.page.getByText("hello from amy")).toBeVisible();

  // Amy edits it; the edit + "(edited)" marker propagate to Ben.
  const amyRow = alice.page
    .locator("div.group")
    .filter({ hasText: "hello from amy" });
  await amyRow.hover();
  await amyRow.getByRole("button", { name: "Edit message" }).click();
  const editBox = amyRow.getByRole("textbox");
  await expect(editBox).toBeVisible();
  await editBox.fill("edited by amy");
  // The row's hasText filter no longer matches once the value changes, so press
  // Enter via the focused keyboard rather than re-locating the row.
  await alice.page.keyboard.press("Enter");
  await expect(bob.page.getByText("edited by amy")).toBeVisible();
  await expect(bob.page.getByText("(edited)")).toBeVisible();

  // Amy deletes it; it disappears for Ben.
  alice.page.on("dialog", (dialog) => dialog.accept());
  const editedRow = alice.page
    .locator("div.group")
    .filter({ hasText: "edited by amy" });
  await editedRow.hover();
  await editedRow.getByRole("button", { name: "Delete message" }).click();
  await expect(bob.page.getByText("edited by amy")).toHaveCount(0);
});
