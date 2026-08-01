# Rooms Become Their Own Files

Parent Plan: `map_library.plan.md`

## Goal

Make a room a file of its own rather than a passage inside the map that uses it, and split reading a map from resolving one. A map file then names the rooms it wants, a separate operation turns those names into rooms, and the run that plays today plays identically.

## Summary

A room exists only inside the single map that carries it, so a room cannot be shared and the map file is the only unit of authorship. This child moves the room out: its extent, its role, its crowd and its cells become a file named by the room's own identity, and the map keeps a list of names.

Because the authoring endpoint writes a validator's return value verbatim into the file it validated, the function that validates a map cannot be the function that resolves it — a validator returning rooms would write a map file naming no rooms, which its own next load would refuse. So there are two operations. `parseMapSource` answers the map file's shape: names, slots, pool, draw, and every rule those alone can decide. A new resolver answers the runtime's shape: it looks each name up in a room library, refuses one nothing answers, and is the only place that can check whether a room fits a slot it could land in, because a name has no extent.

A room may also now say it holds nobody. `crowd` becomes optional, and a room that omits it is built with no bodies standing in it and never gains one — which is a different statement from a cap of zero paired with a respawn interval, and only one of those is a thing an author can mean.

Discovery is not this child's job. The five rooms and the one map are still statically imported; child 02 replaces that with a library that finds them. What lands here is the contract: five room files, a map that names them, a validator that sees names, a resolver that sees rooms, and a demo half whose only change is which type name it takes.

The result: `?map=pantry-depths` and no name at all both play the floor they play today — the same main region, the same four side rooms, the same crowd, the same feel.

## Relational Context

- `src/demo/maps.ts` is the only place that turns files into a playable map. It parses the rooms, parses the map, and resolves the two together at module load; `src/demo/demo-surface.ts` calls `mapNamed` and gets a resolved map. Nothing else in `src/demo/` may reach a room file.
- The resolved map type is structurally identical to today's `MapSource`, so `src/demo/maze.ts` and `src/demo/world.ts` change only in which type name they import. Making the resolved shape differ from today's would push this change through the whole floor builder, which is not what the plan asks for.
- `dev/tools/authoring/authoring-api.ts` calls `parseMapSource` in its `map` branch. That call must stay pointed at the map-file validator and must never reach the resolver: the save path writes the return value verbatim, and a resolved map written back to a map file is a file its own next load rejects.
- `checkSideFit` reads a room's width and height, so it cannot run while a map is being read. It moves into the resolver together with the loop that checks every pool room against every free side slot. That loop's reasoning is unchanged: which slot a drawn room lands in is decided at build time, so a fit that holds for three slots of four is a floor that fails at random.
- `validateDrawnFloor` takes a `DrawnFloor` rather than a map and is untouched by this change.
- `src/demo/maze.ts` builds a `DemoRoom` from a room and hands its crowd to `crowdHere`, which every spawn path in `src/demo/world.ts` and `src/demo/simulation.ts` reads. Those paths keep asking a room for three numbers; the absence of a crowd is resolved once, where a room becomes a `DemoRoom`, and never leaks into the spawn code as an optional.
- The room vocabulary — tile kinds and room roles — belongs to the room, so it moves with it. `src/content/maps/map-schema.ts` keeps `MapTileKind` in view by importing it, because `DrawnFloor` is stated in tiles.
- Each schema module in `src/content/` carries its own private `record`-style helpers rather than sharing them. The new room module follows that, and does not introduce a shared parsing utility.

## Scope

### Included

- A room-file shape and its validator, holding everything only a room can decide.
- An optional crowd, and a room without one holding and spawning nobody.
- A map-file shape naming rooms, and a validator answering that shape.
- A resolver turning a map file and a room library into the map the runtime consumes, refusing an unanswered name and checking side fit.
- The five rooms of the existing map extracted into files, and that map rewritten to name them.
- The demo half moved onto the resolved type.

### Excluded

- Discovery of maps or rooms. Both are still statically imported — child 02.
- Any change to the authoring endpoint's targets, paths, or naming — child 02.
- The sandbox map — child 03.
- Any change to how a floor is assembled, drawn, walked, or fought in.
- New tests. The existing authoring test does not exercise the map save path and is expected to keep passing unchanged.

