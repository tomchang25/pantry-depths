# Three Kinds Of Surface, Declared

Goal-Executable: yes

## Goal

Make the scene contract carry three kinds of surface as three declared things: the floor's built structure, a mark painted into the ground, and a mark painted onto a wall. Today only the ground mark is declared. Built structure exists as a caching decision nobody wrote down, and the wall mark does not exist at all — a body driven into a wall leaves a billboard picture that reads as a mark only because the renderer happens to cull pictures seen from behind their own face.

## Requirements

1. A mark on a wall is a kind of thing the scene can carry, distinct from a picture standing in front of a wall. The two are drawn differently and fail differently, and today one impersonates the other, so every future wall mark inherits a billboard's sorting, tinting, and culling by accident rather than by choice.
2. What a floor's built structure is, and what forces it to be rebuilt, is stated in the scene contract rather than left implicit in a cache. The boundary is already load-bearing — a fixture that appears when a floor's main objective completes has to force a rebuild, and the only thing saying so today is a note beside the call that does it — so a reader who does not already know the rule cannot discover it.
3. The three are told apart by what they are attached to, not by how they are drawn: built structure belongs to the floor and outlives a frame; a ground mark is painted into the ground at sub-cell resolution; a wall mark is painted onto one face of one wall.
4. Nothing on screen changes. This plan describes the picture correctly; it does not change it, and a visible difference is a defect rather than an improvement.

## Design

### The three channels

| Channel         | Attached to            | Lifetime                                        | Told by                                                  |
| --------------- | ---------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Built structure | The floor's own layout | Survives frames; rebuilt when the floor changes | Walls, floor materials, and the fixtures that stand up   |
| Ground mark     | A point on the ground  | A frame, or a countdown the simulation owns     | Sub-cell shapes shaded as part of the ground they sit on |
| Wall mark       | One face of one wall   | As long as whatever left it                     | Flat against the plane, hidden from behind that plane    |

The vocabulary already exists for the middle row and is the model for the other two: a ground mark is deliberately not one more ground-material overlay, because an overlay is one material per cell and a warning drawn through that channel would erase whatever blood had been spilled on the cells it crosses and put it back when it expired. The same argument makes a wall mark its own channel rather than one more billboard.

### Why the wall mark cannot stay a billboard

A billboard is a picture that turns to face the viewer, sorted against a depth buffer, tinted by distance, and positioned in the room. A wall mark does none of those things: it lies in the plane of a wall face, it is visible from one side only, and it narrows as the view across that face goes oblique. What holds it together today is that the picture pipeline was taught to cull a picture seen from behind its own face and to narrow it with the viewing angle — a rule that exists for wall-mounted decoration and that a blood mark borrows.

The borrowing works and is not a bug. It is a shape nobody is defending: the next thing that wants to be on a wall — a scorch from a shell, a crack around a break, a stain under a fixture — arrives at the same borrowed rule and has to rediscover why a picture behaves that way. Declaring the channel costs one contract entry and settles it once.

### Why built structure needs a declared rebuild trigger

Rebuilding a floor's walls, materials, and standing fixtures every frame was measurably wasteful, so it is cached against the floor. That makes correctness depend on a question the contract does not ask: what counts as a change to the floor. Opening the descent when a main objective completes changes the built structure, so it forces the rebuild by hand; a future fixture that appears, moves, or breaks has to know to do the same, and nothing tells it.

Stating the channel states the obligation with it. The rule is one sentence — a change to what is built forces a rebuild, and everything else is free — and the value of writing it down is that the next fixture inherits it instead of finding out.

### Children

| Child | Focus                                                | Form             |
| ----- | ---------------------------------------------------- | ---------------- |
| 01    | Wall marks become their own channel                  | Spec via `/goal` |
| 02    | Built structure and its rebuild trigger are declared | Spec via `/goal` |

Landing order is 01 then 02. They are independent, and 01 is first because it is the one that changes a data path rather than only a contract, so anything it disturbs is found while the second change is still small.

## Non-Goals

