# Feature Specification: Real-Time Chat & Video Calling Application

**Feature Branch**: `001-realtime-chat-video`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord" with users & authentication, servers, channels, messaging, direct messages, and voice/video calls (version-one scope).

## Clarifications

### Session 2026-07-14

- Q: What is the scale target for v1 (members per server and concurrent users)? → A: Small-moderate — up to ~500 members per server and ~2,000 concurrent users total.
- Q: What happens to a server when its owner leaves or deletes their account? → A: The server and all its channels and messages are deleted.
- Q: How long is message history retained? → A: Indefinitely, until deleted by the author or removed via channel/server deletion.
- Q: What happens to an existing DM when the two users no longer share a server? → A: The DM persists and stays usable; only starting a new DM requires a shared server.
- Q: Is a voice channel an always-open room or a discrete call? → A: Always-open room — members join/leave anytime; the call is whoever is connected and is simply empty when the last leaves.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up, log in, and see who's online (Priority: P1)

A new person creates an account with a display name and avatar, logs in, and can be
seen as online by others; when they leave, others see them as offline.

**Why this priority**: Identity and presence are the entry gate for every other
capability. Nothing else can be used without an account, and presence is a defining
part of the product's social feel.

**Independent Test**: Register two accounts in separate sessions, log both in, and
confirm each appears "online" to the other; log one out and confirm it flips to
"offline" for the other within a few seconds.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they sign up with valid credentials, a
   display name, and an avatar, **Then** an account is created and they are logged in.
2. **Given** a registered user, **When** they log in with correct credentials, **Then**
   they gain access to their servers and conversations.
3. **Given** a registered user, **When** they log in with incorrect credentials, **Then**
   access is denied and they see a clear error message.
4. **Given** two users who share a server, **When** one is active in the app, **Then** the
   other sees that user's status as online.
5. **Given** an online user, **When** they log out or disconnect, **Then** others see the
   status change to offline within a short delay.

---

### User Story 2 - Create a server and invite members (Priority: P1)

A logged-in user creates a server (becoming its owner), generates an invite link, and
invites others who then join and appear in the member list. The owner can rename the
server and remove members.

**Why this priority**: Servers are the container for all group communication. Without a
server there is no place for channels, messages, or calls to exist.

**Independent Test**: Create a server as User A, generate an invite link, use it as User B
to join, confirm B appears in A's member list, then have A rename the server and remove B,
confirming both actions take effect.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a server, **Then** the server exists
   with them as owner and a default "general" text channel present.
2. **Given** a server owner, **When** they generate an invite link, **Then** a shareable
   link is produced that others can use to join the server.
3. **Given** an invited user with a valid invite link, **When** they use it, **Then** they
   become a member and appear in the member list with their online status.
4. **Given** a server owner, **When** they rename the server, **Then** all members see the
   updated name.
5. **Given** a server owner, **When** they remove a member, **Then** that member loses
   access to the server and its channels.
6. **Given** a member viewing a server, **When** they open the member list, **Then** they
   see all members and each member's online/offline status.

---

### User Story 3 - Send and receive messages in a channel in real time (Priority: P1) 🎯 MVP

Members open a text channel and exchange messages that appear instantly for everyone in
the channel without refreshing. Each message shows author name, avatar, timestamp, and
content. Authors can edit and delete their own messages, edits are marked, older history
loads on scroll, and typing indicators show who is composing.

**Why this priority**: Real-time text messaging is the core value of the product and the
smallest slice that makes the application worth using once servers exist.

**Independent Test**: With two members in the same channel, send a message as one and
confirm it appears for the other without a manual refresh; edit and delete it and confirm
both changes propagate; scroll up to load older messages; type and confirm the other sees
a typing indicator.

**Acceptance Scenarios**:

1. **Given** a member in a text channel, **When** they send a message, **Then** it appears
   for all members currently viewing that channel in real time without a page refresh.
2. **Given** a displayed message, **When** any member views it, **Then** it shows the
   author's name, avatar, timestamp, and content.
3. **Given** an author's own message, **When** they edit it, **Then** the updated content
   appears for everyone and is marked as edited.
4. **Given** an author's own message, **When** they delete it, **Then** it is removed for
   everyone.
5. **Given** a member viewing another member's message, **When** they attempt to edit or
   delete it, **Then** the action is not permitted.
6. **Given** a channel with many past messages, **When** a member scrolls up (or requests
   more), **Then** older messages load incrementally.
7. **Given** a member typing in a channel, **When** they are composing, **Then** other
   members in that channel see a typing indicator identifying them.
8. **Given** a server owner, **When** they create, rename, or delete a text or voice
   channel, **Then** the change is reflected for all members, and deleting a text channel
   also removes its messages.

---

### User Story 4 - Direct messages between members (Priority: P2)

A user starts a one-to-one direct message conversation with another member of a shared
server and they exchange messages in real time, with the ability to edit and delete their
own messages.

**Why this priority**: Private conversation complements group channels and is expected in
a Discord-like product, but the group experience (P1) delivers the core value first.

