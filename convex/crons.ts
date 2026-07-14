import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { TYPING_WINDOW_MS } from "./typing";

// Backstop sweep for typing indicators (T070, scoped to typing here).
//
// Clients clear their own typing row on send/idle/switch/tab-hide, but a hard
// crash or dropped connection can leave a row behind. Because Convex queries
// only re-run when their read data changes, that orphan row would keep showing
// "X is typing…" to anyone already watching until an unrelated write occurred.
// Deleting stale rows here is that write, so watchers reconcile.
export const sweepStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TYPING_WINDOW_MS;
    // Ephemeral table (only active typers) — a full scan is cheap.
    const rows = await ctx.db.query("typingIndicators").collect();
    let removed = 0;
    for (const row of rows) {
      if (row.updatedAt < cutoff) {
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return { removed };
  },
});

const crons = cronJobs();
crons.interval(
  "sweep stale typing indicators",
  { minutes: 1 },
  internal.crons.sweepStaleTyping,
  {},
);
export default crons;
