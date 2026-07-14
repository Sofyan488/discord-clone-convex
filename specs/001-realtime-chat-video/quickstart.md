# Quickstart: Real-Time Chat & Video Calling Application

**Feature**: `001-realtime-chat-video` | **Stack**: React + Vite + Tailwind + Convex + WebRTC

This guide gets a developer from a clean checkout to a running app with the real-time flows
working locally.

## Prerequisites

- Node.js 18+ and npm
- A Convex account (free tier is sufficient) — `npx convex` will prompt to log in
- A modern desktop browser with WebRTC (Chrome/Edge/Firefox/Safari)
- For testing calls locally: two browser windows/profiles (or two machines on the same
  network, since there is no TURN server)

## 1. Install dependencies

```bash
npm install
```

Key packages: `react`, `react-dom`, `react-router-dom`, `convex`, `@convex-dev/auth`,
`tailwindcss`, `vite`; dev: `vitest`, `@testing-library/react`, `convex-test`,
`@playwright/test`.

## 2. Configure Convex and environment

```bash
npx convex dev        # first run: creates a dev deployment, writes CONVEX_URL
```

Create `.env.local` (the only place env vars live — never commit it):

```dotenv
VITE_CONVEX_URL=<your convex deployment URL>
# Convex Auth secrets are set in the Convex dashboard / via `npx convex env set`
```

Set the auth secret for the password provider:

```bash
npx convex env set AUTH_SECRET "$(openssl rand -base64 32)"
```

## 3. Run the app

Run the Convex backend and the Vite dev server together (two terminals or a single
`npm run dev` script that runs both):

```bash
npx convex dev        # terminal 1 — backend + schema push + function hot reload
npm run dev           # terminal 2 — Vite SPA at http://localhost:5173
```

## 4. Verify the core flows (maps to spec Success Criteria)

Open two browser profiles as User A and User B.

1. **Auth & presence (US1 / SC-001, SC-003)**: Sign up A and B with display name + avatar.
   Each should appear **online** to the other within ~5s; close B's tab and A should see B
   go **offline**.
2. **Server & invite (US2 / SC-004)**: A creates a server → gets a default "general"
   channel. A copies the invite link; B opens it and joins. B appears in A's member list.
3. **Real-time messaging (US3 / SC-002, SC-005)**: In "general", A sends a message — it
   appears for B in < 1s without refresh. A edits it (shows "edited") and deletes it; both
   changes propagate to B in < 1s. B sees A's typing indicator while A composes. Scroll up
   to load older history.
4. **Direct messages (US4)**: A starts a DM with B (allowed because they share a server);
   exchange messages in real time; edit and delete one.
5. **Voice/video call (US5 / SC-006, SC-007)**: A creates a voice channel and joins; B joins
   too. Confirm they connect, see each other's video tiles, toggle mic/camera, and see
   mute/speaking indicators update in < 1s. Start a 1:1 video call from the A↔B DM.

> **STUN-only note**: If the two clients are on networks behind symmetric NAT, the call may
> fail to connect (no TURN in v1). Test on the same LAN or with STUN-friendly networks. A
> clear "couldn't connect" state should appear on failure.

## 5. Run tests

```bash
npm run test          # Vitest unit/component + convex-test function tests
npm run test:e2e      # Playwright real-time smoke flows (two-client)
npm run typecheck     # tsc --noEmit (strict mode)
npm run lint          # eslint
```

Per the constitution, tests are written before implementation; all of the above must be
green before merge.

## Project layout reference

See `plan.md` → Project Structure. Backend functions live in `convex/`; the SPA lives in
`src/`; the single source of truth for data shape is `convex/schema.ts`.

## Known v1 limitations

- No TURN server → calls can fail behind restrictive NAT (documented in `research.md` R8).
- Full-mesh calls capped at 4 participants (R6).
- Presence disconnect detection bounded by the heartbeat staleness window (~30s) except on
  explicit logout/tab close (R3).
