import { test, expect, Browser, Page } from "@playwright/test";

// US4 E2E (T058). LIVE RUN — requires a running Vite dev server + Convex and two
// browser contexts sharing a server (DMs require a shared server).
//
// Flow: Amy opens a DM with Ben from the member list → real-time exchange → Amy
// edits and deletes a message → Ben sees the changes.

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

test("direct messages are real-time across two clients", async ({
  browser,
}) => {
  const alice = await signUp(browser, "Dana");
  const bob = await signUp(browser, "Dave");

  // Dana creates a server and Dave joins so they share one (DM prerequisite).
  await alice.page.getByRole("button", { name: "Create a server" }).click();
  await alice.page.locator("input").first().fill("DM QA");
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();
  const link = await inviteLink(alice.page, "DM QA");
  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  // Dana opens a DM with Dave from the member list.
  await expect(alice.page.getByText("Dave")).toBeVisible();
  const daveRow = alice.page.getByRole("listitem").filter({ hasText: "Dave" });
  await daveRow.hover();
  await daveRow.getByRole("button", { name: "Message Dave" }).click();

  const composer = "Message @Dave";
  await expect(alice.page.getByLabel(composer)).toBeVisible();
  await alice.page.getByLabel(composer).fill("hi dave");
  await alice.page.getByLabel(composer).press("Enter");

  // Dave opens the DM and sees the message live.
  await bob.page.getByTitle("Direct Messages").click();
  await bob.page.getByText(/Dana/).first().click();
  await expect(bob.page.getByText("hi dave")).toBeVisible();

  // Dana edits the message; the change propagates to Dave.
  const row = alice.page.locator("div.group").filter({ hasText: "hi dave" });
  await row.hover();
  await row.getByRole("button", { name: "Edit message" }).click();
  const editBox = row.getByRole("textbox");
  await expect(editBox).toBeVisible();
  await editBox.fill("hi dave (edited)");
  await alice.page.keyboard.press("Enter");
  await expect(bob.page.getByText("hi dave (edited)")).toBeVisible();

  // Dana deletes the message; it disappears for Dave.
  alice.page.on("dialog", (dialog) => dialog.accept());
  const editedRow = alice.page
    .locator("div.group")
    .filter({ hasText: "hi dave (edited)" });
  await editedRow.hover();
  await editedRow.getByRole("button", { name: "Delete message" }).click();
  await expect(bob.page.getByText("hi dave (edited)")).toHaveCount(0);
});
