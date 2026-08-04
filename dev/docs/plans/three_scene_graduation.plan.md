# Graduating The Three.js Runtime Into The Game

> **Authorized 2026-08-03.** The spike that this plan waits on returned a viable verdict, given by the author with the experiment open: the Three.js runtime reproduces the whole game view well enough to become the game. That verdict is this plan's authorization and its only one.

## Goal

Make the Three.js runtime the way the game is drawn, and delete the two things it replaces: the ray-marched renderer and the interim projection layer that feeds it. The spike answered whether a replacement was worth planning; this plan is the replacement, and its whole value is that the game ends with one renderer rather than two.

## Requirements

1. The shipped game draws through the new runtime and nothing else. Not two renderers behind a preference — a switch means every future change to the picture is made twice and judged never, which is the cost the spike was run to avoid paying permanently.
2. Nothing a player does changes: the same keys, the same mouse handling, the same pause, the same run flow, the same sounds, the same readouts. This is a change of what draws, not of what plays.
3. Sound, readouts, pointer handling, the run's own screens, the development instruments, and the filming stage keep their present owner. The runtime learns none of them — the experiment lacks all of them because it is a debug tool, and answering that by teaching the renderer would make the renderer the surface.
4. Every copy the experiment made of a shipped module is retired before the plan ends: the procedural texture generators, the block skeleton asset and its clip and weapon names, and the sprite set. A graduation that keeps its copies leaves two owners for one picture, which is how the two drift apart. **Corrected 2026-08-03**: this originally said "in the same change that moves it", which the first child proved impossible — two of the three copies are read by the renderer this plan has not deleted yet, so retiring them early would change what that renderer draws and break the criterion that the game plays identically after every child. Each copy is retired in the child that deletes its last reader; the block armature, which has no such reader, moved with the code.
5. The interim projection layer and the ray-marched renderer are deleted rather than left dormant. Dormant code that once drew the game is the most convincing wrong answer a later reader can find.
6. Every development surface that inspects the interim projection either works against the new runtime afterwards or is retired with its reason recorded. There are six of them and they are the only reason the deletion is not a single change.
7. The game stays judged by playing. No new tests of any kind, and no pixel comparison promoted into a gate.

## Design

### What the seam actually is

The play surface owns the frame: it steps the rules, drains the sound cues, updates the readouts, and then asks four things of the drawing side — build a scene from the world, build the frame's effect envelopes, load the pictures, and paint the first-person layer. Those four calls are the entire boundary between the game and how it looks. Everything this plan does is either preparation for replacing those four calls, the replacement itself, or clearing up afterwards.

The experiment does not fit that shape today, and the mismatch is the single largest piece of work here. It owns its own frame loop, its own input handling, and its own world — because a debug tool has nobody to hand those to. Graduating it means taking all three away and leaving a renderer that is handed a world and a time step, which is what the surface already knows how to talk to. That reshaping is given its own child precisely because it is invisible: it lands with the game still drawn the old way, so if it breaks anything the breakage is unambiguous.

### What the surface keeps

Everything not on the drawing side stays where it is and is not rewritten: the pointer lock and its relock retry, the pause that keeps the pointer, the title and end overlays, the run-end summary, the card timer, the objective banner, the sound listener and the cue drain, the development instrument panel and its cheats, the filming stage's dressing, and the capture flag. The experiment has none of these and does not acquire them; it acquires a caller that already has them.

Two of them need a value the experiment does not compute and the runtime will: how hard the view is turning, which the finishing pass reads, and where a swing landed on screen, which the first-person layer aims its arc at. Both are questions the surface asks the drawing side, so both arrive as part of the seam rather than as new state anywhere.

### The picture between children

The seam child changes what the player sees, and the two children before it change nothing. That ordering is deliberate: by the time the seam is swapped, the runtime is expected to be at or above the shipped picture. It starts there — the spike closed every gap its porting survey found before the verdict was given, precisely so the verdict was not given against a picture nobody plays.

Two things are knowingly below the shipped picture on the day the seam swaps, and **neither is closed here**. Corpses are one settling shape for all six ways of dying, because the block rig ships no death clip to play and posing one by hand would be guessing at work the body plans are about to author properly. Soft bodies are a plain shape where the ray-marched renderer deformed them through squash, shatter and drowning, because the spike rejected the programmatic blob outright.

This plan originally intended to close the first of those and discovered, when it came to, that there was nothing to port — the shipped death treatments are baked sprite atlases and the rig that replaced them has no terminal clip. So both are regressions this plan ships knowingly and neither is its to repair. `humanoid_block_bodies.plan.md` owns the first and `slime_bodies.plan.md` the second.

