import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

// Owner + a voice channel + (extra) members, all in one server.
async function voiceSetup(t: ReturnType<typeof setup>, extraMembers: number) {
  const owner = await createUser(t, "Owner");
  const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
    name: "S",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  const members: Id<"users">[] = [];
  for (let i = 0; i < extraMembers; i++) {
    const m = await createUser(t, `M${i}`);
    await asUser(t, m).mutation(api.servers.joinByInvite, {
      inviteCode: server!.inviteCode,
    });
    members.push(m);
  }
  const { channelId } = await asUser(t, owner).mutation(api.channels.create, {
    serverId,
    name: "Voice",
    type: "voice",
  });
  return { owner, members, channelId };
}

describe("calls.join / leave", () => {
  test("two members join the same voice room", async () => {
    const t = setup();
    const { owner, members, channelId } = await voiceSetup(t, 1);
    const r1 = await asUser(t, owner).mutation(api.calls.join, { channelId });
    const r2 = await asUser(t, members[0]).mutation(api.calls.join, {
      channelId,
    });
    expect(r2.callId).toBe(r1.callId); // same always-open room
    expect(r2.participants).toHaveLength(2);
  });

  test("rejects a 5th live participant (FR-030)", async () => {
    const t = setup();
    const { owner, members, channelId } = await voiceSetup(t, 4);
    await asUser(t, owner).mutation(api.calls.join, { channelId });
    for (let i = 0; i < 3; i++) {
      await asUser(t, members[i]).mutation(api.calls.join, { channelId });
    }
    await expect(
      asUser(t, members[3]).mutation(api.calls.join, { channelId }),
    ).rejects.toThrow(/CALL_FULL/);
  });

  test("last participant leaving deactivates the call", async () => {
    const t = setup();
    const { owner, channelId } = await voiceSetup(t, 0);
    const { callId } = await asUser(t, owner).mutation(api.calls.join, {
      channelId,
    });
    await asUser(t, owner).mutation(api.calls.leave, { callId });
    const state = await asUser(t, owner).query(api.calls.getState, {
      channelId,
    });
    expect(state).toBeNull();
  });

  // Regression: a leftover inactive call row (from a prior call that ended)
  // must not shadow the room. Before the fix, findActiveCall read only the
  // first row; a stale inactive one made join create a second row and getState
  // return null forever ("Waiting for others to join…").
  test("a leftover inactive call row does not shadow a fresh join", async () => {
    const t = setup();
    const { owner, members, channelId } = await voiceSetup(t, 1);

    // Simulate a prior call for this channel that already ended.
    await t.run((ctx) =>
      ctx.db.insert("calls", { channelId, active: false }),
    );

    const r1 = await asUser(t, owner).mutation(api.calls.join, { channelId });
    const r2 = await asUser(t, members[0]).mutation(api.calls.join, {
      channelId,
    });
    // Both must land in the SAME active room, not separate new rows.
    expect(r2.callId).toBe(r1.callId);

    const ownerState = await asUser(t, owner).query(api.calls.getState, {
      channelId,
    });
    const memberState = await asUser(t, members[0]).query(api.calls.getState, {
      channelId,
    });
    expect(ownerState?.callId).toBe(r1.callId);
    expect(ownerState?.participants).toHaveLength(2);
    expect(memberState?.callId).toBe(r1.callId);
  });

  // Regression: rejoining a channel after everyone left must produce a call
  // that getState can find (no stale-row shadowing).
  test("rejoining after the room emptied still connects", async () => {
    const t = setup();
    const { owner, channelId } = await voiceSetup(t, 0);
    const first = await asUser(t, owner).mutation(api.calls.join, {
      channelId,
    });
    await asUser(t, owner).mutation(api.calls.leave, {
      callId: first.callId,
    });

    const second = await asUser(t, owner).mutation(api.calls.join, {
      channelId,
    });
    const state = await asUser(t, owner).query(api.calls.getState, {
      channelId,
    });
    expect(state).not.toBeNull();
    expect(state?.callId).toBe(second.callId);
    expect(state?.participants).toHaveLength(1);
  });
});

describe("calls.getState / setMedia / heartbeat", () => {
  test("media flags are reflected in state", async () => {
    const t = setup();
    const { owner, channelId } = await voiceSetup(t, 0);
    const { callId } = await asUser(t, owner).mutation(api.calls.join, {
      channelId,
    });
    await asUser(t, owner).mutation(api.calls.setMedia, {
      callId,
      cameraEnabled: true,
      speaking: true,
    });
    const state = await asUser(t, owner).query(api.calls.getState, {
      channelId,
    });
    expect(state?.participants[0]).toMatchObject({
      micEnabled: true,
      cameraEnabled: true,
      speaking: true,
    });
  });

  test("stale (ghost) participants are excluded from state", async () => {
    const t = setup();
    const { owner, members, channelId } = await voiceSetup(t, 1);
    await asUser(t, owner).mutation(api.calls.join, { channelId });
    const { callId } = await asUser(t, members[0]).mutation(api.calls.join, {
      channelId,
    });

    // Force the member's participant row stale.
    await t.run(async (ctx) => {
      const p = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_and_user", (q) =>
          q.eq("callId", callId).eq("userId", members[0]),
        )
        .unique();
      await ctx.db.patch(p!._id, { lastSeen: Date.now() - 60_000 });
    });

    const state = await asUser(t, owner).query(api.calls.getState, {
      channelId,
    });
    expect(state?.participants).toHaveLength(1);
    expect(state?.participants[0].userId).toBe(owner);
  });
});

describe("DM 1:1 call (FR-034)", () => {
  test("both DM participants can join a thread call", async () => {
    const t = setup();
    const alice = await createUser(t, "Alice");
    const { serverId } = await asUser(t, alice).mutation(api.servers.create, {
      name: "S",
    });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    const bob = await createUser(t, "Bob");
    await asUser(t, bob).mutation(api.servers.joinByInvite, {
      inviteCode: server!.inviteCode,
    });
    const { threadId } = await asUser(t, alice).mutation(
      api.directMessages.startThread,
      { otherUserId: bob },
    );

    const r1 = await asUser(t, alice).mutation(api.calls.join, { threadId });
    const r2 = await asUser(t, bob).mutation(api.calls.join, { threadId });
    expect(r2.callId).toBe(r1.callId);
    expect(r2.participants).toHaveLength(2);
  });
});
