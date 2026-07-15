<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-realtime-chat-video/plan.md`.

Active feature: **001-realtime-chat-video** — a Discord-style real-time chat & video app.
Stack: React 18 + TypeScript + Vite + Tailwind (SPA in `src/`), Convex as database/backend/
auth (`convex/`), and native WebRTC (full-mesh, ≤4, Google STUN, signaling relayed through
Convex). Supporting docs live in `specs/001-realtime-chat-video/`: `spec.md`, `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`.
<!-- SPECKIT END -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
