# Pantry Depths Development Governance

Pantry Depths is a `web-react` consumer of the shared governance foundation. The foundation is pinned as the `dev/foundation/` submodule at one exact commit; do not edit it from this repository or recreate its rules locally. This README is navigation only: it routes work to its canonical owner and does not own placement rules.

## Load order

1. Repository root entry point (`AGENTS.md` / `CLAUDE.md`).
2. `dev/foundation/core/agent_rules/foundation_startup.md`.
3. `dev/foundation/platforms/web-react/platform_startup.md`, selected by `dev/foundation.config.json`.
4. `dev/agent_rules/agent_startup.md` for this project's snapshot, operations, and local discovery.

The foundation owns document placement, core workflows, shared agent behavior, and platform standards. Every selected profile (no profiles) loads its own startup in declared order. Read shared rules directly from `dev/foundation/`; keep only project-specific deltas below.

## Local ownership

- `dev/agent_rules/`: project snapshot, implementation and Git permissions, and executable validation operations.
- `dev/standards/`: project-specific addenda and any local governance policy.
- `dev/skills/`: only project-specific hazard cards, never a copy of a foundation skill.
- `dev/docs/`: product design, active plans, reports, and archives.
- `dev/tools/`: project-owned offline tooling. A file directly under it is an executable entrypoint; reusable implementation lives in a named subdirectory. See the tooling ownership section of `dev/standards/project_structure.addendum.md`.

## Trigger map

Route each kind of work to its required reading before starting.

| Work                                                                   | Required reading                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Add, move, or reorganize governance or documentation files             | `foundation/core/standards/governance_structure_standard.md`                                               |
| Create or update a plan, sketch, spec, review, or closeout             | `foundation/core/workflows/work_lifecycle.md` and the matching workflow under `foundation/core/workflows/` |
| Change a runtime state owner, command, selector, or persisted contract | `foundation/core/standards/runtime_ownership.md`                                                           |
| Run validation or deliver a change                                     | `dev/agent_rules/test_operations.md`                                                                       |
| Any Git mutation                                                       | `dev/agent_rules/git_operations.md`                                                                        |
| Change local governance or its checker                                 | `dev/standards/` local governance policy and this project's checker                                        |

Platform rows, from `foundation/platforms/web-react/platform_startup.md`:

| Work                                                                  | Required reading                                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Add or move a source file, create a layer, change an import direction | `foundation/platforms/web-react/standards/project_structure_standard.md` and `dev/standards/project_structure.addendum.md` |
| Add or rename an npm script, or change a verification stage           | `foundation/platforms/web-react/standards/command_surface_standard.md`                                                     |
| Add or reorganize TypeScript modules or CSS                           | `foundation/platforms/web-react/standards/naming_conventions.md`                                                           |
| Change control flow, function layout, or code spacing                 | `foundation/platforms/web-react/standards/code_style_standard.md`                                                          |
| Change DOM interaction, focus, reduced motion, or assistive state     | `foundation/platforms/web-react/standards/web_accessibility_standard.md`                                                   |
| Add or run tests                                                      | `foundation/platforms/web-react/standards/testing_standard.md` and `dev/agent_rules/test_operations.md`                    |

Project rows:

| Work                                                                              | Required reading                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Run `/implement`                                                                  | `dev/agent_rules/implement_operations.md` after the canonical `/implement` workflow               |
| Change any gameplay rule, stat, enemy, door, key, floor layout, or balance number | `dev/docs/design/pantry-depths_v1.md`                                                             |
| Anything involving React, IndexedDB, service workers, or PWA                      | The declared deviation in `dev/standards/project_structure.addendum.md` — these do not apply here |
