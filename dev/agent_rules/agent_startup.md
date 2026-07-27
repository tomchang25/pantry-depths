# Agent Startup

## Required Startup

Read `dev/foundation/core/agent_rules/foundation_startup.md`, then `dev/foundation/platforms/web-react/platform_startup.md`, before this file. No profiles are selected. This file is the authoritative project-local startup layer for Pantry Depths.

## Project Snapshot

Pantry Depths is a first-person grid dungeon crawler in the 魔塔 tradition: five baked floors, stationary enemies, three key colors, and a single `max(0, attack − defense)` formula on both sides of every exchange. The player buys stat upgrades with HP and then spends those stats to make the rest of the route cheaper. There is no save, no randomness in combat, and no stat source other than four doors.

`dev/docs/design/pantry-depths_v1.md` is the product authority for every rule and number. Its `Frozen extensions` list is a scope contract, not a wish list: equipment, XP, shops, potions, chests, enemy movement, and runtime map generation are out of scope for V1 and must not gain runtime placeholders.

| Fact                | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Effective root      | Repository root; the foundation is at `dev/foundation/`                  |
| Platform            | `web-react`, with a declared no-React deviation (see structure addendum) |
| Profiles            | None                                                                     |
| Language / renderer | TypeScript, Canvas 2D raycasting, no UI framework                        |
| Toolchain           | Vite, Vitest, Prettier, oxlint, dependency-cruiser                       |
| Dev server          | `http://localhost:5273` (`strictPort`)                                   |
| Aggregate gate      | `npm run verify`                                                         |
| Path alias          | `@/*` → `src/*`, required for every cross-layer import                   |

Determinism is the project's load-bearing property. Combat contains no random number; the same input sequence must always produce the same result. That is what makes the balance simulation possible and what makes every playtest death reproducible. A change that introduces nondeterminism into `src/core/` is an architecture decision, not an implementation detail.

## Required Operation Contracts

- Read `dev/agent_rules/git_operations.md` before any Git mutation or when Git state is unreliable.
- Read `dev/agent_rules/test_operations.md` before running any test, build, screenshot, smoke, or other platform validation operation.
- Read `dev/agent_rules/implement_operations.md` before running `/implement`; it defines the project's explicit second-confirmation bypass.

## Project-Local Discovery

| Work                                                                  | Required reading                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Run `/implement`                                                      | `dev/agent_rules/implement_operations.md` plus the canonical `/implement` workflow                   |
| Choose a probe, sketch, plan, or spec for new forward work            | `dev/standards/work_lifecycle.addendum.md` after the foundation work lifecycle                       |
| Add or move a source file, create a layer, change an import direction | `dev/standards/project_structure.addendum.md` and the platform project-structure standard            |
| Change any gameplay rule, stat, enemy, door, key, or floor layout     | `dev/docs/design/pantry-depths_v1.md`; a number that contradicts it is a product decision, not a fix |
| Add or rename an npm script, or change a verification stage           | `dev/foundation/platforms/web-react/standards/command_surface_standard.md`                           |
| Any React, IndexedDB, service worker, or PWA question                 | Do not. See the declared deviation in `dev/standards/project_structure.addendum.md`                  |
