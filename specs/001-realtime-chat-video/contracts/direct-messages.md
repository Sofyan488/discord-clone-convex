# Contract: Direct Messages (US4)

Covers FR-025–FR-028, FR-026a.

## Threads

### `directMessages.startThread` (mutation)
- **Args**: `{ otherUserId: Id<"users"> }`
- **Returns**: `{ threadId: Id<"directMessageThreads"> }`
- **Behavior**: finds or creates the single DM thread for the unordered pair (canonical
  `userAId < userBId`). Creation REQUIRES the caller and `otherUserId` to currently share
  at least one server (FR-025); otherwise rejects with `NO_SHARED_SERVER` (FR-026).
- **Auth**: authenticated. Idempotent (returns existing thread if present).

### `directMessages.listThreads` (query)
- **Args**: `{}`
- **Returns**: `v.array({ threadId, otherUser: { userId, name, avatarUrl, online }, lastMessageAt })`
- **Behavior**: the caller's DM conversations; persists even if a shared server no longer
  exists (FR-026a). **Auth**: authenticated (only threads the caller participates in).

## Messages

### `directMessages.list` (paginated query)
- **Args**: `{ threadId: Id<"directMessageThreads">, paginationOpts: PaginationOptions }`
- **Returns**: paginated `{ _id, authorId, content, _creationTime, editedAt }`
- **Behavior**: reactive, newest-first pages via `by_thread` (FR-027). **Auth**: caller MUST
  be one of the thread's two participants (`FORBIDDEN`).

### `directMessages.send` (mutation)
- **Args**: `{ threadId: Id<"directMessageThreads">, content: v.string() }`
- **Returns**: `{ messageId: Id<"directMessages"> }`
- **Behavior**: inserts a DM; delivered to the other participant in real time (FR-027). No
  shared-server check here (FR-026a). **Auth**: participant only.
- **Validation**: `content` trimmed, 1–4000 chars.

### `directMessages.edit` (mutation)
- **Args**: `{ messageId: Id<"directMessages">, content: v.string() }`
- **Returns**: `v.null()`
- **Behavior**: updates content, sets `editedAt` (FR-028). **Auth**: author only (`NOT_AUTHOR`).

### `directMessages.remove` (mutation)
- **Args**: `{ messageId: Id<"directMessages"> }`
- **Returns**: `v.null()`
- **Behavior**: deletes the DM for both participants (FR-028). **Auth**: author only.

## Typing (DM)

Reuses `typing.setTyping` / `clearTyping` / `list` with `{ threadId }` instead of
`{ channelId }`; auth requires thread participation.
