# The Map And Room Editor

Goal-Executable: yes

Every acceptance criterion below is judged by a person using the tool, and the claim above does not contradict that. What makes a plan goal-executable is that it left no decision for its own execution to take; opening the thing and looking is one of the three ways a criterion is already expected to be judged. An earlier draft of this plan conflated the two and declared itself unexecutable on the strength of it.

The last child is the exception and takes its own authorization. It deletes about six thousand lines and two commands, and a loop carrying the first three stops on a destructive action by its own guard — so the authorization that runs this plan continuously names the first three, and the fourth is asked for again once the tool it replaces has been used.

## Goal

Give maps and rooms an editor, so that laying out a floor stops being a matter of typing coordinates into a file. A map and a room are authored content now, with a written form, a library, and two refusals; what they do not have is a surface where a person can see one while changing it. Every other authored value in this project earned that surface, and each time the reason was the same: a display number is wrong only in the medium that can show it.

## Requirements

1. A map is edited as a whole floor: which rooms are always present and which slot each takes, which rooms the pool holds, and how many are drawn. What is on screen while that is edited is the assembled floor, not a diagram of it.
2. A room is edited on its own, because it is its own file and may be used by more than one map: its extent, whether it holds bodies and how many and how fast they return, the business it holds if any, and how its cells come to exist.
3. A room whose cells are authored is drawn cell by cell. Anything else is typing coordinates with extra steps, which is what this tool exists to end.
4. Both refusals run before saving, not after. One reads what the file declares; the other reads one particular draw and asks whether that combination leaves a route to the way out. A draw that would fail is a thing an author needs to see while the pool is still in front of them.
5. What is previewed is what the game assembles, produced by the same assembler the game calls, and it can be re-drawn on demand because which rooms land where is drawn afresh every time. Every view of one draw comes from that one assembly — two views built from two calls would be two different floors shown side by side as though they were one.
6. What the tool lists, and what its play action opens, are the files as they are on disk rather than a snapshot taken when the tool was loaded. The tool creates files: one that cannot see the file it just wrote is lying about its own library, and a play action that opens the previous version of a map is worse than no play action at all.
7. A saved map can be played from the editor in one action, and the action is unavailable while the draft differs from what is saved. Playing a draft is not offered at all: what plays is the game, reading a file, and a file that has not been written is not a thing the game can read.
8. The tooling this replaces is deleted once this works, along with the content and rules that only it and its tests still reach.

## Design

### Five principles carried from the plan this replaces

The tool-chain plan that owned this work is archived, but these five were the durable part of it and they still govern:

1. **Placement and assembly are separate.** Which parts compose a thing and how they are offset belongs to the thing; where it is put belongs to the placement. A placement may move an origin and may never move, add, remove, or reset a part. Without this, what an author assembles in a tool is not guaranteed to be what the game assembles, and the preview is worth nothing.
2. **A variant is a named identity, not an override.** Two things that differ are two entries, not one entry with a parameter. The cost is a longer catalogue; what it buys is that every combination in use has been assembled by somebody and looked at by somebody.
3. **Why a live preview is mandatory.** The first authored floor this project drew had its key pickups at roughly twice their size, floating at eye height. The value that caused it passed review, type checking, and every automated gate — it was wrong only in the medium that could show it. That is the entire reason these workbenches exist.
4. **Every authored value is editable and saves.** A number that can only be changed by editing source is a number nobody will ever tune. Attacks, decor, bodies, pickups, and carried props have all moved out on this rule; maps and rooms are the next.
5. **A preview is read-only.** It consumes settled content and has no authority over it. Nothing an author sees in a preview may become a source of truth, and writing content goes through the same mutation path the editor uses or it does not happen.

### Two surfaces, because there are two files

**The map surface** holds the slots, the pool, and the draw count, with the assembled floor beside them and a control that draws again. Choosing a room for a slot or for the pool picks from the library by name; it does not edit that room. The refusals report here, both of them, and saving is unavailable while either is unhappy.

**The room surface** holds one room's extent, its crowd or the absence of one, its role, and its structure. Choosing authored cells opens a grid the size of the room, painted with the nine tile kinds. A room is previewed as itself — a floor of one room — because a room does not know which map will use it or which side it will land on.

### What the preview is

The floor assembler takes a map and returns an assembled floor, and the editor calls it with the draft. There is no second implementation and therefore nothing to drift. Every call draws the pool afresh, so the control that re-draws is the same call again rather than a feature.

**One draw is shown two ways, from one assembly.** Seen from above, the floor answers which room landed in which slot, where the arrival and the way out fell, and what the scatter did to the ground — none of which a person standing inside a corridor can see. Seen from inside, at the game's own eye height, it answers whether a room is the right size to stand in and whether what fills it reads at all — which no diagram has ever answered. The two questions are both real and neither view answers the other, so the tool shows both; and because a re-draw changes the floor, they are built from one assembly rather than one each.

A room drawn on its own is the same assembler over a one-room map made on the spot. That is a small lie — no map is being edited — and it is the honest kind: what it shows is the room's own cells assembled by the code that will assemble them.

### What the library reads, and why saving no longer reloads the page

Every other authored file in this project is deliberately unwatched by the development server. The reason is that those files live where a module imports them, so a save looks to the server exactly like an edit, and the reload that follows throws away everything on screen that was not saved. The directories holding maps and rooms were the one exception, and the reason was equally good: the watcher was the only thing that noticed a file appearing in a library, and a library nothing notices additions to is not a library.

An editor makes that exception unbearable, because the tool doing the editing is the tool writing the files — every save would reload the page it was saved from. So the directories join the rest and stop being watched, and the two jobs the watcher was doing are given owners instead:

- **The listing is asked for, on demand, through the same development-only channel the tool saves through.** A button asks and nothing asks on the tool's behalf, which is the rule every other workbench already follows for reading a file back.
- **A save tells the development server that what it holds about those files is stale, and tells no open page.** Nothing on screen moves; the next page loaded — the game the play action opens — reads what was written.

**If the second cannot be arranged, the fallback is decided and needs no further discussion:** keep the directories watched, and let the tool survive the reload by recording in its own address which map or room was open. That is a worse tool, because a save then throws away an unsaved draft in the other surface, and it is not worse than a play action that opens the previous version of the file.

### Playing what was saved

One control, which opens the ordinary game at the saved map in a new tab. It is unavailable while the draft has unsaved changes, and the reason is stated on it rather than left to be discovered: what the game reads is a file.

This is the whole of the answer to "try it". An in-tool playtest was proposed once and cut, because a playtest that differs from the game in any respect is a second source of truth about how the game plays. Naming a saved map at the ordinary address has no such difference.

### What gets deleted

The tooling this replaces answers to a schema that no longer describes anything, and it keeps alive the last content and rules that only it and its tests still reach. Roughly five thousand three hundred lines across nine files, plus their unit tests, plus three things a first count missed: a small type that a live piece of presentation content still reads and so has to move rather than die; two command-line tools and the two commands that name them; and the one browser acceptance test that opens the tool being removed, which is pointed at the new one instead.

It is not deleted first: the new tool is written beside it and the old one goes when the new one works.

### Children

All four children have shipped and this plan is complete. The child overview and execution notes were cut as each landed, per the forward-only rule.

## Non-Goals

1. No playtest inside the tool, at any fidelity, for the reason stated above.
2. No new content vocabulary. No new tile kind, room role, slot, or structure kind appears because an editor made one convenient.
3. No weighting or conditions on a draw, and no repeated draws.
4. No generator. Which cells a generated room gets is the runtime's business and is not previewed as an authorable thing.
5. No editing of anything below a room. A structure, a crowd, or a set of cells is not separately addressable, so it is not separately editable.
6. No decor. That vocabulary stays where it is, unwired, until somebody decides it lives.
7. No deletion from the editor, and no delete verb on the development-only writer it saves through. That writer gains one listing operation and nothing else: its whitelist is the only thing that has ever kept it honest, and removing a file is done by removing the file.
8. No tests. The tool is verified by opening it, which is the only way its actual subject can be judged.

## Acceptance Criteria

Every criterion below is judged by a person using the tool. None is automated, and that is the plan's own claim about itself.

