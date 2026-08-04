# Enemy Behavior Split

Goal-Executable: yes

## Goal

Split the shared enemy AI into an archetype-agnostic chassis and one module per attack family, so that understanding one family means reading one file. Today all attack behavior lives inside one 944-line module together with the movement and state plumbing every enemy shares; the attack-specific parts are already separable — they cluster into distinct function groups dispatched at exactly two points — so this is a behavior-preserving extraction, not a redesign.

## Requirements

1. Behavior-preserving throughout: no change to timing, geometry, damage, telegraph reading, or randomness. Every child lands as a refactor whose observable play is identical.
2. One module per attack family — melee, shoot, charge — selected through the attack-intent vocabulary the enemy contract already declares. Enemies without an attack (the slimes) consult no behavior module at all, preserving the contract's existing rule that having no attack block means no attack exists.
3. The chassis keeps everything shared by every enemy: per-frame timer decay, push and knockback application, drowning exclusion, crowd separation, pathing, steering, walking, the five-state mind frame, and sight/disengagement.
4. Dispatch is total over the intent vocabulary at compile time, so adding a fourth attack family without registering its module fails to build. This preserves the guarantee the current dispatch gets from exhaustiveness checks, in registry form.
5. Behavior modules never depend on the chassis module. Anything both need moves to a lower-level module instead. Without this rule the extraction creates a runtime import cycle, which the boundary checker forbids.
6. Comments in every moved or touched region are rewritten to the plain register defined by the register containment plan, in the same change that moves them.

## Design

### The seams

The chassis interacts with an attack family at four moments, which define the behavior contract:

- **Open** — the body is in range with line of sight and off cooldown; the family commits it to a wind-up. Which families use a visible wind-up and which land on touch stays a fact declared on the archetype row, as today.
- **Telegraph step** — one frame of a committed, not-yet-released attack: the charge telegraph extending, the blade rising. Families without per-frame telegraph work contribute nothing.
- **Release** — the wind-up expires: the shot fires, the cut lands or misses, the charge launches.
- **Live step** — one frame of an attack that continues after release. Only the charge has one; for the others this is empty.

The chassis calls these four seams and owns everything around them: it decides _when_ a body may open (distance, sight, cooldown), locks the facing during a wind-up, and returns the body to the ordinary mind when the attack ends. The family decides only what its attack _is_.

### The registry

A single table maps each intent — shoot, charge, melee — to its module. The table is typed as total over the intent vocabulary, so the compiler rejects a missing row. The two current dispatch sites (opening an attack, resolving an expired wind-up) collapse into lookups; their exhaustiveness checks are subsumed by the table's totality, which satisfies the project's closed-enumeration rule in a different but equivalent form.

### What stays where

| Concern                                                         | Home                      |
| --------------------------------------------------------------- | ------------------------- |
| Timer decay, push, separation, path, steer, walk                | Chassis                   |
| Five-state mind and its transitions                             | Chassis                   |
| Wind-up bookkeeping (start, facing lock, expiry)                | Chassis                   |
| Attack-family constants (charge geometry, cut arc, strike hold) | Enemy contract, unchanged |
| What each family does at the four seams                         | Its own module            |
| Which intent a row uses, its numbers                            | Content, unchanged        |

Content, the catalog, and every import boundary are untouched; all new modules live inside the rules layer's combat domain.

### Child overview

| Child | Focus                                               | Form                       |
| ----- | --------------------------------------------------- | -------------------------- |
| 1     | Behavior contract, registry, shoot family extracted | This plan, Execution below |
| 2     | Charge family extracted                             | This plan, Execution below |
| 3     | Melee family extracted, shared helpers relocated    | This plan, Execution below |

Landing order: 1, 2, 3 — smallest and most self-contained family first, the one requiring helper relocation last. Each child ends with the full verification gate and a play check of the affected enemy types.

## Non-Goals

1. No time discretization and no injectable randomness. The real-time random core is a declared structural deviation; changing it is a gameplay redesign, not a refactor.
2. No consolidation of the per-enemy timer fields into a tagged action state. Considered and not adopted for this plan.
3. No per-archetype modules. The unit is the attack family; the two shoot rows (javelineer, crossbowman) stay one module differentiated by their rows' numbers, as today.
4. No behavior tuning, no new attack families, no change to slime behavior.

## Acceptance Criteria

1. The full verification gate passes after every child, and each hunter type — swordsman, hammerman, javelineer, crossbowman — telegraphs, attacks, and recovers exactly as before, judged by playing and by the entity workbench.
2. After child 3, the chassis module contains no attack-family-specific code: no shot, charge, or blade logic, judged by reading it.
3. Adding a hypothetical fourth family requires one new module and one registry row, and omitting the row fails compilation, judged by reading the registry type.
4. The boundary check passes unchanged — in particular, no import cycle between the chassis and any behavior module.
5. Every moved region's comments are in plain register.

## Execution

