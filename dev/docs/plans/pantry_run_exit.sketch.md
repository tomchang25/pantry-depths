# Run Exit and Completion

Parent Plan: none (standalone sketch)

## Goal

Move a run's completion from "reduce the goal enemy to zero health" to "interact with an authored exit", and delete the princess as a distinct enemy type. This is the rule half of the change; the authoring surface that places start and exit markers stays with `pantry_scene_06`.

## Summary

The design document now defines leaving through the exit as the only way to complete a run, and defines the former princess as an ordinary purple slime — the hardest row of the enemy table, with no boss identity and no terminal effect. This sketch explores landing that in the rules, content, and validator.

The change is mostly a **deletion**. `goalEntityId` is a magic field that names one enemy, and three separate guards exist to protect it: the validator refuses a goal that is not an enemy, the catalog grafts `defeatOutcome: "victory"` onto whichever entity matches it, and the authoring layer reportedly refuses to let the goal stop being an enemy. All three go away together, replaced by an entity that ends the run when interacted with.

The runtime seam is better than expected. `src/core/run-state.ts` already dispatches `interact` through a generic `InteractionCapability` with requirements and effects, and doors, stairs, and the hot spring all ride it. An exit is very likely one more entity kind whose interaction carries one new effect type; it does not need a new command, a new dispatch path, or a new terminal mechanism beyond the outcome the combat path already produces.

The expensive part is the validator. Its terminal condition is "the search reached the goal entity's cell", expressed twice — once in the greedy solver and once in the exhaustive fallback — and both need to become "the search reached the exit". That is a rewrite of the terminal predicate, not of the search, because V1's exit carries no unlock condition; whether the last enemy is unavoidable is B5's layout responsibility, not the validator's.

Landing this before `pantry_feel_04` is the point of doing it now. Once the feel plan ships an ending sequence triggered by an enemy reaching zero health, the trigger becomes presentation-coupled and the same change costs materially more.

## Requirements

1. A run completes when the player interacts with an authored exit, and by no other means. No entity's defeat produces a terminal outcome.
2. The floor-set contract names an exit rather than a goal entity, and structural validation proves the exit is reachable under the existing key and door rules.
3. The princess ceases to exist as an enemy archetype, appearance, or content identity; its stats survive as an ordinary purple slime with no special-case behavior anywhere in the tree.
4. Existing deterministic replay evidence continues to describe a completable route, with its terminal checkpoint expressed as leaving rather than as a defeat.
5. The exit carries no unlock condition in V1. Whether the final encounter is unavoidable is decided by floor layout.

## Sketch

### Likely shape

- **A new gameplay entity kind.** `src/content/floor/floor-schema.ts` enumerates gameplay entity kinds as a discriminated union (`enemy`, `key`, `door`, `stair`, `breakableWall`, `hotSpring`). An `exit` kind with an id and a cell is likely all the contract needs; verify whether it also wants an arrival facing or a label the way `stair` does.
- **One new effect, not a new mechanism.** `EntityEffect` in `src/core/run-state.ts` is a closed union (`grantKey`, `consumeKey`, `deactivateSelf`, `applyUpgrade`, `transition`, `restoreHealth`). A `completeRun` variant that resolves the snapshot's outcome to `victory` is the candidate shape, letting the exit reuse the interaction path that doors, stairs, and the hot spring already take. Verify the interact dispatch near `run-state.ts:474` and the effect application near `run-state.ts:306` before assuming an effect may set a terminal outcome — today only the combat path does.
- **`defeatOutcome` is deleted, not repurposed.** It appears on `CombatCapability`, is grafted on by `src/content/floor/floor-catalog.ts:44` for whichever entity matches `goalEntityId`, and is read at `run-state.ts:462`. With no enemy ending a run, the whole field and its three touch points should disappear rather than surviving as an unused option.
- **`goalEntityId` becomes an exit reference, or nothing at all.** If the exit is an entity kind the validator can find by kind, the floor-set field may not need a replacement at all — a set with exactly one exit needs no pointer. Verify whether more than one exit per set is wanted before choosing; the schema parser at `floor-schema.ts:313` and the canonical content at `src/content/floors/provisional-floor-set.json:11` both move either way.
- **Princess removal is a rename plus a deletion.** `src/content/combat/enemies.ts` carries `princess` in both `EnemyArchetypeId` and `EnemyAppearanceId`, with the archetype defined around line 61. The art needs no work: `src/content/presentation/presentation-asset-definitions.ts:37` already maps `princess` to the purple slime images, so this is a key rename. The provisional floor set references `archetypeId: "princess"` around line 511.
- **Harness fixtures carry the old model.** `src/harness/action-scenario.ts:83` builds a princess fixture with `defeatOutcome: "victory"`, and `src/harness/provisional-route.ts:99` names a `victory` checkpoint labelled "Princess defeated" against entity `b5-princess`. Both need the route to end by interacting with the exit instead, which means the authored command sequence itself changes, not only its labels.

