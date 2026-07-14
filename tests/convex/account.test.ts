import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";

describe("users.deleteAccount (FR-012a)", () => {
  test("cascades owned server, drops memberships, retains DMs & tombstones", async () => {
    const t = setup();
    const alice = await createUser(t, "Alice");
    const bob = await createUser(t, "Bob");

    // Alice owns serverA (will be cascaded); Bob owns serverB where Alice is a member.
    const { serverId: serverA } = await asUser(t, alice).mutation(
      api.servers.create,
      { name: "Alice Server" },
    );
    const { serverId: serverB } = await asUser(t, bob).mutation(
      api.servers.create,
      { name: "Bob Server" },
    );
    const { inviteCode } = await asUser(t, bob).query(api.servers.getInvite, {
      serverId: serverB,
    });
    await asUser(t, alice).mutation(api.servers.joinByInvite, { inviteCode });

    // Seed a message authored by Alice in Bob's server, and a DM between them.
    const { channelMsg, dmThread, dmMsg } = await t.run(async (ctx) => {
      const generalB = await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverB))
        .first();
      const channelMsg = await ctx.db.insert("messages", {
        channelId: generalB!._id,
        authorId: alice,
        content: "hi from alice",
      });
      const [uA, uB] = [alice, bob].sort();
      const dmThread = await ctx.db.insert("directMessageThreads", {
        userAId: uA,
        userBId: uB,
      });
      const dmMsg = await ctx.db.insert("directMessages", {
        threadId: dmThread,
        authorId: alice,
        content: "dm hi",
      });
      return { channelMsg, dmThread, dmMsg };
    });

    await asUser(t, alice).mutation(api.users.deleteAccount, {});

    const state = await t.run(async (ctx) => ({
      serverA: await ctx.db.get(serverA),
      serverB: await ctx.db.get(serverB),
      aliceMemberships: await ctx.db
        .query("serverMembers")
        .withIndex("by_user", (q) => q.eq("userId", alice))
        .collect(),
      channelMsgDoc: await ctx.db.get(channelMsg),
      dmThreadDoc: await ctx.db.get(dmThread),
      dmMsgDoc: await ctx.db.get(dmMsg),
      aliceDoc: await ctx.db.get(alice),
    }));

    expect(state.serverA).toBeNull(); // owned server cascaded
    expect(state.serverB).not.toBeNull(); // other server survives
    expect(state.aliceMemberships).toHaveLength(0); // memberships dropped
    expect(state.channelMsgDoc).not.toBeNull(); // authored message retained
    expect(state.dmThreadDoc).not.toBeNull(); // DM thread retained (FR-026a)
    expect(state.dmMsgDoc).not.toBeNull(); // DM message retained
    expect(state.aliceDoc?.deleted).toBe(true); // tombstoned

    // getCurrent now returns null for the deleted account.
    expect(await asUser(t, alice).query(api.users.getCurrent, {})).toBeNull();
  });
});
