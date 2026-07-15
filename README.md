# Discord Clone

A Discord-style, real-time chat and video-calling web application. Sign up, create
servers, talk in text channels, exchange direct messages, and jump into
full-mesh voice/video calls — all with live presence and typing indicators,
backed by a fully reactive database.

- **Live demo:** https://discord-clone-gilt-mu.vercel.app
- **Repository:** https://github.com/Sofyan488/discord-clone-convex

> Built with **Spec-Driven Development** (GitHub Spec Kit) and **Claude Code**.
> The complete specification, plan, research, data model, API contracts, and task
> breakdown live in [`specs/001-realtime-chat-video/`](specs/001-realtime-chat-video/).

---

## Problem & Goal

Real-time collaboration apps are deceptively hard: presence, live message fan-out,
typing indicators, and peer-to-peer media all have to stay consistent across many
clients at once. The goal of this project is a **version-one Discord clone** that
demonstrates a clean, tested, spec-driven implementation of those real-time
primitives on a modern serverless stack — servers, channels, messaging, DMs, and
small-group WebRTC calls — without a hand-rolled websocket/back-end layer.

Scope target (v1): up to ~500 members per server and ~2,000 concurrent users;
voice/video calls are full-mesh and capped at 4 participants.

---

## Main Features

**Authentication & presence**
- Email/password sign-up and log-in (Convex Auth) with display name + avatar
- Live online/offline presence derived from a heartbeat (~20s staleness window)
- Account settings with account deletion (cascades owned servers; retains DMs)

**Servers**
- Create a server (auto-provisions a default `#general` text channel)
- Invite links, join-by-invite with a preview screen
- Owner-only rename, remove member; members can leave
- Member list with live presence

**Channels & messaging**
- Text and voice channels; owner create / rename / delete (with message cascade)
- Real-time channel messages with pagination ("load older" history)
- Edit and delete your own messages (with an "(edited)" marker)
- Typing indicators; idempotent send (exactly-once on reconnect via a client key)
- Consistent loading, empty, and error states

**Direct messages**
- Start a DM with any member you share a server with
- Real-time 1:1 exchange, edit/delete, typing indicators, conversation list
- DMs persist even after the two users no longer share a server

**Voice & video calls**
- Always-open voice-channel rooms — join/leave anytime (full-mesh, ≤4)
- 1:1 "start video call" from a DM
- Native WebRTC (`RTCPeerConnection`) with offer/answer/ICE signaling relayed
  through Convex; queued-ICE and glare handling; deterministic offerer by user id
- Mic mute/unmute, camera on/off, remote participant tiles
- Speaking and muted indicators; permission-denied state; cleanup on leave/disconnect

---

## Screens & User Flows

| Screen | Flow |
| --- | --- |
| **Auth** | Sign up (name, avatar, email, password) → logged in → app shell |
| **Servers home / server view** | Server rail → create server → `#general` opens → channel sidebar + member list |
| **Invite** | Owner opens invite modal → copies link → invitee opens `/invite/:code` → preview → accept → joins |
| **Channel** | Select channel → live message list + composer → edit/delete own → typing indicator |
| **Direct messages** | Member list "Message" → DM conversation → real-time exchange → edit/delete |
| **Voice/video** | Select voice channel → "Join Voice" → participant tiles → mic/camera toggles → leave |

_Screenshots: see [Screenshots](#screenshots) below._

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | **React 18**, **TypeScript**, **Vite**, **Tailwind CSS** |
| Routing | React Router |
| Backend / DB / realtime | **Convex** (reactive queries, mutations, cron) |
| Auth | **Convex Auth** (`@convex-dev/auth`, password provider) |
| Real-time media | **Native WebRTC** / `RTCPeerConnection` (full-mesh, Google STUN) |
| Unit / integration tests | **Vitest**, React Testing Library, `convex-test` |
| End-to-end tests | **Playwright** (two-context real-time flows, fake-media for calls) |
| Workflow | **Spec Kit** (Spec-Driven Development) + **Claude Code** |

**Required Node version:** Node **20+** (developed on Node 22).

---

## Spec-Driven Development

This project was built with the **GitHub Spec Kit** workflow: every capability was
specified, planned, and broken into ordered, testable tasks *before* implementation,
and the artifacts were kept in sync with the code. All artifacts live under
[`specs/001-realtime-chat-video/`](specs/001-realtime-chat-video/) and
[`.specify/`](.specify/):

| Artifact | Location |
| --- | --- |
| **Constitution** (project principles) | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) |
| **Specification** | [`specs/001-realtime-chat-video/spec.md`](specs/001-realtime-chat-video/spec.md) |
| **Clarifications** | recorded in `spec.md` (Clarifications section) |
| **Plan** | [`specs/001-realtime-chat-video/plan.md`](specs/001-realtime-chat-video/plan.md) |
| **Research** | [`specs/001-realtime-chat-video/research.md`](specs/001-realtime-chat-video/research.md) |
| **Data model** | [`specs/001-realtime-chat-video/data-model.md`](specs/001-realtime-chat-video/data-model.md) |
| **Contracts** | [`specs/001-realtime-chat-video/contracts/`](specs/001-realtime-chat-video/contracts/) |
| **Checklists** | [`specs/001-realtime-chat-video/checklists/`](specs/001-realtime-chat-video/checklists/) |
| **Tasks** | [`specs/001-realtime-chat-video/tasks.md`](specs/001-realtime-chat-video/tasks.md) |