**Independent Test**: As User A, start a direct message with User B (a member of a shared
server), exchange messages in real time, then edit and delete a sent message and confirm
the changes appear for B.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one starts a direct message
   with the other, **Then** a one-to-one conversation is created between them.
2. **Given** an open direct message conversation, **When** one participant sends a message,
   **Then** it appears for the other in real time.
3. **Given** a direct message a user authored, **When** they edit or delete it, **Then**
   the change is reflected for the other participant, with edits marked.
4. **Given** two users who share no server, **When** one attempts to start a direct
   message with the other, **Then** the action is not available.

---

### User Story 5 - Voice and video calls (Priority: P3)

Members join a voice channel and start or join a live call with others currently connected,
toggling microphone and camera, seeing video tiles and who is muted or speaking, and
leaving when done. A one-to-one video call can also be started from a direct message.

**Why this priority**: Live audio/video is a high-value differentiator but the most complex
capability; the product is already useful for text communication without it.

**Independent Test**: Have two members join the same voice channel, confirm they connect
into a live call, toggle microphone and camera each way, confirm mute/speaking indicators
and video tiles update for the other participant, then leave and confirm disconnection.

**Acceptance Scenarios**:

1. **Given** a member viewing a voice channel, **When** they join it, **Then** they enter a
   live call with the other members currently connected to that channel.
2. **Given** two to four members in a voice channel call, **When** they are connected,
   **Then** each participant can see and hear the others.
3. **Given** a participant in a call, **When** they toggle their microphone or camera,
   **Then** the change is reflected to other participants (muted/unmuted, video on/off).
4. **Given** participants in a call, **When** someone is speaking or muted, **Then** other
   participants see an indication of who is speaking and who is muted.
5. **Given** a participant in a call, **When** they leave, **Then** they are disconnected
   and removed from other participants' views.
6. **Given** an open direct message, **When** one participant starts a video call, **Then**
   the other can join a one-to-one video call.

---

### Edge Cases

- What happens when a user opens the same account in two sessions at once (presence and
  real-time delivery must remain consistent)?
- How does the system handle an invite link that is used after the server is deleted or the
  inviter is no longer the owner?
- What happens to a member's view when they are removed from a server while actively viewing
  one of its channels or connected to its call?
- How are messages sent during a brief network drop handled on reconnect (no duplicates, no
  lost messages)?
- What happens when a channel is deleted while a member is reading or typing in it?
- What happens when a fifth member attempts to join a voice call that has reached the
  supported maximum of four participants?
- How does a call behave when a participant loses their connection unexpectedly (they should
  be shown as disconnected to others)?
- What happens when two people edit/delete interactions race (e.g., author deletes a message
  another member is replying to)?

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Presence**

- **FR-001**: System MUST allow a visitor to create an account with credentials, a display
  name, and an avatar.
- **FR-002**: System MUST allow a registered user to log in and MUST reject invalid
  credentials with a clear error.
- **FR-003**: System MUST maintain a login session so a user stays authenticated across
  navigation until they log out or the session expires.
- **FR-004**: System MUST represent each user with a display name and avatar shown wherever
  the user appears (messages, member lists, calls).
- **FR-005**: System MUST reflect each user's online/offline status to other users who share
  a server, updating within a few seconds of connect/disconnect.

**Servers & Membership**

- **FR-006**: System MUST allow a logged-in user to create a server and MUST assign that
  user as the server owner.
- **FR-007**: System MUST create a default "general" text channel automatically for every
  new server.
- **FR-008**: System MUST allow a server owner to generate an invite link that others can
  use to join the server.
- **FR-009**: System MUST add a user who uses a valid invite link as a member of that server.
- **FR-010**: System MUST show all members of a server and each member's online/offline
  status to members of that server.
- **FR-011**: System MUST allow the server owner to rename the server, with the new name
  visible to all members.
- **FR-012**: System MUST allow the server owner to remove a member, after which the removed
  member loses access to the server and its channels.
- **FR-012a**: System MUST delete a server together with all its channels and messages when the
  owner leaves the server or deletes their account (ownership is not transferred in version one).

**Channels**

- **FR-013**: System MUST allow members to view all channels in a server they belong to.
- **FR-014**: System MUST allow the server owner to create text channels and voice channels.
- **FR-015**: System MUST allow the server owner to rename and delete text and voice
  channels.
- **FR-016**: System MUST delete all messages belonging to a text channel when that channel
  is deleted.

**Text Messaging**

- **FR-017**: System MUST allow a member to send a text message within a text channel.
- **FR-018**: System MUST deliver new messages to all members currently viewing the channel
  in real time, without requiring a page refresh.
- **FR-019**: System MUST display, for each message, the author's name, avatar, timestamp,
  and content.
- **FR-020**: System MUST allow a message's author to edit their own message and MUST mark
  edited messages as edited.
- **FR-021**: System MUST allow a message's author to delete their own message, removing it
  for all members.
- **FR-022**: System MUST prevent a member from editing or deleting a message they did not
  author.
- **FR-023**: System MUST load channel message history incrementally (pagination or infinite
  scroll) rather than all at once.
