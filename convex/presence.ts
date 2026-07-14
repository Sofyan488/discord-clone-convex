import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireMember } from "./lib/auth";

// A user is "online" if their heartbeat is within this window. Per-user (not
// per-tab); no explicit goOffline (research R3).
export const ONLINE_WINDOW_MS = 20_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const lastSeen = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen });
    } else {
      await ctx.db.insert("presence", { userId, lastSeen });
    }
    return null;
  },
});

// Members of a server with derived online status (FR-005, FR-010).
export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireMember(ctx, serverId);
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    const now = Date.now();

    const result = [];
    for (const member of members) {
      const user = await ctx.db.get(member.userId);
      if (!user || user.deleted) continue;
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", member.userId))
        .unique();
      const online =
        presence !== null && now - presence.lastSeen < ONLINE_WINDOW_MS;
      result.push({
        userId: member.userId,
        name: user.name ?? "",
        avatarUrl: user.avatarUrl,
        role: member.role,
        online,
      });
    }
    return result;
  },
});
