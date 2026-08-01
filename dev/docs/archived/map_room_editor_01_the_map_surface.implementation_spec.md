# The Map Surface, And A Library Read From Disk

Parent Plan: `map_room_editor.plan.md`

## Goal

Give a map an editing surface: its slots, its pool and its draw count on one side, the floor those choices assemble on the other, with both refusals reporting before a save and one action that plays what was saved. Along the way, make the tool's library listing and its play action read the files as they stand on disk rather than as they stood when the page loaded, because this is the first tool that creates the files it edits.

## Summary

**Why it is worth doing.** A map is authored content with a written form, a library and two refusals, and no surface where a person can see one while changing it. Every other authored value in this project earned that surface for the same reason: the first authored floor drew its pickups at twice their size and floating, and that value passed review, type checking and every automated gate — it was wrong only in the medium that could show it.

**What changes.**

| Piece                                 | Today                                         | After                                                                     |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Editing a map                         | Typing JSON into a file                       | A development-only tool with the assembled floor beside the form          |
| The map and room directories          | Watched, so a save reloads every open page    | Unwatched, with a save silently dropping what the server holds about them |
| Knowing which files a library holds   | A build-time glob, fixed when the page loaded | Asked for on demand through the authoring endpoint                        |
| Which named room landed in which slot | Not recoverable from an assembled floor       | Carried on each assembled room                                            |

**Roughly how.** The tool builds a draft map, parses it, resolves it against the room library with any draft room laid over the top, and hands the result to the same world builder the game calls. That one call is the single source for both views: a top-down canvas drawn over the assembled floor's own cells, and a first-person render panel over the scene the demo projects from it. Both refusals already run inside that chain, so a draw that would fail reports by failing to preview, and saving is unavailable while it does.

**What it looks like when it lands.** A `/debug` tool that opens on the shipped map, shows the floor it assembles, re-draws it on demand, refuses to save a map that contradicts itself, and opens the game at the saved map in a new tab. Creating a room file and refreshing the listing shows it without the development server being restarted, and no save reloads the page that made it.

**One thing already proved rather than assumed.** The silent invalidation this rests on was verified against a running development server before this spec was written: a room created through the endpoint appears in the re-served library module with no page reload logged, while the same file written directly to disk stays invisible — which is what shows the cache is real and the invalidation is doing the work. The parent plan's fallback is therefore not taken.

## Relational Context

- **The tool reads content and never reshapes it.** The authoring endpoint writes a validator's return value verbatim into the file it validated, so the draft the tool holds is the file's own shape, and a control that normalised a value — a bare number into a range, an omitted block into an empty one — would rewrite every file it touched. Hold the draft as the source shape and edit it in place.
- **One draw, one assembly.** The world builder calls the floor assembler itself, and the floor assembler re-draws the pool on every call. Both views must therefore come from a single world-building call. Calling the assembler once for the diagram and the world builder once for the first-person view is the wrong shape: it puts two different floors side by side as though they were one, and the re-draw control would then move them independently.
- **Resolution is where a room's extent first becomes visible, and it is not the same operation as reading a map file.** The map reader answers names because that is what a map file holds; the resolver turns names into rooms and is the only place that can refuse a room that does not fit a slot it could land in. The tool calls both, in that order, and neither is bypassed for a draft.
- **The room library is handed to the resolver rather than reached for by it.** That is what lets the tool resolve a draft against the shipped library with a draft room laid over the top, and it is the seam child 02 will use. Do not add a resolver path that reaches for the library itself.
- **Both refusals already run inside the preview chain.** The map reader and the resolver run before assembly; the two drawn-floor checks run at the end of it. Nothing in the tool calls a validator explicitly — it reports what the chain threw. A tool that re-ran them separately would be a second opinion that can disagree with the one the game gets.
- **The floor repair runs before the drawn-floor checks.** Stranded ground is opened up by the assembler, so the check that fires in practice is the one asking whether a route to the way out exists at all. Do not present the two as equally likely.
- **The development server's watcher and the endpoint's invalidation are now one contract.** The directories are ignored by the watcher precisely because the endpoint drops the modules instead; removing either half without the other leaves the library either reloading every page or never noticing a new file. The invalidation must not broadcast — a broadcast is the page reload this removes.
- **The endpoint's whitelist is the only thing keeping it inside its directories.** The listing operation accepts no name and therefore contributes nothing to a path. It must stay that way: a listing that took a subdirectory argument would reopen what the slug check closes.
- **The play action opens the game, not a copy of it.** It navigates to the ordinary address with the map named. Nothing about how the game reads a map may be special-cased for having been opened from the tool.

## Scope

### Included

- Unwatching the map and room directories, and invalidating what the development server holds after a save without telling any open page.
- A listing operation on the authoring endpoint for directory targets, and the client call for it.
- Carrying the source room's identity onto an assembled room, so a diagram can name what landed where.
- The map editing surface: slots, pool, draw count, map name and extent; both views of one assembly; a re-draw control; refusal reporting; save; refresh-the-listing; play.

### Excluded

- The room editing surface in any form, including a read-only view of a room's own fields. That is child 02.
- Authored cells and any painting. That is child 03.
- Deleting the tooling this replaces, and every file that deletion touches. That is child 04, which holds its own authorization.
- Creating, renaming or deleting a room from this surface. A slot picks a name the library already answers.
- Any new automated test. The existing authoring-endpoint suite is updated where this change moves its subject, which is not the same thing.

