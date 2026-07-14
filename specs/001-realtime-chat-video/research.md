# Phase 0 Research: Real-Time Chat & Video Calling Application

**Feature**: `001-realtime-chat-video` | **Date**: 2026-07-14

This document resolves the technical unknowns implied by the chosen stack (React + Vite +
Tailwind + Convex + native WebRTC) and records the decisions that shape Phase 1 design.
The stack itself was specified by the user; research focuses on *how* to apply each piece
correctly for this feature's requirements.

## R1. Real-time delivery without a socket server

- **Decision**: Use Convex reactive queries (`useQuery`) as the real-time transport for
  messages, presence, typing, membership, channel lists, calls, and signaling. Any client
  subscribed to a query is automatically pushed new results when underlying documents
  change.
- **Rationale**: Convex re-runs subscribed queries on data change and streams results over
  its own WebSocket, satisfying SC-002/SC-003/SC-005 (< 1–5s propagation) with no separate
  Socket.io server. This directly supports Constitution Principle III (reconnect/reconcile
  is handled by the Convex client).
- **Alternatives considered**: Socket.io + custom Node server (rejected: extra
  infrastructure, violates Principle V simplicity); polling (rejected: latency + load).

## R2. Authentication (Convex Auth password provider)

- **Decision**: Use `@convex-dev/auth` with the `Password` provider. Configure in
  `convex/auth.ts`, expose HTTP routes in `convex/http.ts`, and wrap the app in
  `ConvexAuthProvider` on the client. Gate the app behind `<Authenticated>` /
  `<Unauthenticated>` components.
- **Rationale**: First-party Convex auth stores password hashes securely and exposes
  `getAuthUserId(ctx)` inside functions for default-deny checks (Principle IV). Matches the
  spec's session-based assumption.
- **Sign-up profile fields**: display name and avatar are collected at sign-up. The
  password provider's `profile` callback maps these into the `users` document.
- **Alternatives considered**: Clerk / Auth0 (rejected: external dependency not requested);
  hand-rolled auth (rejected: security risk, reinventing hashing/session handling).

## R3. Online/offline presence via heartbeat (multi-session-safe)

- **Decision**: A `presence` table stores one row per user `{ userId, lastSeen }`. The client
  calls a `heartbeat` mutation on an interval (~10s) while the tab is active. A user is
  **online** if `now - lastSeen < 20s`, otherwise **offline**. Presence for a server is a
  query joining `serverMembers` with `presence` to derive the boolean (FR-005, FR-010).
- **Per-user, not per-tab**: because any active tab refreshes the single row, closing one of
  several open tabs does not flip the user offline — the surviving tab keeps `lastSeen`
  fresh. This directly satisfies the "same account in two sessions" edge case.
- **No `goOffline`**: an earlier draft flipped presence to offline on `beforeunload`. That is
  **wrong for multi-session** (closing one tab would mark a still-active user offline), so it
  is removed. Offline is reached purely by the staleness window when the *last* tab stops
  beating. Trade-off: involuntary-disconnect detection is bounded by the ~20s window rather
  than the 5s SC-003 target; the connect direction is immediate (first heartbeat on load).
  This is the simplest correct model; a per-session presence table (one row per tab, deleted
  on close) is the documented upgrade path if sub-5s disconnect ever becomes a hard
  requirement.
- **Cleanup**: staleness is computed at read time; an optional scheduled sweep deletes rows
  long past the window (also reused to reap stale call participants — see R9).

## R4. Typing indicators

- **Decision**: A `typingIndicators` table stores `{ channelId?, dmThreadId?, userId, updatedAt }`.
  A `setTyping` mutation upserts the row on keystroke (throttled to ~1 update / 2s). Readers
  query typing rows for the channel/thread updated within the last ~5s. Rows are ignored once
  stale and periodically cleaned.
- **Rationale**: Lightweight, reuses the same reactive-query mechanism, and self-expires via
  the staleness window (no explicit "stopped typing" event required, though blur sends one).