## Files to Change

| File                                      | Change Size  | Purpose                                                      |
| ----------------------------------------- | ------------ | ------------------------------------------------------------ |
| `src/content/maps/room-schema.ts`         | Large (new)  | The room file's shape, its vocabulary, and its validator     |
| `src/content/maps/map-schema.ts`          | Large        | A map naming rooms; the room half removed                    |
| `src/content/maps/map-resolver.ts`        | Medium (new) | Names into rooms, and the fit checks that need extents       |
| `src/content/rooms/*.room.json`           | Medium (new) | The five rooms the existing map used to carry                |
| `src/content/maps/pantry-depths.map.json` | Medium       | Names its rooms instead of carrying them                     |
| `src/demo/maps.ts`                        | Medium       | Parses the room files, parses the map, resolves the two      |
| `src/demo/maze.ts`                        | Small        | Takes the resolved map, and gives a crowdless room no bodies |
| `src/demo/world.ts`                       | Small        | Takes the resolved map                                       |

## Execution Outline

1. `room-schema.ts`: move the room vocabulary, the crowd, the structure, the authored-cell reader, the water-encloses check and the minimum extent across, make `crowd` optional, and export a validator taking one room file.
2. `map-schema.ts`: delete what moved, import the tile kind back for `DrawnFloor`, and restate a placement and a pool as names. Keep every refusal a name can carry and drop the two that need extents.
3. `map-resolver.ts`: resolve each name against a library, refusing an unanswered one by both map and room name, then run the side-fit checks that moved out of the map reader.
4. Split `pantry-depths.map.json` into five room files plus a map naming them. The room ids are unchanged, so the map's own refusals read the same.
5. `src/demo/maps.ts`: parse the five rooms into a library, parse the map, resolve, and keep `mapNamed` answering the resolved type.
6. `maze.ts` and `world.ts`: take the resolved type, and resolve an absent crowd once where a room becomes a floor's room.
7. Run `npm run verify`, then play the default map and confirm the floor is the floor it was.

## Implementation Notes

- **Room identity.** A room's `id` becomes a lowercase slug, the same pattern a map name already uses. It is what a map names and what the room's filename carries, so an id that could not be a filename is a room the library could never address. Every existing id already satisfies it.
- **A crowdless room.** Resolve it where a room becomes a `DemoRoom`: a cap and a starting count of zero, and a respawn interval of positive infinity. The spawn clock adds that interval to itself and therefore never fires again, and the cap refuses a reinforcement regardless. Do not thread an optional crowd through `crowdHere` and its five callers.
- **What the map reader can still refuse.** A draw larger than its pool, a draw larger than the free side slots, two rooms in one slot, a repeated name, a missing main region, an area past the maximum, and a name that is not a slug. What it can no longer refuse is anything about extents.
- **What the resolver refuses.** A name nothing answers, naming both the map and the room; and every side-fit failure, for each fixed side placement and for every pool room against every free side slot.
- **The library's shape.** A read-only lookup from room id to room. The resolver takes it as an argument rather than reaching for a module-level one, which is what lets child 02 replace how it is built without touching the resolver.

## Edge Cases

| Case                                               | Expected Handling                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| A map names a room no file answers                 | Refused at resolve time, naming the map and the missing room           |
| A room file nothing names                          | Loads and validates; being unused is not an error                      |
| A room omits its crowd                             | Built empty, and never gains a body however long the run lasts         |
| A room declares a crowd of zero cap                | Still legal and unchanged; it simply spawns nobody at its own interval |
| A map file is saved through the authoring endpoint | Validated as names and written back as names, never as resolved rooms  |

## Acceptance Criteria

1. A run started with no map named, or with the existing map named, plays the floor it plays today: the same main region, the same four side rooms, the same crowd.
2. Every room the existing map uses is a file of its own, named by that room's identity, and the map names them rather than carrying them.
3. A map naming a room nothing answers is refused when the map is resolved, and the message names both the map and the missing room.
4. A room file nothing names loads without complaint.
5. A room declaring no crowd holds no bodies when the floor is built and never gains one.
6. The verification gate passes, and no test file is added.
