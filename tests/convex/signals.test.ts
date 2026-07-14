import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, createUser, asUser } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function callWithTwo(t: ReturnType<typeof setup>) {
  const owner = await createUser(t, "Owner");
  const { serverId } = await asUser(t, owner).mutation(api.servers.create, {
    name: "S",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  const member = await createUser(t, "Member");
  await asUser(t, member).mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  const { channelId } = await asUser(t, owner).mutation(api.channels.create, {
    serverId,
    name: "Voice",
    type: "voice",
  });
  const { callId } = await asUser(t, owner).mutation(api.calls.join, {
    channelId,
  });
  await asUser(t, member).mutation(api.calls.join, { channelId });
  return { owner, member, callId };
}

describe("signals relay", () => {
  test("participant sends; recipient receives then acks", async () => {
    const t = setup();
    const { owner, member, callId } = await callWithTwo(t);

    await asUser(t, owner).mutation(api.signals.send, {
      callId,
      toUserId: member,
      kind: "offer",
      payload: '{"sdp":"x"}',
    });

    const inbox = await asUser(t, member).query(api.signals.receive, { callId });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ fromUserId: owner, kind: "offer" });

    // Owner has nothing addressed to them.
    expect(await asUser(t, owner).query(api.signals.receive, { callId })).toHaveLength(0);

    await asUser(t, member).mutation(api.signals.ack, {
      signalIds: [inbox[0]._id],
    });
    expect(await asUser(t, member).query(api.signals.receive, { callId })).toHaveLength(0);
  });

  test("a non-participant cannot send or receive", async () => {
    const t = setup();
    const { owner, member, callId } = await callWithTwo(t);
    const stranger = await createUser(t, "Stranger");

    await expect(
      asUser(t, stranger).query(api.signals.receive, { callId }),
    ).rejects.toThrow(/FORBIDDEN|NOT_MEMBER/);

    await expect(
      asUser(t, owner).mutation(api.signals.send, {
        callId,
        toUserId: stranger as Id<"users">,
        kind: "candidate",
        payload: "{}",
      }),
    ).rejects.toThrow(/FORBIDDEN/);

    void member;
  });
});
