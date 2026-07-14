import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

// Load all Convex function modules for the in-memory test backend.
export const modules = import.meta.glob("../../convex/**/*.*s");

export function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

// Insert a bare user row (bypassing the auth flow) for use as a test identity.
export async function createUser(t: T, name = "Alice"): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase()}@test.dev`,
    });
  });
}

// Run functions as the given user. `getAuthUserId` parses `subject` as
// `userId|sessionId`, so a bare userId subject resolves correctly.
export function asUser(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: userId as unknown as string });
}