Perishable coordinates, recorded 2026-08-04 at commit b8ad8d5. Re-check against live code before executing. Conflicts resolve in favor of the conceptual half.

Current layout of `src/core/combat/enemy-ai.ts` (944 lines):

| Cluster                 | Functions (line)                                                                                                                                        | Destination           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Chassis: frame plumbing | `decayTimers` (74), `applyPush` (82), `separate` (110), `pathHeading` (142), `steerToward` (187), `walk` (207)                                          | stays                 |
| Chassis: minds          | `stepMind` (673), `rest` (702), `stepIdle` (716), `stepWander` (750), `stepChase` (805), `stepRetreat` (865), `holdGround` (887), `faceThePlayer` (893) | stays                 |
| Chassis: wind-up frame  | `beginWindup` (261), `stepWindup` (595) minus its release branches, `beginAttack` (915) minus its per-intent branches, `stepEnemies` (543)              | stays                 |
| Shoot family            | `fireShot` (273)                                                                                                                                        | `behaviors/shoot.ts`  |
| Charge family           | `launchCharge` (312), `stokeCharge` (382), `stepCharge` (404)                                                                                           | `behaviors/charge.ts` |
| Melee family            | `honeBlade` (340), `releaseBlade` (368), melee release branch of `stepWindup` (622–641)                                                                 | `behaviors/melee.ts`  |
| Shared helpers          | `shortestTurn` (175), `hurtPlayer` (469)                                                                                                                | see child 3           |

Dispatch sites today: `beginAttack` (915) branches on `archetype.windupIntent`; `stepWindup` (609–648) branches on `enemy.intent`. Both end in `satisfies never`.

### Child 1 — contract, registry, shoot family

New directory `src/core/combat/behaviors/`. New file `behaviors/index.ts` declaring:

- `type EnemyBehavior` with the four seams: `open(world, enemy): void` (called after the chassis's range/sight/cooldown gate), `telegraphStep(world, enemy, deltaSeconds): void`, `release(world, enemy): void`, `liveStep(world, enemy, deltaSeconds): void`. Seams a family does not use are no-op members, so the chassis calls all four unconditionally.
- `const ENEMY_BEHAVIORS: Readonly<Record<WindupIntent, EnemyBehavior>>` — totality over `WindupIntent` (from `@/core/combat/enemy-contract`) is requirement 4's compile-time guarantee.

New file `behaviors/shoot.ts`: move `fireShot` (spawns a `Hazard` from the row's `shot` numbers; imports `world` only). Cut `beginAttack`'s and `stepWindup`'s shoot branches over to the registry. The other two intents' registry rows temporarily wrap the existing in-place functions so `enemy-ai.ts` compiles between children; this wrapper importing direction is chassis → registry → in-place functions, which is acyclic because the wrappers live in `enemy-ai.ts`'s rows passed at registration — if that proves awkward, register the two pending families as thin modules that re-export from `enemy-ai.ts` is forbidden (cycle); instead move each family fully in its own child and keep the un-extracted branches inline until their child lands. Simplest safe shape: child 1 introduces the registry with only the shoot row wired through it and leaves the charge/melee branches in place; the `satisfies never` tails shrink accordingly.

### Child 2 — charge family

New file `behaviors/charge.ts`: move `launchCharge`, `stokeCharge`, `stepCharge`. They read the charge constants from `@/core/combat/enemy-contract` (`CHARGE_SPEED` 242, `CHARGE_DISTANCE` 252, `CHARGE_DAMAGE`, `CHARGE_KNOCKBACK`, `CHARGE_WALL_STUN`, `CHARGE_WALL_DAMAGE`), movement from `@/core/floor/movement`, and wall damage via `@/core/combat/actions` — same imports the cluster uses today, none of which touch the chassis. `stepEnemies`'s charge-phase call (the live step) goes through the registry.

### Child 3 — melee family and helper relocation

Cycle hazard: the melee release branch calls `hurtPlayer` (469) and `shortestTurn` (175), both currently in `enemy-ai.ts`. A behavior module may not import the chassis (requirement 5). Relocations, comment-only rewrites included:

- `shortestTurn` → `@/core/floor/movement` (it is steering math; `steerToward` in the chassis imports it from there afterwards).
- `hurtPlayer` → `@/core/combat/impacts` (player damage application; already imported by the chassis and the tick). Update the tick's import — `src/core/world/simulation.ts` currently imports `hurtPlayer` from `@/core/combat/enemy-ai` (line 19) — and the mortar shell call site that passes it as a callback.

Then `behaviors/melee.ts`: move `honeBlade`, `releaseBlade`, and the melee release branch (`stepWindup` 622–641, using `MELEE_CUT_HALF_ANGLE` and `STRIKE_SECONDS` from the contract). After this child the registry's three rows are all real modules, `stepWindup` and `beginAttack` contain no per-intent branches, and `enemy-ai.ts` should sit near 600 lines of chassis.
