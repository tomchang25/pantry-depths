# Deterministic Action Resolution and Viewer

Parent Plan: `pantry_rules.plan.md`

## Goal

Establish Pantry Depths' deterministic grid-command boundary so every move, turn, attack, interaction, retaliation, and terminal outcome resolves from explicit state and authored world input. Provide a development-only Action Viewer that makes those real transitions observable before fixed-floor content and final presentation land.

## Summary

This child introduces four-direction facing, immutable run snapshots, and a canonical command path for forward movement, turning, interaction, and rejected backward input. It resolves combat through the existing shared damage function, including the confirmed rule that an enemy retaliates only when that same surviving enemy is edge-adjacent at both the accepted tick's start and end. Closed-door and solid-wall forward inputs are cancelled before a tick; successful movement, turns, valid interactions, and attacks are accepted ticks.

Keys are collected automatically on successful entry. A targeted interaction accepts a tick for a closed door, stair, or hot spring; a locked door remains an accepted tick, while interaction with no target is cancelled. Stairs and hot springs occupy non-passable target cells and are used only from a facing-adjacent cell. Door effects are supplied through the existing authored upgrade records, stairs preserve the complete run state, breakable walls use the combat rule without retaliation, and the hot spring restores health before retaliation. Death wins over victory if other surviving enemies kill the player during the same tick that defeats the Princess.

The Action Viewer uses one harness-owned small scenario, dispatches through the runtime command boundary, and displays an accessible 2D map plus before snapshot, semantic events, and after snapshot for each command. It is an inspection surface, not an editor or alternate rules implementation. The five baked floors, their placements, and presentation feedback remain later work.

## Relational Context

- `src/core/` owns immutable run-state contracts, grid geometry, command validation, and pure transition results. It imports neither content nor browser code, and it calls the existing combat calculation rather than copying attack-minus-defense arithmetic.
- An authored world definition is immutable input; each spatial entity composes only the movement, interaction, pickup, and combat capabilities it needs. A run snapshot stores player progress plus generic active and health state keyed by entity identifier, so opening, collection, and defeat never mutate authored data.
- Entity `kind` is authored metadata for content inspection and presentation only. Command resolution queries capabilities: movement checks `blocksEntry`, interaction evaluates requirements and ordered effects, pickup applies entry effects, and combat supplies attackability and retaliation. Do not branch command flow on door, stair, hot-spring, key, enemy, or breakable-wall identity, restore parallel capability lists, or add content-owned callbacks.
- `src/runtime/` owns the active session's current snapshot and exposes the sole stateful `dispatch` boundary. Every consumer, including the harness and future ordinary play, observes the snapshot and submits commands through that boundary rather than mutating run fields.
- The core transition captures adjacent living enemies before applying an accepted command, then applies retaliation only from captured enemies that survive and remain adjacent afterward. Rejected commands make no transition and no retaliation; a terminal snapshot rejects subsequent commands.
- A forward command attacks a facing-adjacent enemy or breakable wall without entering its cell. A solid wall, closed door, stair, or hot spring water cell cancels forward input. A valid interaction targets only the facing-adjacent closed door, stair, or hot spring; an empty or already-consumed target cancels input, while a locked closed door is still an accepted interaction.
- The harness owns the compact authored debug scenario and constructs a runtime session from it. The application debug viewer may import that harness seam, but the viewer holds no gameplay truth and must not construct or alter state outside session dispatch.
- The Action Viewer registers through the existing `DEBUG_TOOLS` catalog. It renders semantic map symbols and textual state/event output from real snapshots and never maintains a second combat, door, retaliation, or terminal-outcome model.
- Later floor-content children supply provisional and final floor definitions through the same world contract. This child must not ship floor layouts, topology checks, generators, final HUD, renderer behavior, or player-facing feedback effects.

## Scope

### Included

- Four-direction grid cells and facing, immutable run snapshots, commands, semantic events, and terminal outcomes.
- Deterministic forward, turn, interaction, combat, start/end adjacency retaliation, key, door, stair, breakable-wall, and hot-spring rules.
- A stateful runtime session that is the canonical command boundary.
- A compact harness scenario, focused unit coverage, and a development-only Action Viewer.

### Excluded

- The five authored floor layouts, floor bake, topology validation, route replay, and balance report.
- Rendering, input timing, animation, HUD, audio, rejection feedback, death screen, and ending presentation.
- Save/load, randomness, enemy movement, inventory, item systems, editor controls, debug mutation bypasses, and a production debug route.

