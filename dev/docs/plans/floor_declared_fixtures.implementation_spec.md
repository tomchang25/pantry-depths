# Room-Owned Floor Structures

Parent Plan: none (standalone spec)

## Goal

Make each room the authority for the interactive structures it contributes to a floor, including whether each structure is placed at authored cells or drawn randomly inside the room. Replace the current mixture of room roles, unconditional floor fields, and offstage sentinel coordinates with one resolved structure collection that also permits a floor to declare no structures.

## Summary

The current contract represents the same concept three different ways: the cursed altar is copied through `Maze.altar` and `World.altar`, the stairway is an unconditional `Maze.exit`, and the blessing altar, hot spring, and extraction beacon are implied by a room role and fixed at that room's centre. `Maze.extraction` is a fourth representation but is unused. This makes a room unable to hold more than one kind of fixture, prevents authored placement, and forces non-dungeon scenes to move unwanted fixtures onto a boundary cell.

This change gives `MapRoom` one keyed `structures` declaration covering `cursedAltar`, `blessingAltar`, `hotSpring`, `extraction`, and `stair`. Each key chooses one placement form:

```json
"structures": {
  "stair": { "random": 1 },
  "extraction": { "at": [{ "x": 10, "y": 6 }] }
}
```

`random` is a positive whole count and produces that many placements from legal cells in the owning room. `at` is a list of room-local cells and its length is the count; there is no second count to disagree with it. Omitting a key means none, so zero and an empty authored list are refused rather than retained as alternate spellings of absence. Placement policy is independent of terrain policy: an open generated room may place a fixture exactly, as the four shipped fixture rooms do, while a carved room must use random placement because an exact cell may become masonry.

The existing room terrain field is renamed from `structure` to `layout`, leaving `structures` unambiguous. Floor assembly resolves declarations into `Maze.structures`, whose entries carry a stable floor-local identifier, kind, owning room, and cell. `MapRoom.role`, `Maze.altar`, `Maze.exit`, and `Maze.extraction` are removed. Mutable state, currently only cursed-altar hit points, is kept by structure identifier on `World` without duplicating the structure's position.

The first version keeps the current floor-level cardinality: at most one instance of each structure kind may occur on an assembled floor. Map resolution proves that fixed rooms and every possible pool draw respect that limit, so invalid content is rejected before a random floor can fail. The collection and placement forms still express the room ownership directly and avoid adding five unrelated booleans.

Shipped content preserves its behavior. The four side-room fixtures use authored centre cells, the main region requests one random stairway, and the existing random draw position is retained. Stage, sandbox, circle-water, and trench-yard request none, so the soundstage and render panel no longer relocate fixtures offstage. The room workbench gains a structure layer over the existing grid so exact placements can be painted and random counts can be edited and round-tripped.

## Requirements

1. A room declares every cursed altar, blessing altar, hot spring, extraction beacon, and stairway it contributes; no assembler fallback or room role creates one implicitly.
2. Each declared kind uses either a positive whole random count or one or more authored cells. The two forms are mutually exclusive because a count beside authored cells would create two sources of truth.
3. Omission means zero structures of that kind. Explicit zero, an empty authored list, unknown kinds, overlapping placements, and cells outside the room interior are invalid content and are refused with the room and kind identified.
4. Exact placement is valid for authored and open layouts. A carved layout uses random placement because its final open cells are not known from the room file.
5. Every declared random count is fulfilled exactly from legal cells in its owning room. Insufficient legal cells are a floor-build error rather than permission to silently place fewer structures.
6. An assembled floor carries at most one structure of each current kind. The map contract rejects any fixed-room and pool-draw configuration that could exceed this limit, so validity does not depend on a random draw.
7. A floor with no stairway, altar, extraction beacon, blessing altar, or hot spring is legal. Nothing is built, drawn, lit, sounded, triggered, or represented by a sentinel coordinate for an absent structure.
8. The shipped dungeon retains one cursed altar, one blessing altar, one hot spring, one extraction beacon, and one stairway in their current locations and random sequence.
9. The room workbench can author exact structure cells, edit random counts, preview both forms, and save and reopen them without changing their placement policy or data.
10. The soundstage and render panel stop relocating the stairway and cursed altar, and the arena plan stops directing its scene to reproduce that workaround.

