import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Typed error codes surfaced to the client (contracts/README.md).
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_MEMBER"
  | "NOT_AUTHOR"
  | "NOT_OWNER"
  | "NO_SHARED_SERVER"
  | "CALL_FULL"
  | "VALIDATION";

export function fail(code: ErrorCode, message?: string): never {
  throw new ConvexError({ code, message: message ?? code });
}

/** Default-deny: resolve the caller or reject as UNAUTHENTICATED. */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) fail("UNAUTHENTICATED");
  return userId;
}

/** Ensure the caller is a member of the server; returns the membership doc. */
export async function requireMember(ctx: QueryCtx, serverId: Id<"servers">) {
  const userId = await requireUser(ctx);
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (membership === null) fail("NOT_MEMBER");
  return { userId, membership };
}

/** Ensure the caller owns the server; returns the server doc. */
export async function requireOwner(ctx: QueryCtx, serverId: Id<"servers">) {
  const userId = await requireUser(ctx);
  const server = await ctx.db.get(serverId);
  if (server === null) fail("NOT_FOUND");
  if (server.ownerId !== userId) fail("NOT_OWNER");
  return { userId, server };
}

/** Ensure the caller authored the document (has an `authorId`). */
export function requireAuthor(
  callerId: Id<"users">,
  doc: { authorId: Id<"users"> } | null,
): asserts doc is { authorId: Id<"users"> } {
  if (doc === null) fail("NOT_FOUND");
  if (doc.authorId !== callerId) fail("NOT_AUTHOR");
}

/** Ensure the caller is one of the two participants of a DM thread. */
export async function requireThreadParticipant(
  ctx: QueryCtx,
  threadId: Id<"directMessageThreads">,
) {
  const userId = await requireUser(ctx);
  const thread = await ctx.db.get(threadId);
  if (thread === null) fail("NOT_FOUND");
  if (thread.userAId !== userId && thread.userBId !== userId) fail("FORBIDDEN");
  return { userId, thread };
}

/** Do the two users currently share at least one server? */
export async function shareAServer(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const aServers = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", a))
    .collect();
  const aSet = new Set(aServers.map((m) => m.serverId));
  const bServers = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", b))
    .collect();
  return bServers.some((m) => aSet.has(m.serverId));
}
