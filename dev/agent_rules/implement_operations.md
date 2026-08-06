# Implement Operations

This file is the project-local `/implement` delta. Read `dev/foundation/core/workflows/commands/implement.md`, `dev/foundation/core/workflows/work_lifecycle.md`, and `dev/foundation/core/workflows/implementation_spec_standard.md` first. Formal-track work uses those contracts unchanged.

The sections below apply only when the named target is self-contained under `src/sandbox/<experiment>/` as defined by `dev/standards/sandbox_track.md`.

## Sandbox Decision Scan

- Evaluate whether the existing experiment shape should be replaced instead of extended.
- Gather only the evidence needed to identify observable behavior, scope, and user-authority decisions.
- State a conflict when the requested concept or current shape cannot satisfy the intended result.
- Apply the foundation's conditional stop conditions. Sandbox work adds no scheduled confirmation stop.

## Sandbox Handoff

Use a short architectural note instead of the full implementation-spec structure. The note states:

- What the experiment does and what owns it.
- What existing path it replaces, when one exists.
- The load-bearing ownership and dependency direction.
- The shapes the implementation must avoid.
- The narrow verification, if any, permitted by `dev/agent_rules/test_operations.md`.

Do not inventory every file, signature, or call site. Product decisions remain resolved before implementation; local technical details that cannot change the agreed shape remain just-in-time reading. Lifecycle tracking is one pointer or none.
