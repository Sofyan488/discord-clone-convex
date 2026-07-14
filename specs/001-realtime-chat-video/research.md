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

## R3. Online/offline presence via heartbeat

- **Decision**: A `presence` table stores `{ userId, lastSeen }`. The client calls a
  `heartbeat` mutation on an interval (~15s) while the tab is active. A user is considered
  **online** if `now - lastSeen < 30s`, otherwise **offline**. Presence for a server is a
  query that joins `serverMembers` with `presence` and derives the boolean.
- **Rationale**: Convex has no built-in socket-disconnect hook exposed to app code, so a
  heartbeat + staleness window is the standard pattern. 30s window meets SC-003 (< 5s is the
  *target* for active connect; disconnect detection is bounded by the window — see R2 note
  below). Interval of 15s with a 30s window tolerates one missed beat.
- **Refinement for SC-003**: On explicit logout / `beforeunload`, the client fires a
  best-effort `goOffline` mutation to flip presence immediately, so intentional
  disconnects reflect quickly; crash/network-loss falls back to the staleness window.
- **Alternatives considered**: Convex scheduled function sweeping stale rows (kept as an
  optional optimization, not required — staleness is computed at read time).

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
- **Alternatives considered**: SFU (LiveKit/Twilio/mediasoup) — rejected per requirements and
  because it adds a media server. Documented as the scaling path beyond 4 participants.

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
  returning a typed error the UI shows.
- **Alternatives considered**: Deriving mute/speaking purely from WebRTC stats (rejected:
  not reactive to other clients, harder to show to non-participants).

## R10. Authorization model (default-deny)

- **Decision**: Every query/mutation resolves `getAuthUserId`; server functions verify:
  membership in the server for channel/message access; authorship for edit/delete;
  ownership for server/channel management; shared-server existence only when *starting* a DM
  (FR-026/FR-026a). Unauthorized calls throw a typed error.
- **Rationale**: Principle IV requires default-deny enforced server-side, not in the UI.
- **Alternatives considered**: UI-only gating (rejected: insecure).

## R11. Cascade deletes

- **Decision**: Deleting a text channel deletes its messages (FR-016); deleting a server
  (including when its owner leaves/deletes account, FR-012a) deletes channels, messages,
  memberships, typing rows, calls, participants, and signals for that server. Implemented as
  explicit multi-step mutations (Convex has no cascading FK), batched/paginated for large
  data to respect transaction limits.
- **Rationale**: Meets the spec's deletion requirements; explicit cascades are the Convex
  idiom. Large cascades chunk work across scheduled mutations to stay within limits.
- **Alternatives considered**: Soft-delete flags (rejected for v1: adds query complexity;
  spec calls for actual removal).

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
