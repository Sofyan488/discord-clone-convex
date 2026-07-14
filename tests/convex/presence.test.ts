import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";

describe("presence", () => {
  test("heartbeat marks the user online; listForServer derives status", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "Test Server",
    });

    // Before any heartbeat, the owner is offline.
    let members = await asUser(t, owner).query(api.presence.listForServer, {
      serverId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].online).toBe(false);

    // After a heartbeat, online.
    await asUser(t, owner).mutation(api.presence.heartbeat, {});
    members = await asUser(t, owner).query(api.presence.listForServer, {
      serverId,
    });
    expect(members[0].online).toBe(true);
    expect(members[0].role).toBe("owner");
  });

  test("listForServer rejects a non-member", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const stranger = await createUser(t, "Stranger");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "Private",
    });

    await expect(
      asUser(t, stranger).query(api.presence.listForServer, { serverId }),
    ).rejects.toThrow(/NOT_MEMBER/);
  });

  test("listForServer requires authentication", async () => {
    const t = setup();
    const owner = await createUser(t, "Owner");
    const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
      name: "S",
    });
    await expect(
      t.query(api.presence.listForServer, { serverId }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
  });
});
