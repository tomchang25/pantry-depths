# Starting From Nothing, And Copying

Parent Plan: `map_room_editor.plan.md`

## Goal

Let a map or a room be started from nothing and copied from an existing one, and let a save say whether it is about to create a file or overwrite one. The first two are what acceptance criteria 1 and 2 actually ask for and what the shipped tool does not offer; the third is what stops the first from being dangerous.

## Summary

**Why it is worth doing, stated plainly.** Children 01 and 02 were closed against criteria that ask for a map built from an empty state and a room created — and what shipped can only open a file that already exists and rename it. That writes a new file, so the criteria looked met; but it is a different act from creating one, it is not discoverable, and it destroys whatever already answered to the name typed. This child is what meets those criteria. Copying is not something the plan ever asked for; it lands here because it is the same mechanism from the other side and costs almost nothing once the first is built.

**What changes.**

| Piece                      | Today                                             | After                                                          |
| -------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Starting a new map or room | Open an existing one and retype its identity      | A control that empties the draft to a blank template           |
| Copying one                | The same, and you must invent the name yourself   | A control that keeps the draft and moves it to a free name     |
| What a save is about to do | Unstated — creating and destroying look identical | Said on the save control itself, from the listing already held |

**Roughly how.** Both surfaces already hold their draft as the file's own shape and save it under whatever identity it carries, so nothing underneath changes and the endpoint is untouched. New replaces the draft with a blank template; Clone keeps it and derives a free name from the listing; the save control reads the same listing to say whether that identity is taken.

**What it looks like when it lands.** `New` on either tab gives an empty draft that says what it still needs. `Clone` gives the same content under `<name>-copy`, unsaved until saved. The save button reads `Save map (new file)` or `Save map (overwrites pantry-depths)`.

## Relational Context

- **Nothing new is needed under the surfaces.** The draft is already the file's own shape and the save already writes by the draft's identity, so creating a file is saving a draft whose identity nothing answers yet. Do not add a create operation to the development-only writer: it already writes files that do not exist, and a second verb would be a second thing to keep inside the whitelist.
- **Deletion stays a non-goal, and copying does not smuggle it in.** Clone writes nothing until the save is pressed, and it never touches the file it copied from.
- **The listing, not the library glob, answers whether a name is taken.** The glob is fixed at page load; the listing is what the tool refreshes. A file created a minute ago is in one and not the other, and the overwrite warning is worthless if it consults the stale one.
- **A blank draft is refused, and that is the design.** An empty map has no main region and an empty room has no identity, so both report what they still need the moment they appear. The status line and the disabled save are already the mechanism for that; nothing new reports it.
- **Neither control touches the other surface.** A new room does not appear in the map surface's room list until that surface's own listing is refreshed, because the two listings are asked for separately and deliberately.

## Scope

### Included

- A control on each surface that replaces the draft with a blank template.
- A control on each surface that moves the current draft onto a free derived identity.
- A save control that states whether it will create a file or overwrite one, read from the listing that surface already holds.

### Excluded

- Deleting or renaming a file on disk. Saving under a new identity leaves the old file where it is, which is what copying means.
- Any change to the development-only writer, including a create verb.
- Any confirmation dialog. The save says what it will do; a modal on top of that is a second thing to dismiss rather than a second thing to know.
- Any change to what a map or a room may declare.
- Any new automated test.

## Files to Change

| File                              | Change Size | Purpose                                                  |
| --------------------------------- | ----------- | -------------------------------------------------------- |
| `src/app/debug/map-workbench.ts`  | Small       | New, Clone, and the save control's own account of itself |
| `src/app/debug/room-workbench.ts` | Small       | The same three on the room surface                       |

## Execution Outline

1. **The map surface** gains the two controls in its open row and the save control's wording, since it is the smaller of the two drafts and settles the shape.
2. **The room surface** takes the same three, over its own draft.
3. **`npm run verify`**, then open both tabs, start one of each from nothing, copy one of each, and look at what the save says.

## Implementation Notes

**The blank map** takes the extent the shipped map uses, no placements, an empty pool and a draw of nothing. It reports that it has no main region, which is the next thing to fix.

**The blank room** takes the sandbox's extent, no crowd, no scatter and open floor — the one structure that is legal with nothing else declared. Its identity is empty, so the reader's own message about what an identity must look like is the first thing shown.

**The free derived name** is the identity with a copy suffix, then a counter while the listing still answers to it. A draft with no identity has nothing to derive from, so Clone does nothing in that state rather than inventing a name.

**The save control's wording** is recomputed wherever the form is refreshed, because both the identity and the listing can move under it. It is wording only — the save behaves identically either way, and the endpoint remains the thing that decides whether a write is legal.

## Edge Cases

| Case                                           | Expected Handling                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Clone pressed on a draft with no identity      | Nothing happens; there is no name to derive from                                |
| New pressed with unsaved changes               | The draft is replaced; the file on disk is untouched and reload is the way back |
| An identity that is taken but was never loaded | The save says it will overwrite, which is what it will do                       |
| The listing has never been fetched             | The save says nothing about overwriting rather than guessing                    |

## Acceptance Criteria

1. A map can be started from nothing, filled in, saved and played, without opening a file by hand or borrowing an existing map's name.
2. A room can be started from nothing, given its declarations, saved, and then named by a map.
3. Either can be copied: the copy carries the original's content under a free name, writes nothing until saved, and leaves the original alone.
4. The save control says whether it will create a file or overwrite an existing one, and is correct for a file created since the tool was opened.
5. The verification gate passes, and no test file is added.
