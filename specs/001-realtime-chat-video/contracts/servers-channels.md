# Contract: Servers & Channels (US2, US3)

Covers FR-006–FR-016, FR-012a.

## Servers

### `servers.create` (mutation)
- **Args**: `{ name: v.string() }`
- **Returns**: `{ serverId: Id<"servers"> }`
- **Behavior**: creates the server with caller as `owner`, adds an `owner` `serverMembers`
  row, generates a unique `inviteCode`, and creates a default "general" text channel
  (FR-006, FR-007).
- **Auth**: authenticated. **Validation**: `name` 1–100 chars.

### `servers.rename` (mutation)
- **Args**: `{ serverId: Id<"servers">, name: v.string() }`
- **Returns**: `v.null()`
- **Auth**: caller MUST be the owner (`NOT_OWNER`). (FR-011)

### `servers.remove` (mutation)
- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.null()`
- **Behavior**: full cascade delete of the server (channels, messages, typing, members,
  calls, participants, signals) — R11. Also invoked when the owner deletes their account
  (FR-012a). **Auth**: owner only.

### `servers.removeMember` (mutation)
- **Args**: `{ serverId: Id<"servers">, userId: Id<"users"> }`
- **Returns**: `v.null()`
- **Behavior**: deletes the target `serverMembers` row; the removed user loses access
  (FR-012). Owner cannot be removed this way. **Auth**: owner only.

### `servers.leave` (mutation)
- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.null()`
- **Behavior**: the caller leaves the server. If the caller is a **member**, only their
  `serverMembers` (+ their typing/call-participant rows in that server) are removed. If the
  caller is the **owner**, the entire server is cascade-deleted (FR-012a; ownership is not
  transferred in v1). **Auth**: caller MUST be a member of `serverId`.

### `servers.listMine` (query)
- **Args**: `{}`
- **Returns**: `v.array({ _id, name, ownerId })`
- **Behavior**: servers the caller is a member of (server rail). **Auth**: authenticated.

### `servers.getMembers` (query)
- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.array({ userId, name, avatarUrl, role, online })`
- **Auth**: caller MUST be a member (`NOT_MEMBER`). (FR-010)

## Invites

### `servers.getInvite` (query)
- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `{ inviteCode: v.string() }`
- **Behavior**: returns the server's reusable `inviteCode`, which is generated once at server
  creation (FR-008). No separate generate/rotate mutation exists in v1 (kept simple; the
  spec has no code-rotation requirement). **Auth**: caller MUST be a member.

### `servers.getInvitePreview` (query)
- **Args**: `{ inviteCode: v.string() }`
- **Returns**: `v.union(v.null(), { serverId, name, memberCount })`
- **Behavior**: resolves a code to a joinable server preview; `null` if the code is invalid
  or the server no longer exists (edge case: invite after deletion). **Auth**: authenticated.

### `servers.joinByInvite` (mutation)
- **Args**: `{ inviteCode: v.string() }`
- **Returns**: `{ serverId: Id<"servers"> }`
- **Behavior**: adds caller as a `member` if the code is valid and they are not already a
  member (FR-009). Rejects invalid/expired codes (`NOT_FOUND`). **Auth**: authenticated.

## Channels

### `channels.list` (query)
- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.array({ _id, name, type, _creationTime })` (ordered by `_creationTime`)
- **Auth**: caller MUST be a member; returns all channels (FR-013).

### `channels.create` (mutation)
- **Args**: `{ serverId: Id<"servers">, name: v.string(), type: v.union(v.literal("text"), v.literal("voice")) }`
- **Returns**: `{ channelId: Id<"channels"> }`
- **Auth**: owner only (FR-014). **Validation**: `name` 1–100 chars.

### `channels.rename` (mutation)
- **Args**: `{ channelId: Id<"channels">, name: v.string() }`
- **Returns**: `v.null()`
- **Auth**: owner of the parent server only (FR-015).

### `channels.remove` (mutation)
- **Args**: `{ channelId: Id<"channels"> }`
- **Returns**: `v.null()`
- **Behavior**: deletes the channel; if text, cascades its messages + typing rows (FR-016);
  if voice, cascades its call/participants/signals (R11). **Auth**: owner only.
