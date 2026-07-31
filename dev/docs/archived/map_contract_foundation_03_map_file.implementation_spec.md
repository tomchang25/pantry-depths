# A Map And Its Rooms Become A File

Parent Plan: `map_contract_foundation.plan.md`

## Goal

Give a floor a written form: a named map declaring its grid, the rooms always present, the pool the rest are drawn from, and how many are drawn. Refuse a map that cannot produce a legal floor at both ends — once while the file sits still, and once when a particular draw has been made — because the two ends see different errors.

## Summary

A floor exists only as the output of a generator today. Nothing can be authored, nothing can be saved, and nothing can be refused, because there is no artefact to refuse. This child adds the artefact and its two refusals; the next one makes the game play it.

**What a map holds.** A name, a grid extent, the rooms that are always present with the slot each occupies, a pool of optional rooms, and how many are drawn from that pool. Five slots exist: the main region every other room hangs off, and the four sides. A drawn room lands in a free side slot; draws never repeat within one floor. Nothing about difficulty, depth, or the run — a map is content, a floor is one run's use of it.

**What a room holds.** An identity, an extent in cells, a crowd — its cap, its starting count, and its respawn interval — its role when it has one, and its structure: carved, open, or authored cell by cell. Its tile vocabulary is the runtime's own eight kinds and nothing else.

**Two refusals, two jobs.** At rest a map is a set of declarations, and the errors visible there are contradictions between them: a draw count larger than its pool, a room whose extent does not fit the slot it claims, an area past the stated maximum, water enclosing a region in an authored room, a map with no main region. At load a floor is one particular draw, and the error visible there is a property of that draw: no route from the arrival to the way out — a route that may have to be broken through, since masonry is the player's business and four ways to open one exist.

**The maximum area is 4096 cells**, measured in child 01 rather than guessed: one terrain rebuild over today's 1225 cells costs 0.20 ms median under Node, which linearly would allow roughly 49,000 cells at an 8 ms budget. The measurement omits the browser's own per-frame area-proportional work, and a limit an author can hit without noticing is worth less than an order of magnitude of headroom.

**The shipped map ships here, and nothing loads it yet.** The file is what this child's title promises, and the authoring endpoint needs a real file behind its target. The floor assembled from it and the address that names it are child 04's, so the load-time validator ships without a runtime caller — stated rather than hidden.

## Relational Context

- `src/content/` may import only `src/content/` and `src/core/`, machine-checked. The schema therefore **declares its own tile-kind and role lists** rather than importing the demo's. The demo half may import content, so the two unions are held equal there, which is where child 04 will do it.
- `dev/tools/authoring/authoring-api.ts` calls one validator per target and **writes that validator's return value verbatim**. A validator that reshapes its input writes a file its own next load rejects. The map parser therefore answers the same shape it was handed.
- Adding a target to `CANONICAL_AUTHORING_PATHS` widens `AuthoringTargetId`, and `test/unit/dev/tools/authoring/authoring-api.test.ts` builds an exhaustive `Record<AuthoringTargetId, unknown>`. That record gains one entry so it still compiles. No case, assertion, or file is added, and the parent plan's criterion that no test file is modified is knowingly missed by that one entry — it is the cost of the same plan's criterion that a bad map is refused when saved.
- The at-rest validator sees declarations and the load-time one sees a draw. They are two functions with two jobs, in one module because the module has one importer and a second file with none would be an unreferenced module the boundary check reports.
- Room placement is fixed by the assembly, not declared: the main region sits centred in the grid, and a side room sits flush against its grid edge and centred on the other axis. Every at-rest extent rule follows from that, and child 04's assembly must not invent a different one.

## Scope

### Included

- The map and room types, the tile and role vocabularies, and the parse-and-refuse pass over a map at rest.
- The refuse pass over a drawn floor.
- The shipped map file describing what the generator produces today.
- The `map` authoring target.

### Excluded

- Assembling a floor from a map, and playing one. Child 04.
- Any authored map. The authored-cells path ships unexercised, per the parent's Non-Goal 3.
- Tests, per the parent's Non-Goal 8.
- Removing or changing the old floor set, its schema, or its validator.

## Files to Change

| File                                                  | Change Size | Purpose                                                                |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `src/content/maps/map-schema.ts`                      | Large       | The types, the vocabularies, and both refusals                         |
| `src/content/maps/pantry-depths.map.json`             | Small       | The shipped map: a carved main region and four open side rooms by role |
| `dev/tools/authoring/api-contract.ts`                 | Small       | The `map` target and its canonical path                                |
| `dev/tools/authoring/authoring-api.ts`                | Small       | The `map` branch of the save-time validator                            |
| `test/unit/dev/tools/authoring/authoring-api.test.ts` | Small       | One entry in the exhaustive target record, so it still compiles        |

## Execution Outline

1. Write `map-schema.ts`: vocabularies, types, `parseMapSource` (structure and declarations), `validateDrawnFloor` (one draw). Keep the two refusals visibly separate and say in the module doc why they are two.
2. Write the shipped map JSON, and check it against the parser by loading it through the authoring endpoint's read path rather than by eye.
3. Add the `map` target to the contract and the endpoint, mirroring the `entityDisplay` branch.
4. Add the one entry the exhaustive test record needs.
5. Run the gate.

## Implementation Notes

- **Grid extent is declared, not derived.** A pooled room's size is not known until it is drawn, so an extent computed from rooms could not be checked at rest — which is where the maximum area has to be refused. The at-rest rules then check that every room fits every slot it could land in: a side room's cross-axis extent must not exceed the main region's, and the leftover space on each axis must divide evenly in two, or the room cannot sit on whole cells.
- **Water enclosing a region** is checked only where it can be: an authored room's cells. Flood from the first cell that is neither water nor boundary, crossing anything that is neither, and refuse if any such cell is unreached. Masonry is crossed on purpose — a wall in the way is the player's business, a pool is not.
- **The drawn-floor route** is the same flood over everything that is not boundary, from the arrival to the way out. Breakable masonry is passable to it for the same reason.
- Every refusal names the map, and the number or room that caused it. A refusal that does not say which map is a refusal an author has to bisect.

## Edge Cases

| Case                                                | Expected Handling                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Draw count exceeds the pool                         | Refused at rest, naming the map, the count, and the pool size         |
| Draw count exceeds the free slots                   | Refused at rest — a drawn room with nowhere to stand is a silent loss |
| A free slot with no room drawn into it              | Legal. The block is simply not built, and reads as boundary brick     |
| Two rooms sharing an identity                       | Refused at rest, naming the identity                                  |
| A map with no room in the main slot                 | Refused at rest — nothing to hang rooms off, and nowhere to arrive    |
| An authored room whose rows do not match its extent | Refused at rest, naming the row                                       |
| Declared area past 4096 cells                       | Refused at rest, naming both areas                                    |
| A drawn floor whose way out cannot be reached       | Refused at load, naming the map and the rooms in that draw            |

## Acceptance Criteria

1. A map is a file: it names itself, its grid, its always-present rooms and their slots, its pool, and its draw count, and it carries nothing about depth or difficulty.
2. A room in that file declares its extent, its crowd, its role when it has one, and whether it is carved, open, or authored cell by cell.
3. A map whose draw count exceeds its pool is refused when saved, naming which map and which number.
4. A map declaring an area past the stated maximum is refused rather than accepted.
5. A drawn floor with no route to the way out is refused when loaded, naming the draw; a route that must be broken through counts as a route.
6. The shipped map describes what the generator produces today and passes both refusals.
