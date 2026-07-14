# Contracts: Convex Function API

**Feature**: `001-realtime-chat-video`

Because Convex is both the database and the backend, the application's interface contract
is its set of **queries** (reactive reads), **mutations** (transactional writes), and
**auth HTTP routes**. Each function's argument and return validators (`v.*`) are the
authoritative, runtime-validated contract shared between client and server (Constitution
Principle II). The generated `api` object provides end-to-end types to the React client.

## Conventions used in these contracts

- **Query** = read; subscribed via `useQuery`, re-runs reactively on data change.
- **Mutation** = write; transactional, invoked via `useMutation`.
- Every function performs a **default-deny** authorization check using
  `getAuthUserId(ctx)` and rejects with a typed error if the caller is not permitted
  (Principle IV). Unauthed calls throw `ConvexError("UNAUTHENTICATED")`.
- Common typed errors: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `NOT_MEMBER`,
  `NOT_AUTHOR`, `NOT_OWNER`, `NO_SHARED_SERVER`, `CALL_FULL`, `VALIDATION`.
- Args/returns below are described in `v.*` terms; `Id<T>` denotes `v.id("T")`.

## Contract files

| File | Covers | User stories |
|------|--------|--------------|
| [auth-presence.md](./auth-presence.md) | Sign-up/login, profile, presence heartbeat | US1 |
| [servers-channels.md](./servers-channels.md) | Servers, invites, membership, channels | US2, US3 |
| [messaging.md](./messaging.md) | Channel messages, typing indicators | US3 |
| [direct-messages.md](./direct-messages.md) | DM threads and messages | US4 |
| [calls-signaling.md](./calls-signaling.md) | Calls, participants, WebRTC signaling | US5 |

## Contract test expectations

Each function has at least one `convex-test` test asserting: (a) the happy path with a
valid authenticated caller, and (b) the authorization failure path (wrong user / not a
member / not the author / not the owner). These tests are written **before** the
implementation (Principle I).
