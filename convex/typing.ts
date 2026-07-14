import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireMember, requireThreadParticipant, fail } from "./lib/auth";

// Typing is considered active within this window (FR-024, research R4).
export const TYPING_WINDOW_MS = 5_000;

type Target = { channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> };

const targetArgs = {
  channelId: v.optional(v.id("channels")),
  threadId: v.optional(v.id("directMessageThreads")),
};

// Authorize the caller for a channel (member) or DM thread (participant).
async function authorizeTarget(
  ctx: QueryCtx | MutationCtx,
  { channelId, threadId }: Target,
): Promise<Id<"users">> {
  if ((channelId && threadId) || (!channelId && !threadId)) fail("VALIDATION");
  if (channelId) {
    const channel = await ctx.db.get(channelId);
    if (channel === null) fail("NOT_FOUND");
    const { userId } = await requireMember(ctx, channel.serverId);
    return userId;
  }
  const { userId } = await requireThreadParticipant(ctx, threadId!);
  return userId;
}

async function findRow(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  { channelId, threadId }: Target,
) {
  if (channelId) {
    return ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("channelId", channelId),
      )
      .unique();
  }
  return ctx.db
    .query("typingIndicators")
    .withIndex("by_user_and_thread", (q) =>
      q.eq("userId", userId).eq("threadId", threadId),
    )
    .unique();
}

export const setTyping = mutation({
  args: targetArgs,
  handler: async (ctx, target) => {
    const userId = await authorizeTarget(ctx, target);
    const existing = await findRow(ctx, userId, target);
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt });
    } else {
      await ctx.db.insert("typingIndicators", {
        userId,
        channelId: target.channelId,
        threadId: target.threadId,
        updatedAt,
      });
    }
    return null;
  },
});

export const clearTyping = mutation({
  args: targetArgs,
  handler: async (ctx, target) => {
    const userId = await authorizeTarget(ctx, target);
    const existing = await findRow(ctx, userId, target);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// Users (other than the caller) typing on the target within the window.
export const list = query({
  args: targetArgs,
  handler: async (ctx, target) => {
    const caller = await authorizeTarget(ctx, target);
    const now = Date.now();
    const rows = target.channelId
      ? await ctx.db
          .query("typingIndicators")
          .withIndex("by_channel", (q) =>
            q.eq("channelId", target.channelId),
          )
          .collect()
      : await ctx.db
          .query("typingIndicators")
          .withIndex("by_thread", (q) => q.eq("threadId", target.threadId))
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