1. A map can be built from an empty state — slots filled, a pool assembled, a draw count set — saved, and played, without a file being opened by hand.
2. A room can be created, given an extent, a crowd or none, a role or none, and a structure, saved, and then named by a map.
3. A room whose cells are authored can be painted with every tile kind, and what is painted is what the assembled floor shows.
4. Both refusals appear before saving, and each says which map or room and which rule.
5. The preview shows the assembled floor from above and from inside it, both of one draw, and re-drawing changes which rooms landed where.
6. The control that plays the map is unavailable while the draft is unsaved, says why, and opens the game at that map when it is available.
7. Saving does not reload the tool, and a room created in the tool appears in its library listing once that listing is refreshed — neither needing the development server restarted.
8. The play action opens the map as it was last saved rather than as it stood when the tool was opened.
9. The tooling and content this replaces is gone, and the verification gate passes without it.
10. No test file is added.
11. A map or a room can be started from nothing and copied from an existing one, and a save says which of the two it is about to do before it does it.

## Execution

Perishable: this records the codebase on 2026-08-01. Re-check every coordinate against live code before acting on it.

What this plan was waiting for has landed — a room is its own file, both libraries are discovered rather than listed, and the endpoint reads and writes either by name. The library is at `dev/docs/archived/map_library.plan.md`. What a room file holds has since grown too, and `dev/docs/archived/room_contents.plan.md` is the record of it: a scatter declaration, a crowd of quantities rather than fixed numbers, a stated openness and wall mix on a carved room, water as a share, and a trench that only an authored room can place. A tool that edits a room now has all of that to show.

### What to build on

- `src/app/debug/debug-shell.ts` — `createDebugPage` and `createDebugPanel` give the page and its landmarks. Take them unchanged.
- `src/app/debug/render-panel.ts` — `createRenderPanel` owns a canvas, its frame loop, its resize, its error state, and its teardown, and shares presentation image loading across concurrent panels. The caller supplies a scene per frame and owns nothing else.
- `src/app/debug/authoring-client.ts` — `loadCanonical` and `saveCanonical`, neither of which reshapes what it carries. Child 01 adds a third call beside them.
- `src/app/debug/debug-tools.ts` — `DEBUG_TOOLS` is the catalogue; one entry per tool, lazily importing it.
- `src/app/debug/decor-workbench.ts` is the smallest complete example of the shape at 346 lines: a preview panel, a form, a save, a reload-from-canonical.

### What to call, and three things an earlier draft of this plan had wrong

- The floor assembler is `buildDemoFloor` in `src/demo/maze.ts` (line 935). It takes a `ResolvedMap`, returns a `DemoMaze`, and re-draws the pool on every call.
- **`createDemoScene` in `src/demo/demo-scene.ts` (line 3288) takes a `DemoWorld`, not a `DemoMaze`.** An earlier draft of this plan said a scene is built from an assembled floor, and it is not. The only clean route to a scene is `createDemoWorld(map)` in `src/demo/world.ts` (line 776), which calls `buildDemoFloor` itself — so one `createDemoWorld` call is the single source for both views, or the diagram and the first-person view show two different draws. This is what requirement 5's second sentence exists to forbid.
- **The second refusal is two functions, not one.** `validateDrawnFloor` and `validateDrawnWalk` are both called at the end of `buildDemoFloor` (lines 1050-1051). `openStrandedGround` runs just before them and repairs stranded ground, so in practice the one that fires is `validateDrawnFloor` — no route to the way out.
- **`MAP_TILE_KINDS` has nine entries, not eight**: `open`, `border`, `stone`, `wood`, `water`, `barricade`, `filled`, `mortar`, `trench`. The trench arrived with `room_contents.plan.md`'s fifth child.
- The first refusal is `parseMapSource` and `parseRoomSource` in `src/content/maps/map-schema.ts` and `room-schema.ts`, plus `checkSideFit` inside `resolveMap` in `map-resolver.ts` — the last of which is the only one that can see an extent.
- The draft path to a preview needs no new content-layer API: `parseMapSource(draft)` → `resolveMap(source, new Map([...ROOM_LIBRARY, [draftRoom.id, draftRoom]]))` → `createDemoWorld(resolved)`. Both refusals then run inside that chain, which is how requirement 4 is met without either being called explicitly.
