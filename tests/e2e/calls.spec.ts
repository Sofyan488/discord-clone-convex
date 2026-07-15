import { test, expect, Browser, Page } from "@playwright/test";

// US5 E2E (T069). LIVE RUN — requires a running Vite dev server + Convex and two
// browser contexts with fake media (configured globally in playwright.config.ts:
// --use-fake-device-for-media-stream / --use-fake-ui-for-media-stream).
//
// Flow: both users join a voice channel → participant tiles appear for each →
// one mutes and the peer sees the muted indicator → one leaves and their tile
// disappears for the other.
//
// Note: this verifies call membership + media-state signalling (driven by Convex
// getState). Actual peer-to-peer WebRTC media flow over STUN is a documented v1
// limitation and is not asserted here.

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

test("two clients connect in a voice channel and toggle media", async ({
  browser,
}) => {
  const alice = await signUp(browser, "Cara");
  const bob = await signUp(browser, "Cid");

  // Cara creates a server and a voice channel.
  await alice.page.getByRole("button", { name: "Create a server" }).click();
  await alice.page.locator("input").first().fill("Call QA");
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();

  await alice.page
    .getByRole("button", { name: "Create voice channel" })
    .click();
  await alice.page.getByPlaceholder("new-channel").fill("voice-qa");
  await alice.page.getByRole("button", { name: "Create", exact: true }).click();

  // Cid joins the server via invite.
  const link = await inviteLink(alice.page, "Call QA");
  await bob.page.goto(link);
  await bob.page.getByRole("button", { name: "Accept invite" }).click();

  // Both select the voice channel and join the call.
  for (const p of [alice.page, bob.page]) {
    await p.getByRole("button", { name: /voice-qa/ }).click();
    await p.getByRole("button", { name: "Join Voice" }).click();
  }

  // Each sees both participant tiles (self + peer) in the call area.
  const aliceCall = alice.page.getByRole("main");
  const bobCall = bob.page.getByRole("main");
  await expect(aliceCall.getByText("Cara (you)")).toBeVisible();
  await expect(aliceCall.getByText("Cid", { exact: true })).toBeVisible();
  await expect(bobCall.getByText("Cid (you)")).toBeVisible();
  await expect(bobCall.getByText("Cara", { exact: true })).toBeVisible();

  // Cara mutes; Cid sees a muted indicator on Cara's tile.
  await expect(alice.page.getByRole("button", { name: "Mute" })).toBeVisible();
  await alice.page.getByRole("button", { name: "Mute" }).click();
  await expect(bobCall.getByTitle("Muted")).toBeVisible();

  // Cara leaves; her tile disappears for Cid.
  await alice.page.getByRole("button", { name: "Leave" }).click();
  await expect(bobCall.getByText("Cara", { exact: true })).toHaveCount(0);
});
