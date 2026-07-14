import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function serverWithTwo(t: ReturnType<typeof setup>) {
  const owner = await createUser(t, "Owner");
  const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
    name: "S",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  const member = await createUser(t, "Member");
  await asUser(t, member).mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  const general = await t.run((ctx) =>
    ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .first(),
  );
  return { owner, member, channelId: general!._id as Id<"channels"> };
}

describe("typing indicators", () => {
  test("shows other typers, excludes the caller", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);

    await asUser(t, member).mutation(api.typing.setTyping, { channelId });

    const asSeenByOwner = await asUser(t, owner).query(api.typing.list, {
      channelId,
    });
    expect(asSeenByOwner).toEqual([{ userId: member, name: "Member" }]);

    // The typer does not see themselves.
    const asSeenByMember = await asUser(t, member).query(api.typing.list, {
      channelId,
    });
    expect(asSeenByMember).toHaveLength(0);
  });

  test("stale typing rows are ignored", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);
    await t.run((ctx) =>
      ctx.db.insert("typingIndicators", {
        userId: member,
        channelId,
        updatedAt: Date.now() - 60_000, // 60s ago, well past the 5s window
      }),
    );
    const list = await asUser(t, owner).query(api.typing.list, { channelId });
    expect(list).toHaveLength(0);
  });

  test("clearTyping removes the caller's row", async () => {
    const t = setup();
    const { owner, member, channelId } = await serverWithTwo(t);
    await asUser(t, member).mutation(api.typing.setTyping, { channelId });
    await asUser(t, member).mutation(api.typing.clearTyping, { channelId });
    const list = await asUser(t, owner).query(api.typing.list, { channelId });
    expect(list).toHaveLength(0);
  });
});
