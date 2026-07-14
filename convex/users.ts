import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./lib/auth";
import { deleteServerCascade } from "./lib/cascade";

// Current signed-in user's public profile (null if unauthenticated or deleted).
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.deleted) return null;
    return {
      _id: user._id,
      name: user.name ?? "",
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  },
});

// Account deletion (FR-012a). Cascade owned servers; drop memberships and
// ephemeral rows; RETAIN authored messages + DMs (FR-026a); tombstone the user
// and remove auth identity so sign-in is disabled.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);

    // (1) Cascade-delete every server the user owns.
    const owned = await ctx.db
      .query("servers")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    for (const server of owned) {
      await deleteServerCascade(ctx, server._id);
    }

    // (2) Remove memberships in all other servers.
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(memberships.map((m) => ctx.db.delete(m._id)));

    // (3) Remove ephemeral rows: presence, typing, call participants.
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (presence) await ctx.db.delete(presence._id);

    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_channel", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(typing.map((t) => ctx.db.delete(t._id)));

    const callParts = await ctx.db
      .query("callParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(callParts.map((c) => ctx.db.delete(c._id)));

    // (4) Retain authored messages + DM threads/messages (FR-026a).

    // (5) Remove auth identity (disable sign-in) and tombstone the profile.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(accounts.map((a) => ctx.db.delete(a._id)));

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const refresh = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      await Promise.all(refresh.map((r) => ctx.db.delete(r._id)));
      await ctx.db.delete(session._id);
    }

    await ctx.db.patch(userId, { deleted: true });
    return null;
  },
});