---

## Architecture Overview

The frontend is a Vite React SPA. All application state — users, servers, channels,
messages, DMs, presence, typing, and call state — lives in **Convex**, which serves
as database, backend functions, and the real-time transport in one.

**Convex real-time subscriptions.** UI components subscribe to Convex queries with
`useQuery` / `usePaginatedQuery`. When a mutation writes data (a new message, a
presence heartbeat, a call participant), Convex re-runs affected queries and pushes
fresh results to every subscribed client — no manual websocket handling.

**WebRTC signaling through Convex.** There is no dedicated signaling server. Session
descriptions (offer/answer) and ICE candidates are written to a `signals` table via
mutations and delivered to the recipient through a reactive query; each side acks and
consumes them. This reuses the same real-time channel as the rest of the app.

**Full-mesh call architecture.** Each participant opens a direct `RTCPeerConnection`
to every other participant (mesh), so an N-person call has N·(N−1)/2 connections —
kept small by the v1 cap of **4**. A deterministic rule (compare user ids) decides
who sends the offer to avoid glare; incoming ICE candidates that arrive before the
remote description are queued and applied in order. STUN (Google public servers) is
used for NAT traversal; there is **no TURN relay** in v1.

**Server functions.** Authorization is default-deny: `convex/lib/auth.ts` centralizes
`requireUser` / `requireMember` / `requireOwner` / `requireAuthor` checks with typed
error codes. Destructive operations use chunked cascade helpers
(`convex/lib/cascade.ts`). A Convex **cron** (`convex/crons.ts`) periodically sweeps
stale presence, call participants, typing rows, and consumed signals.

---

## Folder Structure

```
discord-clone/
├── convex/                     # Convex backend (schema, functions, auth, cron)
│   ├── schema.ts               # 12 tables + indexes
│   ├── auth.ts / auth.config.ts / http.ts
│   ├── servers.ts channels.ts messages.ts directMessages.ts
│   ├── presence.ts typing.ts calls.ts signals.ts users.ts
│   ├── crons.ts                # scheduled stale-row sweep
│   └── lib/                    # auth guards + cascade-delete helpers
├── src/
│   ├── components/             # UI primitives (Button, Modal, Avatar, Spinner, ErrorBoundary…)
│   ├── features/               # auth, servers, channels, messages, dms, calls
│   ├── hooks/                  # usePresence, useTyping, useCall, useHeartbeat…
│   ├── lib/                    # convex client + webrtc/MeshManager.ts
│   ├── styles/                 # Tailwind entry
│   ├── App.tsx / router.tsx / main.tsx
├── tests/
│   ├── convex/                 # convex-test integration tests
│   ├── unit/                   # component + WebRTC mesh unit tests
│   └── e2e/                    # Playwright two-client flows
├── specs/001-realtime-chat-video/   # Spec Kit artifacts
└── .specify/                   # constitution + templates
```

---

## Local Setup

### Prerequisites
- Node.js **20+** (22 recommended) and npm
- A Convex account for the cloud backend (free tier is fine) — the CLI walks you
  through login on first run

### Install

```bash
git clone https://github.com/Sofyan488/discord-clone-convex.git
cd discord-clone-convex
npm install
```

### Configure the backend

Start the Convex dev backend. On first run it will prompt you to log in and create
a project, then write your deployment URL into `.env.local`:

```bash
npx convex dev
```

