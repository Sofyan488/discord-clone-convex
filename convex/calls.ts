import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import {
  requireMember,
  requireThreadParticipant,
  fail,
} from "./lib/auth";
import { ONLINE_WINDOW_MS } from "./presence";

const MAX_PARTICIPANTS = 4;

type Target = {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
};

const targetArgs = {
  channelId: v.optional(v.id("channels")),
  threadId: v.optional(v.id("directMessageThreads")),
};

// Authorize the caller for a voice channel (member) or DM (participant),
// returning their user id.
async function authorizeTarget(
  ctx: QueryCtx | MutationCtx,
  { channelId, threadId }: Target,
): Promise<Id<"users">> {
  if ((channelId && threadId) || (!channelId && !threadId)) fail("VALIDATION");
  if (channelId) {
    const channel = await ctx.db.get(channelId);
    if (channel === null) fail("NOT_FOUND");
    if (channel.type !== "voice") fail("VALIDATION", "Not a voice channel");
    const { userId } = await requireMember(ctx, channel.serverId);
    return userId;
  }
  const { userId } = await requireThreadParticipant(ctx, threadId!);
  return userId;
}

async function findActiveCall(ctx: QueryCtx | MutationCtx, target: Target) {
  const call = target.channelId
    ? await ctx.db
        .query("calls")
        .withIndex("by_channel", (q) => q.eq("channelId", target.channelId))
        .first()
    : await ctx.db
        .query("calls")
        .withIndex("by_thread", (q) => q.eq("threadId", target.threadId))
        .first();
  return call && call.active ? call : null;
}

function isFresh(p: Doc<"callParticipants">, now: number) {
  return now - p.lastSeen < ONLINE_WINDOW_MS;
}

// Join a voice channel / DM call (FR-029, FR-034). Always-open room (FR-029a):
// reuses the active call or creates one. Rejects a 5th live participant (FR-030).
export const join = mutation({
  args: targetArgs,
  handler: async (ctx, target) => {
    const userId = await authorizeTarget(ctx, target);
    const now = Date.now();

    let call = await findActiveCall(ctx, target);
    if (call === null) {
      const callId = await ctx.db.insert("calls", {
        channelId: target.channelId,
        threadId: target.threadId,
        active: true,
      });
      call = (await ctx.db.get(callId))!;
    }

    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", call!._id))
      .collect();

    // Reap ghosts (stale, no leave) before enforcing the cap.
    for (const p of participants) {
      if (!isFresh(p, now) && p.userId !== userId) await ctx.db.delete(p._id);
    }
    const live = participants.filter(
      (p) => isFresh(p, now) || p.userId === userId,
    );

    const mine = live.find((p) => p.userId === userId);
    if (mine) {
      await ctx.db.patch(mine._id, { lastSeen: now });
    } else {
      if (live.length >= MAX_PARTICIPANTS) fail("CALL_FULL");
      await ctx.db.insert("callParticipants", {
        callId: call._id,
        userId,
        micEnabled: true,
        cameraEnabled: false,
        speaking: false,
        joinedAt: now,
        lastSeen: now,
      });
    }

    const roster = await rosterFor(ctx, call._id, now);
    return { callId: call._id, participants: roster };
  },
});

async function rosterFor(
  ctx: QueryCtx | MutationCtx,
  callId: Id<"calls">,
  now: number,
) {
  const parts = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  const out = [];
  for (const p of parts) {
    if (!isFresh(p, now)) continue;
    const user = await ctx.db.get(p.userId);
    out.push({
      userId: p.userId,
      name: user?.name ?? "Unknown",
      avatarUrl: user?.avatarUrl,
      micEnabled: p.micEnabled,
      cameraEnabled: p.cameraEnabled,
      speaking: p.speaking,
    });
  }
  return out;
}

// Leave a call (FR-033): remove the participant + their pending signals; when
// none remain, deactivate the call.
export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { userId } = await requireCallParticipant(ctx, callId);

    const mine = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", callId).eq("userId", userId),
      )
      .unique();
    if (mine) await ctx.db.delete(mine._id);

    // Delete signals to/from this user for the call.
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    await Promise.all(
      signals
        .filter((s) => s.fromUserId === userId || s.toUserId === userId)
        .map((s) => ctx.db.delete(s._id)),
    );

    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    if (remaining.length === 0) {
      await ctx.db.patch(callId, { active: false });
    }
    return null;
  },
});

// Toggle mic/camera and report speaking state (FR-031, FR-032).
export const setMedia = mutation({
  args: {
    callId: v.id("calls"),
    micEnabled: v.optional(v.boolean()),
    cameraEnabled: v.optional(v.boolean()),
    speaking: v.optional(v.boolean()),
  },
  handler: async (ctx, { callId, micEnabled, cameraEnabled, speaking }) => {
    const { participant } = await requireCallParticipant(ctx, callId);
    const patch: Partial<Doc<"callParticipants">> = {};
    if (micEnabled !== undefined) patch.micEnabled = micEnabled;
    if (cameraEnabled !== undefined) patch.cameraEnabled = cameraEnabled;
    if (speaking !== undefined) patch.speaking = speaking;
    await ctx.db.patch(participant._id, patch);
    return null;
  },
});

// In-call heartbeat so abrupt disconnects can be reaped (research R9).
export const heartbeat = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { participant } = await requireCallParticipant(ctx, callId);
    await ctx.db.patch(participant._id, { lastSeen: Date.now() });
    return null;
  },
});

// Reactive call state for a channel/DM: who is connected + their media flags
// (FR-032). Ghosts excluded. Null if no active call.
export const getState = query({
  args: targetArgs,
  handler: async (ctx, target) => {
    await authorizeTarget(ctx, target);
    const call = await findActiveCall(ctx, target);
    if (call === null) return null;
    const now = Date.now();
    const roster = await rosterFor(ctx, call._id, now);
    if (roster.length === 0) return null;
    return { callId: call._id, participants: roster };
  },
});

async function requireCallParticipant(
  ctx: QueryCtx | MutationCtx,
  callId: Id<"calls">,
) {
  const call = await ctx.db.get(callId);
  if (call === null) fail("NOT_FOUND");
  const userId = await authorizeTarget(ctx, {
    channelId: call.channelId,
    threadId: call.threadId,
  });
  const participant = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_and_user", (q) =>
      q.eq("callId", callId).eq("userId", userId),
    )
    .unique();
  if (participant === null) fail("FORBIDDEN", "Not in this call");
  return { userId, participant, call };
}
