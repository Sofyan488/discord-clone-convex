import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";

const page = { numItems: 50, cursor: null };

// Create two users who share one server (owner + member).
async function twoInAServer(t: ReturnType<typeof setup>) {
  const alice = await createUser(t, "Alice");
  const { serverId } = await asUser(t, alice).mutation(api.servers.create, {
    name: "S",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  const bob = await createUser(t, "Bob");
  await asUser(t, bob).mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  return { alice, bob, serverId };
}

describe("directMessages.startThread", () => {
  test("requires a shared server, and is idempotent per pair", async () => {
    const t = setup();
    const { alice, bob } = await twoInAServer(t);

    const first = await asUser(t, alice).mutation(api.directMessages.startThread, {
      otherUserId: bob,
    });
    const second = await asUser(t, bob).mutation(api.directMessages.startThread, {
      otherUserId: alice,
    });
    expect(second.threadId).toBe(first.threadId); // same canonical thread

    const stranger = await createUser(t, "Stranger");
    await expect(
      asUser(t, alice).mutation(api.directMessages.startThread, {
        otherUserId: stranger,
      }),
    ).rejects.toThrow(/NO_SHARED_SERVER/);
  });
});

describe("direct messages", () => {
  test("participants send/edit/delete; non-participant is blocked", async () => {
    const t = setup();
    const { alice, bob } = await twoInAServer(t);
    const { threadId } = await asUser(t, alice).mutation(
      api.directMessages.startThread,
      { otherUserId: bob },
    );
    const stranger = await createUser(t, "Stranger");

    const { messageId } = await asUser(t, alice).mutation(
      api.directMessages.send,
      { threadId, content: "hi bob" },
    );

    // Bob (participant) sees it.
    const bobView = await asUser(t, bob).query(api.directMessages.list, {
      threadId,
      paginationOpts: page,
    });
    expect(bobView.page).toHaveLength(1);
    expect(bobView.page[0]).toMatchObject({ content: "hi bob", authorName: "Alice" });

    // Stranger cannot read or send.
    await expect(
      asUser(t, stranger).query(api.directMessages.list, {
        threadId,
        paginationOpts: page,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      asUser(t, stranger).mutation(api.directMessages.send, {
        threadId,
        content: "intrude",
      }),
    ).rejects.toThrow(/FORBIDDEN/);

    // Only the author edits/deletes.
    await expect(
      asUser(t, bob).mutation(api.directMessages.edit, {
        messageId,
        content: "hacked",
      }),
    ).rejects.toThrow(/NOT_AUTHOR/);
    await asUser(t, alice).mutation(api.directMessages.edit, {
      messageId,
      content: "hi Bob (edited)",
    });
    await asUser(t, alice).mutation(api.directMessages.remove, { messageId });
    const after = await asUser(t, bob).query(api.directMessages.list, {
      threadId,
      paginationOpts: page,
    });
    expect(after.page).toHaveLength(0);
  });

  test("thread stays usable after the users no longer share a server (FR-026a)", async () => {
    const t = setup();
    const { alice, bob, serverId } = await twoInAServer(t);
    const { threadId } = await asUser(t, alice).mutation(
      api.directMessages.startThread,
      { otherUserId: bob },
    );

    // Bob leaves the only shared server.
    await asUser(t, bob).mutation(api.servers.leave, { serverId });

    // Existing DM still works for both.
    await asUser(t, bob).mutation(api.directMessages.send, {
      threadId,
      content: "still here",
    });
    const view = await asUser(t, alice).query(api.directMessages.list, {
      threadId,
      paginationOpts: page,
    });
    expect(view.page.map((m) => m.content)).toContain("still here");

    // But a brand-new thread cannot be started now.
    const charlie = await createUser(t, "Charlie");
    await expect(
      asUser(t, bob).mutation(api.directMessages.startThread, {
        otherUserId: charlie,
      }),
    ).rejects.toThrow(/NO_SHARED_SERVER/);
  });
});