- **Alternatives considered**: Ephemeral signaling only (rejected: Convex has no ephemeral
  pub/sub separate from tables; a table with a short staleness window is simplest).

## R5. Message history pagination

- **Decision**: Use Convex's built-in pagination (`paginate` / `usePaginatedQuery`) on the
  `messages` table via a `by_channel` index ordered by creation time, loading newest-first
  in pages (e.g., 50) with infinite scroll upward.
- **Rationale**: Satisfies FR-023 (incremental load) and FR-023a (indefinite retention)
  without loading whole channels; Convex pagination is reactive (new messages append live).
- **Alternatives considered**: Manual cursor by `_creationTime` (viable but reimplements what
  `usePaginatedQuery` provides).

## R6. WebRTC full-mesh topology (≤ 4 participants)

- **Decision**: Full-mesh peer connections: each participant maintains one
  `RTCPeerConnection` to every other participant (N·(N−1)/2 connections; max 6 at N=4). Each
  peer publishes local mic/camera tracks to all connections.
- **Rationale**: Explicitly requested; for ≤4 participants the bandwidth/CPU cost of mesh is
  acceptable and avoids an SFU (Principle V). At N=4 each client sends 3 uplinks and receives
  3 downlinks — within desktop browser capability.
- **Deterministic offerer**: To avoid glare, the peer with the lexicographically smaller
  `userId` creates the offer; the other answers. This makes signaling roles deterministic.
- **No renegotiation on toggle**: both audio and video tracks are acquired and published at
  join; mic/camera toggles flip `track.enabled` rather than adding/removing tracks. This
  avoids `onnegotiationneeded` entirely, so the only offer/answer exchange is the initial one
  — keeping signaling minimal and glare-free (Principle V).
- **Alternatives considered**: SFU (LiveKit/Twilio/mediasoup) — rejected per requirements and
  because it adds a media server. Documented as the scaling path beyond 4 participants.
  Lazy track-add + renegotiation — rejected as unnecessary complexity for a 4-party mesh.

## R7. WebRTC signaling over Convex

- **Decision**: A `signals` table relays SDP offers/answers and ICE candidates as documents
  `{ callId, fromUserId, toUserId, kind: "offer"|"answer"|"candidate", payload, _creationTime }`.
  Each client subscribes (via `useQuery`) to signals addressed to it for the active call,
  applies them to the correct `RTCPeerConnection`, and deletes/acks consumed signals.
- **Rationale**: Reuses Convex reactive queries as the signaling channel, removing the need
  for Socket.io (as required). Signaling volume is tiny relative to media.
- **Consumed-signal cleanup**: Consumer deletes rows it has applied (or a scheduled sweep
  removes rows older than the call), keeping the table small.
- **Alternatives considered**: Dedicated WebSocket signaling server (rejected: extra infra).

## R8. STUN / NAT traversal (no TURN in v1)

- **Decision**: Configure `RTCPeerConnection` with `iceServers: [{ urls: "stun:stun.l.google.com:19302" }]`.
  No TURN server.
- **Rationale**: Requested constraint. STUN enables connectivity for most home/office NATs.
- **Accepted risk**: Peers behind symmetric NAT or restrictive firewalls may fail to connect
  with no relay fallback. This is an explicit v1 limitation; the UI MUST surface a clear
  "couldn't connect" state (ties to Edge Case: unexpected disconnect). TURN is the documented
  future fix.

## R9. Call participant & media state model

- **Decision**: `calls` (one row per active voice-channel room or DM call) and
  `callParticipants` (`{ callId, userId, micEnabled, cameraEnabled, speaking, joinedAt }`).
  Mic/camera toggles are mutations updating the participant row; "speaking" is detected
  client-side via WebAudio volume analysis and written on change (throttled). A voice channel
  room is always-open (FR-029a): the `calls` row exists/refreshes while ≥1 participant is
  connected and is emptied (participants removed) as people leave.
