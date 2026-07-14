<!--
Sync Impact Report
==================
Version change: TEMPLATE (unversioned) → 1.0.0
Rationale: Initial ratification of the project constitution from template. MINOR/PATCH
  bumps not applicable; this is the first concrete adoption (MAJOR baseline 1.0.0).

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Test-First (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Type-Safe Contracts
  - [PRINCIPLE_3_NAME] → III. Real-Time Reliability
  - [PRINCIPLE_4_NAME] → IV. Security & Privacy by Default
  - [PRINCIPLE_5_NAME] → V. Simplicity & Incremental Delivery

Added sections:
  - Technology & Architecture Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (generic Constitution Check gate; no change needed)
  - ✅ .specify/templates/spec-template.md (no mandatory-section conflicts; no change needed)
  - ✅ .specify/templates/tasks-template.md (test/security/observability task types already
       representable; no change needed)

Follow-up TODOs: none. Ratification date set to first adoption (2026-07-14).
-->

# Discord Clone Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)

Every behavioral change MUST be covered by an automated test written before the
implementation. The cycle is Red-Green-Refactor: the test is written, confirmed to
fail, then the minimum code to pass is written, then refactored. Bug fixes MUST add a
regression test that reproduces the defect before the fix. Merging code whose new
behavior lacks a failing-first test is prohibited.

Rationale: A real-time messaging product breaks in subtle, timing-dependent ways;
tests are the only durable guard against silent regressions across releases.

### II. Type-Safe Contracts

The codebase MUST use strict static typing (e.g., TypeScript `strict` mode) with no
implicit `any`. Data crossing a boundary — client↔server, HTTP/WebSocket payloads,
database rows — MUST be validated against a shared, single-source-of-truth schema at
runtime, not merely asserted at compile time. Client and server MUST NOT define the
same contract twice; the shared schema is authoritative.

Rationale: Divergence between client and server contracts is the most common source of
runtime failures in chat apps; a shared, validated schema eliminates a whole class of
bugs.

### III. Real-Time Reliability

Real-time features (messaging, presence, typing indicators) MUST tolerate transient
disconnects: clients reconnect automatically and reconcile missed state without user
action. UI updates MAY be optimistic but MUST reconcile against server confirmation and
visibly recover on failure. Message delivery MUST be idempotent — retries MUST NOT
produce duplicates. Message-send-to-visible latency SHOULD stay under 300ms p95 under
expected load.

Rationale: Users judge a chat app by whether messages arrive, in order, exactly once,
even on flaky networks; reliability is the product, not a feature.

### IV. Security & Privacy by Default

All routes and real-time channels MUST enforce authentication and authorization; access
defaults to deny. All input MUST be validated and all user-generated content MUST be
escaped/sanitized before rendering to prevent injection and XSS. Secrets MUST NOT be
committed to the repository and MUST be supplied via environment configuration. Passwords
and tokens MUST be stored using industry-standard hashing/encryption; plaintext storage
is prohibited.

Rationale: A social platform holds private conversations and credentials; a single
authorization or injection gap is a breach, so security is non-negotiable and default-on.

### V. Simplicity & Incremental Delivery

Start with the simplest design that satisfies requirements (YAGNI); added abstraction,
services, or dependencies MUST be justified against a concrete, present need. Work MUST
be delivered as independently testable, demonstrable increments (per the user-story slices
in the spec), each of which keeps the system releasable.

Rationale: Feature-driven chat clones accrete complexity fast; disciplined simplicity and
incremental delivery keep the project shippable and reviewable.

## Technology & Architecture Constraints

- The application is a web-based, real-time chat product; the default stack is TypeScript
  end-to-end (typed frontend + typed backend) with a real-time transport (WebSocket or
  equivalent). Deviation from this default MUST be recorded in the plan's Complexity
  Tracking.
- Persistent data MUST go through a defined schema/migration path; ad-hoc schema drift is
  prohibited.
- Configuration (URLs, ports, credentials, feature flags) MUST come from environment, not
  hardcoded values.
- Third-party dependencies MUST be added deliberately; each new runtime dependency SHOULD
  be justified in the relevant plan or PR.

## Development Workflow & Quality Gates

- Every change lands via a reviewed pull request; at least one approving review is required
  before merge.
- CI MUST pass before merge: type-check, linter, and the full test suite (all green).
- The Constitution Check gate in the implementation plan MUST pass before Phase 0 research
  and be re-verified after Phase 1 design; unresolved violations block progress.
- Any principle violation carried forward MUST be recorded in the plan's Complexity Tracking
  with the concrete need and the rejected simpler alternative.

## Governance

This constitution supersedes ad-hoc conventions and other project practices where they
conflict. Amendments MUST be proposed via pull request that states the change, its
rationale, and its version impact; approval by a project maintainer is required to merge.

Versioning follows semantic versioning: MAJOR for backward-incompatible governance or
principle removals/redefinitions, MINOR for a newly added principle or materially expanded
guidance, PATCH for clarifications and non-semantic refinements.

Compliance is verified at every pull request and at each Constitution Check gate. Reviewers
MUST confirm the change adheres to these principles or that any deviation is justified in
Complexity Tracking. For runtime development guidance and per-feature technical context,
consult the current plan and `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
