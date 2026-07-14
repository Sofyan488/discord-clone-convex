import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireMember, requireOwner, fail } from "./lib/auth";
import { deleteServerCascade } from "./lib/cascade";

function newInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// Create a server; caller becomes owner; a default "general" text channel is
// created automatically (FR-006, FR-007).
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUser(ctx);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) fail("VALIDATION");

    const serverId = await ctx.db.insert("servers", {
      name: trimmed,
      ownerId: userId,
      inviteCode: newInviteCode(),
    });
    await ctx.db.insert("serverMembers", {
      serverId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
    });
    return { serverId };
  },
});

export const rename = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, { serverId, name }) => {
    await requireOwner(ctx, serverId);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) fail("VALIDATION");
    await ctx.db.patch(serverId, { name: trimmed });
    return null;
  },
});

export const remove = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireOwner(ctx, serverId);
    await deleteServerCascade(ctx, serverId);
    return null;
  },
});

export const removeMember = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, { serverId, userId }) => {
    const { server } = await requireOwner(ctx, serverId);
    if (userId === server.ownerId) fail("FORBIDDEN", "Cannot remove the owner");
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", serverId).eq("userId", userId),
      )
      .unique();
    if (membership === null) fail("NOT_FOUND");
    await ctx.db.delete(membership._id);
    return null;
  },
});

// A member leaves; if the caller is the owner, the whole server is deleted
// (FR-012a; no ownership transfer in v1).
export const leave = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { userId, membership } = await requireMember(ctx, serverId);
    if (membership.role === "owner") {
      await deleteServerCascade(ctx, serverId);
      return null;
    }
    await ctx.db.delete(membership._id);
    // Clean the leaver's typing rows in this server's channels.
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    const channelIds = new Set(channels.map((c) => c._id));
    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_and_channel", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(
      typing
        .filter((t) => t.channelId && channelIds.has(t.channelId))
        .map((t) => ctx.db.delete(t._id)),
    );
    return null;
  },
});

// Servers the caller is a member of (server rail).
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const servers = [];
    for (const m of memberships) {
      const server = await ctx.db.get(m.serverId);
      if (server) {
        servers.push({
          _id: server._id,
          name: server.name,
          ownerId: server.ownerId,
        });
      }
    }
    return servers;
  },
});

// The reusable invite code (generated at creation). Members may read it.
export const getInvite = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireMember(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server === null) fail("NOT_FOUND");
    return { inviteCode: server.inviteCode };
  },
});

// Resolve an invite code to a joinable preview (null if invalid/deleted).
export const getInvitePreview = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    await requireUser(ctx);
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (server === null) return null;
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", server._id))
      .collect();
    return {
      serverId: server._id,
      name: server.name,
      memberCount: members.length,
    };
  },
});

// Join a server via a valid invite code (FR-009); idempotent for existing members.
export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const userId = await requireUser(ctx);
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (server === null) fail("NOT_FOUND", "Invalid invite");

    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", server._id).eq("userId", userId),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("serverMembers", {
        serverId: server._id,
        userId,
        role: "member",
        joinedAt: Date.now(),
      });
    }
    return { serverId: server._id };
  },
});
