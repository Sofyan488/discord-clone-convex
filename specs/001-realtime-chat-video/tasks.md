---
description: "Task list for Real-Time Chat & Video Calling Application"
---

# Tasks: Real-Time Chat & Video Calling Application

**Input**: Design documents from `/specs/001-realtime-chat-video/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are **included and mandatory** — Constitution v1.0.0 Principle I
(Test-First) is NON-NEGOTIABLE and overrides the default "tests optional" rule. Every story
writes its tests first (they must fail before implementation).

**Organization**: Tasks are grouped by user story (spec priorities) to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5, per spec.md (Setup/Foundational/Polish carry no story label)
- File paths are relative to the repository root

## Path Conventions

Single-repo web app: Vite SPA in `src/`, Convex backend in `convex/`, tests in `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [ ] T001 Initialize Vite + React 18 + TypeScript project at repo root (`package.json`, `index.html`, `src/main.tsx`, `vite.config.ts`, `tsconfig.json` with `"strict": true`)
- [ ] T002 [P] Install and configure Tailwind CSS (`tailwind.config.ts`, `postcss.config.js`, `src/styles/index.css`)
- [ ] T003 [P] Add runtime deps: `react-router-dom`, `convex`, `@convex-dev/auth` (`package.json`)
- [ ] T004 [P] Configure ESLint + Prettier with strict TypeScript rules (`.eslintrc.cjs`, `.prettierrc`)
- [ ] T005 [P] Configure test tooling: Vitest + React Testing Library, `convex-test`, Playwright (`vitest.config.ts`, `playwright.config.ts`, create `tests/convex/`, `tests/unit/`, `tests/e2e/`)
- [ ] T006 Initialize Convex project and generate types (`npx convex dev`), creating `convex/` and `convex/_generated/`; add `VITE_CONVEX_URL` to `.env.local`
- [ ] T007 [P] Ensure `.env.local` is gitignored and add `npm` scripts (`dev`, `test`, `test:e2e`, `typecheck`, `lint`) in `package.json`

