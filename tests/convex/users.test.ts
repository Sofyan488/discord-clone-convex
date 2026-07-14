import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";

describe("users.getCurrent", () => {
  test("returns null when unauthenticated", async () => {
    const t = setup();
    expect(await t.query(api.users.getCurrent, {})).toBeNull();
  });

  test("returns the profile for the signed-in user", async () => {
    const t = setup();
    const userId = await createUser(t, "Alice");
    const me = await asUser(t, userId).query(api.users.getCurrent, {});
    expect(me).not.toBeNull();
    expect(me?.name).toBe("Alice");
    expect(me?._id).toBe(userId);
  });

  test("returns null for a tombstoned (deleted) user", async () => {
    const t = setup();
    const userId = await createUser(t, "Gone");
    await t.run(async (ctx) => ctx.db.patch(userId, { deleted: true }));
    expect(await asUser(t, userId).query(api.users.getCurrent, {})).toBeNull();
  });
});
