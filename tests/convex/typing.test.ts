import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function serverWithTwo(t: ReturnType<typeof setup>) {
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
  return {
    owner,
    member,
    serverId,
    channelId: general!._id as Id<"channels">,
  };
}

// Alias for readability where the serverId is the point of interest.
const serverWithTwoAndServer = serverWithTwo;

describe("typing indicators", () => {
  test("shows other typers, excludes the caller", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);

    await asUser(t, member).mutation(api.typing.setTyping, { channelId });

    const asSeenByOwner = await asUser(t, owner).query(api.typing.list, {
      channelId,
    });
    expect(asSeenByOwner).toEqual([{ userId: member, name: "Member" }]);

    // The typer does not see themselves.
    const asSeenByMember = await asUser(t, member).query(api.typing.list, {
      channelId,
    });
    expect(asSeenByMember).toHaveLength(0);
  });

  test("stale typing rows are ignored", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);
    await t.run((ctx) =>
      ctx.db.insert("typingIndicators", {
        userId: member,
        channelId,
        updatedAt: Date.now() - 60_000, // 60s ago, well past the 5s window
      }),
    );
    const list = await asUser(t, owner).query(api.typing.list, { channelId });
    expect(list).toHaveLength(0);
  });

  test("clearTyping removes the caller's row", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);
    await asUser(t, member).mutation(api.typing.setTyping, { channelId });
    await asUser(t, member).mutation(api.typing.clearTyping, { channelId });
    const list = await asUser(t, owner).query(api.typing.list, { channelId });
    expect(list).toHaveLength(0);
  });

  // Data-layer guarantee behind "clears when switching channel": clearing one
  // target must not touch the same user's indicator in another target.
  test("clearTyping is scoped to its own target", async () => {
    const t = setup();
    const { owner, member, serverId, channelId } =
      await serverWithTwoAndServer(t);
    const { channelId: other } = await asUser(t, owner).mutation(
      api.channels.create,
      { serverId, name: "second", type: "text" },
    );

    await asUser(t, member).mutation(api.typing.setTyping, { channelId });
    await asUser(t, member).mutation(api.typing.setTyping, {
      channelId: other,
    });
    // Simulate leaving the first channel.
    await asUser(t, member).mutation(api.typing.clearTyping, { channelId });

    expect(
      await asUser(t, owner).query(api.typing.list, { channelId }),
    ).toHaveLength(0);
    expect(
      await asUser(t, owner).query(api.typing.list, { channelId: other }),
    ).toEqual([{ userId: member, name: "Member" }]);
  });
});

describe("DM typing indicators", () => {
  test("a participant sees the other typing; non-participants are rejected", async () => {
    const t = setup();
    const { owner, member } = await serverWithTwoAndServer(t);
    const stranger = await createUser(t, "Stranger");
    const { threadId } = await asUser(t, owner).mutation(
      api.directMessages.startThread,
      { otherUserId: member },
    );

    await asUser(t, member).mutation(api.typing.setTyping, { threadId });

    expect(
      await asUser(t, owner).query(api.typing.list, { threadId }),
    ).toEqual([{ userId: member, name: "Member" }]);

    // The typer doesn't see themselves.
    expect(
      await asUser(t, member).query(api.typing.list, { threadId }),
    ).toHaveLength(0);

    // A non-participant cannot read the thread's typing state.
    await expect(
      asUser(t, stranger).query(api.typing.list, { threadId }),
    ).rejects.toThrow(/FORBIDDEN|NOT_/);
  });
});

describe("stale-typing cron sweep (T070)", () => {
  test("sweep deletes stale rows and keeps fresh ones", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);

    // A fresh row (active typer) and a stale one (crashed/disconnected client).
    await asUser(t, member).mutation(api.typing.setTyping, { channelId });
    await t.run((ctx) =>
      ctx.db.insert("typingIndicators", {
        userId: owner,
        channelId,
        updatedAt: Date.now() - 60_000,
      }),
    );

    const { removed } = await t.mutation(
      internal.crons.sweepStaleTyping,
      {},
    );
    expect(removed).toBe(1);

    const remaining = await t.run((ctx) =>
      ctx.db.query("typingIndicators").collect(),
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(member);
  });
});
