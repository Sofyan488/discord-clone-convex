# Contract: Channel Messaging & Typing (US3)

Covers FR-017–FR-024, FR-023a.

## Messages

### `messages.list` (paginated query)
- **Args**: `{ channelId: Id<"channels">, paginationOpts: PaginationOptions }`
- **Returns**: Convex paginated result of
  `{ _id, authorId, authorName, authorAvatarUrl, content, _creationTime, editedAt }`
- **Behavior**: newest-first pages via `by_channel` index; reactive (new messages appear
  live), supports infinite scroll upward (FR-018, FR-023). **Auth**: caller MUST be a member
  of the channel's server (`NOT_MEMBER`).

### `messages.send` (mutation)
- **Args**: `{ channelId: Id<"channels">, content: v.string(), clientKey: v.optional(v.string()) }`
- **Returns**: `{ messageId: Id<"messages"> }`
- **Behavior**: inserts a message authored by the caller; becomes visible to all channel
  subscribers in real time (FR-017, FR-018). If `clientKey` is provided and a recent message
  from the same author in this channel already has it, the existing message is returned
  instead of inserting a duplicate (idempotent reconnect retries, SC-009). **Auth**: member of
  the server.
- **Validation**: `content` trimmed, 1–4000 chars (`VALIDATION` otherwise).

### `messages.edit` (mutation)
- **Args**: `{ messageId: Id<"messages">, content: v.string() }`
- **Returns**: `v.null()`
- **Behavior**: updates content and sets `editedAt = now` (renders "edited", FR-020).
- **Auth**: caller MUST be the author (`NOT_AUTHOR`) — enforces FR-022.

### `messages.remove` (mutation)
- **Args**: `{ messageId: Id<"messages"> }`
- **Returns**: `v.null()`
- **Behavior**: deletes the message for everyone (FR-021). **Auth**: author only
  (`NOT_AUTHOR`, FR-022).

## Typing indicators

### `typing.setTyping` (mutation)
- **Args**: `{ channelId: Id<"channels"> }`
- **Returns**: `v.null()`
- **Behavior**: upserts the caller's `typingIndicators` row for the channel with
  `updatedAt = now`; client throttles to ~1 call / 2s (FR-024, R4). **Auth**: member.

### `typing.clearTyping` (mutation)
- **Args**: `{ channelId: Id<"channels"> }`
- **Returns**: `v.null()`
- **Behavior**: removes the caller's typing row (sent on blur / send). **Auth**: member.

### `typing.list` (query)
- **Args**: `{ channelId: Id<"channels"> }`
- **Returns**: `v.array({ userId, name })`
- **Behavior**: lists users with a typing row updated within the last ~5s, excluding the
  caller (FR-024). **Auth**: member.
