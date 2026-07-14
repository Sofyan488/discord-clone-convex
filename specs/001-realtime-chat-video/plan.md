# Implementation Plan: Real-Time Chat & Video Calling Application

**Branch**: `001-realtime-chat-video` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-realtime-chat-video/spec.md`

## Summary

Build a Discord-style web application delivering authenticated real-time text messaging
in server channels, direct messages, presence/typing indicators, and full-mesh WebRTC
voice/video calls (up to 4 participants). The implementation uses a React + TypeScript +
Vite single-page app styled with Tailwind, backed entirely by Convex (database, queries,
mutations, and auth). Real-time behavior is achieved through Convex reactive queries
(`useQuery` live subscriptions) rather than a separate socket server; WebRTC signaling is
also relayed through a Convex table. No dedicated media server (SFU) is used in v1.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node.js 18+ (Convex CLI/runtime)

**Primary Dependencies**: React 18, Vite, React Router, Tailwind CSS, Convex,
`@convex-dev/auth` (password provider), native browser WebRTC (`RTCPeerConnection`)

**Storage**: Convex (document/relational tables defined in `convex/schema.ts` with
explicit indexes for every access pattern)

**Testing**: Vitest + React Testing Library (frontend components/hooks); Convex function
tests via `convex-test`; end-to-end smoke via Playwright for the critical real-time flows

**Target Platform**: Modern desktop web browsers (Chromium, Firefox, Safari) with WebRTC
support

**Project Type**: Web single-page application with a Convex backend (single repository)

**Performance Goals**: New messages visible to channel viewers in < 1s (SC-002); presence
changes reflected < 5s (SC-003); edits/deletes propagate < 1s (SC-005); mute/speaking
indicators update < 1s (SC-007)

**Constraints**: Full-mesh WebRTC limited to 4 participants (SC-006); Google public STUN
only, no TURN in v1 (calls may fail behind symmetric NAT — accepted risk); env vars in
`.env.local` only; no component library (Tailwind primitives only)

**Scale/Scope**: Up to ~500 members per server and ~2,000 concurrent users (SC-010); 5
user stories, 11 Convex tables, ~40 Convex functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.0.0:

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Test-First (NON-NEGOTIABLE) | Plan mandates Vitest + `convex-test` + Playwright; tasks will be authored test-first (failing test before implementation). | PASS |
| II. Type-Safe Contracts | End-to-end TypeScript in `strict` mode; Convex validators (`v.*`) define runtime-validated argument/return contracts shared by client and server; generated `api` types are the single source of truth. | PASS |
| III. Real-Time Reliability | Convex reactive queries auto-reconcile on reconnect; mutations are transactional and made idempotent (client-generated dedupe keys where needed); optimistic UI reconciles against server state. | PASS |
| IV. Security & Privacy by Default | Convex Auth gates every query/mutation; each function re-checks membership/authorship (default-deny); user content escaped by React by default; secrets only in `.env.local`; passwords handled by Convex Auth password provider (hashed). | PASS |
| V. Simplicity & Incremental Delivery | No SFU/TURN/socket server; full-mesh WebRTC and Convex-relayed signaling keep the stack minimal. Work is sliced by the spec's prioritized user stories for incremental delivery. | PASS |

**Technology & Architecture Constraints**: Satisfied — TypeScript end-to-end, Convex
provides schema + migrations path, config via environment, WebRTC is native (no extra
runtime dependency for media).

**Initial Constitution Check**: PASS (no violations; Complexity Tracking empty).

**Post-Design Constitution Check** (re-evaluated after Phase 1): PASS. The data model and
contracts preserve default-deny authorization on every function, keep contracts typed via
Convex validators, and introduce no new complexity requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-realtime-chat-video/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── auth-presence.md
│   ├── servers-channels.md
│   ├── messaging.md
│   ├── direct-messages.md
│   └── calls-signaling.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
convex/
├── schema.ts              # All tables + indexes (single source of truth)
├── auth.ts                # Convex Auth config (password provider)
├── auth.config.ts         # Auth environment configuration
├── http.ts                # Auth HTTP routes
├── users.ts               # User profile queries/mutations
├── presence.ts            # Heartbeat-based online/offline presence
├── servers.ts             # Create/rename/delete server, invites, membership
├── channels.ts            # Create/rename/delete text & voice channels
├── messages.ts            # Channel messaging (send/edit/delete, paginated history)
├── typing.ts              # Typing indicators
├── directMessages.ts      # DM threads + messages
├── calls.ts               # Call/participant lifecycle, mic/camera/speaking state
├── signals.ts             # WebRTC signaling relay (offers/answers/ICE)
└── _generated/            # Convex-generated API & data model types

src/
├── main.tsx               # App entry (ConvexProvider + Router)
├── App.tsx                # Route layout
├── router.tsx             # React Router routes
├── lib/
│   ├── convex.ts          # Convex client setup
│   └── webrtc/            # RTCPeerConnection mesh manager + signaling glue
├── hooks/                 # usePresence, useTyping, useCall, useHeartbeat, ...
├── components/            # Reusable Tailwind primitives (Button, Avatar, Modal, ...)
├── features/
│   ├── auth/              # Sign up / log in screens
│   ├── servers/           # Server rail, create/join, member list
│   ├── channels/          # Channel sidebar, channel management
│   ├── messages/          # Message list, composer, edit/delete, typing UI
│   ├── dms/               # Direct message UI
│   └── calls/             # Voice/video call UI (tiles, controls)
└── styles/                # Tailwind entry (index.css)

tests/
├── convex/                # Convex function tests (convex-test)
├── unit/                  # Component/hook unit tests (Vitest + RTL)
└── e2e/                   # Playwright smoke tests for real-time flows

.env.local                # Convex deployment URL + auth secrets (gitignored)
index.html                # Vite entry
vite.config.ts
tailwind.config.ts
tsconfig.json
```

**Structure Decision**: Single repository with a root Vite SPA and Convex functions under
`convex/`, per the provided tech stack. There is no separate backend service directory —
Convex is the backend. Real-time transport is Convex's reactive query system; WebRTC media
is peer-to-peer with Convex used only for signaling.

## Complexity Tracking

> No constitution violations. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |
