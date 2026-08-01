# Authored Cells, Painted

Parent Plan: `map_room_editor.plan.md`

## Goal

Let a room whose cells are authored be painted cell by cell, in every tile kind, with what is painted showing up in the floor the game assembles. This is the last structure the room surface cannot edit, and the only one where the alternative is literally typing coordinates — which is what this tool exists to end.

## Summary

**Why it is worth doing.** An authored room is a grid of nine tile kinds written out row by row in JSON. It is the only way ground that cannot be filled ever reaches a floor, and it is the one structure where a mistake is invisible until somebody walks into it. The two rooms that use it today were written by hand and are the reason the previous child had to open them read-only.

**What changes.**

| Piece                        | Today                                          | After                                                                |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| An authored room             | Opens read-only behind a note                  | Opens with a grid, painted in any of the nine kinds                  |
| Switching a room to authored | Not offered                                    | Offered, seeded from the room's current extent                       |
| The refusal on sealed ground | Reported when the file is read                 | Reported while painting, before it can be saved                      |
| Resizing an authored room    | Invalidates the file — the grid no longer fits | Reshapes the grid, keeping every cell that still has somewhere to be |

**Roughly how.** A grid of buttons the size of the room, one per cell, painted with whichever kind is selected — click to paint, drag to paint a run. The draft holds rows of kind names exactly as the file does. The refusal that matters here is asked of the draft on every change rather than at save time, because a room sealed by a trench is one the runtime repair cannot open, and finding that out at save time is finding it out too late to see what did it.

**What it looks like when it lands.** Every one of the nine kinds can be painted, the room beside it rebuilds as it is painted, and a region sealed off by water or a trench says so before it can be written.

## Relational Context

- **Authored cells are the only path by which unfillable ground reaches a floor.** The generator is not allowed to place a trench; an author is. So this surface is the one place in the project where that kind can be introduced, and the refusal on it is not a nicety.
- **The two refusals on an authored room are not the same question.** The one that runs on the room's own cells asks whether unfillable ground seals a region off from the rest of the room. The one that runs on a built floor asks whether any walkable ground cannot be walked to. The first is the author's to fix and must report while painting; the second is repaired by the assembly and only reported if that repair failed.
- **The grid's size is the room's extent, and the reader demands they agree exactly** — every row as long as the width, as many rows as the height. Changing the extent therefore rewrites the grid rather than leaving it stale, and a room that shrinks loses the cells that fall outside it.
- **The draft holds the file's own shape.** Rows of kind names, not an internal enumeration reshaped for painting. Anything else would be rewritten on every save.
- **Switching structure is destructive in one direction and must say so.** Going from a generated structure to an authored one seeds a grid; going back throws the grid away. Neither is undoable inside the tool, and the tool is not the place to invent an undo — the file on disk is what the reload button is for.

## Scope

### Included

- A painting grid over an authored room's cells, in all nine tile kinds.
- Switching a room to and from an authored structure, seeded from its extent.
- Reshaping the grid when the extent changes, keeping what still fits.
- Reporting the sealed-region refusal while painting rather than at save.
- Correcting the room schema's stale header comment about how many kinds there are.

### Excluded

- Any new tile kind, room role or structure kind. The vocabulary is the schema's.
- Undo, copy, fill, or any other painting convenience beyond painting a run by dragging.
- A generator preview for an authored room. Its cells are its cells.
- Deleting the tooling this replaces. That is child 04.
- Any new automated test.

## Files to Change

| File                              | Change Size | Purpose                                                       |
| --------------------------------- | ----------- | ------------------------------------------------------------- |
| `src/app/debug/room-workbench.ts` | Medium      | The grid, the structure switch, the reshape, the live refusal |
| `src/app/debug/debug.css`         | Small       | The grid and its palette                                      |
| `src/content/maps/room-schema.ts` | Small       | Its header comment says eight kinds; there are nine           |

## Execution Outline

1. **The palette and the grid** in the room surface, replacing the read-only note the previous child left behind.
2. **The structure switch** gains the authored option, seeding a grid from the room's extent.
3. **The reshape** on an extent change, keeping every cell that still has somewhere to be.
4. **The live refusal**, asked of the draft rather than of the saved file.
5. **The schema comment**, corrected in passing.
6. **`npm run verify`**, then paint a room and look at it.

## Implementation Notes

**Seeding a new grid** makes a wall ring with open floor inside it, which is the only shape that is certainly legal and certainly not empty. A grid seeded as all-open would have no boundary and would read as a room with no walls; a grid seeded as all-wall has no interior to paint into.

**Reshaping** keeps a cell if its coordinates still exist and fills anything new with the same wall ring rule. A room that grows gains boundary and floor; a room that shrinks loses whatever fell outside.

**Painting a run** works by holding the pointer down and moving over cells. The grid is buttons rather than a canvas, because a cell is a thing to click and a canvas would mean rebuilding hit-testing that the browser already does.

**The live refusal** shares the schema's own check rather than restating it. The check is not currently exported; exporting it is the smallest honest change, because a second copy in the tool is exactly the drift the rest of this plan avoids.

**The preview is rebuilt as cells are painted**, which is what makes the grid worth having. The refusal, when it fires, keeps the last good floor on screen the way every other failure on this surface does.

## Edge Cases

| Case                                                      | Expected Handling                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Painting a trench that seals part of the room off         | The refusal reports at once and saving is unavailable until it is opened again      |
| Painting water that seals part of the room off            | The same; water is unfillable for this question because closing it costs bodies     |
| A room switched to authored and then back                 | The grid is discarded; the reload button is the way back to what is on disk         |
| An extent changed to smaller than the smallest legal room | The reader's refusal reports, and the grid is left alone until the extent is legal  |
| A grid whose every cell is wall                           | Legal to paint and legal to save; there is no interior, and nothing claims there is |

## Acceptance Criteria

1. A room whose cells are authored opens with a grid, and every one of the nine tile kinds can be painted into it.
2. What is painted is what the assembled room shows, without a save in between.
3. A room can be switched to an authored structure and back.
4. Changing an authored room's extent reshapes its grid rather than breaking it.
5. Sealing part of a room off with water or a trench reports while painting and blocks the save.
6. The verification gate passes, and no test file is added.
