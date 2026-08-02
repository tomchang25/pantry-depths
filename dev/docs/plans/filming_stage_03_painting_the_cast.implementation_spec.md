# Painting The Cast

Parent Plan: `filming_stage.plan.md`

Status: Draft implementation spec

## Goal

Give the room surface a way to place a cast by pointing at cells, so authoring which body stands where is a stroke rather than a coordinate typed into a file. A cast a room can declare is worth nothing if declaring one means counting cells by hand.

## Summary

**Why.** Every other authored value in this project earned a surface for the same reason: a value is wrong only in the medium that can show it. A cast is a picture — three bodies in a row, one in each corner — and typing coordinates is exactly what the room surface exists to end.

**What changes.** The room surface's cell grid gains a second layer. The palette gains one swatch per body kind plus an eraser, so a single palette holds two groups; which group the held brush belongs to decides which layer a stroke writes. A tile brush paints cells as it does today. A body brush places a body on the cell under the pointer, and the eraser clears one.

**Where the grid appears.** Today the grid is shown only for a room whose cells are authored. A cast is not a property of authored cells — the stage is open floor throughout — so the grid is shown for every room, with a flat backdrop when the structure is not authored and the painted cells as backdrop when it is. The tile half of the palette stays available only where there are cells to paint.

**Confirmation.** The floor diagram beside the form marks each body the assembled floor holds, at its cell. This is deliberately drawn from the assembled floor rather than from the draft, so what the author sees confirms the cast survived the assembler rather than restating the form.

**Result.** Open a room, pick a body, click three cells, save, and the floor that assembles has those three bodies standing there.

## Relational Context

- The painter element is built once and kept; strokes recolour a single cell button in place and ask only for a preview rebuild. Rebuilding the form per stroke destroys the button under the pointer and ends the drag — this is a solved bug with a comment on it, and the cast layer must obey the same rule.
- The room draft is held loosely as an untyped record, so a field the surface does not edit survives a round trip through the form. What strips an unknown field is the room reader, which the previous child fixes; this child assumes it returns the cast.
- The colour table is exported from the preview module precisely so the palette and the diagram cannot disagree. Body marker colours belong in the same table for the same reason.
- The diagram is drawn from the assembled floor's grid today and does not see bodies. It must be given the assembled world rather than only its grid to mark them; the preview already holds that world, so nothing new is resolved.
- The preview is read-only and has no authority over content. Nothing the diagram shows becomes a source of truth, and saving goes through the same path it does today.
- The brush is module-level so a chosen kind survives closing one room and opening another. A second brush group joins that state rather than adding a second variable that can disagree with it.
- Wrong shapes to avoid: a second grid beside the first; a mode toggle separate from the palette, which lets the held brush and the active layer disagree; drawing the diagram's markers from the draft rather than from the assembly.

## Scope

### Included

- The body swatches and eraser in the room surface's palette, and the layer they write.
- Showing the grid for rooms whose structure is not authored.
- Body markers on the cell buttons and on the floor diagram.
- Marker colours in the shared colour table.

### Excluded

- Any change to the tile layer's behaviour or to the tile palette.
- Any new surface, tab, or tool. The cast is painted where rooms are already painted.
- Any editing of a cast from the map surface, which edits maps and not rooms.
- Refusals, which belong to the room reader and already exist by this child.

## Files to Change

| File                              | Change Size | Purpose                                                                          |
| --------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `src/app/debug/room-workbench.ts` | Medium      | The second brush group, the cast layer, and showing the grid for every structure |
| `src/app/debug/floor-preview.ts`  | Small       | Marker colours and marking bodies on the diagram                                 |
| `src/app/debug/debug.css`         | Small       | The marker on a cell button and the body swatches                                |

## Execution Outline

1. Extend the held-brush state to carry either a tile kind or a body kind, keeping it module-level, and build the palette as two groups from one list.
2. Give the painter a second layer alongside its rows: the draft's cast, addressed by cell. A stroke with a body brush sets or clears one entry and recolours that one button; a stroke with a tile brush behaves exactly as today.
3. Show the grid regardless of structure, with a flat backdrop where there are no authored cells, and keep the tile swatches unavailable where there is nothing to paint.
4. Add body marker colours to the shared colour table and dress a cell button carrying a body with one.
5. Give the diagram the assembled world instead of only its grid, and mark each body at its cell.
6. Open the room surface, paint a cast on a room whose structure is open, save it, reload the tool, and confirm it comes back; then confirm the diagram marks it where it was painted.
7. Run the aggregate gate.

## Implementation Notes

- Cast entries are addressed by cell for editing and written back in the file's own shape on save. Keep the written order stable so saving a file the author did not change does not reorder it.
- The eraser is a brush in the body group, not a separate control — otherwise the palette has two ways to express "no body here".
- A stroke dragged across cells with a body brush places one body per cell entered, which is the same behaviour the tile brush already has; the cap is enforced by the reader and the floor, not by the painter.
- Resizing a room already refits the tile grid and keeps interior cells that still have somewhere to be. Cast entries outside the new interior are dropped on the same pass, because the reader would refuse them and a draft that cannot be saved is a trap.
- The diagram's existing marks for the arrival, the way out, and the room labels stay; body markers are drawn after the grid and before those, so a body under a label does not hide it.

## Edge Cases

| Case                                             | Expected Handling                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Painting a body on a cell that already holds one | No change; one body per cell is the contract.                                                                                |
| Painting a body on a wall or water cell          | Allowed. The reader refuses only what the file alone can decide, and a body in water is authorable.                          |
| Shrinking a room below a cast entry's cell       | The entry is dropped as the grid refits, in the same pass that drops orphaned tile cells.                                    |
| A room whose structure is carved                 | The grid shows a flat backdrop; a cast can still be painted, and where a carve puts a wall is a floor-time question.         |
| A room with no cast                              | The cast layer is absent from the draft entirely, not an empty list, so a room that never had one is not rewritten with one. |

## Acceptance Criteria

1. A cast can be painted on any room regardless of its structure, saved, and read back after the tool is reloaded.
2. Painting a tile still behaves exactly as it does today, including dragging a stroke across cells.
3. The palette shows both groups, and the held brush is visibly one of them.
4. The floor diagram marks each body of the assembled floor at its cell.
5. Shrinking a room drops cast entries that no longer fit rather than producing a draft that cannot be saved.
6. A room that has no cast is not given an empty one by opening and saving it.
7. The aggregate verification gate passes and no test file is added.
