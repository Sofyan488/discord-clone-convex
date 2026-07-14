import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  requireUser,
  requireThreadParticipant,
  shareAServer,
  fail,
} from "./lib/auth";
import { ONLINE_WINDOW_MS } from "./presence";

const MAX_LEN = 4000;

// Canonical ordering so each unordered pair maps to a single thread.
function pair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

// Start (or reopen) a 1:1 DM. Creation requires a currently-shared server
// (FR-025/FR-026); idempotent for an existing pair.
export const startThread = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireUser(ctx);
    if (otherUserId === userId) fail("VALIDATION", "Cannot DM yourself");

    const existing = await findThread(ctx, userId, otherUserId);
    if (existing) return { threadId: existing._id };

    if (!(await shareAServer(ctx, userId, otherUserId))) {
      fail("NO_SHARED_SERVER");
    }
    const [userAId, userBId] = pair(userId, otherUserId);
    const threadId = await ctx.db.insert("directMessageThreads", {
      userAId,
      userBId,
    });
    return { threadId };
  },
});

async function findThread(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
) {
  const [userAId, userBId] = pair(a, b);
  return ctx.db
    .query("directMessageThreads")
    .withIndex("by_pair", (q) =>
      q.eq("userAId", userAId).eq("userBId", userBId),
    )
    .unique();
}

// The caller's DM conversations with the other participant + presence (FR-026a).
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const asA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userA", (q) => q.eq("userAId", userId))
      .collect();
    const asB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userB", (q) => q.eq("userBId", userId))
      .collect();
    const now = Date.now();

    const result = [];
    for (const thread of [...asA, ...asB]) {
      const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;
      const other = await ctx.db.get(otherId);
      if (!other) continue;
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", otherId))
        .unique();
      const last = await ctx.db
        .query("directMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .first();
      result.push({
        threadId: thread._id,
        otherUser: {
          userId: otherId,
          name: other.name ?? "",
          avatarUrl: other.avatarUrl,
          online:
            presence !== null && now - presence.lastSeen < ONLINE_WINDOW_MS,
        },
        lastMessageAt: last?._creationTime ?? thread._creationTime,
      });
    }
    result.sort((x, y) => y.lastMessageAt - x.lastMessageAt);
    return result;
  },
});

// Paginated DM history (newest-first) with author name/avatar joined (FR-027).
export const list = query({
  args: {
    threadId: v.id("directMessageThreads"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { threadId, paginationOpts }) => {
    await requireThreadParticipant(ctx, threadId);
    const result = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
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

// Send a DM (FR-027). No shared-server check (FR-026a). clientKey → idempotent.
export const send = mutation({
  args: {
    threadId: v.id("directMessageThreads"),
    content: v.string(),
    clientKey: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, content, clientKey }) => {
    const { userId } = await requireThreadParticipant(ctx, threadId);
    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_LEN) fail("VALIDATION");

    if (clientKey) {
      const existing = await ctx.db
        .query("directMessages")
        .withIndex("by_thread_and_clientKey", (q) =>
          q.eq("threadId", threadId).eq("clientKey", clientKey),
        )
        .first();
      if (existing) return { messageId: existing._id };
    }

    const messageId = await ctx.db.insert("directMessages", {
      threadId,
      authorId: userId,
      content: trimmed,
      clientKey,
    });
    return { messageId };
  },
});

export const edit = mutation({
  args: { messageId: v.id("directMessages"), content: v.string() },
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

export const remove = mutation({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, { messageId }) => {
    const userId = await requireUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null) fail("NOT_FOUND");
    if (message.authorId !== userId) fail("NOT_AUTHOR");
    await ctx.db.delete(messageId);
    return null;
  },
});