### What the survey recorded and this plan does not close

The porting survey separated absent from reduced. Everything absent is the spike's to build before the verdict. Of what is reduced, the last child closes four: the structures' weathering and debris, the room lights that grow while a hold runs, the swing arc chasing what it hit, and the waterline cut on a body going under. A fifth was listed — the wall material family the baked floors need — and it turned out not to be needed at all: the two tools that would have wanted it hand the runtime a world, and the runtime builds its walls from the map's own tile kinds. Anything else the survey noted — and the soft bodies above all — is accepted as it stands, and the acceptance is recorded rather than left as an omission.

### Children

| #   | Child                          | Focus                                                                                                             | Form                                                                         |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | The move                       | The experiment folder becomes a presentation-layer module; the armature becomes content; boundary rules follow it | `three_scene_graduation_01_the_move.implementation_spec.md`                  |
| 2   | The runtime stops owning play  | Frame loop, input and world ownership leave the runtime; it becomes something handed a world and a step           | `three_scene_graduation_02_runtime_stops_owning_play.implementation_spec.md` |
| 3   | The seam                       | The four drawing calls swap; the surface's own halves are rewired to the new renderer                             | `three_scene_graduation_03_the_seam.implementation_spec.md`                  |
| 4   | Who owns the bodies            | The body work is scoped into its own plans and handed over; nothing about a body is built here                    | Shipped 2026-08-04 — the two plans it produced                               |
| 5   | The workbenches and demolition | Six development surfaces migrate or retire; the interim projection and the ray-marched renderer are deleted       | Cancelled 2026-08-04 — `three_scene_demolition.implementation_spec.md`       |
| 6   | The fidelity tail              | Structure detail, hold-driven room lights, swing aim, and the waterline cut                                       | Execution below                                                              |

Landing order is the table order. Child 2 must precede 3 because the seam has nothing to call otherwise, and the cancelled child's work must still follow 3 for the reason it always did: it deletes the path the game would otherwise fall back to.

Child 5 was cancelled on 2026-08-04 and its work handed to a standalone spec, because both of its assumptions turned out wrong. The entity workbench is deleted rather than rewired onto the runtime, and the question the child was holding open — what becomes of the scene vocabulary the baked-floor tools read — answered itself when those tools moved onto worlds instead of onto projections. Requirements 4, 5 and 6 and acceptance criteria 3 and 4 stay this plan's and are delivered by that spec.

This plan does not declare itself goal-executable. Child 3 changes the whole picture, and that is a decision a person should see land before the next one starts.

## Non-Goals

1. No new authored model content. The enemy and structure roster is the modelling plan's subject and this plan draws whatever exists on the day it runs.
2. No new visual features. A depth-buffered renderer makes a dozen things newly cheap that the ray-marcher could not afford, and every one of them is a separate decision after this. The target is what the game draws today.
3. No performance work beyond staying playable on the development machine. The known cost — a body is its own armature of a dozen meshes — becomes a problem only if a floor stops being playable, and instancing is the answer if it does.
4. No scene routing, address, or map-selection change.
5. No behaviour, balance, content, or feel change. Where the new runtime's feel differs, that is a fidelity gap to close or accept, never an opportunity to retune.
6. No compositing and no fallback path. There is no arrangement in which both renderers are present at the end of this plan.
7. No new tests, and no promotion of a picture comparison into a gate. The capture harness may observe and must not judge.

## Acceptance Criteria

1. After every child, the game plays the same as it did at the commit before it — confirmed by a playtest covering the surface that child touched — and the aggregate verification gate passes.
2. After the seam child, a whole floor plays from the ordinary address through the new runtime, with sound, readouts, pause, damage feedback, death, restart and descent all behaving as before.
3. After the demolition, exactly one renderer exists in the repository, nothing imports the interim projection layer, and that layer no longer exists.
4. Each of the six development surfaces that inspected the interim projection is either working against the new runtime or recorded as retired with its reason.
5. The production build succeeds, the game opens in a browser, and a full floor is playable at a frame rate no worse than the one the spike measured.
6. Every gap the porting survey recorded is, by the end, either closed or carrying a recorded decision to accept it — with the soft bodies named explicitly as accepted and pointed at the modelling plan.
7. The filming stage still dresses, still hides its instruments, still restages its cast, and the capture harness still produces pictures.

---

## Execution

