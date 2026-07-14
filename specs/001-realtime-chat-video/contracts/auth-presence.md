# Contract: Auth & Presence (US1)

Covers FR-001–FR-005. Authentication is provided by `@convex-dev/auth` (password provider);
profile and presence functions are app-defined.

## Auth (via @convex-dev/auth)

- **HTTP routes** (`convex/http.ts`): the auth provider registers sign-up, sign-in, and
  sign-out endpoints. The React app uses `ConvexAuthProvider` and the `useAuthActions`
  hook (`signIn`, `signOut`).
- **Sign-up inputs**: `email`, `password`, plus profile fields `name` (display name) and
  `avatarUrl`. The `Password` provider's `profile(params)` maps these into the `users`
  document (FR-001).
- **Sign-in**: `email` + `password`; invalid credentials reject with an auth error the UI
  surfaces as a clear message (FR-002).
- **Session**: managed by the auth library; `getAuthUserId(ctx)` returns the current user
  id inside functions (FR-003).

## `users.getCurrent` (query)

- **Args**: `{}`
- **Returns**: `v.union(v.null(), { _id, name, email, avatarUrl })`
- **Auth**: returns `null` if unauthenticated, else the caller's user document.

## `users.deleteAccount` (mutation)

- **Args**: `{}`
- **Returns**: `v.null()`
- **Behavior**: deletes the caller's account per the FR-012a rules (data-model → "Membership
  departure & account deletion"): cascade-delete owned servers, remove memberships in other
  servers, delete the caller's presence/typing/callParticipants/pending signals, retain DMs
  and authored messages, set `users.deleted = true`, and remove the auth identity. Large
  cascades chunk across scheduled mutations (R11).
- **Auth**: authenticated caller only; operates solely on the caller's own account.

## `presence.heartbeat` (mutation)

- **Args**: `{}`
- **Returns**: `v.null()`
- **Behavior**: upserts the caller's single `presence` row with `lastSeen = now` (FR-005, R3).
  Any active tab refreshes it, so presence is per-user and multi-session-safe. Called on an
  interval (~10s) while the tab is active. There is intentionally **no** `goOffline`; offline
  is reached by the staleness window when the last tab stops heartbeating.
- **Auth**: authenticated caller only.

## `presence.listForServer` (query)

- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.array({ userId, name, avatarUrl, online: v.boolean() })`
- **Behavior**: lists members of the server with derived `online` (FR-010, FR-005).
- **Auth**: caller MUST be a member of `serverId` (else `NOT_MEMBER`).
