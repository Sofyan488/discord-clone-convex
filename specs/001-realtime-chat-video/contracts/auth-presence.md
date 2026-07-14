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

## `users.updateProfile` (mutation)

- **Args**: `{ name: v.optional(v.string()), avatarUrl: v.optional(v.string()) }`
- **Returns**: `v.null()`
- **Auth**: caller must be authenticated; updates only their own `users` row.
- **Validation**: `name` 1–80 chars when present.

## `presence.heartbeat` (mutation)

- **Args**: `{}`
- **Returns**: `v.null()`
- **Behavior**: upserts `presence` row for the caller with `lastSeen = now` (FR-005, R3).
- **Auth**: authenticated caller only.

## `presence.goOffline` (mutation)

- **Args**: `{}`
- **Returns**: `v.null()`
- **Behavior**: sets `lastSeen` far in the past (or removes the row) so the user flips to
  offline immediately on explicit logout / tab close (R3 refinement).

## `presence.listForServer` (query)

- **Args**: `{ serverId: Id<"servers"> }`
- **Returns**: `v.array({ userId, name, avatarUrl, online: v.boolean() })`
- **Behavior**: lists members of the server with derived `online` (FR-010, FR-005).
- **Auth**: caller MUST be a member of `serverId` (else `NOT_MEMBER`).