1. Authored decor. The decor preset vocabulary stays where it is and is not wired into the demo here; it belongs with the map contract that replaces the floor schema, and pulling it forward would commit that contract before its open questions are answered.
2. No new shapes, marks, or fixtures. Nothing gains a kind it does not already have.
3. No change to how anything is drawn. Sorting, tinting, fog, and lighting behave as they do today.
4. No decision about runtime 3D. This plan describes the surfaces the current renderer already draws.
5. No tests, per the standing test contract for this half of the repository.

## Acceptance Criteria

1. A body driven into a wall leaves the same mark, in the same place, at the same size and fade, described as a wall mark rather than as a picture.
2. A wall mark is invisible from behind its own wall and narrows as the view across that face goes oblique — the behaviour it has today, now a property of its channel rather than of the picture pipeline.
3. Opening a floor's descent mid-run still makes the stairs appear on the frame the objective completes.
4. A floor played start to finish shows no visible difference from before the change.
5. The project's verification gate passes, and no test file is added or modified.

## Execution

Perishable: this records the codebase on 2026-07-31. Re-check every coordinate against live code before acting on it; a stale line here is expected, not a defect in the plan.

Both children are demo-half work — the surfaces are `src/presentation/` and `src/demo/` — so `dev/agent_rules/implement_operations.md` applies: the spec is a short architectural note, not a file inventory, and verification is `npm run verify` plus playing it.

### Child 01 — Wall marks become their own channel

- `src/presentation/render-scene.ts` — the scene contract. `RenderFloorDecal` (from about line 153) and `RenderFloorDecalShape` (about line 111) are the model to copy: a `Readonly<{}>` type with a doc comment stating why it is not one of the neighbouring channels, plus an optional `readonly` field on `RenderScene` (the field list runs to about line 400). Add `RenderWallMark` and a `wallMarks?` field. A wall mark needs the cell, which face of it, the position across and up that face, a size, an asset id, and an opacity — read the current arguments off `wallMark()` below rather than inventing them.
- `src/demo/demo-scene.ts` — `wallMark()` at about line 1482 builds the `RenderSprite`; the comment above it (about line 1069) already describes the thing as a decal and explains why a soft body cannot be one. `projectDemoDeath()` returns `{ blobs: [], sprites: [wallMark(death)] }` for the `splattered` cause; the sibling branch at about line 1367 returns `[]` for the same cause in the blob path and explains why. The projection returns `DemoEntityProjection`, so that type gains the new list and every construction site of it needs the empty case.
- `src/presentation/canvas-gameplay-renderer.ts` — the wall-facing rule lives in the sprite pass; the comment at about line 1984 reads "Culls a wall decoration seen from behind its own face and narrows it as the view turns oblique". That is the behaviour to carry over. Whether the new channel is a distinct pass or the same code reached through a different entry is an implementation choice, provided the drawn result is identical.
- `src/app/debug/entity-workbench.ts` shares the living and death projection paths with the demo rather than imitating them, so it consumes `DemoEntityProjection` directly and must keep compiling and keep drawing the splattered death.

### Child 02 — Built structure and its rebuild trigger are declared

- `src/demo/demo-scene.ts` — the cache is described at about line 3228 ("Walls, floor materials and structures were being rebuilt from scratch sixty times a second"); the fixtures it covers are at about line 2039 ("The structures that stand up: the altar and the mouth of the stairs"); and about line 2911 records that lights are rebuilt every frame while structure is cached, which is the boundary being written down.
- `src/demo/world.ts` at about line 404 states what the structure is derived from ("The scene's walls, floor materials and structures are derived from those and nothing else"). That sentence is the rebuild rule already in prose; the change is to make the contract carry it.
- `src/demo/tasks.ts` at about line 100 is the one existing caller that forces a rebuild, when the descent unlocks. It is the worked example for whatever the declared trigger turns out to be, and it must keep working.
- The deliverable is a named boundary in the scene contract plus the obligation stated where a future fixture will read it. It is not a rewrite of the cache: if the cache is already correct, this child leaves its behaviour alone and only makes its rule discoverable.