**Checkpoint**: App builds and an empty Convex deployment is reachable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth, authorization, and app shell that ALL stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Define all 12 tables with indexes in `convex/schema.ts` (users, servers, serverMembers, channels, messages, directMessageThreads, directMessages, typingIndicators, presence, calls, callParticipants, signals) per data-model.md
- [ ] T009 Configure Convex Auth password provider with profile mapping (`name`, `avatarUrl`) in `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`
- [ ] T010 [P] Implement authorization helpers (default-deny) in `convex/lib/auth.ts`: `requireUser`, `requireMember`, `requireOwner`, `requireAuthor`, and typed `ConvexError` codes (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_MEMBER`, `NOT_AUTHOR`, `NOT_OWNER`, `NO_SHARED_SERVER`, `CALL_FULL`, `VALIDATION`)
- [ ] T011 [P] Implement chunked cascade-delete helpers in `convex/lib/cascade.ts`: `deleteTextChannelCascade`, `deleteVoiceChannelCascade`, `deleteServerCascade` per research R11
- [ ] T012 Set up Convex client + providers in `src/lib/convex.ts` and `src/main.tsx` (`ConvexProvider` + `ConvexAuthProvider`)
- [ ] T013 [P] Implement app shell + routing in `src/App.tsx` and `src/router.tsx` with `<Authenticated>`/`<Unauthenticated>` gating and the Discord layout regions (server rail, channel sidebar, main area, member list)
- [ ] T014 [P] Build base Tailwind UI primitives in `src/components/` (`Button.tsx`, `Input.tsx`, `Modal.tsx`, `Avatar.tsx`, `Spinner.tsx`, `ContextMenu.tsx`)
- [ ] T015 [P] Implement visibility-aware interval hook in `src/hooks/useHeartbeat.ts` (drives presence + in-call heartbeats)

**Checkpoint**: Schema deployed, auth wired, layout renders behind auth gate.

---

## Phase 3: User Story 1 - Sign up, log in, and presence (Priority: P1) 🎯 MVP

**Goal**: A user creates an account (display name + avatar), logs in, and appears
online/offline to others.

**Independent Test**: Register two accounts in two sessions; each sees the other flip
online→offline on disconnect.

### Tests for User Story 1 (write first, must fail) ⚠️

- [ ] T016 [P] [US1] `convex-test` for profile creation on sign-up + `users.getCurrent` in `tests/convex/users.test.ts`
- [ ] T017 [P] [US1] `convex-test` for `presence.heartbeat` upsert and online/offline derivation (~20s window, multi-session safe) in `tests/convex/presence.test.ts`
- [ ] T018 [P] [US1] `convex-test` for `presence.listForServer` membership gating (non-member → `NOT_MEMBER`) in `tests/convex/presence.test.ts`
- [ ] T019 [P] [US1] Component tests for sign-up and log-in forms (validation, error display) in `tests/unit/auth.test.tsx`

### Implementation for User Story 1

- [ ] T020 [US1] Implement `users.getCurrent` query in `convex/users.ts`
- [ ] T021 [US1] Implement `presence.heartbeat` mutation and `presence.listForServer` query in `convex/presence.ts` (no `goOffline`; per-user row)
- [ ] T022 [P] [US1] Build Sign Up screen (display name, avatar URL/generated default, email, password) in `src/features/auth/SignUp.tsx`
- [ ] T023 [P] [US1] Build Log In screen with error messaging in `src/features/auth/LogIn.tsx`
- [ ] T024 [US1] Implement `src/hooks/usePresence.ts` (start heartbeat via `useHeartbeat` while authenticated) and wire `useAuthActions` sign-in/out into the shell
- [ ] T025 [US1] Render member online/offline status indicator component in `src/features/servers/MemberList.tsx` (consumes `presence.listForServer`)
- [ ] T026 [US1] E2E: two-client presence online→offline in `tests/e2e/presence.spec.ts`

**Checkpoint**: Auth + presence fully functional and independently testable.

---

## Phase 4: User Story 2 - Create a server and invite members (Priority: P1)

**Goal**: A user creates a server (owner), generates an invite link, others join, member list
shows presence; owner can rename/remove members/leave; account deletion cascades.

**Independent Test**: A creates a server → invite link → B joins → appears in member list → A
renames and removes B.

### Tests for User Story 2 (write first, must fail) ⚠️

- [ ] T027 [P] [US2] `convex-test` for `servers.create` (owner membership + default "general" text channel) in `tests/convex/servers.test.ts`
- [ ] T028 [P] [US2] `convex-test` for `servers.joinByInvite` / `getInvitePreview` (valid, invalid, already-member) in `tests/convex/servers.test.ts`
- [ ] T029 [P] [US2] `convex-test` for owner-only `rename`/`removeMember`/`remove` and `leave` (member vs owner-cascade) in `tests/convex/servers.test.ts`
- [ ] T030 [P] [US2] `convex-test` for `users.deleteAccount` cascade + tombstone, retaining DMs/messages, in `tests/convex/account.test.ts`

### Implementation for User Story 2

- [ ] T031 [US2] Implement server functions in `convex/servers.ts`: `create` (with general channel + inviteCode), `rename`, `remove` (cascade), `removeMember`, `leave`, `listMine`, `getMembers`, `getInvite`, `getInvitePreview`, `joinByInvite`
- [ ] T032 [US2] Implement `users.deleteAccount` in `convex/users.ts` (cascade owned servers, drop memberships/ephemeral rows, retain DMs/messages, set `deleted`, remove auth identity) using `convex/lib/cascade.ts`
- [ ] T033 [P] [US2] Build server rail + "Create Server" modal in `src/features/servers/ServerRail.tsx` and `CreateServerModal.tsx`
- [ ] T034 [P] [US2] Build invite modal (show/copy link) in `src/features/servers/InviteModal.tsx`
- [ ] T035 [US2] Build invite-accept route/screen in `src/features/servers/JoinByInvite.tsx` (uses `getInvitePreview` + `joinByInvite`) and add route in `src/router.tsx`
- [ ] T036 [US2] Wire member list with presence + owner actions (rename server, remove member) in `src/features/servers/MemberList.tsx` and `ServerHeader.tsx`
- [ ] T037 [P] [US2] Add account settings with delete-account action in `src/features/auth/AccountSettings.tsx`
- [ ] T038 [US2] E2E: create → invite → join → member list → rename → remove member in `tests/e2e/servers.spec.ts`

**Checkpoint**: Servers, membership, invites, and lifecycle work end-to-end.

---

## Phase 5: User Story 3 - Real-time channel messaging (Priority: P1) 🎯 MVP

**Goal**: Members exchange live messages in text channels (author/avatar/timestamp/content),
edit/delete own messages (marked), paginated history, typing indicators; owner manages
text/voice channels (delete cascades messages).

**Independent Test**: Two members in a channel; message appears live; edit/delete propagate;
scroll loads history; typing indicator shows.

### Tests for User Story 3 (write first, must fail) ⚠️

- [ ] T039 [P] [US3] `convex-test` for `channels` create/rename/remove incl. text-channel message cascade in `tests/convex/channels.test.ts`
- [ ] T040 [P] [US3] `convex-test` for `messages` send/edit/delete authorship enforcement (non-author → `NOT_AUTHOR`) and member gating in `tests/convex/messages.test.ts`
- [ ] T041 [P] [US3] `convex-test` for `messages.list` pagination (newest-first pages) in `tests/convex/messages.test.ts`
- [ ] T042 [P] [US3] `convex-test` for `typing` set/clear/list with staleness window in `tests/convex/typing.test.ts`
- [ ] T043 [P] [US3] Component test for message list + composer + edit/delete UI in `tests/unit/messages.test.tsx`
- [ ] T043a [P] [US3] `convex-test` for send idempotency: a duplicate `messages.send` with the same client-supplied `clientKey` (e.g. after a reconnect retry) is suppressed, not duplicated (SC-009) in `tests/convex/messages.test.ts`

### Implementation for User Story 3

- [ ] T044 [US3] Implement `convex/channels.ts`: `list`, `create`, `rename`, `remove` (cascade via helpers)
- [ ] T045 [US3] Implement `convex/messages.ts`: `list` (paginated, joins author name/avatar), `send`, `edit` (sets `editedAt`), `remove`
- [ ] T045a [US3] Add idempotent send (SC-009): accept an optional client-supplied `clientKey` on `messages.send`, dedupe against a recent-window lookup, add `clientKey` field + supporting index to `messages` in `convex/schema.ts`, and have the composer generate/retry with a stable key on reconnect in `src/features/messages/MessageComposer.tsx`
- [ ] T046 [P] [US3] Implement `convex/typing.ts`: `setTyping`, `clearTyping`, `list`
- [ ] T047 [P] [US3] Build channel sidebar + channel management (create/rename/delete, text/voice) in `src/features/channels/ChannelSidebar.tsx` and `ChannelManageModal.tsx`
- [ ] T048 [US3] Build message list with infinite scroll (via `usePaginatedQuery`) in `src/features/messages/MessageList.tsx`
- [ ] T049 [US3] Build message composer with edit/delete of own messages and "edited" marker in `src/features/messages/MessageComposer.tsx` and `MessageItem.tsx`
- [ ] T050 [P] [US3] Implement `src/hooks/useTyping.ts` (throttled setTyping, clear on blur/send) and typing indicator UI in `src/features/messages/TypingIndicator.tsx`
- [ ] T051 [US3] E2E: two-client live message + edit + delete + typing + history scroll in `tests/e2e/messaging.spec.ts`
- [ ] T051a [US3] E2E: simulate a brief disconnect/reconnect during send and assert the message is delivered exactly once (no loss, no duplicate — SC-009) in `tests/e2e/messaging.spec.ts`

**Checkpoint**: Core MVP (US1+US2+US3) delivers a usable chat product.

---

## Phase 6: User Story 4 - Direct messages (Priority: P2)

**Goal**: Start a 1:1 DM with a shared-server member; real-time send/edit/delete; existing DMs
persist even without a shared server.

**Independent Test**: A starts a DM with B; exchange in real time; edit/delete propagate.

### Tests for User Story 4 (write first, must fail) ⚠️

- [ ] T052 [P] [US4] `convex-test` for `directMessages.startThread` shared-server rule (`NO_SHARED_SERVER`) + idempotent pair thread in `tests/convex/dm.test.ts`
- [ ] T053 [P] [US4] `convex-test` for DM send/edit/delete authorship + participant gating, and thread persistence after leaving a shared server, in `tests/convex/dm.test.ts`

### Implementation for User Story 4

- [ ] T054 [US4] Implement `convex/directMessages.ts`: `startThread`, `listThreads`, `list` (paginated), `send` (with the same `clientKey` idempotency pattern as T045a; add `clientKey` to `directMessages` in `convex/schema.ts`), `edit`, `remove`
- [ ] T055 [P] [US4] Extend `convex/typing.ts` to support `{ threadId }` typing (participant-gated)
- [ ] T056 [P] [US4] Build DM list + conversation UI (reusing MessageList/Composer) in `src/features/dms/DmList.tsx` and `DmConversation.tsx`
- [ ] T057 [US4] Add "Message" action from member list to start a DM in `src/features/servers/MemberList.tsx` and DM routes in `src/router.tsx`
- [ ] T058 [US4] E2E: start DM, real-time exchange, edit/delete in `tests/e2e/dm.spec.ts`

**Checkpoint**: Direct messaging works alongside channels.

---

## Phase 7: User Story 5 - Voice & video calls (Priority: P3)

**Goal**: Join a voice channel (always-open room) into a full-mesh WebRTC call (≤4), toggle
mic/camera, see tiles + mute/speaking indicators, leave; 1:1 video from a DM. Signaling via
Convex; STUN-only.

**Independent Test**: Two members join a voice channel, connect, toggle mic/camera, see
indicators, leave.

### Tests for User Story 5 (write first, must fail) ⚠️

- [ ] T059 [P] [US5] `convex-test` for `calls.join` (create/find room, participant insert, `CALL_FULL` at 4, ghost exclusion) and `leave` (deactivate when empty) in `tests/convex/calls.test.ts`
- [ ] T060 [P] [US5] `convex-test` for `calls.setMedia`, `calls.heartbeat` (lastSeen refresh), and `getState` stale filtering in `tests/convex/calls.test.ts`
- [ ] T061 [P] [US5] `convex-test` for `signals` send/receive/ack participant gating + recipient scoping in `tests/convex/signals.test.ts`
- [ ] T062 [P] [US5] Unit test for the WebRTC mesh manager offer/answer/ICE state machine (mocked `RTCPeerConnection`) in `tests/unit/webrtc.test.ts`

### Implementation for User Story 5

- [ ] T063 [US5] Implement `convex/calls.ts`: `join`, `leave`, `setMedia`, `heartbeat`, `getState` (stale-participant filtering)
- [ ] T064 [US5] Implement `convex/signals.ts`: `send`, `receive`, `ack` (participant-gated, recipient-scoped)
- [ ] T065 [US5] Implement WebRTC mesh manager in `src/lib/webrtc/MeshManager.ts` (STUN config, deterministic offerer by userId, tracks published up front, `track.enabled` toggling, in-order signal application, `ontrack`, ICE-failure detection)
- [ ] T066 [US5] Implement `src/hooks/useCall.ts` (join/leave, bridge `signals.receive`↔MeshManager, `signals.send`, WebAudio speaking detection → `setMedia`, in-call heartbeat)
- [ ] T067 [P] [US5] Build call view: video tiles, mic/camera toggle controls, mute/speaking indicators, leave button, STUN-failure state in `src/features/calls/CallView.tsx` and `VideoTile.tsx`
- [ ] T068 [US5] Add voice-channel join UX in `src/features/channels/ChannelSidebar.tsx` and 1:1 "Start video call" from `src/features/dms/DmConversation.tsx`
- [ ] T069 [US5] E2E: two-client voice channel call connects, toggle mic/camera, indicators update, leave in `tests/e2e/calls.spec.ts`

**Checkpoint**: All five user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and shared concerns spanning stories

- [ ] T070 [P] Add scheduled sweep (Convex cron) to purge stale `presence`, `callParticipants`, `typingIndicators`, and consumed/old `signals` in `convex/crons.ts`
- [ ] T071 [P] Add consistent loading/empty/error states across features in `src/components/` and feature screens (edge cases from spec)
- [ ] T072 [P] Accessibility pass on interactive components (keyboard nav, ARIA, focus) in `src/components/` and `src/features/`
- [ ] T073 [P] Handle removed-while-viewing / deleted-channel-while-open reconciliation in affected feature screens (spec edge cases)
- [ ] T074 Verify all Success Criteria via `quickstart.md` (SC-001…SC-010) and record results
- [ ] T075 Ensure `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run test:e2e` all pass (constitution merge gate)
- [ ] T076 [P] Write `README.md` (setup, run, test, known v1 limitations: no TURN, mesh ≤4, presence window)
- [ ] T077 [P] (SC-010) Load/perf validation toward ~2,000 concurrent users and ~500-member servers, verifying real-time latency targets (SC-002/003/005) hold under load; document results in `tests/perf/README.md`. **Deferrable**: may be scheduled as a post-MVP performance pass — if deferred, record the decision here rather than leaving it silently unmet.
- [ ] T078 (SC-006) Call stability/soak check: a 4-participant call remains stable for ≥30 minutes with reliable mic/camera toggles; run as manual QA or a long-running Playwright scenario in `tests/e2e/calls-soak.spec.ts`. **Deferrable**: acceptable to run as manual QA before release.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories** (schema T008, auth T009, helpers T010–T011 are prerequisites)
- **User Stories (Phases 3–7)**: all depend on Foundational
  - US1 (P1) → US2 (P1) → US3 (P1): natural order for the MVP (US2 uses US1 presence in the member list; US3 needs channels created by US2). Can be staffed in parallel after Foundational, but this order is recommended.
  - US4 (P2): depends on Foundational; uses US2 (shared-server rule) and reuses US3 message/typing UI
  - US5 (P3): depends on Foundational; uses voice channels (US3) and DM entry point (US4 for 1:1 call)
- **Polish (Phase 8)**: after the targeted stories are complete

### Story-Level Notes

- `users.deleteAccount` (T032) intentionally lives in US2 because it depends on the server
  cascade helpers (T011) and server functions (T031).
- Typing (T046) is created in US3 and extended for DM threads in US4 (T055).

### Within Each User Story

- Tests (⚠️) are written FIRST and must FAIL before implementation (Constitution Principle I)
- Convex functions before the UI that consumes them
- Hooks before the components that use them
- Story complete and independently testable before moving on

### Parallel Opportunities

- Setup: T002, T003, T004, T005, T007 in parallel after T001
- Foundational: T010, T011, T013, T014, T015 in parallel (T008, T009, T012 gate them where noted)
- Within each story, all test tasks marked [P] run in parallel; then [P] implementation tasks
  touching different files run in parallel

---

## Parallel Example: User Story 3

```bash
# Tests first (all parallel — different files):
Task: T039 convex-test channels cascade
Task: T040 convex-test messages authorship
Task: T041 convex-test messages pagination
Task: T042 convex-test typing staleness
Task: T043 component test message UI

# Then parallel implementation across separate files:
Task: T046 convex/typing.ts
Task: T047 src/features/channels/ChannelSidebar.tsx
Task: T050 src/hooks/useTyping.ts
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) = the three P1 stories
3. **STOP and VALIDATE**: a usable authenticated real-time chat product (servers, channels,
   live messaging). Deploy/demo.

### Incremental Delivery

4. Add US4 (Direct messages) → test → demo
5. Add US5 (Voice & video calls) → test → demo
6. Phase 8 polish throughout / at the end

### Notes

- [P] = different files, no incomplete dependencies
- Commit after each task or logical group
- Verify tests fail before implementing (Principle I)
- Keep each story independently demoable