- **Rationale**: Keeps authoritative mute/speaking state in Convex so all participants (and
  non-joined observers of the channel) see indicators reactively within SC-007 (< 1s).
- **Join cap enforcement**: Join mutation rejects a 5th participant (FR-030 / edge case),
  returning a typed error the UI shows. Ghost participants (below) are excluded before the
  cap check so a crashed peer never permanently blocks a slot.
- **Ghost reaping**: an abrupt disconnect leaves a `callParticipants` row with no `leave`
  call. Each client refreshes `callParticipants.lastSeen` via `calls.heartbeat` (piggybacked
  on the presence heartbeat, ~10s). `calls.getState` excludes participants stale beyond the
  ~20s window, and the presence sweep also deletes them — keeping the participant list and
  the 4-person cap accurate. Peers also drop a tile immediately on
  `iceConnectionState = failed/disconnected` for fast UI feedback.
- **Alternatives considered**: Deriving mute/speaking purely from WebRTC stats (rejected:
  not reactive to other clients, harder to show to non-participants).

## R10. Authorization model (default-deny)

- **Decision**: Every query/mutation resolves `getAuthUserId`; server functions verify:
  membership in the server for channel/message access; authorship for edit/delete;
  ownership for server/channel management; shared-server existence only when *starting* a DM
  (FR-026/FR-026a). Unauthorized calls throw a typed error.
- **Rationale**: Principle IV requires default-deny enforced server-side, not in the UI.
- **Alternatives considered**: UI-only gating (rejected: insecure).

## R11. Cascade deletes, server-leave, and account deletion (FR-012a)

- **Decision**: Deleting a text channel deletes its messages + typing rows (FR-016); deleting
  a voice channel deletes its call/participants/signals; deleting a server deletes its
  channels, messages, typing rows, memberships, calls, participants, and signals. Implemented
  as explicit multi-step mutations (Convex has no cascading FK), chunked across scheduled
  mutations for large data to respect transaction limits.
- **Server-leave** (`servers.leave`): a non-owner leaving deletes only their own membership
  (+ their typing/call-participant rows in that server); the **owner** leaving deletes the
  whole server via the cascade above (FR-012a; no ownership transfer in v1).
- **Account deletion** (`users.deleteAccount`): cascade-delete every server the user owns;
  delete the user's memberships in other servers; delete the user's presence/typing/
  call-participant/pending-signal rows; **retain** DM threads, direct messages, and authored
  channel messages; set `users.deleted = true` (tombstone) and remove the auth identity.
- **Why a tombstone instead of hard-deleting the user**: FR-026a requires DMs to persist, and
  retained channel messages/DMs reference `authorId`/`userAId`/`userBId`. Keeping the `users`
  row as a tombstone (login disabled, hidden from member lists, unreachable for new DMs since
  no shared server remains) preserves those references so history renders correctly — simpler
  and safer than rewriting every historical row or nulling foreign keys.
- **Alternatives considered**: hard-deleting the `users` row (rejected: dangling references in
  retained DMs/messages); full soft-delete of all content (rejected: contradicts FR-026a and
  adds query-time filtering everywhere).

## R12. Testing strategy

- **Decision**: `convex-test` for function-level tests (auth gating, cascades, pagination,
  join caps); Vitest + React Testing Library for components/hooks; Playwright for a small set
  of two-client real-time e2e flows (message appears live, typing indicator, presence flip,
  2-party call connects). Tests authored before implementation per Principle I.
- **Rationale**: Covers the real-time and authorization behaviors that unit tests alone
  cannot, aligned with Constitution testing discipline.

## Resolved unknowns summary

All Technical Context items are resolved; no `NEEDS CLARIFICATION` markers remain. Accepted
v1 limitations are explicitly documented: no TURN (R8), full-mesh cap of 4 (R6), presence
disconnect bounded by heartbeat window (R3).
