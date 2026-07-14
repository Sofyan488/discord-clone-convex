# Phase 1 Data Model: Real-Time Chat & Video Calling Application

**Feature**: `001-realtime-chat-video` | **Date**: 2026-07-14 | **Backend**: Convex

All tables are defined in `convex/schema.ts` using `defineTable` with explicit indexes for
every access pattern (per the tech stack directive). Convex adds `_id` and `_creationTime`
to every document automatically; those are not repeated below. Types are expressed with
Convex validators (`v.*`), which double as the runtime-validated contract (Constitution
Principle II).

## Conventions

- IDs referencing another table use `v.id("<table>")`.
- Timestamps we manage explicitly (heartbeats, edited markers) are `v.number()`
  (epoch ms); creation order uses the built-in `_creationTime`.
- "Online" is **derived**, not stored: `online = (now - presence.lastSeen) < 30_000`.

---

## Entity: users

Represents an account. Profile fields are populated by the Convex Auth password provider's
`profile` callback at sign-up. (Auth-managed credential/session tables from
`@convex-dev/auth` are additional and not enumerated here.)

| Field | Type | Notes |
|-------|------|-------|
| name | `v.string()` | Display name (FR-004). Required. |
| email | `v.string()` | Login identifier (from auth). |
| avatarUrl | `v.optional(v.string())` | Avatar URL. See avatar provisioning note below. |
| deleted | `v.optional(v.boolean())` | Tombstone flag set by account deletion (FR-012a). |

**Indexes**: `by_email` on `["email"]` (lookup / uniqueness check).

**Validation**: `name` non-empty, ≤ 80 chars; `email` unique (enforced in sign-up flow).

**Avatar provisioning**: file uploads are out of scope (FR-035), so an avatar is either an
external image URL supplied at sign-up or a **generated default** derived deterministically
from the user's id/initials when `avatarUrl` is absent. No upload/storage feature is built.

**Account deletion (tombstone)**: to satisfy FR-012a while keeping historical messages and
DMs renderable (FR-026a), account deletion does NOT hard-delete the `users` row. It sets
`deleted: true`, removes the auth identity (sign-in disabled), and cascades per the
"Account deletion" rules below. A tombstoned user renders their retained `name`/avatar in
old messages but cannot log in, cannot be messaged (shares no active server), and does not
appear in any member list.

---

## Entity: servers

A community space (FR-006, FR-007, FR-011).

| Field | Type | Notes |
|-------|------|-------|
| name | `v.string()` | Server name. Required. |
| ownerId | `v.id("users")` | Current owner (FR-006). |
| inviteCode | `v.string()` | Unguessable code embedded in the invite link (FR-008). |

**Indexes**: `by_owner` on `["ownerId"]`; `by_invite_code` on `["inviteCode"]`.

**Validation**: `name` 1–100 chars; `inviteCode` unique, random.

**Lifecycle**: Created with a default "general" text channel (FR-007). Deleted — with full
cascade (R11) — when the owner leaves or deletes their account (FR-012a).

---

## Entity: serverMembers

Join table linking users to servers (FR-009, FR-010, FR-012).

| Field | Type | Notes |
|-------|------|-------|
| serverId | `v.id("servers")` | |
| userId | `v.id("users")` | |
| role | `v.union(v.literal("owner"), v.literal("member"))` | Flat model (spec assumption). |
| joinedAt | `v.number()` | |

**Indexes**: `by_server` on `["serverId"]`; `by_user` on `["userId"]`;
`by_server_and_user` on `["serverId", "userId"]` (membership check / uniqueness).

**Validation**: one membership row per (serverId, userId); exactly one `owner` per server.

---

## Entity: channels

Text or voice channel within a server (FR-013–FR-016, FR-029a).

| Field | Type | Notes |
|-------|------|-------|
| serverId | `v.id("servers")` | |
| name | `v.string()` | |
| type | `v.union(v.literal("text"), v.literal("voice"))` | |

**Indexes**: `by_server` on `["serverId"]`; `by_server_and_type` on `["serverId", "type"]`.

**Ordering**: channels are displayed in creation order via the built-in `_creationTime`
(no separate `position` field — the spec has no reorder feature).

