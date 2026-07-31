# The Map Contract And Its Loading Path

Goal-Executable: yes

## Goal

Make a floor into a file the game can be pointed at. Today a floor is generated fresh at the start of every run, exists only in memory, and sits on a grid whose size is a constant compiled into thirty-odd loops — so nothing can be authored, nothing can be saved, and no floor can be a different shape from any other. This plan delivers the contract, the validation, and the loading path, and stops short of authoring: the one map it ships describes exactly what the generator already produces, so the whole change is proved by a run playing the way it plays today.

## Requirements

1. The grid's extent is a property of the map rather than a constant. Everything that draws, walks, sees, or shoots reads it from the map it was handed — today thirty-odd loop bounds and four flat indices carry the number directly, and each is a place where an authored map of another size would fail silently rather than loudly.
2. Both the main region and the rooms hanging off it are rooms. They differ by what they hold and how they are built, never by kind. Today only the four side rooms are rooms and the main region is simply the middle of the grid, which is why nothing that varies per region has anywhere honest to live.
3. A room owns its own extent, its enemy cap, and its respawn rate. These are room properties because a body walks between rooms freely: a cap owned by the whole map can state a total but can never say what any part of it holds, and the difference is exactly what a boss room or an empty corridor needs to express.
4. A room's structure is either generated or authored cell by cell, declared by the room itself. Generation belongs to a room and not to a map, so one map can carry an authored room beside a generated one without either knowing the other exists.
5. A map names which rooms are always present, which are drawn from a pool, and how many are drawn, with no room drawn twice. A pool is what makes two runs differ; without one an authored map is the same room order forever.
6. A map that cannot produce a legal floor is refused twice, and the two refusals catch different things. A pool smaller than its draw count is wrong while the file sits still; a particular draw that leaves no route to the way out is only wrong once it has been drawn. Refusing only at rest ships a map that fails mid-run, and refusing only at load lets a broken file be saved and handed on.
7. The game plays a named map from the address it is already played at. A surface that plays the game but is not the game is a second source of truth about how the game plays, and this project has already ruled that a preview may never become one.
8. Nothing observable changes. The map this plan ships reproduces what the generator produces today, including that its main region is different on every run, and the plan is judged by a run being indistinguishable rather than by the contract reading well.

## Design

### The four words, fixed once

| Word      | Means                                     | Note                                                                       |
| --------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| **map**   | One piece of content: a file              | What the current generator produces an unnamed instance of                 |
| **room**  | A block inside a map, large or small      | Today only the four side rooms qualify; this plan makes the centre one     |
| **floor** | One run's instance of a map, at one depth | Already in use for the thing a run descends through                        |
| **level** | The run's difficulty number               | Already taken, on screen at all times, and not available for anything else |

The word the runtime currently uses for a map is retired in the same change. It described a generated warren, and a map that can be authored, drawn from, and named is not one; keeping the old word would leave the loading path reading as though it loaded a labyrinth.

### What a map holds

- Its identity, by name — the name the address bar uses.
- Its rooms that are always present, each with the slot it occupies.
- Its pool of optional rooms, and how many are drawn from it. Draws never repeat within one floor.
- Nothing about difficulty, depth, or the run. A map is content; a floor is one run's use of it.

### What a room holds

- Its extent, in cells.
- Its enemy cap and its respawn rate.
- Its role, when it has one — what business it holds.
- Its structure: generated, or authored cell by cell.

A room's tile vocabulary is the one the runtime already uses. Nothing invents a second set; a map that needed a tile the game cannot walk on, see through, or shoot past would be describing a game that does not exist.

### Why the extent moves onto the map

The current constant is not merely a number in the wrong place. It is a promise that every floor is the same shape, and thirty loops were written against that promise. Moving it now costs a mechanical pass over those loops; moving it after maps are authored costs the same pass plus a migration of every file that assumed the old shape, because a map cannot state an extent it is not allowed to differ on.

The hazard that comes with it is not the size but the squareness. A flat index written with the wrong one of two extents type-checks perfectly and is wrong only on a map that is not square — which will be the first interesting map anybody authors. The defence is that the stride is never exposed: one accessor turns a coordinate into an index, and nothing outside it multiplies by an extent.

The second hazard is that an authored map can be slow. The scene is rebuilt by sweeping the whole grid several times, so area is a cost somebody can now author into existence without noticing. A stated maximum area in the validator is what keeps that a refusal instead of a discovery.

### Why validation happens at both ends