## Relational Context

- `room-contract.ts` owns the vocabulary. `parseRoomSource` returns what the authoring endpoint writes, so `layout` and `structures` must validate and round-trip without a legacy `structure` alias or zero form.
- The map resolver can examine fixed rooms, the pool, and `draw`; it proves the maximum contribution of each kind is one before assembly, while assembly keeps a defensive duplicate refusal.
- `buildFloor` alone resolves room-local declarations into stable `Maze.structures`. Exact footprints are reserved and random placements are drawn there; no consumer derives positions from room centres.
- `Maze.structures` owns kind and position. `World` owns only mutable state keyed by structure identifier, so cursed-altar hit points do not duplicate a position.
- Cell and pad selectors replace singular maze fields, `padRoomAt`, and role checks. Pad lookup retains the current three-by-three blessing, spring, and extraction extent.
- Arrival validation always runs. Stair route validation, task messaging, markers, and descent depend on a stair instance; the main objective and sealed reward do not.
- The workbench adds structures as a third grid layer beside terrain and cast. Do not replace the keyed union with per-kind fields, paired count-and-cell sources, first-wins duplicates, or sentinel positions.

## Scope

### Included

- Room declarations, validation, resolution, selectors, keyed mutable state, and all rules and presentation consumers for the five kinds.
- The terrain-field rename, all room content migrations, and structure editing and preview in the room workbench.
- Removal of roles, singular fixture fields, positional altar state, both offstage workarounds, and their planning text.

### Excluded

- Entrance placement; arrival remains a separate mandatory floor anchor.
- Terrain and terrain-backed obstacles: water, walls, barricades, and mortars.
- Multiple same-kind instances and the new reward or transition semantics they would require.
- Floor objectives, room and map extents, side-room counts, and the arena scene itself.
- Browser tests and presentation assertions; the edited and played result is inspected manually.

## Files to Change

| File | Change Size | Purpose |
| --- | --- | --- |
| `src/core/floor/room-contract.ts` | Large | Replace roles with layout and structure declarations |
| `src/content/rooms/room-schema.ts`; `src/content/rooms/*.room.json` | Large | Validate and migrate room content |
| `src/content/maps/map-resolver.ts`; `src/core/floor/map-contract.ts` | Medium | Enforce cardinality and optional stair routes |
| `src/core/floor/maze.ts` | Large | Resolve placements, expose selectors, and remove singular fields |
| `src/core/world/world.ts`; `src/core/world/index.ts` | Medium | Own keyed mutable structure state and exports |
| `src/core/floor/rooms.ts`; `src/core/world/extraction.ts`; `src/core/world/tasks.ts`; `src/core/world/step-world.ts` | Large | Migrate pad, task, and descent behavior |
| `src/core/player/melee/execute-melee.ts` | Medium | Join cursed-altar placement and state |
| `src/presentation/scene-3d/world-structures.ts`; `world-effects.ts`; `scene-renderer.ts` | Large | Render instances, effects, readouts, lights, and markers |
| `src/runtime/surface.ts`; `src/ui/hud.ts` | Medium | Migrate channels, task wording, minimap, and legend |
| `src/app/debug/room-workbench.ts`; `debug.css`; `floor-preview.ts` | Large | Author and preview the structure layer |
| `src/app/scene/soundstage.ts`; `scene-router.ts`; `src/app/debug/render-panel.ts` | Medium | Delete offstage relocation and stale descriptions |
| `test/unit/core/floor/map-contract.test.ts`; `maze-structures.test.ts`; `test/unit/dev/tools/authoring/authoring-api.test.ts` | Medium | Cover floor and authoring contracts |
| `dev/docs/plans/first_five_minutes.plan.md`; `TODO.md` | Small | Remove workaround direction and narrow remaining work |

