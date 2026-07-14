import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";

describe("servers.create", () => {
  test("creates server with owner membership and a general text channel", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "  My Server  ",
    });

    const { server, members, channels } = await t.run(async (ctx) => ({
      server: await ctx.db.get(serverId),
      members: await ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
      channels: await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    }));

    expect(server?.name).toBe("My Server"); // trimmed
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ name: "general", type: "text" });
  });

  test("rejects an empty name", async () => {
    const t = setup();
    const owner = await createUser(t);
    await expect(
      asUser(t, owner).mutation(api.servers.create, { name: "   " }),
    ).rejects.toThrow(/VALIDATION/);
  });
});

describe("invites", () => {
  test("join via invite adds a member; idempotent; preview resolves", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const joiner = await createUser(t, "Joiner");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "Server",
    });
    const { inviteCode } = await asUser(t, owner).query(api.servers.getInvite, {
      serverId,
    });

    const preview = await asUser(t, joiner).query(
      api.servers.getInvitePreview,
      { inviteCode },
    );
    expect(preview).toMatchObject({ serverId, name: "Server", memberCount: 1 });

    await asUser(t, joiner).mutation(api.servers.joinByInvite, { inviteCode });
    await asUser(t, joiner).mutation(api.servers.joinByInvite, { inviteCode });

    const members = await t.run(async (ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    );
    expect(members).toHaveLength(2); // owner + joiner (no duplicate)
  });

  test("invalid invite code: preview null, join throws NOT_FOUND", async () => {
    const t = setup();
    const user = await createUser(t);
    expect(
      await asUser(t, user).query(api.servers.getInvitePreview, {
        inviteCode: "nope",
      }),
    ).toBeNull();
    await expect(
      asUser(t, user).mutation(api.servers.joinByInvite, { inviteCode: "nope" }),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("owner-only management", () => {
  test("non-owner cannot rename", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const member = await createUser(t, "Member");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "S",
    });
    const { inviteCode } = await asUser(t, owner).query(api.servers.getInvite, {
      serverId,
    });
    await asUser(t, member).mutation(api.servers.joinByInvite, { inviteCode });

    await expect(
      asUser(t, member).mutation(api.servers.rename, {
        serverId,
        name: "Hacked",
      }),
    ).rejects.toThrow(/NOT_OWNER/);
    await asUser(t, owner).mutation(api.servers.rename, {
      serverId,
      name: "Renamed",
    });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    expect(server?.name).toBe("Renamed");
  });

  test("owner removes a member; cannot remove the owner", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const member = await createUser(t, "Member");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "S",
    });
    const { inviteCode } = await asUser(t, owner).query(api.servers.getInvite, {
      serverId,
    });
    await asUser(t, member).mutation(api.servers.joinByInvite, { inviteCode });

    await asUser(t, owner).mutation(api.servers.removeMember, {
      serverId,
      userId: member,
    });
    await expect(
      asUser(t, member).query(api.presence.listForServer, { serverId }),
    ).rejects.toThrow(/NOT_MEMBER/);

    await expect(
      asUser(t, owner).mutation(api.servers.removeMember, {
        serverId,
        userId: owner,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("leave", () => {
  test("member leaving removes only their membership", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const member = await createUser(t, "Member");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "S",
    });
    const { inviteCode } = await asUser(t, owner).query(api.servers.getInvite, {
      serverId,
    });
    await asUser(t, member).mutation(api.servers.joinByInvite, { inviteCode });

    await asUser(t, member).mutation(api.servers.leave, { serverId });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    expect(server).not.toBeNull(); // server survives
    const members = await t.run((ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    );
    expect(members).toHaveLength(1);
  });

  test("owner leaving cascade-deletes the server and its channels", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "S",
    });
    await asUser(t, owner).mutation(api.servers.leave, { serverId });

    const { server, channels } = await t.run(async (ctx) => ({
      server: await ctx.db.get(serverId),
      channels: await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    }));
    expect(server).toBeNull();
    expect(channels).toHaveLength(0);
  });
});