Perishable coordinates, first recorded 2026-08-03 against `57dd494` and left as written when the spike's last three children landed on top of them. They are therefore known to be short: the experiment gained a floor-decal projection, a blood grid, a finishing pass and a sprite sheet after this was taken. Every child re-checks its own against the live code first. Conflicts resolve in favour of the conceptual half.

### Shared facts

- Source today: `src/sandbox/three-scene/`, 14 modules, ~5,200 lines plus `assets/skeleton-blocky.glb` and `three-scene.css`.
- The four seam calls are all in `src/runtime/surface.ts`: imports at `:33-35`, used at `:566` (`loadDemoImages`), `:871` (`createDemoScene`), `:872` (`createDemoEffects`) and `:880` (`drawDemoViewmodel`), with `renderer.project(scene, target)` at `:879` feeding the last one.
- What the deletion covers, and the six surfaces that have to move before it, belong to `three_scene_demolition.implementation_spec.md` and are recorded there against live code.
- Gate: `npm run verify`. Governance changes additionally run `npm run check:governance`. Three.js is already a dependency but is currently reachable only from the debug namespace; after child 3 it is in the production bundle for the first time. The baseline to compare against, measured 2026-08-03: the play chunk is 233.78 kB raw / 76.15 kB gzipped, and its stylesheet 24.81 kB / 5.21 kB.
- The other two sandbox experiments, `src/sandbox/three-block/` and `src/sandbox/three-preview/`, were expected to be unaffected and are not: `three_scene_demolition.implementation_spec.md` graduates the first into the debug layer and deletes the second, which leaves `src/sandbox/` empty. Nothing in this plan's remaining child reads either.

### Child 1 — The move

