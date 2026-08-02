# A Cast A Room Declares

Parent Plan: `filming_stage.plan.md`

Status: Draft implementation spec

## Goal

Let a room declare which bodies stand in it and where, as authored content in room-local coordinates, so a floor can be assembled with a known body on a known cell instead of a random draw. This is the contract half of the filming stage, and it is the one part of the plan that changes what a room is.

## Summary

**Why.** Nothing in the content layer can say "a swordsman stands here". The only way to get one particular body in one particular place today is to restart runs until the draw produces it. A room already declares how many bodies live in it and how fast they return; what it cannot say is which and where.

**What changes.** A room file may carry a cast: a list of entries, each naming a body kind and a cell inside the room. Coordinates are the room's own, in the same space its authored cells use — the wall ring is row and column zero, so the first interior cell is 1,1 — which means the declaration travels with the room into whichever slot a map gives it, and an editor can paint bodies and tiles on one grid without two coordinate systems.

**The vocabulary problem and its answer.** The body kinds live in the demo half, which the content layer may not import. The content layer therefore declares the names itself — the same move, in the same file, that the nine tile kinds and four room roles already make for the same reason. The demo's table is then keyed by that vocabulary, so a body added to one half and not the other fails to compile. A test cannot hold the two lists equal: no test file may import the demo half.

**The trap.** The authoring endpoint writes the room reader's return value verbatim into the file it validated. A reader that parses a cast but does not return it means the next save from either workbench silently deletes every cast in the file.

**Placement rules.** A cast is placed before anything random, exactly where it says, ignoring the keep-your-distance rule the random crowd obeys — placing a body at arm's reach is the point. Cast bodies count against the room's crowd cap, so the cap stays a true promise and a room whose cast fills it gets no random bodies and no reinforcements until one dies.

**Result.** A room file can be given a cast by hand or by a tool, and the assembled floor stands those bodies where the file says, in every slot the room can land in.

## Relational Context

- The content layer may reach only content and core. It declares the body-kind vocabulary and never imports the demo table; the demo half imports the content type and binds its table to it. This direction is the whole reason the vocabulary is declared rather than shared.
- The room reader is the only refusal for a room file, and the authoring endpoint writes its return value verbatim. Any field the reader does not return is a field the next save deletes.
- The map resolver copies room records through whole; the assembler builds one assembled-room record per placed room, and that record is the only thing the floor population sees. A cast must ride on that record the way the crowd already does, or the population has no way to ask which room declared it.
- There is exactly one construction point for an assembled room record; the side-room path spreads it. Adding the cast there covers every slot including the main region.
- Floor population owns placing bodies and is the single authority on how many stand on a floor. It runs on a fresh run and again on every descent, so a cast is re-placed per floor rather than carried.
- Wrong shapes to avoid: resolving the cast by looking the room up again by name from the map (the drawn side rooms are not recoverable that way); reusing the turn-based game's enemy identifiers or the appearance identifiers, neither of which lines up with the demo's seven bodies; placing the cast through the reinforcement path, which enforces a distance from the arrival.

## Scope

### Included

- The cast declaration, its vocabulary, its reader, and its refusals.
- The cast riding through the assembler onto the assembled-room record.
- Placement during floor population, and the crowd-cap accounting.
- Binding the demo's body table to the content vocabulary.

### Excluded

- Any editor for the cast. Painting it is the next child.
- Any refusal based on whether a cell is walkable. See Edge Cases.
- Any cast on a map. A map places rooms; what stands inside one is the room's.
- Reinforcement behaviour beyond the cap accounting.

## Files to Change

| File                              | Change Size | Purpose                                                                      |
| --------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `src/content/maps/room-schema.ts` | Medium      | The vocabulary, the cast type, its reader, its refusals, and returning it    |
| `src/demo/enemy-archetypes.ts`    | Small       | The body identifier becomes the content vocabulary; the table is keyed by it |
| `src/demo/maze.ts`                | Small       | The assembled-room record carries the cast                                   |
| `src/demo/world.ts`               | Medium      | Placement during floor population and the crowd-cap accounting               |
| `src/content/rooms/*.room.json`   | None        | Existing rooms declare no cast and are unaffected                            |

## Execution Outline

1. Declare the body-kind vocabulary in the room reader's file, beside the tile-kind and role vocabularies, with the same reasoning stated in the same shape.
2. Bind the demo's body identifier to it and key the demo's table by that identifier, then run typecheck — a mismatch in either direction must fail here, not later.
3. Add the cast type and its reader, refusing a cell outside the room's interior and two entries on one cell, and **return the cast from the room reader**.
4. Carry the cast onto the assembled-room record at its single construction point.
5. Place the cast in floor population, before the random spawn pool is built, and subtract what was placed from the random starting count so the cap holds.
6. Add a cast by hand to a scratch room file, play it, and confirm the bodies stand where the file says; then save that room from the room workbench and confirm the cast survives the round trip.
7. Run the aggregate gate.

## Implementation Notes

- The interior bound is one cell in from each edge, matching what the assembler actually paints for every structure kind. A room's outer ring is never interior.
- Room-local to world is the assembled room's minimum corner plus the local coordinate less the wall ring, because the minimum corner is already the first interior cell. Bodies stand at cell centres, as every existing spawn does.
- The random starting count is computed against the crowd cap and the depth. Subtract the cast placed in that room rather than clamping afterwards, so the intent reads.
- Reinforcement already measures against the live body count, so it needs no change once the cast is in that count.
- The floor's kit scatter reads only the main room's declaration and is untouched by this child.

## Edge Cases

| Case                                               | Expected Handling                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cast cell outside the room's interior            | Refused when the file is read, naming the cell.                                                                                                                                                                                                                        |
| Two entries on one cell                            | Refused when the file is read, naming the cell.                                                                                                                                                                                                                        |
| A cast cell that a carved structure leaves as wall | Not refused. The body is placed and settles out of the geometry as any pushed body does.                                                                                                                                                                               |
| A cast cell that is water                          | Not refused. The body drowns on arrival, which an author may be filming on purpose.                                                                                                                                                                                    |
| A cast larger than the room's crowd cap            | The whole cast stands; the cap governs what arrives on top of it, so the random count shrinks to nothing and no reinforcement comes until a body dies. Dropping the surplus instead would empty the cast of every room declaring no crowd, which is what the stage is. |
| A room with a cast and no crowd declaration        | The cast stands and nothing else arrives, which is the stage.                                                                                                                                                                                                          |
| Descending to a new floor                          | The cast is placed again from the room's declaration, like everything else the floor holds.                                                                                                                                                                            |

## Acceptance Criteria

1. A room file carrying a cast places those bodies at those cells when the floor is assembled, in every slot that room can land in.
2. A cast placed at the arrival cell stands there, rather than being pushed away by the keep-your-distance rule.
3. A room whose cast meets its crowd cap receives no random starting bodies and no reinforcements until one dies.
4. A room file saved through the authoring endpoint keeps its cast.
5. A cast naming a cell outside the interior, or two bodies on one cell, is refused with a message naming the cell.
6. Adding a body kind to one half without the other fails the verification gate.
7. Every existing room and map still assembles and plays unchanged.