## Files to Change

| File                                  | Change Size | Purpose                                                                                             |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `src/core/grid.ts`                    | Medium      | Define cells, facing, adjacency, and directional movement primitives.                               |
| `src/core/run-state.ts`               | Large       | Define immutable world input, mutable snapshot, commands, events, and pure command resolution.      |
| `src/core/combat.ts`                  | Small       | Reuse its damage contract from action resolution without duplicating the formula.                   |
| `src/runtime/game-session.ts`         | Medium      | Own the active snapshot and expose canonical stateful command dispatch.                             |
| `src/harness/action-scenario.ts`      | Medium      | Author the compact inspection scenario and create its runtime session.                              |
| `src/app/debug/action-viewer.ts`      | Large       | Render command controls, a semantic 2D map, snapshots, and events from the real session.            |
| `src/app/debug/debug-tools.ts`        | Small       | Register the Action Viewer in the existing development-only catalog.                                |
| `test/unit/core/run-state.test.ts`    | Large       | Prove commands, temporal retaliation, interactions, and terminal outcomes through core transitions. |
| `dev/docs/plans/pantry_rules.plan.md` | Small       | Point this child overview entry at the executable handoff.                                          |

## Execution Outline

1. Define core grid and run-state contracts, then implement the pure command resolver around the already-tested combat calculation.
2. Add focused core tests for accepted and rejected commands, temporal-overlap retaliation, keys and doors, stairs, specials, and death-versus-victory precedence.
3. Add the runtime session and the harness scenario so stateful command dispatch is available without coupling the viewer to core mutation details.
4. Register and implement the native-DOM Action Viewer from the harness session, including reset through scenario recreation rather than state mutation.
5. Run focused tests and the full delivery gate, then manually inspect development command stepping and production debug exclusion.

## Implementation Notes

- Represent command outcomes explicitly: a rejected request reports its reason without changing the snapshot or producing a gameplay tick; an accepted result includes the next immutable snapshot and ordered semantic events.
- Derive player combat stats from the initial authored baseline plus opened door effects. Use effect identifiers and the existing content records as the numeric source; do not revive stage IDs as mutable run state or duplicate upgrade values.
- Keep mutable entity progress in one generic snapshot collection. A combat capability declares whether it retaliates and whether defeat requests victory; command resolution does not infer either behavior from entity kind.
- Apply automatic key collection as part of successful forward entry before post-command retaliation. Opening a door leaves the player in place, while a stair transition changes floor and its destination cell as one accepted interaction.
- Resolve the terminal status after all eligible retaliation. When player health is zero, emit death rather than victory even if the Princess was defeated in the same tick; terminal snapshots accept no more commands.
- The viewer's map uses text or symbols in addition to color, controls use native buttons, and its event/state output remains readable without final art. It displays the session result rather than predicting it.

## Edge Cases

| Case                                                         | Expected Handling                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Forward into a solid wall, closed door, stair, or hot spring | Reject before a tick; preserve snapshot and apply no retaliation.                        |
| Forward into an enemy with zero player damage                | Accept attack tick, leave target health unchanged, then apply eligible retaliation.      |
| Turn beside one or more enemies                              | Each enemy present at both tick boundaries retaliates independently.                     |
| Successful forward movement enters or leaves adjacency       | The affected enemy has no overlap at both boundaries and does not retaliate.             |
| Closing hit defeats an enemy or breakable wall               | Remove it before retaliation; neither entity retaliates.                                 |
| Closed door without a matching key                           | Accept interaction tick, leave door and keys unchanged, then apply eligible retaliation. |
| Interaction with no valid facing target                      | Reject before a tick; preserve snapshot and apply no retaliation.                        |
| Princess defeat and lethal surviving-enemy retaliation       | Record death, not victory.                                                               |

## Acceptance Criteria

1. Equal initial snapshots and equal command sequences always produce equal next snapshots and ordered semantic-event sequences without browser, time, or random input.
2. Forward movement, turns, attacks, interactions, rejected inputs, and every confirmed temporal-overlap retaliation case follow the parent plan's rule order.
3. Keys, doors, stairs, the breakable wall, hot spring, death, and Princess victory behave through the same canonical command boundary with no duplicated upgrade values or combat formula.
4. The Action Viewer steps a compact real scenario, exposes a semantic 2D map plus before/events/after evidence, and never mutates run state outside dispatch.
5. Development debug registration remains catalog-driven and production excludes the Action Viewer with the existing debug boundary intact.
