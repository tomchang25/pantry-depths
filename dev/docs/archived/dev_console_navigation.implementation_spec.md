# Development Console Navigation

Parent Plan: none (standalone spec)

## Goal

Make the development console's front page navigable: give the HUD workbench the name it already displays, land every hub card on the same grid so the row reads as one row, and add the one address the console cannot currently reach — a directory of the development scenes, so the soundstage, every map testbed, and every scene registered later are one click from `/debug` instead of a path somebody has to remember.

## Summary

**Why.** Three small things about the console are wrong in the same place. The HUD workbench is titled `HUD Workbench` on its own page and in the catalog, but its id, its path, and its module still say `hud-attack-workbench` — a name left over from when the tool was the attack geometry surface and the HUD came later. The hub's five cards sit at five different heights and the first one sits seven pixels above the other four, which is two separate CSS faults reading as one visual mess. And the scene addresses that shipped with the scene routes — `/soundstage`, `/testbed/<map>` — are reachable only by typing them, because a scene is deliberately not listed on the hub.

**What changes.**

- The workbench is renamed to `hud-workbench` in every live coordinate: module filename, exported render function, catalog id, catalog path, and the two router test cases that name it. Its displayed title and its page are untouched — they already read correctly.
- The card grid's two faults are fixed at their causes. The prose-list spacing rule that pushes every card after the first one down by `0.35rem` stops reaching grid items, and the card anchor grows to fill the grid item the grid already stretches, so cards in a row end level regardless of how long their descriptions are. Rows are equalized to each other as well, so a wrapped grid stays a grid rather than a ragged stack.
- A new development tool, the Scene Index, lists every play address the development build offers: each named scene from the scene catalog, every authored map as a plain testbed, and the ordinary play route as the control they are read against. It is registered first in the catalog because it is navigation rather than a workbench.
- The scene catalog gains the two fields a listing needs — a title and a one-line description per scene — so that a scene stays one entry in one place. Registering the boss lab later adds it to the index with no second edit.
- The structure addendum's rule that a scene gets no hub listing is amended rather than broken: the hub still lists tools only, and the tool it now lists is the directory whose links leave the debug namespace.

**Result.** `/debug` opens on an even grid whose first card is the way into the game, the HUD workbench answers at the name it already displays, and the addresses a scene owns are discoverable from the console instead of memorized.

## Requirements

1. The HUD workbench is reachable at an address matching its displayed name, and no live coordinate keeps the previous name. Frozen and archived documents are not rewritten — they record what was true when written.
2. Cards on the development hub are aligned to a common top edge and share a common height within a row, independent of description length, and rows in a wrapped grid share their height with each other. The prose-list spacing that caused the misalignment keeps working for prose lists.
3. The development console offers one address listing every development play address: each named scene, each authored map as a testbed, and ordinary play. A scene registered later appears there without a second edit, because the listing reads the scene catalog rather than a copy of it.
4. The scene catalog remains the single owner of what a scene is — address, floor, rules, and now the words that describe it. No module states a scene's name or purpose a second time.
5. Nothing about the production surface changes: the scene catalog and the scene index stay out of the production module graph, exactly as the debug tools and the scene subtree already do.

## Relational Context

- `src/app/debug/debug-tools.ts` is the single registry the hub, the router, and the router test all read. A tool's id, path, title, and description exist only there; renaming a tool is a catalog edit plus the module it defers to.
- `src/app/debug/scene-index.ts` reads `src/app/scene/scene-router.ts` (a read, at module scope) and `src/content/maps/map-library.ts` (a read, eager). Both crossings are legal: no boundary rule constrains `src/app/` as an importer, and the debug subtree is production-excluded by the same DEV guard in `src/app/main.ts` that excludes the scene subtree — so the scene catalog reaching the debug chunk does not put it in the production graph. A static import of either module from a production-reachable module would.
- The scene catalog's `load` thunks stay deferred. The index renders from the plain fields only and must never call `load` to build a row; doing so would pull every scene's rules into the index page and make the catalog's laziness decorative.
- Scene links are full-document anchors, never client-side navigation. A scene mounts the play surface and its viewport-locking stylesheet; leaving the debug document is what keeps that stylesheet out of a scrolling page. This is the same mechanism the hub's tool cards already use.
- `.debug-card-grid` and `.debug-tool-card` are shared by the hub and, after this change, by the scene index. The CSS fix therefore lands once and serves both; the scene index must not fork a second card style.
- `.debug-page li + li` exists for prose lists inside debug panels. Its interaction with the card grid is accidental, so the exclusion belongs on that rule rather than on a higher-specificity override elsewhere.
- The router test names three tools by id, path, and title, and then iterates the whole catalog. The renamed entry breaks the first form and passes the second; updating the named case is a test whose subject moved, not a new test.
- `test/e2e/debug-route.spec.ts` selects the Map Workbench card by accessible name and is unaffected by a new first card or by the rename.

