# Run Exit and Completion

Parent Plan: none (standalone spec)

## Goal

Make a run end by interacting with an authored exit instead of by reducing a designated goal enemy to zero health, and remove the princess as a distinct enemy type. This is the rule half of the decision recorded in the design document's section 十三; the authoring surface that places the markers remains with `pantry_scene_06`.

## Summary

Completion today is a special case bolted onto combat. `goalEntityId` names one enemy in the floor set, the catalog grafts `defeatOutcome: "victory"` onto whichever assembled entity matches it, the forward-attack path reads that field to produce a terminal outcome, the validator refuses a goal that is not an enemy, and the authoring layer separately refuses to let the goal stop being an enemy or be deleted. Five mechanisms exist to support one enemy being magic.

This change replaces all of them with an `exit` gameplay entity. The exit blocks entry and carries an interaction whose single effect completes the run, so it reuses the interaction path doors, stairs, and the hot spring already use. `goalEntityId` is deleted rather than renamed: a floor set must contain exactly one exit, which the validator checks by kind, so no pointer field can go stale or point at the wrong kind. `defeatOutcome` is deleted with it, and no entity defeat produces a terminal outcome anywhere.

The validator gets simpler rather than harder. Because the exit blocks entry, reaching it means standing adjacent to it, not entering its cell — the same relationship stairs and closed doors already have with the search. The current goal is entered, which is why the greedy solver carries two special cases: a goal standing on the origin must not report a zero-step win, and the trailing move after the defeat step must be dropped. Both disappear. The search itself is untouched: an unconditional exit adds no state bits, and enemies remain in the "cleared on contact, never blocks a route" class they are already in.

The princess is removed as an identity, not as a difficulty. Its stats stay exactly as authored and become the purple slime, the hardest row of the enemy table with no special behavior. The artwork already points at the purple slime images, so this is a rename of `princess` to `purpleSlime` in the archetype and appearance ids.

The exit needs a sprite. Rather than authoring real art now, this change bakes a block placeholder in the same striped-rounded-square style as the existing entity placeholder but in a distinct colour scheme, so the exit is unmistakably a stand-in and is never confused with a stair or with an enemy placeholder.

`victoryReached` is renamed to `runCompleted`, because the event now fires from leaving rather than from winning a fight, and it carries the exit's id. It has one test-only consumer today, so the rename is cheap and is worth doing before `pantry_feel_04` wires presentation to it.

When it lands: walking into the final enemy kills it and nothing else happens; walking up to the exit and pressing `E` ends the run with the completion outcome; a floor set with no exit, more than one exit, or an unreachable exit fails structural validation; and the replayed provisional route ends by leaving.

## Requirements

1. A run completes only through an exit interaction. No entity defeat produces a terminal outcome, because keeping a second completion path would leave the deleted special case alive in a new form.
2. A floor set contains exactly one exit, identified by entity kind rather than by a pointer field, so the contract cannot name a non-exit or drift out of sync with the entity list.
3. Structural validation proves the exit is reachable under the existing key and door rules, and reports a distinct finding when it is missing, duplicated, or unreachable.
4. The princess ceases to exist as an archetype, appearance, or content identity, with its stats preserved as an ordinary purple slime.
5. Deterministic replay is unchanged for every non-terminal command: the same input sequence still produces the same result.

## Relational Context

