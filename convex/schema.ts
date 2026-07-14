import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Single source of truth for all data shape (data-model.md).
// Convex adds `_id` and `_creationTime` to every document automatically.
// `...authTables` provides auth-managed tables (authAccounts, authSessions, ...);
// we override `users` to add profile + tombstone fields.
export default defineSchema({
  ...authTables,

  // --- Users (overrides authTables.users) ---
  users: defineTable({
    // Fields expected by @convex-dev/auth (all optional):
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom profile / lifecycle fields (data-model.md):
    avatarUrl: v.optional(v.string()),
    deleted: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // --- Servers ---
  servers: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),

  // --- Membership ---
  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  // --- Channels ---
  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_type", ["serverId", "type"]),

  // --- Channel messages ---
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    clientKey: v.optional(v.string()),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_and_clientKey", ["channelId", "clientKey"]),

  // --- Direct message threads (canonical userAId < userBId) ---
  directMessageThreads: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
  })
    .index("by_userA", ["userAId"])
    .index("by_userB", ["userBId"])
    .index("by_pair", ["userAId", "userBId"]),

  // --- Direct messages ---
  directMessages: defineTable({
    threadId: v.id("directMessageThreads"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    clientKey: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_clientKey", ["threadId", "clientKey"]),

  // --- Typing indicators (channel or DM thread) ---
  typingIndicators: defineTable({
    userId: v.id("users"),
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    updatedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"])
    .index("by_user_and_channel", ["userId", "channelId"])
    .index("by_user_and_thread", ["userId", "threadId"]),

  // --- Presence (heartbeat) ---
  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
  }).index("by_user", ["userId"]),

  // --- Calls (voice-channel room or DM call) ---
  calls: defineTable({
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    active: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"]),

  // --- Call participants ---
  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    micEnabled: v.boolean(),
    cameraEnabled: v.boolean(),
    speaking: v.boolean(),
    joinedAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_call", ["callId"])
    .index("by_call_and_user", ["callId", "userId"])
    .index("by_user", ["userId"]),

  // --- WebRTC signaling relay ---
  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
    ),
    payload: v.string(),
  })
    .index("by_call", ["callId"])
    .index("by_recipient", ["callId", "toUserId"]),
});
