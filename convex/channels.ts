import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireOwner, fail } from "./lib/auth";
import {
  deleteTextChannelCascade,
  deleteVoiceChannelCascade,
} from "./lib/cascade";

// All channels of a server, in creation order (FR-013).
export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireMember(ctx, serverId);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    return channels.map((c) => ({
      _id: c._id,
      name: c.name,
      type: c.type,
      _creationTime: c._creationTime,
    }));
  },
});

// Owner creates a text or voice channel (FR-014).
export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, { serverId, name, type }) => {
    await requireOwner(ctx, serverId);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) fail("VALIDATION");
    const channelId = await ctx.db.insert("channels", {
      serverId,
      name: trimmed,
      type,
    });
    return { channelId };
  },
});

// Owner renames a channel (FR-015).
export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, { channelId, name }) => {
    const channel = await ctx.db.get(channelId);
    if (channel === null) fail("NOT_FOUND");
    await requireOwner(ctx, channel.serverId);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) fail("VALIDATION");
    await ctx.db.patch(channelId, { name: trimmed });
    return null;
  },
});

// Owner deletes a channel; text channels cascade their messages + typing rows,
// voice channels cascade their call/participants/signals (FR-016, R11).
export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const channel = await ctx.db.get(channelId);
    if (channel === null) fail("NOT_FOUND");
    await requireOwner(ctx, channel.serverId);
    if (channel.type === "text") {
      await deleteTextChannelCascade(ctx, channelId);
    } else {
      await deleteVoiceChannelCascade(ctx, channelId);
    }
    return null;
  },
});
