import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireMember, fail } from "./lib/auth";

// Typing is considered active within this window (FR-024, research R4).
export const TYPING_WINDOW_MS = 5_000;

async function channelServerMember(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
) {
  const channel = await ctx.db.get(channelId);
  if (channel === null) fail("NOT_FOUND");
  return requireMember(ctx, channel.serverId);
}

export const setTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { userId } = await channelServerMember(ctx, channelId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("channelId", channelId),
      )
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt });
    } else {
      await ctx.db.insert("typingIndicators", {
        userId,
        channelId,
        updatedAt,
      });
    }
    return null;
  },
});

export const clearTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { userId } = await channelServerMember(ctx, channelId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("channelId", channelId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// Users (other than the caller) typing in the channel within the window.
export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { userId: caller } = await channelServerMember(ctx, channelId);
    const now = Date.now();
    const rows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();

    const result = [];
    for (const row of rows) {
      if (row.userId === caller) continue;
      if (now - row.updatedAt > TYPING_WINDOW_MS) continue;
      const user = await ctx.db.get(row.userId);
      if (user && !user.deleted) {
        result.push({ userId: row.userId, name: user.name ?? "" });
      }
    }
    return result;
  },
});