**Validation**: `name` 1–100 chars. Deleting a **text** channel cascades to its messages and
typing rows (FR-016); deleting a **voice** channel cascades to its call/participants/signals.

---

## Entity: messages

A message within a text channel (FR-017–FR-023a).

| Field | Type | Notes |
|-------|------|-------|
| channelId | `v.id("channels")` | |
| authorId | `v.id("users")` | Author (FR-019, authorship checks FR-022). |
| content | `v.string()` | Message body. |
| editedAt | `v.optional(v.number())` | Set on edit → renders "edited" marker (FR-020). |

**Indexes**: `by_channel` on `["channelId"]` (paginated newest-first, FR-023).

**Validation**: `content` 1–4000 chars, non-empty after trim. Timestamp shown = `_creationTime`.
Edit/delete fetch the message by `_id`, so no `by_author` index is needed (no feature lists
a user's messages).

**Retention**: indefinite; removed only by author delete or channel/server cascade (FR-023a).

---

## Entity: directMessageThreads

A one-to-one DM conversation between two users (FR-025, FR-026a).

| Field | Type | Notes |
|-------|------|-------|
| userAId | `v.id("users")` | Stored with `userAId < userBId` (canonical order) to dedupe. |
| userBId | `v.id("users")` | |

**Indexes**: `by_userA` on `["userAId"]`; `by_userB` on `["userBId"]`;
`by_pair` on `["userAId", "userBId"]` (find/create the single thread for a pair).

**Validation**: exactly one thread per unordered pair (enforced via canonical ordering +
`by_pair`). Starting a thread requires a shared server at creation time (FR-025/FR-026);
existing threads persist regardless afterward (FR-026a).

---

## Entity: directMessages

A message inside a DM thread (FR-027, FR-028).

| Field | Type | Notes |
|-------|------|-------|
| threadId | `v.id("directMessageThreads")` | |
| authorId | `v.id("users")` | |
| content | `v.string()` | |
| editedAt | `v.optional(v.number())` | Edited marker (FR-028). |

**Indexes**: `by_thread` on `["threadId"]` (paginated).

**Validation**: same content rules as `messages`. Author-only edit/delete (FR-028). Edit/delete
fetch by `_id`, so no `by_author` index is needed.

---

## Entity: typingIndicators

Ephemeral typing state for a channel or DM thread (FR-024).

| Field | Type | Notes |
|-------|------|-------|
| userId | `v.id("users")` | |
| channelId | `v.optional(v.id("channels"))` | Set for channel typing. |
| threadId | `v.optional(v.id("directMessageThreads"))` | Set for DM typing. |
| updatedAt | `v.number()` | Staleness window ~5s (R4). |

**Indexes**: `by_channel` on `["channelId"]`; `by_thread` on `["threadId"]`;
`by_user_and_channel` on `["userId", "channelId"]`; `by_user_and_thread` on `["userId", "threadId"]`.

**Validation**: exactly one of `channelId` / `threadId` present. Rows older than the window
are ignored by readers and periodically cleaned.

---

## Entity: presence

Heartbeat-based presence (FR-005, R3).

| Field | Type | Notes |
|-------|------|-------|
| userId | `v.id("users")` | |
| lastSeen | `v.number()` | Updated by `heartbeat`; used to derive online/offline. |

**Indexes**: `by_user` on `["userId"]`.

**Validation**: one row per user (upsert). Online derived at read time (~20s window). Presence
is **per user, not per tab**: any active tab refreshes `lastSeen`, so closing one of several
tabs keeps the user online (fixes the multi-session edge case). There is no explicit
`goOffline`; offline is reached purely by the staleness window when the last tab stops
heartbeating.

---

## Entity: calls

An active voice/video session — a voice-channel room or a DM call (FR-029–FR-034, R9).

| Field | Type | Notes |
|-------|------|-------|
| channelId | `v.optional(v.id("channels"))` | Set for a voice-channel call. |
| threadId | `v.optional(v.id("directMessageThreads"))` | Set for a DM call (FR-034). |
| active | `v.boolean()` | True while ≥1 participant connected (always-open room, FR-029a). |

**Indexes**: `by_channel` on `["channelId"]`; `by_thread` on `["threadId"]`.

**Validation**: exactly one of `channelId` / `threadId`. At most one active call per
channel/thread.

---

## Entity: callParticipants

Per-participant media state within a call (FR-030–FR-033, R9).

| Field | Type | Notes |
|-------|------|-------|
| callId | `v.id("calls")` | |
| userId | `v.id("users")` | |
| micEnabled | `v.boolean()` | Toggled by mutation (FR-031). |
| cameraEnabled | `v.boolean()` | Toggled by mutation (FR-031). |
| speaking | `v.boolean()` | Client-detected, throttled write (FR-032). |
| joinedAt | `v.number()` | |
| lastSeen | `v.number()` | Refreshed by the in-call heartbeat; used to reap ghosts. |

**Indexes**: `by_call` on `["callId"]`; `by_call_and_user` on `["callId", "userId"]`;
`by_user` on `["userId"]`.

**Validation**: one row per (callId, userId). Join rejected when a call already has 4
participants (FR-030). Leaving removes the row; removing the last row deactivates the call.

**Ghost reaping**: an abrupt disconnect (tab crash) leaves no `leave` call, so the same
client heartbeat that pings presence also calls `calls.heartbeat` to refresh `lastSeen`.
Participants stale beyond the presence window (~20s) are treated as gone: they are excluded
from `calls.getState` at read time and removed by the same sweep that cleans presence,
keeping the participant list and the 4-person cap accurate. Peers additionally drop a tile
immediately on `iceConnectionState = failed/disconnected` for fast UI feedback.

---

## Entity: signals

WebRTC signaling relay (R7). Short-lived documents.

| Field | Type | Notes |
|-------|------|-------|
| callId | `v.id("calls")` | |
| fromUserId | `v.id("users")` | |
| toUserId | `v.id("users")` | Recipient subscribes to signals addressed to them. |
| kind | `v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate"))` | |
| payload | `v.string()` | JSON-encoded SDP or ICE candidate. |

**Indexes**: `by_call` on `["callId"]`; `by_recipient` on `["callId", "toUserId"]`.

**Validation**: consumer deletes rows after applying them; a scheduled sweep removes
signals for inactive calls (keeps the table small).

---

## Relationship overview

```text
users 1───∞ serverMembers ∞───1 servers 1───∞ channels 1───∞ messages
  │                                   │            │
  │                                   │            └───∞ typingIndicators
  │                                   └───(owner)
  │
  ├──1 presence
  ├──∞ directMessageThreads(userA/userB) 1───∞ directMessages
  └──∞ callParticipants ∞───1 calls 1───∞ signals
                                  └── channelId? / threadId?
```

## Cascade rules (see research R11)

- Delete **text channel** → delete its `messages` + `typingIndicators`.
- Delete **voice channel** → delete its `calls` + `callParticipants` + `signals`.
- Delete **server** → delete its `channels`, `messages`, `typingIndicators`,
  `serverMembers`, `calls`, `callParticipants`, `signals`.
- Delete **message / directMessage** → remove the single document (author-initiated).
- DM threads and their messages are **not** cascaded by server deletion (FR-026a: DMs
  persist).

## Membership departure & account deletion (FR-012a)

- **Member leaves a server** (`servers.leave`, non-owner): delete only that user's
  `serverMembers` row plus their `typingIndicators`/`callParticipants` in that server. Their
  authored `messages` remain (like Discord).
- **Owner leaves a server** (`servers.leave`, owner) OR **owner deletes account**: the server
  is deleted with the full server cascade above (ownership is never transferred in v1).
- **Account deletion** (`users.deleteAccount`): (1) cascade-delete every server the user
  owns; (2) delete the user's `serverMembers` in all other servers; (3) delete the user's
  `presence`, `typingIndicators`, `callParticipants`, and pending `signals`; (4) **retain**
  the user's DM threads, `directMessages`, and authored channel `messages`; (5) set the
  `users` row `deleted: true` and remove the auth identity. The retained `users` tombstone
  keeps historical content renderable and satisfies FR-026a (DMs persist) without dangling
  id references.
