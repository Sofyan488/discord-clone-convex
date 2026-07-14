import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireMember, requireUser, fail } from "./lib/auth";

const MAX_LEN = 4000;

// Resolve a channel's server, asserting it exists.
async function channelServerId(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
): Promise<Id<"servers">> {
  const channel = await ctx.db.get(channelId);
  if (channel === null) fail("NOT_FOUND");
  return channel.serverId;
}

// Paginated channel history, newest-first, with author name/avatar joined
// (FR-018, FR-019, FR-023). Reactive: new messages appear live.
export const list = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { channelId, paginationOpts }) => {
    await requireMember(ctx, await channelServerId(ctx, channelId));
    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .order("desc")
      .paginate(paginationOpts);

    const authors = new Map<string, { name: string; avatarUrl?: string }>();
    const page = [];
    for (const m of result.page) {
      let author = authors.get(m.authorId);
      if (!author) {
        const user = await ctx.db.get(m.authorId);
        author = { name: user?.name ?? "Unknown", avatarUrl: user?.avatarUrl };
        authors.set(m.authorId, author);
      }
      page.push({
        _id: m._id,
        authorId: m.authorId,
        authorName: author.name,
        authorAvatarUrl: author.avatarUrl,
        content: m.content,
        _creationTime: m._creationTime,
        editedAt: m.editedAt,
      });
    }
    return { ...result, page };
  },
});

// Send a message (FR-017). Optional clientKey makes reconnect retries idempotent
// (SC-009): a duplicate send with the same key returns the existing message.
export const send = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
    clientKey: v.optional(v.string()),
  },
  handler: async (ctx, { channelId, content, clientKey }) => {
    const { userId } = await requireMember(
      ctx,
      await channelServerId(ctx, channelId),
    );

    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_LEN) fail("VALIDATION");

    if (clientKey) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_channel_and_clientKey", (q) =>
          q.eq("channelId", channelId).eq("clientKey", clientKey),
        )
        .first();
      if (existing) return { messageId: existing._id };
    }

    const messageId = await ctx.db.insert("messages", {
      channelId,
      authorId: userId,
      content: trimmed,
      clientKey,
    });
    return { messageId };
  },
});

// Edit own message; marks it edited (FR-020, FR-022).
export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    const userId = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null) fail("NOT_FOUND");
    if (message.authorId !== userId) fail("NOT_AUTHOR");
    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_LEN) fail("VALIDATION");
    await ctx.db.patch(messageId, { content: trimmed, editedAt: Date.now() });
    return null;
  },
});

// Delete own message (FR-021, FR-022).
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null) fail("NOT_FOUND");
    if (message.authorId !== userId) fail("NOT_AUTHOR");
    await ctx.db.delete(messageId);
    return null;
  },
});