The two ends know different things. At rest, a map is a set of declarations, and the errors visible there are contradictions between them — a draw count larger than its pool, a room whose extent does not fit the slot it claims, a map with no way out. At load, a floor is one particular draw, and the errors visible there are properties of that draw — a route to the way out that this combination happens not to leave, or a pool of pools whose members are individually fine.

Refusing at only one end is not half the protection, it is the wrong protection: a file that passes at rest and fails on the seventeenth run is worse than one that never saved.

### Why the game loads it, not a workbench

The obvious place to try a map is the tool that authored it, and it is the wrong place. A map is played inside a floor assembled from several rooms, and a tool that shows one room in isolation is showing something the game never draws. The plan this one grew out of admitted that in its own words and then proposed doing it anyway.

Naming a map in the address costs one parameter and one branch, and it has no seam at all, because what plays the map is the game. The cost is real and worth naming: an unsaved draft cannot be played this way, so the authoring loop becomes save, then look.

### Children

| Child | Focus                                                      | Form             |
| ----- | ---------------------------------------------------------- | ---------------- |
| 04    | The game plays a named map, and today's floor ships as one | Spec via `/goal` |

Landing order is 01 → 02 → 03 → 04, and it is not negotiable: each is a refactor whose correctness is judged by the run being unchanged, and two of them landing together would make an unchanged run impossible to attribute.

## Non-Goals

1. No editor. Authoring a map is the tool chain's work and keeps its own plan; this one ships the contract the editor will write into.
2. No new generator. The existing generation is called through a room instead of through the floor and is otherwise untouched.
3. No authored map. The format supports authored cells and no map here uses them — the first consumer is a hand-written test map, deliberately outside this plan. That code path therefore ships unexercised, which is stated rather than hidden.
4. No removal of the stairs, and no change to depth, descent, difficulty, or the floor's tasks. That is a design change and this is a mechanical one; landing them together would make a change in feel unattributable.
5. No new room kinds, no boss room, no new tile.
6. No decor, and no wiring of the authored decor vocabulary into anything.
7. No deletion of the old floor tooling. It answers to the old schema and dies when its replacement works, which is the tool chain's change to make.
8. No tests. The validator ships uncovered, verified by the one map loading and by the run being unchanged.

## Acceptance Criteria

1. A run started with no map named plays exactly as it does today: the same floor shape, the same rooms, the same crowd, the same feel.
2. A run started with the shipped map named in the address is indistinguishable from the above, including that its main region differs on every run.
3. No loop bound, index, or extent outside the map module reads a compiled-in grid size; every one reads the map it was given.
4. The main region reports as a room, and the enemy cap and respawn rate in force at any point are the ones belonging to the room the body is standing in.
5. A map whose draw count exceeds its pool is refused when saved, naming which map and which number; a drawn floor with no route to the way out is refused when loaded, naming the draw.
6. A map declaring an area past the stated maximum is refused rather than loaded slowly.
7. The verification gate passes at every child, and no test file is added or modified.

## Execution

Perishable: this records the codebase on 2026-07-31. Re-check every coordinate against live code before acting on it; a stale line here is expected, not a defect.

Children 01, 02 and 04 are demo-half work — the surface is `src/demo/` and `src/app/` — so `dev/agent_rules/implement_operations.md` applies and the spec is a short architectural note. Child 03 lands in `src/content/`, which is the other half and keeps full ceremony; it still adds no tests, per Non-Goal 8 and the standing rule that a new test needs to be asked for in as many words.

The whole plan is judged against a run that has not changed. `npm run capture` is the instrument: it seeds `Math.random`, drives the same debug keys, and writes `capture-output/latest/` plus a contact sheet putting the previous run beside the latest. It asserts nothing and judges nothing — read the pictures.

### Child 04 — The game plays a named map

- `src/app/app-route.ts` resolves the ordinary and debug surfaces from a pathname; the map name is a query parameter, which that function deliberately does not look at. Decide whether it grows the responsibility or the surface reads its own parameter, and prefer whichever leaves the route function still answering one question.
- `src/app/main.ts` boots the ordinary surface by lazily importing `@/demo/demo-surface`; the map name has to reach the mount call.
- `src/demo/maze.ts` — `generateDemoMaze()` at line 587 is today's only floor source. The new path assembles a floor from a map; the old one becomes the case where the map's main region is a generated room, so there is one path and not two.
- The shipped map declares one generated main region and the four existing side rooms by role. It does not freeze a particular floor: the main region is generated per run, which is what makes Acceptance Criterion 2 the same run as Acceptance Criterion 1.
- `TODO.md` carries the `[map_contract]` line pointing here; cut it when the last child ships.
