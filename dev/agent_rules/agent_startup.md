# Agent Startup

## Required Startup

Read `dev/foundation/core/agent_rules/foundation_startup.md`, then `dev/foundation/platforms/web-react/platform_startup.md`, before this file. No profiles are selected. This file is the authoritative project-local startup layer for Pantry Depths.

## Environment

This file describes how to operate the repository. It deliberately says nothing about what the game is or should be: the code under `src/` is the only authority on that, and a description kept here would drift out of date and then be believed.

| Fact              | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Effective root    | Repository root; the foundation is at `dev/foundation/`                  |
| Platform          | `web-react`, with a declared no-React deviation (see structure addendum) |
| Profiles          | None                                                                     |
| Language          | TypeScript, no UI framework                                              |
| Toolchain         | Vite, Vitest, Prettier, oxlint, dependency-cruiser                       |
| Dev server        | `http://localhost:5273` (`strictPort`)                                   |
| Branch-merge gate | `npm run verify`                                                         |
| Path alias        | `@/*` → `src/*`, required for every cross-layer import                   |

`dev/docs/design/` and `dev/docs/reports/` are frozen; see `dev/standards/frozen_reference_directories.md`. Delivery scope lives in `dev/docs/plans/` and `TODO.md`.

## Required Operation Contracts

- Read `dev/agent_rules/git_operations.md` before any Git mutation or when Git state is unreliable.
- Read `dev/agent_rules/test_operations.md` before running any test, build, screenshot, smoke, or other platform validation operation.
- Read `dev/agent_rules/implement_operations.md` before running `/implement`; it defines the second-confirmation bypass, the plan-level standing authorization, and the sandbox track's light ceremony.

## Implementation Defaults

- Do not add compatibility wrappers, redirects, aliases, duplicate APIs, or migrations without a current approved compatibility requirement. For an internal contract with no such promise, update its owner and consumers together and remove the obsolete path.
- If a change would break required behavior, first strengthen or generalize the current owner around demonstrated cases. Otherwise change the existing function or API directly. Add an intermediary only when both routes would violate ownership or dependency direction.
- Never remove historical save migrations or legacy reads without explicit sign-off. This project has no save system; add a migration only when a change is proven to invalidate persisted user data and the user explicitly requires compatibility, then follow `dev/foundation/core/agent_rules/save_migrations.md`.
- Deliver the simplest complete end-to-end layer that meets current requirements and leaves the product working. Choose durable ownership seams, but do not pre-build speculative abstractions, configuration, extension points, or future layers.
- Separate modules when responsibility, state ownership, lifecycle, or dependency direction differs. A forwarding wrapper, helper, interface, manager, or extra file is not modularity by itself.
- Before adding code or a package for common functionality, inspect existing dependencies and their current documentation and types. Prefer an existing dependency, otherwise a maintained library, when it lowers total complexity.
- Research established product and technical patterns before consequential user-facing or architectural decisions with mature precedent. Keep the research focused on the unresolved decision; do not delay mechanical changes or settled designs with open-ended research.

## Project-Local Discovery

| Work                                                                               | Required reading                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Run `/implement`                                                                   | `dev/agent_rules/implement_operations.md` plus the canonical `/implement` workflow        |
| Run `/commit`                                                                      | `dev/workflows/commands/commit.md`, then the Git operations contract it routes to         |
| Choose a probe, sketch, plan, or spec for new forward work                         | `dev/standards/work_lifecycle.addendum.md` after the foundation work lifecycle            |
| Add or move a source file, create a layer, change an import direction              | `dev/standards/project_structure.addendum.md` and the platform project-structure standard |
| Start, grow, graduate, or delete a sandbox experiment under `src/sandbox/`         | `dev/standards/sandbox_track.md`, then the owners it routes to                            |
| Add or change a branch chain over a discriminated union, literal union, or enum    | `dev/standards/code_style.addendum.md` after the platform code style standard             |
| Read or cite anything under `dev/docs/design/` or `dev/docs/reports/`              | `dev/standards/frozen_reference_directories.md` — the short answer is do not              |
| Add or replace a game sound, or touch the audio library at `E:/Code/audio-library` | `dev/skills/sfx_sourcing.md`                                                              |
| Add or rename an npm script, or change a verification stage                        | `dev/foundation/platforms/web-react/standards/command_surface_standard.md`                |
| Any React, IndexedDB, service worker, or PWA question                              | Do not. See the declared deviation in `dev/standards/project_structure.addendum.md`       |
