import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function serverWithMember(t: ReturnType<typeof setup>) {
  const owner = await createUser(t, "Owner");
  const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
    name: "S",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  const member = await createUser(t, "Member");
  await asUser(t, member).mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  const general = await t.run((ctx) =>
    ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .first(),
  );
  return { owner, member, serverId, channelId: general!._id as Id<"channels"> };
}

const page = { numItems: 50, cursor: null };

describe("messages", () => {
  test("member sends; non-member cannot", async () => {
    const t = setup();
    const { member, channelId } = await serverWithMember(t);
    const stranger = await createUser(t, "Stranger");

    await asUser(t, member).mutation(api.messages.send, {
      channelId,
      content: "hello",
    });
    const result = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: page,
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      content: "hello",
      authorName: "Member",
    });

    await expect(
      asUser(t, stranger).mutation(api.messages.send, {
        channelId,
        content: "intruder",
      }),
    ).rejects.toThrow(/NOT_MEMBER/);
  });

  test("only the author can edit or delete", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithMember(t);
    const { messageId } = await asUser(t, member).mutation(api.messages.send, {
      channelId,
      content: "mine",
    });

    await expect(
      asUser(t, owner).mutation(api.messages.edit, {
        messageId,
        content: "hacked",
      }),
    ).rejects.toThrow(/NOT_AUTHOR/);
    await expect(
      asUser(t, owner).mutation(api.messages.remove, { messageId }),
    ).rejects.toThrow(/NOT_AUTHOR/);

    await asUser(t, member).mutation(api.messages.edit, {
      messageId,
      content: "edited",
    });
    const afterEdit = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: page,
    });
    expect(afterEdit.page[0].content).toBe("edited");
    expect(afterEdit.page[0].editedAt).toBeTypeOf("number");

    await asUser(t, member).mutation(api.messages.remove, { messageId });
    const afterDelete = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: page,
    });
    expect(afterDelete.page).toHaveLength(0);
  });

  test("history paginates newest-first", async () => {
    const t = setup();
    const { member, channelId } = await serverWithMember(t);
    for (let i = 1; i <= 3; i++) {
      await asUser(t, member).mutation(api.messages.send, {
        channelId,
        content: `m${i}`,
      });
    }
    const first = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((m) => m.content)).toEqual(["m3", "m2"]);
    expect(first.isDone).toBe(false);

    const second = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((m) => m.content)).toEqual(["m1"]);
  });

  test("clientKey makes send idempotent (SC-009)", async () => {
    const t = setup();
    const { member, channelId } = await serverWithMember(t);
    const a = await asUser(t, member).mutation(api.messages.send, {
      channelId,
      content: "once",
      clientKey: "k-1",
    });
    const b = await asUser(t, member).mutation(api.messages.send, {
      channelId,
      content: "once (retry)",
      clientKey: "k-1",
    });
    expect(b.messageId).toBe(a.messageId);

    const result = await asUser(t, member).query(api.messages.list, {
      channelId,
      paginationOpts: page,
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].content).toBe("once");
  });
});