- `src/content/floor/floor-catalog.ts` reads authored `GameplayEntitySource` records and writes `WorldEntity` records for `src/core/run-state.ts`. Content assembles capabilities; core interprets them. The exit's terminal behavior must be expressed as an authored effect the catalog emits, never as a kind check inside core.
- `resolveInteract` in `run-state.ts` finds the first active entity in the faced cell that has an `interaction`, checks requirements, then applies effects. It currently calls `completeAcceptedTick` with no victory entity, so the terminal argument is the only wiring that must change; `applyEntityEffects` keeps its snapshot-only return.
- `completeAcceptedTick` applies post-tick retaliation before `resolveTerminalOutcome`, and `resolveTerminalOutcome` checks player death before completion. This ordering is load-bearing and must not be reordered: interacting with the exit while adjacent to a live enemy that lands a fatal retaliation is a death, matching how defeating the current goal already behaves.
- `exploreReachable` and `solveTopology` both key reachability by cell. Entities that block entry (door, stair) are never present as reached cells; stairs replace the reached cell with their destination. The exit belongs to that class, so both terminal checks are adjacency checks against a reached node, not membership of the exit's cell.
- `isBasePassable` is tested before any entity lookup in both searches, so the exit must sit on a passable base tile exactly as stairs and doors do. Blocking is an entity capability, not a tile property.
- `validateReferences` runs before either solver and short-circuits on any error, so exit-count validation must live there for the solvers to assume exactly one exit exists.
- `src/app/debug/floor-authoring.ts` mutates a draft floor set and re-validates it. Its two goal guards exist only to protect `goalEntityId`; with the field gone they must be deleted rather than retargeted at the exit, because exit placement and deletion are ordinary authoring actions guarded by validation.
- `dev/tools/floor-set/generator.ts` emits a goal enemy on the deepest floor and sets `goalEntityId`. It must emit an exit instead. Generated candidates are development-only and never enter the build.
- The floor-set contract carries an exact `schemaVersion`, and the parser rejects any other value. Removing `goalEntityId` and adding an entity kind changes the readable shape, so the version increases from 3 to 4 and every authored or fixture floor set moves with it. This is the mechanism that stops a stale generated candidate from loading as if nothing changed.
- Wrong shape to avoid: keeping `goalEntityId` as an optional or deprecated field "for compatibility". There is no external consumer of the floor-set JSON, canonical content is committed in-repo, and a retained field would leave two answers to what ends a run.

## Scope

### Included

- `exit` gameplay entity kind, its schema parsing, catalog assembly, and renderer sprite.
- `completeRun` entity effect and its wiring through the interact path.
- Deletion of `goalEntityId`, `defeatOutcome`, and both authoring goal guards, with the floor-set schema version raised to 4.
- Validator exit-count and exit-reachability rules, replacing both goal terminal conditions.
- `victoryReached` renamed to `runCompleted`.
- `princess` renamed to `purpleSlime` across archetype and appearance identity.
- Baked block placeholder artwork and its source file.
- Canonical floor set, generator, harness route and scenario, and test fixtures updated to the new model.

### Excluded

- Exit unlock conditions, switches, kill gates, and spawn conditions.
- The leaving presentation, camera move, fade, and completion statistics, which `pantry_feel_04` owns.
- Authoring controls for placing start or exit markers, which `pantry_scene_06` owns.
- Final B5 layout and the geometry that makes the last encounter unavoidable, which `pantry_floor_design_01` owns.
- Any change to combat, movement, adjacency retaliation, key and door rules, or an enemy stat.
- Real exit artwork replacing the placeholder.

## Files to Change

| File                                                                                                        | Change Size | Purpose                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `src/core/run-state.ts`                                                                                     | Medium      | `completeRun` effect, interact terminal wiring, `defeatOutcome` removal, event rename |
| `src/content/floor/floor-schema.ts`                                                                         | Small       | `exit` kind parsing; `goalEntityId` removal                                           |
| `src/content/floor/floor-catalog.ts`                                                                        | Small       | Exit assembly; drop the goal parameter chain and the `defeatOutcome` graft            |
| `src/content/floor/floor-validation.ts`                                                                     | Medium      | Exit-count rule, both terminal conditions, `leaveExit` step, finding text             |
| `src/content/floors/provisional-floor-set.json`                                                             | Small       | B5 exit placement; `goalEntityId` removal                                             |
| `src/content/combat/enemies.ts`                                                                             | Small       | `princess` to `purpleSlime`                                                           |
| `src/content/presentation/presentation-asset-definitions.ts`                                                | Small       | Exit sprite registration; appearance key rename                                       |
| `src/content/presentation/sprite-placements.ts`                                                             | Small       | Exit display size and floor anchor                                                    |
| `src/presentation/render-scene.ts`                                                                          | Small       | Exit sprite branch                                                                    |
| `src/app/debug/floor-authoring.ts`                                                                          | Small       | Delete both goal guards                                                               |
| `dev/tools/floor-set/generator.ts`                                                                          | Small       | Emit an exit instead of a goal enemy                                                  |
| `src/harness/provisional-route.ts`, `src/harness/action-scenario.ts`                                        | Medium      | Route terminates by leaving; scenario fixture drops the victory defeat                |
| `test/fixtures/*`, `test/unit/**`                                                                           | Medium      | Fixtures and assertions follow the new model                                          |
| `assets/presentation/block-placeholder-source.png`, `src/content/presentation/assets/block-placeholder.png` | Small       | Placeholder artwork source and baked runtime PNG                                      |

