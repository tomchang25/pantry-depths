# Presentation-Only Environment Features

Parent Plan: `pantry_rules.plan.md`

## Goal

Add an authored environment-feature contract to floor content so decorations, wall-mounted lights, ambient lights, and emitters can be placed before the renderer exists. The contract must keep these records presentation-only while preserving a stable wall-face anchor that a later gameplay hazard can reuse.

## Summary

Floor content moves to schema version 2 and separates `gameplayEntities` from `environmentFeatures`. Environment records support floor decorations, wall decorations, ambient lights, and effect emitters; content names decoration, light, and effect presets while future presentation owns their visual realization.

Wall features anchor to a solid base tile and its outward cardinal face. A provisional floor set will demonstrate bones, a lit wall torch, wall spikes, and steam without claiming final placements. Wall spikes are decorative in this change: they do not affect collision, combat, topology, replay, or a run snapshot.

## Relational Context

- The parsed floor set remains the single authored-content authority. Its gameplay projection assembles only `gameplayEntities` into `RunWorld`; `environmentFeatures` remain available to the floor viewer and a future renderer but never reach core state.
- Content chooses semantic decoration, light, and effect preset identifiers. Presentation may omit an unsupported optional identifier and owns all visual parameters, rendering, timing, and variation.
- Topology validation reads tiles and gameplay entities. Environment validation checks authored anchors and identifiers but environment records never occupy cells, block movement, affect the solution, or change balance analysis.
- A wall decoration uses a `wallCell` plus an outward `face`, matching the existing directional-hint convention. The same spatial shape is reusable by a future hazard contract without adding a placeholder gameplay behavior now.
- Generated candidate floors carry an empty environment list. The offline generator does not invent final decoration placement; provisional examples are authored JSON only.

## Scope

### Included

- Schema v2 with explicit gameplay and environment floor-content collections.
- Tile and wall decoration, ambient-light, and effect-emitter records with anchor validation.
- Provisional examples, debug viewer markers, and focused contract tests.

### Excluded

- A renderer, actual lighting or particle effects, presentation preset implementations, and authoring-editor controls.
- Spike collision, kick commands, knockback, damage, death, or a generic hazard system.
- Final environment placement and preset selection.

## Files to Change

| File                                              | Change Size | Purpose                                                               |
| ------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `src/content/floor/floor-schema.ts`               | Large       | Parse schema v2 and define environment feature anchors.               |
| `src/content/floor/floor-validation.ts`           | Medium      | Validate environment placements while keeping topology gameplay-only. |
| `src/content/floor/floor-catalog.ts`              | Medium      | Assemble core state from gameplay records only.                       |
| `src/app/debug/floor-viewer.ts`                   | Medium      | Surface environment annotations in the read-only inspector.           |
| `src/content/floors/provisional-floor-set.json`   | Medium      | Migrate content and add non-final examples.                           |
| `dev/tools/floor-set/generator.ts`                | Small       | Generate schema-v2 floors with no environment placement.              |
| `test/unit/content/floor/*.test.ts`               | Medium      | Cover validation and core-projection isolation.                       |
| `test/unit/dev/tools/floor-set/generator.test.ts` | Small       | Assert generated schema-v2 environment defaults.                      |
| `dev/docs/plans/pantry_rules.plan.md`             | Small       | Point the active child overview at this executable handoff.           |

## Execution Outline

1. Define and parse the schema-v2 gameplay/environment split and update generated and committed content.
2. Keep existing gameplay validation and topology traversal on the gameplay collection, then add environment-anchor validation.
3. Update catalog assembly and the floor viewer so environment input is inspectable but does not enter `RunWorld`.
4. Add contract-focused tests, run canonical floor validation and the aggregate verification gate.

## Implementation Notes

- Tile decorations and floor-owned lights or emitters require an in-bounds passable base tile. A wall decoration requires an in-bounds solid base tile with an in-bounds passable observation cell on its declared face.
- IDs are unique across gameplay and environment records. At most one tile decoration may use a floor cell and at most one wall decoration may use a wall face; lights and emitters may share a floor position.
- `lightPresetId` and `effectPresetId` are non-empty semantic references only. This rules layer deliberately does not validate them against a renderer catalog.
- The viewer keeps base terrain and gameplay information primary, then exposes environment markers and accessible labels without becoming a renderer.

## Edge Cases

| Case                                                            | Expected Handling                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A wall decoration targets a floor tile or an enclosed wall face | Validation reports an environment anchor error.                                   |
| A decoration ID collides with gameplay content                  | Validation reports a duplicate content ID.                                        |
| Environment examples are removed or changed                     | Gameplay world, structural solution, replay, and balance inputs remain unchanged. |
| A future renderer lacks a named optional preset                 | It may omit that visual only; gameplay remains unchanged.                         |

## Acceptance Criteria

1. Authored floor data can place a tile decoration, a lit wall decoration, wall spikes, an ambient light, and an effect emitter.
2. Invalid floor and wall anchors are rejected with actionable validation findings.
3. Environment annotations do not alter core run-world assembly or the canonical structural solution.
4. The debug floor inspector exposes authored environment annotations without introducing a presentation renderer.
5. Wall spikes remain purely decorative while retaining a stable wall-face placement shape for future gameplay work.