### The validator is the hard part

`src/content/floor/floor-validation.ts` expresses the terminal condition twice and guards it once:

- `:282` finds the goal entity and `:286` raises `goal.invalid` unless it is an enemy. That guard inverts: the set must name an exit.
- `:556` in the greedy solver and `:742` in the exhaustive search both terminate on reaching the goal entity's cell. The greedy path additionally has special handling for a goal standing on the origin and for dropping a trailing move step, because entering the goal cell emits a defeat step. An exit is entered and then interacted with, so the terminal step shape changes; verify what `routeSteps` should emit for it.
- `:831` raises `topology.noSolution` with goal-flavored wording.

What does **not** change is the search itself. The state key at `:111` deliberately omits defeated enemies and broken walls because both are "unconditional, permanent, and never block a route"; the exponential part is keys and doors, which are consumable and fungible. An unconditional exit adds no state bits. Do not let this child grow an unlock-condition mechanism — that is V2, and it is recorded in `dev/docs/design/pantry_depths_v2_direction.md`.

### Landing order note

This lands before `pantry_feel_04`, which owns the leaving presentation and completion statistics. It has no dependency on the scene authoring plan: the exit can be authored directly in JSON, and placing markers from the Workbench remains `pantry_scene_06`.

### Candidate files to inspect

- `src/content/floor/floor-schema.ts` — gameplay entity union, floor-set fields, parser.
- `src/content/floor/floor-catalog.ts` — entity assembly and the `defeatOutcome` graft.
- `src/content/floor/floor-validation.ts` — goal guard, both terminal conditions, route step shapes, finding codes.
- `src/core/run-state.ts` — interact dispatch, effect application, outcome resolution, `CombatCapability`.
- `src/content/combat/enemies.ts` and `src/content/presentation/presentation-asset-definitions.ts` — archetype and appearance identity.
- `src/content/floors/provisional-floor-set.json` — canonical content; B5 needs an exit placed beyond the purple slime with no bypass.
- `src/harness/action-scenario.ts` and `src/harness/provisional-route.ts` — fixtures and the replayed route's terminal checkpoint.
- The authoring mutation layer, for the reported guard preventing the goal from ceasing to be an enemy. This claim came from `pantry_scene_06`'s sketch and has not been freshly verified.
- `src/app/debug/route-replay.ts` and `src/harness/balance-analysis.ts` — both assert `outcome === "victory"`; verify they still read correctly when victory arrives from an interaction.

## Non-Goals

1. Do not add unlock conditions, switches, or kill gates to the exit. V2 owns them.
2. Do not add spawn conditions for any entity or block.
3. Do not design the leaving presentation, camera move, fade, or completion statistics; `pantry_feel_04` owns them.
4. Do not build authoring controls for placing the start or exit markers; `pantry_scene_06` owns them.
5. Do not change combat, movement, adjacency retaliation, key and door rules, or any enemy stat while removing the princess identity.
6. Do not treat this sketch's codebase claims as verified; the spec author re-checks each one.

## Acceptance Criteria

1. Interacting with the authored exit completes the run, and no enemy defeat produces a terminal outcome anywhere in the tree.
2. The floor-set contract expresses the exit, and structural validation proves it reachable under the existing key and door rules, reporting a clear finding when it is not.
3. No princess archetype, appearance id, content reference, or fixture remains, and the purple slime's stats are unchanged.
4. The replayed provisional route reaches completion by leaving, and the regenerated balance evidence describes that outcome without defeat-flavored wording.
5. Deterministic replay is unchanged for every command that is not the terminal one: the same input sequence still produces the same result.