- Destination: `src/presentation/scene3d/` (name is the child's to confirm; it must be a presentation-layer directory, since that layer already owns everything that draws).
- Boundary rules to change: `.dependency-cruiser.cjs` currently forbids anything outside `src/app/debug/` from importing `src/sandbox/`, and forbids the sandbox tree from importing `src/presentation/`. Both rules stop applying to this code the moment it moves; the new module obeys the ordinary presentation-layer rules instead.
- Copies to retire in the same change:
  - `scene-textures.ts` (378 lines) against `src/presentation/procedural-textures.ts` (608). They are different implementations at different sizes, not a duplicate to delete — the child decides per material whether the shipped generator is called or the experiment's is kept and the shipped one narrowed. Do not leave both.
  - `scene-sprites.ts` against `src/demo/demo-sprites.ts` (914). Both grew after this was taken; the experiment's set still holds a few drawings nothing places, so check each against its call sites before deleting any.
  - `assets/skeleton-blocky.glb` (112 KB) moves to `src/content/**/assets/` per the structure addendum's asset rule; `block-clips.ts` (21) holds the clip and weapon names copied from `src/sandbox/three-block/block-contracts.ts`.
- `src/app/debug/debug-tools.ts` keeps a catalog entry pointing at the new location — a presentation module can be mounted by a debug tool, which is how the workbenches already work. The `THREE_SCENE_EXPERIMENT` chrome in `three-scene.ts` (277) stays a debug tool and stops being a sandbox one.
- Nothing in `src/runtime/` changes. The game still draws through the Canvas renderer at the end of this child.

### Child 2 — The runtime stops owning play

The renderer — `SceneRuntime` in `scene-runtime.ts` when this was written, `SceneRenderer` in `scene-renderer.ts` after the child renamed it — owned three things it had to give up:

- **The frame loop.** `frame` at `:407` calls `stepWorld`, drains `world.sfxCues` (`:421`, currently discarded), computes the delta, and re-arms `requestAnimationFrame` at `:469`. All of that belongs to the caller. What remains is: sync the sub-systems, place the camera, render.
- **Input.** `holdKey`/`releaseKeys`/`look`/`strike`/`grab` at `:268-298` and `MOUSE_SENSITIVITY`/`MAX_PITCH` at `:72-73`. The surface has its own copies with different limits — `MAX_PITCH_UP = 1.5`, `MAX_PITCH_DOWN = 0.48` at `surface.ts:89-90`, asymmetric because the Canvas pitch is a shear. A real perspective camera has no such asymmetry, so the child decides which limits survive; that is a feel decision and belongs in the playtest, not in this note.
- **The world.** `createWorld` at `:146`, `restart` at `:213`, `faceOpenGround` at `:316`, and the debug helpers `killEverything`/`flatten`/`fillCrowd` at `:242-266`, which duplicate `surface.ts:748-793`. The surface's copies win; the runtime's go.
- The camera kick functions at `:519-552` (`blastKick`, `weightKick`, `meleeImpactPitch`) duplicate `demo-scene.ts:3195-3231` and `demoMeleeImpactPitch`. One copy survives the plan; which one is child 5's to settle, but they must not both live past child 5.
- What the runtime gains: a `project(world, target)` answer for the swing aim, and a turn-rate input for the finishing pass. Both are requirements 2 and 3 of the seam.
- At the end of this child the experiment still opens from the debug hub and still plays — driven by a small harness in its own debug tool rather than by itself.

### Child 3 — The seam

- Swap the four calls in `surface.ts` and delete `sceneContext`/`canvas.getContext("2d")` at `:572` if the first-person layer moves onto its own element, which is how the renderer does it (`viewmodel.ts` builds an overlay canvas, `scene-renderer.ts` appends it, and the finishing pass stacks a second one under it).
- Sound: `world.sfxCues` must reach `playSfx`. The surface already does this at `:857-861`; the discard went away with the frame loop in child 2 and the debug tool now drains them, so this is a matter of the surface keeping its own drain rather than the renderer growing one.
- The pixel grain (`GRAIN_SCALE` in `scene-renderer.ts`) reproduces `renderer.halvePlaneRows`/`halvePlaneColumns` at `surface.ts:570-571`. Keep it, and keep it toggleable from the debug tool rather than from the game.
- `renderer.resize(clientWidth, clientHeight, devicePixelRatio)` at `:870` has an answer already: `scene-renderer.ts` drives its own sizing through a `ResizeObserver` on the element it was given, which serves either caller.
- `window.demoWorld` and `window.demoRenderer` (`:626-631`) are read by `dev/tools/capture-scenes.mjs` for `stats.json` — per `dev/agent_rules/test_operations.md:36` they are a handle, not an import, so a rename fails silently. Keep both names.
- The capture flag `?capture` at `:77` and the harness's key-driving must still work; the experiment's `window.__sceneRuntime.stand(...)` is a second, incompatible arrangement and should not survive as one.
- Playtest closes this child, and it is the largest one in the plan: a whole floor, sound on, taking damage, dying, restarting, descending.

### Child 4 — Who owns the bodies

Shipped 2026-08-04. What it found, kept here because children 5 and 6 read it:

- The block rig's clips are `idle`, `walk`, `windup`, `strike`, `recovery`, `crossbowAim`, `crossbowReload` — **no death**. The shipped deaths this plan meant to port are five baked eight-direction sprite atlases selected by cause, and `blasted` selects none of them: the ray-marched game draws no corpse for a body that was blown apart and lets the scattered bone say it.
- The rig-first pipeline the body work needs already exists under `dev/tools/skeletons/` and `dev/tools/blender-kit/`, about 3,500 lines of it. It builds a seven-bone rig, hangs boxes off it bound one-bone-per-box at full weight — rigid parts wearing the armature system's clothes — keys clips from tables of angles, and exports the model the browser reads. One command, re-runnable.
- What that pipeline lacks is not architecture: proportions are module constants so it can only ever build one body, every weapon is built onto the socket at once and hidden at draw time, parts are tagged but nothing detaches them, and the clip table has no terminal row.
- `src/content/enemies/assets/` holds 81 MB of skeleton sprite atlases still shipping because the raycaster still reads them. They die in child 5, not in a body plan.
- Corpses stay one settling shape until `humanoid_block_bodies.plan.md` lands. The tracker carries a chore for the cheap half of that — handing a dying body's own armature to its corpse so a dead skeleton is at least that skeleton — which throws nothing away when the real clips arrive.

### Child 6 — The fidelity tail

- **Structures.** `altarBoxes` at `demo-scene.ts:1625` (74 lines) against `world-structures.ts:68` (38): missing are `weathered` (`:1603`), `ALTAR_DEBRIS` (`:1597`) and `litFace` (`:1612`). The other four fixtures differ by less.
- **Room lights.** `roomLights` at `demo-scene.ts:2913`: the blessing light grows with `progress.heldSeconds / BLESSING_HOLD_SECONDS`, the extraction light with `extractionShare(world)` and speeds its flicker with it. `world-structures.ts:487-516` has both at fixed values.
- **Swing aim.** `surface.ts:878-880` projects `world.swingTarget` and hands the screen point to the first-person layer; `viewmodel.ts:188` records that the experiment has no projection to ask. Child 2 adds the answer; this is where it gets used.
- **Waterline cut.** `RenderSprite.submerged` (`render-scene.ts:273`) cuts everything below the floor line; `world-bodies.ts:326` and `:386` only sink the body. Read the coordinate before the demolition spec deletes that file, or read it out of history afterwards.