## Files to Change

| File                                                  | Change Size | Purpose                                                                             |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `vite.config.ts`                                      | Medium      | Unwatch the directory targets; drop the affected modules after a save, silently     |
| `dev/tools/authoring/authoring-api.ts`                | Medium      | Route a listing operation for directory targets and give it a filesystem dependency |
| `src/app/debug/authoring-client.ts`                   | Small       | The browser half of the listing call                                                |
| `src/demo/maze.ts`                                    | Small       | Carry the source room's identity onto an assembled room                             |
| `src/app/debug/map-workbench.ts`                      | Large       | The tool itself                                                                     |
| `src/app/debug/debug-tools.ts`                        | Small       | One catalogue entry                                                                 |
| `src/app/debug/debug.css`                             | Small       | Layout for the two views side by side, and the diagram's own canvas                 |
| `test/unit/dev/tools/authoring/authoring-api.test.ts` | Small       | Its dependency fixture gains the listing method this change adds to the contract    |

## Execution Outline

1. **`vite.config.ts` — unwatch and invalidate.** Extend the derived path list to cover directory targets, and match with a predicate rather than a glob. After a successful save, drop the written file's module and the module holding that target's glob. Ordering matters only in that this lands before the tool: without it, every save from the tool reloads the tool.
2. **`dev/tools/authoring/authoring-api.ts` — the listing operation.** Add a listing dependency beside the read and write ones, implement it over the whitelisted directory, and route it for directory targets only. The path parser rejects a directory target with no name today, so the listing route is decided before that rejection rather than after it.
3. **`test/unit/dev/tools/authoring/authoring-api.test.ts`** — its fixture constructs the dependency object, so it gains the new method. Existing cases are unchanged in intent.
4. **`src/app/debug/authoring-client.ts`** — one call beside the other two, reshaping nothing.
5. **`src/demo/maze.ts`** — the assembled-room type gains the identity of the room file it came from, set where an assembled room is built from its source. This is the only edit outside the tool's own half.
6. **`src/app/debug/map-workbench.ts`** — the tool, following the decor workbench's shape: a form panel, a preview, an explicit save, an explicit reload. Built last because every seam it stands on now exists.
7. **`src/app/debug/debug-tools.ts` and `debug.css`** — the catalogue entry and the layout.
8. **`npm run verify`**, then open the tool and look at it.

## Implementation Notes

**The draft-to-preview chain.** Read the draft map source, resolve it against the shipped room library, and build a world from the result. Every failure along that chain is a message for the status line; the tool distinguishes only between "there is a message" and "there is not", because each thrown message already names the map and the rule.

**What the diagram draws.** The assembled floor's own cells, one colour per tile kind, plus the arrival, the way out, and each assembled room's bounds labelled with its identity and role. Nothing in the tooling being deleted by child 04 survives to be borrowed, so this is written fresh — which is also why it stays small: a canvas, a cell size, a colour table.

**The first-person view** stands the camera where the run arrives. It shares the frame loop the other workbenches use, which owns its own canvas, resize, error state and teardown; the tool supplies a scene per frame and owns nothing else.

**Re-drawing** rebuilds the world from the same draft. Because the world builder is the only source, the diagram and the first-person view move together by construction rather than by being told to.

**Saving** sends the draft through the endpoint under the map's own name. The endpoint refuses a file whose declared name is not the name it was saved as, so the name control and the save address are the same value.

**Playing** is unavailable whenever the draft differs from what was last loaded or saved, and says so on itself rather than leaving it to be discovered. Compare against the last known-saved source rather than tracking edits, so an edit that is undone re-enables it.

**The listing** is refreshed by an explicit control, matching every other workbench's reload button. Nothing refreshes it on the tool's behalf, including a save.

## Edge Cases

| Case                                                             | Expected Handling                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A slot names a room the library no longer answers                | The resolver's refusal reports and the save is unavailable; the slot keeps the name so it can be fixed |
| The draw count exceeds the pool or the free slots                | The map reader's refusal reports before anything is assembled                                          |
| A draw happens to leave no route to the way out                  | Assembly throws, the preview shows the message, and re-drawing is offered because another draw may not |
| The map has no main region                                       | Refused by the map reader; the preview stays empty rather than showing a partial floor                 |
| The listing is asked for while the development server is stopped | The call fails and the status line says so; the tool keeps the listing it had                          |
| A map is saved under a name whose file does not exist yet        | The endpoint creates it, and it appears in the listing once the listing is refreshed                   |

## Acceptance Criteria

1. A map's slots, pool and draw count can be edited in a development-only tool, and the floor those choices assemble is on screen beside them.
2. The floor is shown both from above and from inside it, and both are of the same draw.
3. Re-drawing changes which rooms landed where, in both views at once.
4. A map that contradicts itself, or that names a room nothing answers, reports before it can be saved, and the message names the map and the rule.
5. A draw that leaves no route to the way out reports as such and can be re-drawn.
6. Saving writes the map file and does not reload the tool.
7. A room file created while the tool is open appears in its listing once the listing is refreshed, without the development server being restarted.
8. The play action is unavailable while the draft differs from what is saved, says why, and otherwise opens the game at that map — as it was last saved.
9. The verification gate passes, and no test file is added.
