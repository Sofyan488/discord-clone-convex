# Contract: Calls & WebRTC Signaling (US5)

Covers FR-029–FR-034, FR-029a. Media flows peer-to-peer over WebRTC; Convex holds
authoritative participant state and relays signaling only (R6–R9).

## Call lifecycle

### `calls.join` (mutation)
- **Args**: `{ channelId: v.optional(Id<"channels">), threadId: v.optional(Id<"directMessageThreads">) }`
  (exactly one provided)
- **Returns**: `{ callId: Id<"calls">, participants: v.array({ userId, name }) }`
- **Behavior**: finds or creates the active `calls` row for the voice channel (always-open
  room, FR-029a) or DM (FR-034); inserts a `callParticipants` row for the caller with
  `micEnabled: true, cameraEnabled: false, speaking: false`. Returns the current peer list so
  the client can open peer connections (FR-029).
- **Rejects**: `CALL_FULL` if the call already has 4 participants (FR-030); `NOT_MEMBER` /
  `FORBIDDEN` if the caller may not access the channel/thread.
- **Auth**: member of the server (channel calls) or thread participant (DM calls).

### `calls.leave` (mutation)
- **Args**: `{ callId: Id<"calls"> }`
- **Returns**: `v.null()`
- **Behavior**: removes the caller's participant row and their pending signals; if no
  participants remain, marks the call `active: false` (FR-033, FR-029a). **Auth**: participant.

### `calls.setMedia` (mutation)
- **Args**: `{ callId: Id<"calls">, micEnabled: v.optional(v.boolean()), cameraEnabled: v.optional(v.boolean()), speaking: v.optional(v.boolean()) }`
- **Returns**: `v.null()`
- **Behavior**: updates the caller's participant media flags; `speaking` is written by the
  client's WebAudio detector (throttled). Visible to all reactively (FR-031, FR-032, SC-007).
  **Auth**: participant.

### `calls.getState` (query)
- **Args**: `{ channelId: v.optional(Id<"channels">), threadId: v.optional(Id<"directMessageThreads">) }`
- **Returns**: `v.union(v.null(), { callId, participants: v.array({ userId, name, avatarUrl, micEnabled, cameraEnabled, speaking }) })`
- **Behavior**: reactive current call + participant states, so both joined participants and
  channel observers see who is connected/muted/speaking (FR-032). **Auth**: member/participant.

## Signaling relay (R7)

### `signals.send` (mutation)
- **Args**: `{ callId: Id<"calls">, toUserId: Id<"users">, kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate")), payload: v.string() }`
- **Returns**: `v.null()`
- **Behavior**: inserts a signaling document from the caller to `toUserId`. Deterministic
  offerer rule (smaller `userId` offers) prevents glare (R6). **Auth**: both users MUST be
  participants of `callId`.

### `signals.receive` (query)
- **Args**: `{ callId: Id<"calls"> }`
- **Returns**: `v.array({ _id, fromUserId, kind, payload })`
- **Behavior**: reactive list of signals addressed to the caller for the call, oldest-first.
  Client applies each to the matching `RTCPeerConnection`, then calls `signals.ack`.
  **Auth**: participant.

### `signals.ack` (mutation)
- **Args**: `{ signalIds: v.array(Id<"signals">) }`
- **Returns**: `v.null()`
- **Behavior**: deletes consumed signal rows (R7 cleanup). **Auth**: recipient of each row.

## Client-side WebRTC contract (non-Convex)

- `RTCPeerConnection` configured with `iceServers: [{ urls: "stun:stun.l.google.com:19302" }]`
  (R8). No TURN — connection may fail behind symmetric NAT; the UI MUST show a clear failure
  state.
- Full-mesh: one connection per remote peer, max 3 peers (4-party call). Local mic/camera
  `MediaStream` tracks are added to every connection; remote tracks render as video tiles.
- On `iceConnectionState` transitioning to `failed`/`disconnected`, the client marks that
  peer disconnected in the UI (edge case: unexpected disconnect).