This generates `convex/_generated/` and provisions the schema. You also need auth
keys set on the Convex deployment (see [Authentication setup](#authentication-setup)).

### Run the app

In a second terminal:

```bash
npm run dev
```

Open http://localhost:5173.

> **Two commands, two terminals:** `npx convex dev` (backend, keeps types +
> functions in sync) and `npm run dev` (Vite frontend).

### Testing with two browser profiles

Real-time features (presence, live messages, DMs, calls) are best seen with two
identities at once. Open the app in **two separate browser profiles** (or one normal
window + one incognito window), sign up as two different users, have one create a
server and invite the other, and watch updates propagate live between them.

---

## Environment Variables

Environment values live **only** in `.env.local`, which is git-ignored — never commit
real values. `npx convex dev` populates the client-facing URLs automatically:

| Variable | Where | Purpose |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT` | `.env.local` | Deployment targeted by the Convex CLI |
| `VITE_CONVEX_URL` | `.env.local` | Convex API URL the browser connects to |
| `VITE_CONVEX_SITE_URL` | `.env.local` | Convex HTTP site URL (auth endpoints) |

**Auth keys are backend-only.** `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` are set on
the **Convex deployment** (via `npx convex env set …`), never in frontend env vars,
and never committed. Only the `VITE_`-prefixed URLs are exposed to the client bundle.

> **`.env.local` safety note:** `.gitignore` excludes `.env`, `.env.local`, and
> `.env.*.local`, plus `convex/_generated/`, build output, and crash dumps. Keep all
> secrets there and out of version control.

### Authentication setup

Auth uses Convex Auth's password provider. If sign-up/login returns an error, the
deployment is almost certainly missing its auth keys. Set them on the Convex
deployment (not in the frontend):

```bash
# generate an RS256 keypair for Convex Auth, then:
npx convex env set JWT_PRIVATE_KEY "<private key PEM>"
npx convex env set JWKS "<public JWKS json>"
npx convex env set SITE_URL "http://localhost:5173"   # your app origin
```

Follow the current Convex Auth docs for generating the keypair. In production, set
`SITE_URL` to your deployed frontend origin.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npx convex dev` | Start the Convex backend + keep generated types in sync |
| `npm run build` | Type-check (`tsc -b`) and build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `.ts`/`.tsx` |
| `npm run test` | Vitest (unit + `convex-test` integration) |
| `npm run test:e2e` | Playwright end-to-end suite |

### Running the E2E suite

The Playwright specs drive two real browser contexts against a **running stack**, so
start `npx convex dev` and `npm run dev` first, then:

```bash
npx playwright install   # first time only
npm run test:e2e
```

Call tests run headless with fake media
(`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, configured in
`playwright.config.ts`).

---

## Testing & QA Status

- **Typecheck:** passing
- **Lint:** passing
- **Unit + integration (Vitest):** 59 tests passing (`convex-test` for every backend
  module + component/WebRTC unit tests)
- **End-to-end (Playwright):** 5 two-client flows passing against a live stack —
  servers (create/invite/join/remove), channel messaging (live/edit/delete),
  direct messages, voice call (join/mute-indicator/leave), and presence
  (online→offline)

**Remaining manual / deferred checks (documented honestly):**
- Exactly-once send across a real mid-send socket drop (SC-009) is covered by the
  `messages.test.ts` client-key idempotency test; faking the in-browser socket drop
  is left to manual QA.
- Load/perf validation toward the ~2,000-user / ~500-member targets (SC-010) is a
  deferred post-MVP pass.
- 4-participant ≥30-minute call soak (SC-006) is deferred to manual pre-release QA.

---

## Known Limitations (v1)

- **STUN only, no TURN relay.** NAT traversal relies on Google's public STUN servers.
  On **restrictive/symmetric NAT networks**, peers may fail to establish a direct
  connection and the call media won't flow (membership/signaling state still works).
- **Full-mesh, capped at 4 participants.** No SFU/MCU; larger calls are out of scope.
- **Presence window.** Online/offline is heartbeat-derived over a ~20s window, so
  offline can lag a few seconds after a session closes.
- **Avatars are URL/generated** (no file uploads in v1).
- Some checks remain manual/deferred as listed under [Testing & QA Status](#testing--qa-status).

---

## Future Improvements

- TURN relay (e.g. coturn) for reliable connectivity behind strict NATs
- SFU-based calls to scale beyond 4 participants
- Screen sharing and richer media controls
- File/image uploads and message attachments
- Message reactions, threads, mentions, and notifications
- Read receipts and unread badges
- Load/perf hardening and a long-running call soak in CI

---

## Deployment

- **Frontend:** deployed to **Vercel** (static Vite build).
  Production URL: **https://discord-clone-gilt-mu.vercel.app**
  (smoke-tested live: auth → prod Convex, server/channel creation, real-time
  messaging, voice-channel join/leave, DMs — no console errors).
  The Vercel build command runs `npx convex deploy --cmd 'npm run build'` so the
  Convex generated code exists at build time; `CONVEX_DEPLOY_KEY`,
  `VITE_CONVEX_URL`, and `VITE_CONVEX_SITE_URL` are configured as Vercel project
  environment variables (no auth private keys are exposed to the frontend).
- **Backend:** Convex cloud deployment. The frontend's `VITE_CONVEX_URL` /
  `VITE_CONVEX_SITE_URL` must point at the **cloud** deployment (never a local
  `127.0.0.1:3210` URL). Auth keys (`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`) are set on
  the Convex deployment; `SITE_URL` must be the Vercel production origin.

---

## Screenshots

_Screenshots are not committed to the repository. Placeholders below — replace with
real captures if desired._

| Auth | Server & channels |
| --- | --- |
| _(screenshot placeholder)_ | _(screenshot placeholder)_ |

| Direct messages | Voice/video call |
| --- | --- |
| _(screenshot placeholder)_ | _(screenshot placeholder)_ |

---

## License

No license file is currently included in this repository. The `package.json` declares
`ISC`. Add a `LICENSE` file to formalize usage terms.
