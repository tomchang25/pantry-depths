# A Room Declares What Is Scattered Into It

Parent Plan: `room_contents.plan.md`

## Goal

Move the quantities that furnish a floor — pools, caltrops, emplacements and loose ground kit — out of the assembly code and onto the room, let each be a range rather than a fixed number, and make a room that declares none receive none. The sandbox becomes the empty room it was always meant to be.

## Summary

Four groups of constants decide what a floor is furnished with, and all four live in the code that assembles one. They are applied only to the region every other room hangs off, so a room a third the size receives the large room's quantity, and no room has any way to ask for an empty floor. That is why the sandbox — eleven cells square, declaring no crowd — still arrives holding fourteen cells of water, four caltrops, two emplacements and eleven pieces of kit.

This child gives the room a `scatter` declaration, shaped like the `crowd` it sits beside: optional throughout, and absent means none. Every quantity in it may be written as a bare number or as the two ends of a range, and that reader is the one the next child reuses for the crowd.

Two of the four move differently, and the difference is deliberate. Pools, caltrops and emplacements are already bounded to one room's block, so they become genuinely per-room: the assembly walks the floor's rooms and gives each what it asked for. Loose kit is not — it is scattered across the whole floor from a single pool of cells, side rooms included — so it stays floor-wide and is declared by the map's main region. Making it per-room would change which cell every prop lands on, on every floor, which the plan's fifth requirement forbids; the main region is the one room every map has, so it is the honest place for a floor-wide declaration until the last child reworks distribution anyway.

Nothing about what the shipped map plays changes. Its main region receives today's constants verbatim as ranges; its four side rooms declare no scatter at all, which turns the assembly's hardcoded "hazards belong to the main region" into something the content says for itself.

## Relational Context

- **The seeded sequence is the constraint that governs this whole child.** `npm run capture` seeds `Math.random`, and the assembly already records that the draw's position in that sequence is load-bearing. Every roll must therefore happen the same number of times in the same order as it does today. Two rules follow: a bare number is never rolled for, and a range whose ends are equal is never rolled for either. Today's values are all genuine ranges, so migrating them consumes exactly the randomness it consumes now.
- The three block-bounded scatters each read their constant on their first line and are otherwise already parameterised by the block they are handed, so they take a quantity instead. Their call order within one room — pools, then caltrops, then emplacements, each over a freshly recomputed list of free cells — is what today's sequence is, and it stays.
- The assembly must iterate rooms with the main region first, and must make no roll at all for a room that declares nothing. Only the main region declares anything on the shipped map, so the sequence is untouched.
- Arrival and descent are still drawn from the main region alone. This child does not touch where a run starts or where the stairs go.
- The prop pool is built after the block scatters have run, over cells that are walkable at that moment, so water and caltrops already exclude themselves from it. That ordering does not change.
- The room schema may import the prop vocabulary from the content layer's own presentation schema; both are content, so the boundary allows it. The demo layer must not be reached for it.
- The parser answers the shape the file held, because the authoring endpoint writes its return value verbatim. A quantity written as a number comes back a number; one written as a range comes back a range.
- The roll helper belongs in the demo layer beside the existing random helpers, not in the content layer. Content states quantities; the demo decides what a quantity becomes on one particular floor.

## Scope

### Included

- A quantity that is either a whole number or a range, and its reader.
- An optional `scatter` on a room, holding optional pools, caltrops, emplacements and loose kit.
- The three block-bounded scatters driven per room from that declaration.
- Loose kit driven from the map's main region, still scattered floor-wide.
- The shipped map's rooms migrated so nothing it plays changes.
- The sandbox confirmed empty.

### Excluded

- The crowd's shape — child 02.
- Any guarantee about reachable ground — child 03.
- Terrain as a share of a room, and any new ground — child 04.
- Per-room loose kit, for the reason above.
- Any change to depth scaling, to where a reinforcement may appear, or to where a run arrives and descends.
- New tests.

## Files to Change

| File                                      | Change Size | Purpose                                                          |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `src/content/maps/room-schema.ts`         | Medium      | The quantity, the scatter declaration, and their readers         |
| `src/demo/maze.ts`                        | Medium      | Rolling a quantity, and scattering per room from what it says    |
| `src/demo/world.ts`                       | Small       | Loose kit read from the map's main region rather than a constant |
| `src/content/rooms/main-region.room.json` | Small       | Today's constants, stated by the room                            |

## Execution Outline

1. `room-schema.ts`: add the quantity type and its reader, then the scatter type and its reader, both optional throughout.
2. `maze.ts`: make the range roller return its lower end without consuming randomness when both ends are equal, and add a roller for a quantity that never rolls for a bare number.
3. `maze.ts`: give the three scatters a quantity parameter instead of a module constant.
4. `maze.ts`: build the list of block-and-room pairs the assembly already computes, and scatter each room that declares anything, main region first.
5. `world.ts`: read the loose kit from the map's main region, keeping the floor-wide pool and the existing per-kind order.
6. Migrate the main region's room file; leave the four side rooms without a scatter key.
7. Run `npm run verify`, then open the sandbox and confirm it is empty, and the default map and confirm it is not.

## Implementation Notes

- **The equal-ends short circuit is not an optimisation.** The existing range roller consumes a random number even when there is nothing to choose between, so without the short circuit a range of fourteen to fourteen — which is what the next child migrates the crowd's starting count to — would shift every subsequent roll and change every seeded picture.
- **Per-kind order for loose kit is the JSON key order.** The existing constant lists sticks, then rocks, then bombs, and each count is exact, so the migrated file lists them in that order with bare numbers and consumes no randomness the old list did not.
- **A room with a scatter key but no sub-keys is legal** and means the same as no scatter key at all. There is nothing to gain from refusing it.
- **Pools need two quantities**, how many and how large, because both are rolled today and both are worth authoring.

## Edge Cases

| Case                                        | Expected Handling                                                   |
| ------------------------------------------- | ------------------------------------------------------------------- |
| A room declares no scatter                  | Nothing is scattered into it, and no random number is drawn for it  |
| A map's main region declares no loose kit   | The floor holds none                                                |
| A quantity's range has its ends equal       | That value, with no randomness consumed                             |
| A range's lower end exceeds its upper       | Refused when the room file is read                                  |
| A room asks for more of something than fits | As many as fit are placed, exactly as the existing spacing rules do |

## Acceptance Criteria

1. A run with no map named plays the floor it plays today, and a seeded capture produces the same floors it produced before.
2. Starting the game with the sandbox named plays an empty walled room: no water, no caltrops, no emplacements, nothing on the ground, and no bodies.
3. A room stating a range for a scattered thing produces different amounts of it on different floors.
4. A room that declares no scatter receives none of any of it.
5. The verification gate passes, and no test file is added.
