# A Library Of Maps And Rooms

Goal-Executable: yes

## Goal

Turn the one map the game can play into a library it can be pointed at. Today a room exists only inside the single map that carries it, that map is the only one the address bar can name, and the file it lives in is the only one the authoring endpoint can write — so a second map cannot be made, and a room cannot be shared by two maps that both want it. This plan makes a room its own file, a map a list of names, and the endpoint able to address either by name, then ships a second map to prove it.

## Requirements

1. A room is its own file, named by its own identity, and a map names the rooms it uses rather than carrying them. Rooms are the unit that gets reused — a boss room, an arena, a corridor — and a room locked inside one map has to be copied to be used twice, which makes every later edit two edits.
2. Reading a map and resolving it are two operations, not one. The endpoint writes a validator's return value verbatim into the file it validated, so a validator that resolved names into rooms would write a file naming no rooms, which its own next load would refuse. What validates answers the file's shape; what resolves answers the runtime's.
3. A map naming a room that does not exist is refused where the map is read, and the refusal names both the map and the missing room. A room no map names is not an error — a library holds what it holds.
4. A room may state that it holds no bodies at all. Every room today declares a cap, a starting count, and a respawn interval, and a room meant to be empty has no honest way to say so: a zero cap with a respawn interval still declares a rate for something that never happens.
5. Both maps and rooms are discovered rather than listed in code. The editor this unblocks creates files; a library that needs a source edit to notice one is a library the editor cannot add to.
6. The endpoint addresses a map or a room by name, and refuses a name that would escape its directory or that is not a plain slug. It is a development-only endpoint that writes to the working tree, and the whitelist is the only thing that has ever kept it honest.
7. What plays today keeps playing identically. The existing map is migrated, not redesigned, and a run started with no name or with its name is the run it is now.

## Design

### What moves, and what does not

| Piece                          | Today                           | After                                                  |
| ------------------------------ | ------------------------------- | ------------------------------------------------------ |
| A room's extent and crowd      | Inline in the map that uses it  | Its own file, named by its identity                    |
| A map's rooms                  | The rooms themselves            | The names of rooms                                     |
| The slot each fixed room takes | On the placement                | Unchanged                                              |
| The pool and the draw count    | Lists of rooms, and a number    | Lists of names, and a number                           |
| Every validation rule          | One function over the whole map | Split by what it can see: names, then resolved extents |

Nothing about how a floor is assembled changes, and nothing about what the runtime is handed changes. The runtime keeps receiving a map whose rooms are present; the difference is that it receives it from a resolver rather than from a parser.

### The two operations, and why the split is not optional

The endpoint's contract is that a validator answers the shape its file holds, and that rule was written because breaking it once took the debug hub down. A map file holds names. So the function that validates a map for saving must answer names, and the function that turns names into rooms is a second one, run when a floor is about to be built.

That split lands the validation rules in two places, by what each can see:

- **Reading a map file** sees names, a slot for each fixed placement, a pool, and a draw count. It can refuse a draw larger than its pool, a draw larger than the free slots, two rooms in one slot, a repeated name, a missing main region, and an area past the maximum.
- **Resolving a map against the library** sees extents for the first time. It can refuse a name nothing answers, and it is the only place that can check whether a room fits the slot it could land in.

A room file validates on its own: its extent, its crowd if it declares one, and — when its cells are authored — that no water encloses a region.

### A room that holds nobody

`crowd` becomes optional. A room that omits it holds no bodies, spawns none, and never tops up. This is not a convenience: it is the difference between a room saying "nothing lives here" and a room saying "at most zero bodies live here, and another arrives every five seconds", and only one of those is a thing an author can mean.

### The second map

A sandbox: eleven cells square, one main region that fills it, floor throughout inside a wall ring, no crowd, no pool, nothing drawn. It exists to be somewhere to stand — the first thing that wants it is measuring what a large built structure costs to draw, and a floor with a generated warren and twenty bodies in it cannot measure that.

It is also the proof this plan works, because it is a map the runtime discovers rather than imports, and its room is a file rather than a passage inside a map.

### Children

| Child | Focus                                                             | Form             |
| ----- | ----------------------------------------------------------------- | ---------------- |
| 01    | Rooms become their own files, and reading splits from resolving   | Spec via `/goal` |
| 02    | Maps and rooms are discovered, and the endpoint addresses by name | Spec via `/goal` |
| 03    | The sandbox map ships and plays                                   | Spec via `/goal` |

Landing order is 01 → 02 → 03. The first is a contract change proved by the existing run being unchanged; the second replaces how the contract's files are found; the third is the first thing that could not have existed before either.

## Non-Goals

1. No editor. This plan makes the library the editor writes into and stops there.
2. No change to how a floor is assembled, drawn, walked, or fought in.
3. No new tile kind, no new room role, no new slot.
4. No weighting, no repeated draws, no conditions on a draw. A draw is still a number of distinct rooms from a pool.
5. No sharing of anything below a room. A structure, a crowd, or a set of cells is not separately addressable.
6. No removal of the stairs and no change to depth, difficulty, or a floor's tasks.
7. No new tests. Existing tests whose subject this moves are updated or deleted as part of the change, which the standing contract already permits without asking.