## Execution Outline

1. Replace the room vocabulary, parser, and all room JSON in one beat so reader and content agree.
2. Add map cardinality refusal, floor placement and selectors, optional stair validation, and focused floor tests.
3. Add keyed runtime state and migrate melee, pad behavior, extraction, tasks, and descent; then migrate presentation, HUD, minimap, and preview consumers and delete old fields.
4. Add workbench count and grid-placement editing plus authoring round-trip coverage.
5. Delete both relocation workarounds and update their descriptions, arena execution note, and tracker entry.
6. Run the focused checks below, then inspect the dungeon, soundstage, render panel, and room workbench manually.

## Implementation Notes

**Content.** The four current role rooms retain open layouts and declare their centre cell `3,3`; `main-region` declares one random stair. Exact cells must be interior, non-overlapping, on walkable authored terrain when present, and able to contain the kind's footprint. Carved layout plus `at` is refused.

**Assembly.** Reserve exact footprints before scatter and exclude them from the entrance draw. Keep the current entrance draw and following stair draw over the existing ordered main-region candidates so shipped seeds do not move. Random candidates exclude non-walkable or reserved cells, arrival, doorways, and cleared walks; insufficient candidates are reported with map, room, kind, wanted, and available counts.

**Cardinality and state.** The resolver adds fixed counts to the largest possible pool contribution for `draw`; any result above one is refused. `World` initializes cursed-altar state by identifier on each floor and discards it on descent. Pad kinds retain their three-by-three behavior. With no stair, the objective still rewards the player and its UI promises no stair.

**Workbench.** Add structure kinds and an eraser to the held-brush model; clicking moves the unique kind and draws a distinct overlay. Random mode uses a whole-number count. Resize removes out-of-bounds exact cells. Switching to carved leaves exact data visible and disables save until corrected rather than converting it.

**Focused checks.** Run `npm run typecheck` and `npm run test -- test/unit/core/floor/map-contract.test.ts test/unit/core/floor/maze-structures.test.ts test/unit/dev/tools/authoring/authoring-api.test.ts`. Manual inspection remains necessary for grid editing, fixture placement, readouts, effects, and the absence of fixtures on development surfaces.

## Edge Cases

| Case | Expected Handling |
| --- | --- |
| Kind is omitted | It creates no draw, placeholder, or sentinel |
| Count, cell, footprint, overlap, or layout policy is invalid | Room parsing identifies and refuses the kind and first invalid value |
| A map could draw duplicate kinds | Map resolution refuses it before a floor draw |
| A random declaration has no legal cell | Assembly reports map, room, kind, wanted, and available counts |
| Main objective is met without stairs | Reward remains; all stair-specific behavior and presentation remain absent |
| Room is saved and reopened | Layout, placement form, count, and cells remain unchanged |

## Acceptance Criteria

1. The shipped dungeon plays as it does today: each of its four side fixtures stands at the current room centre, one stairway is drawn in the main region at the same seeded position, pad interactions work over the same area, and descent works after the main objective.
2. A room with authored structure cells places each fixture at those cells, while a room with a random declaration places the requested count on legal cells inside that room.
3. No floor contains a structure that no assembled room declared, and a structure-free floor builds and plays without fixture-related errors or sentinel positions.
4. The soundstage and render-panel workbench contain no altar, stairway, blessing altar, hot spring, or extraction beacon, and neither surface relocates fixtures after world creation.
5. On a floor without stairs, the main objective still grants its sealed reward and no text, HUD legend, minimap point, geometry, effect, marker, warning, or trigger claims a way down exists.
6. Invalid structure kinds, counts, cells, placement policies, overlaps, and possible duplicate floor kinds are refused before they can produce a partially furnished or seed-dependent floor.
7. In the room workbench, an author can switch a kind between absent, random, and exact placement, paint an exact cell, preview it, save it, and reopen the room with the same declaration.
8. The four floor objectives remain unchanged on every map, and the arena plan no longer instructs its scene to hide undeclared fixtures offstage.
