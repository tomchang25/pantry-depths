# The Map And Room Editor

Not goal-executable, and deliberately so. What this plan delivers is judged by whether the tool is usable, which is a person's judgement made while looking at it — the standing loop stops on exactly that, and a plan that claimed otherwise would be claiming its own acceptance could be automated.

## Goal

Give maps and rooms an editor, so that laying out a floor stops being a matter of typing coordinates into a file. A map and a room are authored content now, with a written form, a library, and two refusals; what they do not have is a surface where a person can see one while changing it. Every other authored value in this project earned that surface, and each time the reason was the same: a display number is wrong only in the medium that can show it.

## Requirements

1. A map is edited as a whole floor: which rooms are always present and which slot each takes, which rooms the pool holds, and how many are drawn. What is on screen while that is edited is the assembled floor, not a diagram of it.
2. A room is edited on its own, because it is its own file and may be used by more than one map: its extent, whether it holds bodies and how many and how fast they return, the business it holds if any, and how its cells come to exist.
3. A room whose cells are authored is drawn cell by cell. Anything else is typing coordinates with extra steps, which is what this tool exists to end.
4. Both refusals run before saving, not after. One reads what the file declares; the other reads one particular draw and asks whether that combination leaves a route to the way out. A draw that would fail is a thing an author needs to see while the pool is still in front of them.
5. What is previewed is what the game assembles, produced by the same assembler the game calls, and it can be re-drawn on demand because which rooms land where is drawn afresh every time.
6. A saved map can be played from the editor in one action, and the action is unavailable while the draft differs from what is saved. Playing a draft is not offered at all: what plays is the game, reading a file, and a file that has not been written is not a thing the game can read.
7. The tooling this replaces is deleted once this works, along with the content and rules that only it and its tests still reach.

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

**The room surface** holds one room's extent, its crowd or the absence of one, its role, and its structure. Choosing authored cells opens a grid the size of the room, painted with the eight tile kinds. A room is previewed as itself — a floor of one room — because a room does not know which map will use it or which side it will land on.

### What the preview is

The floor assembler takes a map and returns an assembled floor, and the editor calls it with the draft. There is no second implementation and therefore nothing to drift. Every call draws the pool afresh, so the control that re-draws is the same call again rather than a feature.

A room drawn on its own is the same assembler over a one-room map made on the spot. That is a small lie — no map is being edited — and it is the honest kind: what it shows is the room's own cells assembled by the code that will assemble them.

### Playing what was saved

One control, which opens the ordinary game at the saved map in a new tab. It is unavailable while the draft has unsaved changes, and the reason is stated on it rather than left to be discovered: what the game reads is a file.

This is the whole of the answer to "try it". An in-tool playtest was proposed once and cut, because a playtest that differs from the game in any respect is a second source of truth about how the game plays. Naming a saved map at the ordinary address has no such difference.

### What gets deleted

The tooling this replaces answers to a schema that no longer describes anything, and it keeps alive the last content and rules that only it and its tests still reach. Roughly five thousand three hundred lines across nine files, plus their unit tests. It is not deleted first: the new tool is written beside it and the old one goes when the new one works.

### The order this lands in

The map surface first, because it is the one that can be judged against a floor that already exists. Then the room surface without authored cells, then authored cells, which is the largest single piece and the one that benefits most from the rest being settled. Deletion last.

## Non-Goals

1. No playtest inside the tool, at any fidelity, for the reason stated above.
2. No new content vocabulary. No new tile kind, room role, slot, or structure kind appears because an editor made one convenient.
3. No weighting or conditions on a draw, and no repeated draws.
4. No generator. Which cells a generated room gets is the runtime's business and is not previewed as an authorable thing.
5. No editing of anything below a room. A structure, a crowd, or a set of cells is not separately addressable, so it is not separately editable.
6. No decor. That vocabulary stays where it is, unwired, until somebody decides it lives.
7. No tests. The tool is verified by opening it, which is the only way its actual subject can be judged.

## Acceptance Criteria

Every criterion below is judged by a person using the tool. None is automated, and that is the plan's own claim about itself.

1. A map can be built from an empty state — slots filled, a pool assembled, a draw count set — saved, and played, without a file being opened by hand.
2. A room can be created, given an extent, a crowd or none, a role or none, and a structure, saved, and then named by a map.
3. A room whose cells are authored can be painted with every tile kind, and what is painted is what the assembled floor shows.
4. Both refusals appear before saving, and each says which map or room and which rule.
5. The preview shows the assembled floor, and re-drawing changes which rooms landed where.
6. The control that plays the map is unavailable while the draft is unsaved, says why, and opens the game at that map when it is available.
7. The tooling and content this replaces is gone, and the verification gate passes without it.
8. No test file is added.

## Execution

Perishable: this records the codebase on 2026-08-01. Re-check every coordinate against live code before acting on it. What this plan was waiting for has landed — a room is its own file, both libraries are discovered rather than listed, and the endpoint reads and writes either by name. The library is at `dev/docs/archived/map_library.plan.md`. What a room file holds has since grown too, and `dev/docs/archived/room_contents.plan.md` is the record of it: a scatter declaration, a crowd of quantities rather than fixed numbers, a stated openness and wall mix on a carved room, water as a share, and a trench that only an authored room can place. A tool that edits a room now has all of that to show.

### What to build on

- `src/app/debug/debug-shell.ts` — `createDebugPage` gives the page and its landmarks. Take it unchanged.
- `src/app/debug/render-panel.ts` — `createRenderPanel` owns a canvas, its frame loop, its resize, its error state, and its teardown, and shares presentation image loading across concurrent panels. The caller supplies a scene per frame and owns nothing else.
- `src/app/debug/authoring-client.ts` — `loadCanonical` and `saveCanonical` are the only two calls needed, and neither reshapes what it carries.
- `src/app/debug/debug-tools.ts` — `DEBUG_TOOLS` is the catalogue; one entry, lazily importing the shell.
- `src/app/debug/decor-workbench.ts` is the smallest complete example of the shape at about 350 lines: a preview panel, a form, a save, a reload-from-canonical.

### What to call

- The floor assembler in `src/demo/maze.ts` takes a resolved map and returns an assembled floor. It is the preview, and calling it again is the re-draw.
- The map-file validator and the room-file validator in `src/content/maps/` are the first refusal; `validateDrawnFloor` in the same place is the second, and it takes an assembled floor rather than a map.
- A scene is built from an assembled floor by the demo's own scene projection in `src/demo/demo-scene.ts`. The entity workbench already reaches into that module for its own projections and is the precedent for how much of it a tool may use.

### What to delete, once the new tool works

`src/app/debug/floor-map.ts` (1154 lines), `src/content/floor/floor-validation.ts` (862), `src/app/debug/floor-authoring.ts` (843), `src/core/run-state.ts` (617), `src/app/debug/floor-workbench.ts` (575), `src/content/floors/provisional-floor-set.json` (481), `src/content/floor/floor-schema.ts` (354), `src/app/debug/floor-viewer.ts` (228), `src/content/floor/floor-catalog.ts` (200). With them: `test/unit/content/floor/` and `test/unit/core/run-state.test.ts`. Check `test/e2e/debug-route.spec.ts` before assuming it does not name a tool by id, and `src/content/combat/enemies.ts` stays — the demo still reaches it, and untangling that is nobody's work yet.

The `floorSet` target in `dev/tools/authoring/api-contract.ts` and its branch in the endpoint go at the same time, along with `dev/tools/floor-set/generator.ts` and its test if nothing else has claimed them.
