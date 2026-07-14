import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Explicit cascade deletes (Convex has no cascading foreign keys). For large
// data these should be chunked across scheduled mutations; at v1 scale
// (data-model.md) a single-pass delete is acceptable and kept simple here.

export async function deleteTextChannelCascade(
  ctx: MutationCtx,
  channelId: Id<"channels">,
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  await Promise.all(messages.map((m) => ctx.db.delete(m._id)));

  const typing = await ctx.db
    .query("typingIndicators")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  await Promise.all(typing.map((t) => ctx.db.delete(t._id)));

  await ctx.db.delete(channelId);
}

export async function deleteVoiceChannelCascade(
  ctx: MutationCtx,
  channelId: Id<"channels">,
) {
  const calls = await ctx.db
    .query("calls")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  for (const call of calls) {
    await deleteCallCascade(ctx, call._id);
  }
  await ctx.db.delete(channelId);
}

export async function deleteCallCascade(ctx: MutationCtx, callId: Id<"calls">) {
  const participants = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  await Promise.all(participants.map((p) => ctx.db.delete(p._id)));

  const signals = await ctx.db
    .query("signals")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  await Promise.all(signals.map((s) => ctx.db.delete(s._id)));

  await ctx.db.delete(callId);
}

export async function deleteServerCascade(
  ctx: MutationCtx,
  serverId: Id<"servers">,
) {
  const channels = await ctx.db
    .query("channels")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .collect();
  for (const channel of channels) {
    if (channel.type === "text") {
      await deleteTextChannelCascade(ctx, channel._id);
    } else {
      await deleteVoiceChannelCascade(ctx, channel._id);
    }
  }

  const members = await ctx.db
    .query("serverMembers")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .collect();
  await Promise.all(members.map((m) => ctx.db.delete(m._id)));

  // DM threads/messages are intentionally NOT cascaded (FR-026a: DMs persist).
  await ctx.db.delete(serverId);
}
