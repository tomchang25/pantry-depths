# The Room Surface, Without Authored Cells

Parent Plan: `map_room_editor.plan.md`

## Goal

Give a room its own editing surface: extent, role, crowd, scatter and a generated structure, with the room previewed as a floor of one room by the same assembler the game calls. A room is its own file and may be used by more than one map, so it is edited on its own rather than through whichever map happens to name it.

## Summary

**Why it is worth doing.** Everything a room declares is a number nobody will tune while it lives only in a file: how many bodies stand in it and how fast they come back, how much of it is water, how open the carve leaves it, what its walls are made of. The last plan moved all of that onto the room precisely so it could be authored per room — and then left the only way to author it as typing JSON.

**What changes.**

| Piece                          | Today                                       | After                                                        |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| Editing a room                 | Typing JSON into a file                     | A second tab beside the map surface                          |
| The map tool's page            | One surface, owning the page itself         | A page with two tabs, each surface a factory beside it       |
| A quantity that may be a range | Written by hand in one of two spellings     | A control that switches between the two and rewrites neither |
| Judging a room                 | Name it from a map, start a run, walk to it | Previewed on its own as a floor of one room                  |

**Roughly how.** The page grows tabs, matching the entity workbench's own three-tab shape, and the map form becomes a factory beside a new room factory. The room surface holds a draft in the file's shape and previews it by making a one-room map on the spot — the draft room in the main slot, an empty pool, a draw of zero, and an extent equal to the room's own — then handing that to the same chain child 01 built. Both views come from one assembly, exactly as before.

**What it looks like when it lands.** A Rooms tab that opens any room in the library, changes anything it declares, shows the room the game would build from it, and saves it. A room asking for a range gets a different room on every re-draw; a room that declares nothing arrives empty.

## Relational Context

- **A room file is validated on its own and a map file names it.** The room reader answers a room's own shape and cannot see any map; the fit of a room into a slot belongs to the resolver and is a map's question. The room surface therefore previews a room with no side rooms at all, which is the only arrangement where the fit check has nothing to say.
- **The one-room preview map is a fiction, and a deliberate one.** No map is being edited and none is saved. What it buys is that the room's cells are assembled by the code that will assemble them, rather than by a second drawing path that could disagree.
- **The two spellings of a quantity are content, not presentation.** The room reader keeps a bare number as a bare number and a range as a range, because the endpoint writes its return value verbatim. A control that normalised every quantity into a range would rewrite every room file it opened, and the capture harness's seeded floors would move — a range with equal ends still consumes a random number where a bare number does not.
- **An absent declaration is a statement.** A room with no crowd holds nobody; a room with no scatter receives nothing. The surface must be able to express absence rather than only zero, so each optional block is present-or-absent before it is filled in.
- **The page owns the tabs; each surface owns its own draft, preview and save.** No surface reads another's state. The map surface's library listing and the room surface's are asked for separately, because they are different directories and either can be refreshed without the other.
- **Structure is limited to the generated forms in this child.** Authored cells are child 03. A room whose file already holds authored cells must be openable without being silently converted to a generated one — the surface reports that it cannot edit that structure yet and leaves the draft alone.

## Scope

### Included

- Tabs on the existing tool, and the map surface becoming a factory beside the new one.
- A room surface over every field a room file may hold except authored cells: identity, role, extent, crowd with its reinforcement, scatter with pools, barricades, mortars and ground kit, and a generated structure.
- A quantity control that switches between an exact number and a range without rewriting the other spelling.
- Previewing a room as a floor of one room, with the same two views and the same re-draw as the map surface.
- Saving a room, reloading it from disk, and refreshing the room listing.

### Excluded

- Authored cells and any painting, including the refusal specific to them. That is child 03.
- Deleting a room, or renaming one in place. Saving under a new identity writes a new file, which is what the endpoint does.
- Any change to what a room may declare. The vocabulary is the schema's and this surface only exposes it.
- Any new automated test.

## Files to Change

| File                              | Change Size | Purpose                                                             |
| --------------------------------- | ----------- | ------------------------------------------------------------------- |
| `src/app/debug/map-workbench.ts`  | Medium      | The page grows tabs; the map form becomes a factory                 |
| `src/app/debug/room-workbench.ts` | Large       | The room surface                                                    |
| `src/app/debug/debug-tools.ts`    | Small       | The catalogue entry's title and description now cover both surfaces |
| `src/app/debug/debug.css`         | Small       | Nothing new if the existing tab and form classes fit                |

## Execution Outline

1. **Split the page from the map form.** `map-workbench.ts` keeps the page and gains the tab strip; what it had built becomes a factory returning one element, the way the decor surface already relates to the entity workbench's page.
2. **The quantity control**, written once and used by every quantity the room declares. It is the piece most likely to be got wrong, so it lands before the form that consumes it.
3. **The room surface** over the remaining fields, with the one-room preview and the same save, reload and refresh actions.
4. **The catalogue entry** describes a tool that now edits both.
5. **`npm run verify`**, then open both tabs and look at them.

## Implementation Notes

**The one-room preview map** names the draft room in the main slot, holds an empty pool and a draw of zero, and takes the room's own extent as the map's. With no side rooms the fit check is never reached, so any room the room reader accepts previews.

**Optional blocks** are each fronted by a control that adds or removes the whole block. Removing one drops it from the draft rather than zeroing it, because a room with no crowd and a room whose crowd caps at zero are different statements and only one of them is what an author means by "nothing lives here".

**The quantity control** shows which spelling the draft holds and offers the other. Switching to a range seeds both ends from the number that was there, so the first thing an author sees is the room they already had; switching back to a number takes the low end. Neither switch touches the draft until it happens.

**A room whose structure is authored** opens read-only with a message saying so. Child 03 replaces that message with the grid.

**Seconds are not whole numbers.** The interval between arrivals is the one quantity that may be fractional, and its control has to allow that; every other quantity is a count of things.

## Edge Cases

| Case                                                | Expected Handling                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A starting count larger than the cap                | The room reader's refusal reports and saving is unavailable                               |
| A range whose low end exceeds its high end          | Same, with the message the reader gives                                                   |
| A carved room asking for neither stone nor timber   | Same; a wall would be made of nothing                                                     |
| A room smaller than the smallest with an interior   | Same; the reader names the minimum                                                        |
| A room file already holding authored cells          | Opens, previews, and reports that its structure is not editable here yet; nothing is lost |
| A room saved under an identity that has no file yet | The endpoint creates it, and it joins the listing when the listing is refreshed           |

## Acceptance Criteria

1. A room can be opened from the library, changed in every field it may declare short of authored cells, and saved.
2. A room can be created under a new identity and is then nameable by a map.
3. A room previews as a floor of one room, from above and from inside, both of one assembly, and re-draws on demand.
4. A quantity can be written as an exact number or as a range, and switching between them changes nothing else about the file.
5. A room declaring no crowd and no scatter previews as an empty room.
6. Every refusal a room file can earn reports before saving and names the room and the rule.
7. The verification gate passes, and no test file is added.