- **FR-023a**: System MUST retain message history indefinitely until a message is deleted by its
  author or removed as part of channel or server deletion (no time- or count-based auto-purge in
  version one).
- **FR-024**: System MUST show a typing indicator to other members of a channel while a
  member is composing a message.

**Direct Messages**

- **FR-025**: System MUST allow a user to start a one-to-one direct message conversation with
  another user who shares at least one server with them.
- **FR-026**: System MUST prevent starting a direct message with a user who shares no server.
- **FR-026a**: System MUST keep an existing direct message conversation accessible and usable
  (send/edit/delete) even if the two participants no longer share a server; the shared-server
  requirement applies only to starting a new conversation.
- **FR-027**: System MUST deliver direct messages to the other participant in real time.
- **FR-028**: System MUST allow a direct message's author to edit and delete their own direct
  messages, marking edits, with changes reflected to the other participant.

**Voice & Video Calls**

- **FR-029**: System MUST allow a member to join a voice channel and connect into a live call
  with the other members currently connected to that channel.
- **FR-029a**: System MUST treat a voice channel as an always-open room: any member may join or
  leave at any time, the call consists of whoever is currently connected, and the channel simply
  becomes empty (it is not deleted or "ended") when the last participant leaves.
- **FR-030**: System MUST support at least 2 participants in a call and target support for up
  to 4 participants.
- **FR-031**: System MUST allow a call participant to toggle their microphone and camera, with
  the state visible to other participants.
- **FR-032**: System MUST show call participants video tiles for participants with camera on
  and indicate who is muted and who is speaking.
- **FR-033**: System MUST allow a participant to leave a call, disconnecting them and removing
  them from other participants' views.
- **FR-034**: System MUST allow a one-to-one video call to be started from a direct message
  conversation.

**Out of Scope (Version One)**

- **FR-035**: System MUST NOT include, in version one: message attachments/file uploads,
  reactions, threads, advanced roles and permissions, screen sharing, native mobile apps, and
  message search. These are explicitly deferred.

### Key Entities *(include if feature involves data)*

- **User**: A person with credentials, a display name, an avatar, and a derived online/offline
  presence state. Owns servers they create and authors messages.
- **Server**: A community space with an owner, a name, a set of members, an invite link, and a
  collection of channels. Always has a default "general" text channel.
- **Membership**: The association between a User and a Server, conveying access to the server's
  channels and appearance in its member list.
- **Channel**: A named space within a server, either a text channel (holds messages) or a voice
  channel (hosts calls). Members can view all channels; the owner manages them.
- **Message**: Authored content within a text channel or a direct message conversation, with
  author, timestamp, content, and an edited indicator.
- **Direct Message Conversation**: A one-to-one private conversation between two users who share
  a server, containing messages.
- **Call**: A live voice/video session. For a voice channel it is an always-open room whose
  membership is simply the participants currently connected (empty when none are); for a direct
  message it is a one-to-one session. Each participant has microphone, camera, mute, and speaking
  state.
- **Invite**: A shareable link that grants a user membership to a specific server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from landing on the app to being logged in with a display name
  and avatar in under 2 minutes.
- **SC-002**: A message sent in a channel appears for other members viewing that channel in
  under 1 second in typical conditions, without any manual refresh.
- **SC-003**: A user's online/offline status change is reflected to others within 5 seconds of
  connecting or disconnecting.
- **SC-004**: A server owner can create a server, generate an invite, and have a second user
  join it in under 3 minutes end to end.
- **SC-005**: Message edits and deletions propagate to all viewers within 1 second and are
  correctly marked/removed.
- **SC-006**: A voice/video call with up to 4 participants stays stable for at least 30 minutes
  with participants able to reliably toggle microphone and camera.
- **SC-007**: In a call, mute and speaking indicators reflect the true state of each participant
  within 1 second.
- **SC-008**: 95% of first-time users can create or join a server and send their first message
  without external help.
- **SC-009**: No message is lost or duplicated across a brief (a few seconds) network
  interruption and reconnect.
- **SC-010**: The system sustains up to ~2,000 concurrent users and servers of up to ~500
  members while meeting the real-time latency targets above (SC-002, SC-003, SC-005).

## Assumptions

- Authentication uses standard email/username plus password with session-based login; no SSO or
  third-party identity provider is required for version one.
- Presence is a two-state model (online/offline) only; "idle", "away", and "do not disturb"
  states are out of scope.
- Invite links are reusable by default (not single-use) and remain valid while the server exists
  and the owner permits joining; fine-grained expiry/limits are not required for version one.
- A single, flat owner-vs-member permission model applies; the owner has full management rights
  and members can view channels and participate. Advanced/custom roles are out of scope.
- Members may view all channels in a server (no per-channel private access) in version one.
- Avatars are provided at sign-up (e.g., chosen/uploaded image or generated default); managing an
  avatar library is not a distinct feature here.
- Target call size is up to 4 participants; behavior at larger sizes is not guaranteed and joins
  beyond the supported maximum are rejected gracefully.
- The application targets modern desktop web browsers; native mobile apps are out of scope.
- Reasonable, user-friendly error handling and messaging apply throughout even where not called
  out per requirement.
