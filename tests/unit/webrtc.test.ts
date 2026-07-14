import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { MeshManager } from "@/lib/webrtc/MeshManager";

// Minimal fake RTCPeerConnection recording the negotiation calls.
class FakePC {
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  iceConnectionState = "new";
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  added: unknown[] = [];
  static instances: FakePC[] = [];
  constructor() {
    FakePC.instances.push(this);
  }
  async createOffer() {
    return { type: "offer", sdp: "OFFER" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "ANSWER" };
  }
  async setLocalDescription(d: unknown) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: unknown) {
    this.added.push(c);
  }
  addTrack() {}
  close() {}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("MeshManager", () => {
  beforeEach(() => {
    FakePC.instances = [];
    vi.stubGlobal("RTCPeerConnection", FakePC as unknown as typeof RTCPeerConnection);
  });
  afterEach(() => vi.unstubAllGlobals());

  test("smaller userId is the offerer", async () => {
    const sendSignal = vi.fn();
    const mesh = new MeshManager("aaa", null, {
      sendSignal,
      onRemoteStream: vi.fn(),
    });
    mesh.syncPeers(["bbb"]);
    await flush();
    expect(sendSignal).toHaveBeenCalledWith("bbb", "offer", expect.any(String));
  });

  test("larger userId waits (does not offer)", async () => {
    const sendSignal = vi.fn();
    const mesh = new MeshManager("zzz", null, {
      sendSignal,
      onRemoteStream: vi.fn(),
    });
    mesh.syncPeers(["bbb"]);
    await flush();
    expect(sendSignal).not.toHaveBeenCalled();
  });

  test("answerer replies to an offer and never double-offers", async () => {
    const sendSignal = vi.fn();
    const mesh = new MeshManager("zzz", null, {
      sendSignal,
      onRemoteStream: vi.fn(),
    });
    await mesh.handleSignal(
      "bbb",
      "offer",
      JSON.stringify({ type: "offer", sdp: "OFFER" }),
    );
    expect(sendSignal).toHaveBeenCalledWith("bbb", "answer", expect.any(String));
    expect(
      sendSignal.mock.calls.filter((c) => c[1] === "offer"),
    ).toHaveLength(0);
  });

  test("ICE candidates arriving before the remote description are queued, then drained", async () => {
    const mesh = new MeshManager("zzz", null, {
      sendSignal: vi.fn(),
      onRemoteStream: vi.fn(),
    });
    // Candidate first — must be queued (not applied yet).
    await mesh.handleSignal(
      "bbb",
      "candidate",
      JSON.stringify({ candidate: "c1" }),
    );
    const pc = FakePC.instances[0];
    expect(pc.added).toHaveLength(0);

    // Offer sets the remote description and drains the queue.
    await mesh.handleSignal(
      "bbb",
      "offer",
      JSON.stringify({ type: "offer", sdp: "OFFER" }),
    );
    expect(pc.remoteDescription).toMatchObject({ type: "offer" });
    expect(pc.added).toHaveLength(1);

    // A later candidate applies immediately.
    await mesh.handleSignal(
      "bbb",
      "candidate",
      JSON.stringify({ candidate: "c2" }),
    );
    expect(pc.added).toHaveLength(2);
  });
});
