import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function makeServer(t: ReturnType<typeof setup>) {
  const owner = await createUser(t, "Owner");
  const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
    name: "S",
  });
  const general = await t.run((ctx) =>
    ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .first(),
  );
  return { owner, serverId, generalId: general!._id };
}

async function addMember(t: ReturnType<typeof setup>, serverId: Id<"servers">) {
  const member = await createUser(t, "Member");
  const server = await t.run((ctx) => ctx.db.get(serverId));
  await asUser(t, member).mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  return member;
}

describe("channels", () => {
  test("owner creates text and voice channels; member can list", async () => {
    const t = setup();
    const { owner, serverId } = await makeServer(t);
    await asUser(t, owner).mutation(api.channels.create, {
      serverId,
      name: "random",
      type: "text",
    });
    await asUser(t, owner).mutation(api.channels.create, {
      serverId,
      name: "Voice",
      type: "voice",
    });
    const channels = await asUser(t, owner).query(api.channels.list, {
      serverId,
    });
    expect(channels.map((c) => c.name)).toEqual(["general", "random", "Voice"]);
  });

  test("non-owner cannot create, rename, or delete channels", async () => {
    const t = setup();
    const { serverId, generalId } = await makeServer(t);
    const member = await addMember(t, serverId);

    await expect(
      asUser(t, member).mutation(api.channels.create, {
        serverId,
        name: "x",
        type: "text",
      }),
    ).rejects.toThrow(/NOT_OWNER/);
    await expect(
      asUser(t, member).mutation(api.channels.rename, {
        channelId: generalId,
        name: "x",
      }),
    ).rejects.toThrow(/NOT_OWNER/);
    await expect(
      asUser(t, member).mutation(api.channels.remove, { channelId: generalId }),
    ).rejects.toThrow(/NOT_OWNER/);
  });

  test("deleting a text channel cascades its messages and typing rows", async () => {
    const t = setup();
    const { owner, generalId } = await makeServer(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        channelId: generalId,
        authorId: owner,
        content: "hi",
      });
      await ctx.db.insert("typingIndicators", {
        userId: owner,
        channelId: generalId,
        updatedAt: Date.now(),
      });
    });

    await asUser(t, owner).mutation(api.channels.remove, {
      channelId: generalId,
    });

    const { msgs, typing, channel } = await t.run(async (ctx) => ({
      msgs: await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", generalId))
        .collect(),
      typing: await ctx.db
        .query("typingIndicators")
        .withIndex("by_channel", (q) => q.eq("channelId", generalId))
        .collect(),
      channel: await ctx.db.get(generalId),
    }));
    expect(channel).toBeNull();
    expect(msgs).toHaveLength(0);
    expect(typing).toHaveLength(0);
  });

  test("deleting a voice channel cascades its call, participants, signals", async () => {
    const t = setup();
    const { owner, serverId } = await makeServer(t);
    const { channelId } = await asUser(t, owner).mutation(api.channels.create, {
      serverId,
      name: "Voice",
      type: "voice",
    });
    const callId = await t.run(async (ctx) => {
      const callId = await ctx.db.insert("calls", { channelId, active: true });
      await ctx.db.insert("callParticipants", {
        callId,
        userId: owner,
        micEnabled: true,
        cameraEnabled: false,
        speaking: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
      await ctx.db.insert("signals", {
        callId,
        fromUserId: owner,
        toUserId: owner,
        kind: "offer",
        payload: "{}",
      });
      return callId;
    });

    await asUser(t, owner).mutation(api.channels.remove, { channelId });

    const { call, parts, signals } = await t.run(async (ctx) => ({
      call: await ctx.db.get(callId),
      parts: await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect(),
      signals: await ctx.db
        .query("signals")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect(),
    }));
    expect(call).toBeNull();
    expect(parts).toHaveLength(0);
    expect(signals).toHaveLength(0);
  });
});
