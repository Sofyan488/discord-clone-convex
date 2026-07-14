import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { requireUser, requireThreadParticipant, requireMember, fail } from "./lib/auth";

// Authorize the caller for the call's underlying channel/DM. Deliberately does
// NOT require a callParticipants row: during a join race a client can learn the
// room's callId (created by a peer) and subscribe before its own join() lands
// its participant row. Membership/participation auth is still enforced.
async function requireCallAccess(
  ctx: QueryCtx | MutationCtx,
  call: Doc<"calls">,
) {
  if (call.channelId) {
    const channel = await ctx.db.get(call.channelId);
    if (channel === null) fail("NOT_FOUND");
    await requireMember(ctx, channel.serverId);
  } else if (call.threadId) {
    await requireThreadParticipant(ctx, call.threadId);
  }
}

// Authorize the caller for a call and confirm each given user is a participant.
// Used by send(), where the sender must already be a live participant.
async function assertParticipants(
  ctx: QueryCtx | MutationCtx,
  callId: Id<"calls">,
  userIds: Id<"users">[],
) {
  const call = await ctx.db.get(callId);
  if (call === null) fail("NOT_FOUND");
  await requireCallAccess(ctx, call);
  for (const userId of userIds) {
    const p = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", callId).eq("userId", userId),
      )
      .unique();
    if (p === null) fail("FORBIDDEN", "Target is not a call participant");
  }
}

// Relay an SDP offer/answer or ICE candidate to another participant (R7).
export const send = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
    ),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toUserId, kind, payload }) => {
    const fromUserId = await requireUser(ctx);
    await assertParticipants(ctx, callId, [fromUserId, toUserId]);
    await ctx.db.insert("signals", {
      callId,
      fromUserId,
      toUserId,
      kind,
      payload,
    });
    return null;
  },
});

// Signals addressed to the caller for a call, oldest-first.
//
// Race-safe by design: this subscription can go live before the caller's own
// join() lands their callParticipants row (getState surfaces a peer-created
// room's callId first), and it can outlive the room (a peer's leave() deletes
// the call). Neither is an error — return an empty inbox rather than throwing,
// which would otherwise crash the caller's React route. Authorization is still
// enforced (channel membership / thread participation) and the query is
// recipient-scoped, so a caller only ever sees signals addressed to them.
export const receive = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUser(ctx);
    const call = await ctx.db.get(callId);
    if (call === null) return []; // room ended during a leave race
    await requireCallAccess(ctx, call);
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_recipient", (q) =>
        q.eq("callId", callId).eq("toUserId", userId),
      )
      .collect();
    return rows.map((s) => ({
      _id: s._id,
      fromUserId: s.fromUserId,
      kind: s.kind,
      payload: s.payload,
    }));
  },
});

// Delete consumed signal rows (must be addressed to the caller).
export const ack = mutation({
  args: { signalIds: v.array(v.id("signals")) },
  handler: async (ctx, { signalIds }) => {
    const userId = await requireUser(ctx);
    for (const id of signalIds) {
      const row = await ctx.db.get(id);
      if (row && row.toUserId === userId) await ctx.db.delete(id);
    }
    return null;
  },
});
