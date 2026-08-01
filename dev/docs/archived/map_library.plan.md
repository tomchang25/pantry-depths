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

**It could not be finished here, and it moved.** The sandbox loads, is discovered rather than imported, and holds nobody — every part of it this plan is responsible for. What it is not is empty: the code that assembles a floor scatters pools, caltrops, emplacements and loose kit into the main region from fixed constants, so an eleven-square room receives a thirty-five-square room's quantity, and nothing a room can declare says otherwise. Making it say so means moving those constants onto the room, which is a change to how a floor is assembled and is this plan's second non-goal. So the sandbox and the criterion asking it to be empty moved to `room_contents.plan.md`, which owns what a room holds, and this plan closed at two children.

### Children

| Child | Focus                                                             | Form                                                         |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| 01    | Rooms become their own files, and reading splits from resolving   | `map_library_01_rooms_are_files.implementation_spec.md`      |
| 02    | Maps and rooms are discovered, and the endpoint addresses by name | `map_library_02_discovery_and_naming.implementation_spec.md` |

Both have shipped and both specs are archived. The third child — the sandbox — moved to `room_contents.plan.md` for the reason above.

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
6. The endpoint reads and writes a map or a room chosen by name, and refuses a name that is not a plain slug or that would reach outside its directory.
7. Adding a map file or a room file to the working tree makes it available without any source file being edited.
8. The verification gate passes at every child, and no test file is added.

Every one of these was met. The criterion asking the sandbox to play an empty room moved to `room_contents.plan.md` with the sandbox itself.
