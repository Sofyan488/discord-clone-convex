// Full-mesh WebRTC manager (research R6–R8). One RTCPeerConnection per remote
// peer; STUN-only (no TURN in v1 — connections may fail behind symmetric NAT).
// Glare is avoided by a deterministic offerer: the peer with the smaller userId
// creates the offer. ICE candidates that arrive before the remote description
// are queued and drained once it is set.

export type SignalKind = "offer" | "answer" | "candidate";

export interface MeshHandlers {
  sendSignal: (toUserId: string, kind: SignalKind, payload: string) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onPeerState?: (userId: string, state: RTCIceConnectionState) => void;
}

interface Peer {
  pc: RTCPeerConnection;
  pending: RTCIceCandidateInit[];
  remoteSet: boolean;
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export class MeshManager {
  private peers = new Map<string, Peer>();

  constructor(
    private readonly myUserId: string,
    private localStream: MediaStream | null,
    private readonly handlers: MeshHandlers,
    private readonly iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS,
  ) {}

  /** Reconcile peer connections against the current participant list. */
  syncPeers(remoteIds: string[]) {
    const wanted = new Set(remoteIds.filter((id) => id !== this.myUserId));
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.removePeer(id);
    }
    for (const id of wanted) {
      if (!this.peers.has(id)) this.addPeer(id);
    }
  }

  private addPeer(remoteId: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.handlers.sendSignal(
          remoteId,
          "candidate",
          JSON.stringify(e.candidate),
        );
      }
    };
    pc.ontrack = (e) => {
      if (e.streams[0]) this.handlers.onRemoteStream(remoteId, e.streams[0]);
    };
    pc.oniceconnectionstatechange = () => {
      this.handlers.onPeerState?.(remoteId, pc.iceConnectionState);
    };

    const peer: Peer = { pc, pending: [], remoteSet: false };
    this.peers.set(remoteId, peer);

    // Deterministic offerer: the smaller userId initiates.
    if (this.myUserId < remoteId) void this.makeOffer(remoteId, peer);
    return peer;
  }

  private async makeOffer(remoteId: string, peer: Peer) {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.handlers.sendSignal(remoteId, "offer", JSON.stringify(offer));
  }

  /** Apply a signal received from another peer. */
  async handleSignal(fromUserId: string, kind: SignalKind, payload: string) {
    let peer = this.peers.get(fromUserId);
    if (!peer) peer = this.addPeer(fromUserId);
    const data = JSON.parse(payload);

    if (kind === "offer") {
      await peer.pc.setRemoteDescription(data);
      peer.remoteSet = true;
      await this.drain(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.handlers.sendSignal(fromUserId, "answer", JSON.stringify(answer));
    } else if (kind === "answer") {
      await peer.pc.setRemoteDescription(data);
      peer.remoteSet = true;
      await this.drain(peer);
    } else {
      if (peer.remoteSet) await peer.pc.addIceCandidate(data);
      else peer.pending.push(data);
    }
  }

  private async drain(peer: Peer) {
    for (const candidate of peer.pending) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch {
        // Ignore individual candidate failures (best effort).
      }
    }
    peer.pending = [];
  }

  private removePeer(id: string) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.close();
      this.peers.delete(id);
    }
  }

  close() {
    for (const id of [...this.peers.keys()]) this.removePeer(id);
  }

  get peerIds(): string[] {
    return [...this.peers.keys()];
  }
}