## Scope

### Included

- Renaming the HUD workbench module, export, catalog id, and catalog path, and updating the router test cases that name it.
- The two card-grid CSS corrections and the row-to-row equalization.
- The scene catalog's title and description fields, the scene index tool, and its catalog registration.
- The structure addendum amendment for the hub listing rule.

### Excluded

- Any change to what the HUD workbench does or displays.
- Any change to scene resolution, the scene hooks contract, or what a scene does when opened.
- A `/scene` index route inside the scene namespaces; the directory is a debug page, not a play surface.
- Registering a boss lab or any second scene. The index is built so that one is a catalog entry when its subject exists.
- New unit or browser tests.

## Files to Change

| File                                          | Change Size | Purpose                                                                                               |
| --------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `src/app/debug/hud-attack-workbench.ts`       | Small       | Renamed to `hud-workbench.ts`; exported render function renamed with it                               |
| `src/app/debug/debug-tools.ts`                | Small       | Renamed entry, plus the scene index registered first                                                  |
| `src/app/debug/scene-index.ts`                | Medium      | New tool: named scenes, map testbeds, ordinary play                                                   |
| `src/app/scene/scene-router.ts`               | Small       | Catalog entries gain a title and a description; the catalog and the testbed address form are exported |
| `src/app/debug/map-workbench.ts`              | Small       | Its playtest button builds the testbed address through the shared helper                              |
| `src/app/debug/debug.css`                     | Small       | List-spacing exclusion, row equalization, card fills its grid item                                    |
| `test/unit/app/debug/debug-router.test.ts`    | Small       | The HUD workbench case follows the rename                                                             |
| `dev/standards/project_structure.addendum.md` | Small       | The hub lists the scene index tool; scenes are listed inside it                                       |

## Execution Outline

1. Rename the workbench module and its export, update the catalog entry, and update the two router test cases. Verified by typecheck and the unit run before anything else moves.
2. Fix the card grid in `debug.css` — the three corrections are independent of the rest and make the hub judgeable while the remaining work lands.
3. Add the title and description fields to the scene catalog entries and export the catalog.
4. Write the scene index tool against the shared debug page and card styles, then register it first in the debug catalog.
5. Amend the structure addendum's scene-listing paragraph.
6. Verify: `npm run verify`, `npm run check:governance`, and a production build check that the scene catalog's identifiers are absent from the built output. Then open `/debug` and look at the grid, and follow the index into a scene and a testbed.

## Implementation Notes

- The scene index page uses `createDebugPage` (wide) and one `createDebugPanel` per group. Each group's links reuse `.debug-card-grid` and `.debug-tool-card`, so a scene card and a tool card are the same object at a different address.
- The testbed group is derived from `MAPS`, in the order the map library holds them. The address form — the prefix and the escaping — moves into an exported helper beside the function that decodes it, and the map workbench's playtest button switches to it, so the two places that build a testbed address stop being two owners of it.
- Scene descriptions are the scene's own words about what its session is for, not a restatement of its address. The soundstage's is the filming stage; a testbed's group description carries the control-group reasoning once rather than per map.
- The card anchor fills its grid item with `height: 100%`; `min-height` stays as the floor for a short card in a single-card row.

## Edge Cases

| Case                                                  | Expected Handling                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| A map file is added to the content tree               | It appears as a testbed on the next load, because the index reads the map library |
| A scene is registered without a description           | Not possible: the fields are required on the catalog entry type                   |
| The scene index is opened in a production build       | Unreachable, like every debug address; the ordinary game plays instead            |
| The old HUD workbench path is opened after the rename | Unknown exact path, so the debug router falls back to the hub, as it does today   |

## Acceptance Criteria

1. The HUD workbench opens at an address that matches its displayed name, and the previous address falls back to the hub rather than breaking.
2. On the development hub, every card in a row starts at the same top edge and ends at the same bottom edge, with the longest description setting the height, and a wrapped grid's rows match each other.
3. The development console lists every development play address on one page: each named scene, every authored map as a testbed, and ordinary play; following any of them opens the game at that address.
4. Adding a scene to the catalog is still one entry, and it appears in the listing with no further edit.
5. A production build reaches none of it, and the built output contains no scene catalog or scene index code.
6. The aggregate verification gate and the governance check both pass.
