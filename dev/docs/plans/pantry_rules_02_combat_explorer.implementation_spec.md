# Deterministic Combat Model and Explorer

Parent Plan: `pantry_rules.plan.md`

## Goal

Establish the deterministic combat calculations and authored progression data that Pantry Depths uses to price enemies before the turn-resolution system exists. Provide the first registered debug viewer so every stage and enemy cost can be inspected from the real model rather than from copied design tables.

## Summary

This child adds a pure attack-minus-defense combat projection, authored player baseline and upgrade effects, and the five enemy archetypes. Player stages derive from the ordered upgrade effects so each numerical value has one content source. The projection reports player damage, penetration, hits to kill, retaliation damage, and total kill cost, with an explicit impassable result when player damage is zero.

The Combat Explorer registers at the existing development-only hub and presents the complete cost matrix plus a selectable stage/enemy breakdown. It reads the content and calls the core projection directly; it owns no run state, command path, or alternate formula. Focused unit tests execute every matrix cell and the lower-bound cases. The parent plan also records the confirmed temporal-overlap retaliation contract for the later action-resolution child.

## Relational Context

- `src/core/` owns the pure combat calculation and imports no authored data; `src/content/combat/` owns the player baseline, ordered upgrade effects, derived stages, and enemy archetypes, and may type those records through core contracts.
- The player-stage records derive in content from the one baseline plus the ordered four upgrade effects. Later door resolution consumes those same effect identifiers; it must not introduce a second stage table or duplicate numeric upgrades.
- A combat projection is an analytical result, not an Action resolver: it does not mutate health, choose targets, process adjacency, or emit events. The confirmed start-and-end adjacency overlap rule remains parent-owned behavior to be implemented in `pantry_rules_03`.
- An impassable target has zero player damage and no finite hit count or total cost. Zero enemy retaliation remains a defeatable, zero-cost result; the two cases must remain distinguishable to tests and the viewer.
- The debug viewer consumes content and core calculations through application composition, is registered only through `DEBUG_TOOLS`, and never owns mutable gameplay state or sends a bypass command. Production exclusion remains owned by the existing debug bootstrap boundary.
- The matrix and selected breakdown invoke the core projection for every displayed result. Numeric labels must not be maintained as a parallel viewer table.
- Unit tests import the same content entries and assert each stage/enemy projection, making the complete 5 x 5 matrix executable evidence rather than copied documentation.

## Scope

### Included

- Pure damage and kill-cost projection with explicit penetration and zero-retaliation results.
- Authored player baseline, four ordered upgrade effects, five derived stages, and five enemy archetypes.
- Focused unit coverage for the full combat matrix and lower-bound behavior.
- A development-only Combat Explorer registered at the existing debug hub.
- The parent-plan correction for confirmed temporal-overlap retaliation behavior.

### Excluded

- Mutable run state, accepted player ticks, movement, facing, attack targeting, retaliation execution, death, or semantic events.
- Door, key, grid, floor, sprite asset, HUD, renderer, and harness implementation.
- Any gameplay mutation, scenario selector, balance report, or production debug route.

## Files to Change

| File                                  | Change Size | Purpose                                                                                         |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `src/core/combat.ts`                  | Medium      | Own pure combatant contracts, damage calculation, and kill-cost projection.                     |
| `src/content/combat/player-stages.ts` | Medium      | Define baseline stats, ordered upgrade effects, and derived immutable stages.                   |
| `src/content/combat/enemies.ts`       | Medium      | Define the five immutable enemy archetypes and their appearance identifiers.                    |
| `test/unit/core/combat.test.ts`       | Medium      | Execute the complete stage/enemy matrix and boundary cases.                                     |
| `src/app/debug/combat-explorer.ts`    | Medium      | Render the development-only matrix and selected projection breakdown with native DOM.           |
| `src/app/debug/debug-tools.ts`        | Small       | Register the Combat Explorer through the single debug catalog.                                  |
| `package.json`                        | Small       | Make the unit-test command fail when no test files exist now that this child supplies coverage. |
| `dev/docs/plans/pantry_rules.plan.md` | Small       | Link this handoff and record the confirmed retaliation contract.                                |

## Execution Outline

1. Add the core combat contracts and pure projection first, keeping every formula independent from content and browser state.
2. Add combat content for the player baseline, upgrades, derived stages, and enemy archetypes, then exercise it through the full matrix unit test before adding UI.
3. Implement the native-DOM Combat Explorer from those real exports and add its one catalog registration at `/debug/combat`.
4. Run the focused unit tests, layer-boundary check, and delivery verification; manually inspect the development-only viewer and its production-route fallback.

## Implementation Notes

- Model the impassable branch as a discriminated analytical result with no finite hit count or total cost. Keep retaliation damage visible in that branch because a later accepted failed attack can still be punished.
- Define upgrade effects as ordered content records with stable identifiers and stat deltas. Derive stages from the baseline and prior effects at module initialization without mutable exports or runtime state.
- Enemy archetypes carry only stable identity, display name, health, attack, defense, and a semantic appearance identifier. Floor placement and runtime health instances belong to later children.
- Render the matrix with semantic table markup and use native selects for the selected breakdown. Recompute the detail when either select changes; browser-default presentation is intentional for this debug surface.
- Keep the viewer's labels in English and use a textual impassable marker in addition to any visual formatting.

## Edge Cases

| Case                                        | Expected Handling                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Player attack does not exceed enemy defense | Projection is impassable with no finite hit count or total cost.                                                  |
| Enemy attack does not exceed player defense | Projection remains defeatable and reports zero retaliation damage and zero total cost when no other cost applies. |
| Player's final hit defeats the enemy        | The target contributes no retaliation after that hit, so the cost uses one fewer retaliation than hits to kill.   |
| A stage or enemy select changes             | The explorer replaces the detail with a newly calculated projection and does not retain a copied display result.  |
| Production `/debug/combat` request          | Existing bootstrap falls back to ordinary play without loading the viewer.                                        |

## Acceptance Criteria

1. Every player-stage and enemy-archetype combination produces the parent plan's damage, penetration, hit-count, retaliation, and total-cost result.
2. The model distinguishes an impassable target from a target that costs zero health to defeat.
3. Player stages, upgrade effects, and enemy values each have one immutable authored source and introduce no runtime state.
4. Development `/debug/combat` exposes the full real matrix and an inspectable selected breakdown, while the hub and production behavior retain their existing boundaries.
5. The parent plan states that enemy retaliation requires adjacency to the same surviving enemy at both player-tick boundaries, with cancelled forward inputs producing no tick.