## Execution Outline

1. Bake the block placeholder PNG into both the editable source tree and the runtime content tree, so later presentation work has an asset to import.
2. Add the `completeRun` effect and rename the semantic event in `run-state.ts`, then wire `resolveInteract` to pass the interacting entity as the completion entity when its effects contain `completeRun`. Delete `defeatOutcome` and its read in the attack path in the same beat, because leaving it would allow two completion paths to coexist.
3. Add the `exit` kind to the schema and delete `goalEntityId`. Typechecking breaks widely from here; that is expected and is not a reason to keep a transitional field.
4. Assemble the exit in the catalog with `movement.blocksEntry` and an interaction carrying `completeRun`, and remove the goal parameter from the assembly chain.
5. Replace the validator's goal rule with an exactly-one-exit rule in `validateReferences`, then convert both solvers' terminal conditions to exit adjacency and add the `leaveExit` step. Remove the origin-goal and trailing-move special cases the entered-goal model required.
6. Place the exit in canonical B5 content beyond the purple slime and remove `goalEntityId`; update the generator to emit an exit.
7. Rename `princess` to `purpleSlime` across archetype, appearance, asset map, and content references.
8. Register the exit sprite and its placement, and add the renderer branch.
9. Delete both authoring goal guards.
10. Update the harness route to end with an interact at the exit, update the action scenario fixture, then update test fixtures and assertions.
11. Run `npm run verify`, `npm run validate:floor-set`, and the targeted browser specs for floor authoring.

## Implementation Notes

**`run-state.ts`.** `resolveInteract` should decide the completion entity from the effect list before or after applying effects; do not change `applyEntityEffects` to return a tuple, which would touch every other effect for one case. `completeRun` needs no snapshot mutation of its own — the outcome is produced by `resolveTerminalOutcome` — so it can be a no-op inside the effect loop with a comment saying the terminal outcome is resolved after retaliation, or be excluded from the loop entirely; prefer whichever keeps `applyEntityEffects` exhaustive over the union.

**`floor-validation.ts`.** The exit-count check belongs with the other reference checks so the solvers can assume one exit. For the greedy solver, compute the four cells orthogonally adjacent to the exit once, then after each `exploreReachable` round check whether any is present in the reach map for the exit's floor; the route is `routeSteps` to that node plus a terminal `leaveExit` step. For the exhaustive search, the terminal fires inside the neighbour loop where the exit is the entity at `targetCell`. Keep `leaveExit` out of `REPEATABLE_STEP_TYPES`.

**`provisional-route.ts`.** The route is an authored command sequence with indexed checkpoints. Ending by leaving changes the command list, so every checkpoint index after the change point shifts; re-derive the indices from the edited sequence rather than adjusting them by hand.

**Placeholder artwork.** Match the existing entity placeholder's construction — 512×512 RGBA, rounded square, diagonal stripes, thick border — in a clearly different hue so a placeholder block never reads as a placeholder creature.

## Edge Cases

| Case                                                                                     | Expected Handling                                                                                   |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Player interacts with the exit while adjacent to a live enemy whose retaliation is fatal | Death wins; retaliation resolves before the terminal outcome, matching current goal-defeat behavior |
| Floor set has zero or more than one exit                                                 | Structural validation error before either solver runs                                               |
| Exit is authored on a solid base tile                                                    | Existing entity placement validation rejects it, as for stairs and doors                            |
| Exit is reachable only after opening a door whose key is behind it                       | No solution finding, unchanged from the current lock-and-key search                                 |
| Player faces the exit while another interactable occupies the same cell                  | Impossible by placement validation; no additional runtime guard                                     |
| A command is issued after the run completes                                              | Rejected as terminal, unchanged                                                                     |

## Acceptance Criteria

1. Interacting with the authored exit completes the run, and defeating any enemy — including the hardest one — leaves the run active.
2. A floor set is rejected by structural validation when it has no exit, more than one exit, or an exit no legal route can reach.
3. The structural solution for canonical content ends with leaving through the exit rather than with defeating an enemy.
4. No princess archetype, appearance, content reference, or fixture remains, and the purple slime's health, attack, and defense are unchanged.
5. The replayed provisional route reaches completion by leaving, and generated balance evidence reports that outcome.
6. The exit renders in the first-person view as a distinct placeholder block that is not the stair sprite.
7. Every non-terminal command produces the same result as before the change for the same input sequence.