## Acceptance Criteria

1. A run started with no map named, or with the existing map named, plays exactly as it does today: the same regions, the same side rooms, the same crowd, the same feel.
2. The existing map names its rooms instead of carrying them, and every room it names is a file whose name is that room's identity.
3. A map naming a room nothing answers is refused when the map is read, and the message names the map and the missing room.
4. A room no map names loads without complaint.
5. A room declaring no crowd holds no bodies at the moment the floor is built and never gains one however long the run lasts.
6. Starting the game with the sandbox named plays an empty walled room, eleven cells square, with nothing in it and nothing arriving.
7. The endpoint reads and writes a map or a room chosen by name, and refuses a name that is not a plain slug or that would reach outside its directory.
8. Adding a map file or a room file to the working tree makes it available without any source file being edited.
9. The verification gate passes at every child, and no test file is added.

## Execution

Perishable: this records the codebase on 2026-08-01. Re-check every coordinate against live code before acting on it.

Child 01 and 02 land mostly in `src/content/` and `dev/tools/`, which keep full ceremony; child 03 is a content file plus a look. No child adds a test. `test/unit/dev/tools/authoring/authoring-api.test.ts` asserts the target whitelist and will break when the targets change — updating it is not adding a test and needs no permission, per `dev/agent_rules/test_operations.md`.

### Child 01 — Rooms become their own files

- `src/content/maps/map-schema.ts` is 490 lines and holds everything. The pieces that move to a room file's own validator: `parseRoom` (about line 263), `parseCrowd` (134), `parseStructure` (243), `parseAuthoredCells` (152), `waterEnclosesRegion` (184), and `MIN_ROOM_EXTENT` (54). The pieces that stay with the map: `parsePlacement` (293), `parseMapSource` (346), and `MAX_MAP_AREA` (51).
- `checkSideFit` (about line 311) reads `room.width` and `room.height`, so it cannot run at map-read time any more. It moves to the resolver, and the loop at about line 420 that checks every pool room against every free slot moves with it — that loop's reasoning still holds and does not need re-deriving.
- New types: a room's file shape, a map's file shape naming rooms, and the resolved map the runtime already consumes. Keeping the resolved type structurally identical to today's `MapSource` is what holds the churn in `src/demo/` to a type name.
- `validateDrawnFloor` (about line 444) is untouched. It already takes a `DrawnFloor` rather than a map.
- `src/content/maps/pantry-depths.map.json` holds five rooms inline: one main region and four in the pool. Each becomes its own file; the map keeps `name`, `width`, `height`, `draw`, and the slots.
- `src/demo/maps.ts` parses at module load; it now resolves as well. `src/demo/maze.ts` `buildDemoFloor` (about line 763) and `src/demo/world.ts` `createDemoWorld` (about line 755) both take `MapSource` and want the resolved type.
- `dev/tools/authoring/authoring-api.ts` `validateSource` (about line 102) has a `map` branch at about line 141 calling `parseMapSource`; it must call the map-file validator, not the resolver.

### Child 02 — Discovery and naming

- `dev/tools/authoring/api-contract.ts` holds `CANONICAL_AUTHORING_PATHS`, a flat map of target to one path. `map` points at one file. The whitelist becomes directory-shaped for maps and rooms while every other target keeps its single path — do not convert the targets that do not need it.
- `dev/tools/authoring/authoring-api.ts` `parsePath` (about line 79) splits a pathname into a target and an operation and refuses anything with a third segment. A name is that third segment for the two directory targets. `createFilesystemDependencies` (about line 246) resolves paths from the whitelist; a name must be checked against a slug pattern before it reaches a path join, and the map name pattern already in the schema (`/^[a-z][\da-z-]*$/`, about line 349) is the one to reuse.
- `src/app/debug/authoring-client.ts` `loadCanonical` and `saveCanonical` take a target; they gain an optional name.
- `src/demo/maps.ts` currently holds `MAPS` as a one-element array built from a static import. Discovery replaces it. `import.meta.glob` with eager JSON import is the Vite-native way and is not used anywhere in this repository yet, so it is a new pattern: check that `vite-node` resolves it for `dev/tools/`, and expect the dependency cruiser to report the discovered JSON as orphan modules, which is a warning rather than an error and is worth one sentence in the report.
- The room library needs a home. `src/content/` may import only content and core, so both the library and the resolver belong beside the schema in `src/content/maps/`; `src/demo/maps.ts` keeps only the question of which name the address bar may use.

### Child 03 — The sandbox

- `src/content/rooms/` gains a room: eleven by eleven, `{ generated: "open" }`, no crowd. Eleven includes the wall ring, so nine by nine of floor.
- `src/content/maps/` gains `sandbox`: eleven by eleven, one fixed placement in the main slot naming that room, an empty pool, a draw of zero.
- The margin check in the resolver computes `(gridAlong - mainAlong) / 2`, which is zero here — an integer, and legal. With no side rooms nothing else is checked.
- Verify by opening it: the address names the sandbox, the run starts, the room is empty, and it stays empty. `npm run capture` is available but this one is judged by standing in it.
