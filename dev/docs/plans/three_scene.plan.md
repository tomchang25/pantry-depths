# Three-Scene: The Full-View Reproduction Spike

Goal-Executable: yes

## Goal

Prove, in one disposable sandbox experiment, that a Three.js runtime can reproduce the whole game view — the low-poly textured look and the night atmosphere the current ray-marched renderer draws — with block models standing in for enemies and structures. The interim projection layer is the last piece of the demo still outside the formal layers, held there precisely because this question is unanswered; a yes ends that holding pattern, a no ends the experiment with one folder deletion.

## Requirements

1. The experiment renders a real authored floor from the game's own content and rules — not a mock stage — because atmosphere judged against a synthetic room proves nothing about the game.
2. The whole view is replaced, not composited: walls, floor, sky, lighting, bodies, effects, and the first-person layer all come from the new runtime in the same frame. A bodies-only compositing answer is exactly what this spike exists to avoid needing.
3. Enemies and structures are drawn as low-poly block models with table-driven animation clips, continuing the direction the block-skeleton experiment already validated for a single body.
4. Every visual element of the current view gets an explicit verdict — reproduced, reinterpreted acceptably, or rejected — recorded against the checklist in the Design section, so the outcome is a judged list rather than an impression.
5. The experiment is judged by a person opening it and looking. No new tests of any kind; the delivery gate is the ordinary verification command.
6. The game itself does not change: nothing outside the experiment folder is touched except the one debug-hub catalog entry that mounts it.

## Design

### The atmosphere checklist

Each row is judged at game distance, in motion, by the user. "Reproduce" means the Three.js result must read as the same thing; "reinterpret" means the technique is expected to differ and the look is judged on its own merits.

| Element of the current view                                                                                                            | Expected treatment                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Wall faces: procedurally textured ashlar, brick, iron bars, doors, with one material per damage step so breaking is a visible sequence | Reproduce: textured low-poly meshes sampling the same procedural texture generators                                           |
| Floor: one tiling texture with named patch cells (water, fouled and choked water)                                                      | Reproduce: textured plane with per-cell patch materials                                                                       |
| Open night sky: horizon-to-zenith gradient, stars, moon, boundary walls standing above interior ones                                   | Reinterpret: background gradient or skybox; stars may move into the world                                                     |
| Distance fog and torch-light falloff around the player                                                                                 | Reinterpret: scene fog plus attached light; this pairing carries most of the atmosphere and is the likeliest point of failure |
| Ground marks at sub-cell resolution: blood, scorch, push pads, aim and blast circles                                                   | Reproduce: decal quads laid on the floor                                                                                      |
| Boned enemies: currently sprite strips and an authored eight-way bake                                                                  | Replace: block models playing the existing table-driven clips                                                                 |
| Soft bodies (slimes): currently screen-space blobs with squash, shatter, and drowning stages                                           | Reinterpret: deforming low-poly blobs; the verdict decides whether soft bodies stay block-shaped                              |
| Structures: the two altars, hot spring, extraction beacon, stairs, plinth, barricade iron, mortar                                      | Replace: block models, procedural or authored, judged the same way as enemies                                                 |
| Projectiles and beams: rods and javelins in flight, tumbling props, lightning arcs, sparks                                             | Reproduce: mesh rods and particle sprites                                                                                     |
| The exit marker drawn through walls once the descent is unlocked                                                                       | Reinterpret: a render pass that ignores depth                                                                                 |
| First-person viewmodel: arms, held weapon, swing feedback                                                                              | Reinterpret: camera-attached mesh, or the existing 2D overlay kept on top — judged in the final child                         |
| Camera feel: blast kick and weight kick                                                                                                | Reproduce                                                                                                                     |
| HUD: plain DOM composited over the canvas                                                                                              | Unchanged; the spike only proves the stacking still works                                                                     |

Audio is untouched and out of scope; it does not know what draws the game.

### Children

Three children, ordered so the likeliest failure is met first. The plan was written to be judged between children; the author instead authorized all three in one run on 2026-08-03, which moves the whole checklist to a single judging session at the end rather than splitting it three ways.

| #   | Focus                                                                                                   | Form                            |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2   | Live world: read-only simulation tick, block enemies and structures, deaths, props, decals, projectiles | Execution subsection, no sketch |
| 3   | Close layer: viewmodel, swing feedback, through-wall marker, camera kicks, HUD stacking                 | Execution subsection, no sketch |

### What the verdict decides

A full yes makes the follow-up a formal-track plan: graduate the approach into the presentation layer, swap the one seam the runtime draws through, migrate the debug workbenches that inspect the interim projection, and delete the demo tree — none of which this plan performs. A no, or a partial no on a load-bearing row, is recorded and the folder is deleted. Until the verdict lands, all renderer-bound visual polish elsewhere stays frozen, and the boss encounter's rendering question stays parked on this plan's outcome.

## Non-Goals

1. No graduation, no replacement of the interim projection layer, and no changes to the presentation, runtime, or interface layers — this plan only answers whether the replacement is worth planning.
2. No new authored model content: the existing blocky skeleton and procedurally built block geometry are enough to judge with. Authoring the real roster is the follow-up modelling plan's subject.
3. No performance work beyond staying smoothly playable on the development machine.
4. No compositing fallback: if the whole view cannot be reproduced, the answer is no, not a hybrid.

## Acceptance Criteria

1. The experiment opens from the debug hub, loads a real authored floor, and can be walked through at a playable frame rate.
2. Every checklist row carries a verdict given by the user looking at the running experiment; none is left implicit.
3. The final whole-view verdict — viable or not — is stated by the user in one sitting with the experiment open.
4. The ordinary verification gate passes, and the production module graph is provably unchanged.

## Execution

Perishable notes, recorded 2026-08-03. Whoever executes a child re-checks these against the live code first. Cut each child's subsection when it ships.

### Shared facts

- Experiment folder: `src/sandbox/three-scene/`. One catalog entry in `src/app/debug/` mounts it, following the deferred-loader pattern of the existing experiments (see `THREE_BLOCK_EXPERIMENT` in `src/sandbox/three-block/three-block.ts:70`).
- Boundary rules: the experiment may import only its own folder, `@/core/*`, and `@/content/*`. It may **not** import `src/presentation/` — the procedural texture generators in `src/presentation/procedural-textures.ts` must be copied into the experiment folder. Graduation later re-points to the originals.
- Experiments never import each other. Reusable know-how in `src/sandbox/three-block/` (glTF loading, clip tables, weapon-bone visibility, bake camera constants in `block-contracts.ts` and `block-runtime.ts`) and the asset `src/sandbox/three-block/assets/skeleton-blocky.glb` are copied, not imported.
- The scene vocabulary the current renderer consumes is enumerated in `src/presentation/render-scene.ts`; the projection that feeds it is `src/demo/demo-scene.ts`, whose builder functions (`surfaces`, `boxes`, `altarBoxes`, `stairBoxes`, `floorDecals`, `lights`, `emitters`, `NIGHT_SKY`, `EXIT_XRAY`) are the authoritative list of what each checklist row means concretely.
- The seam the follow-up plan will eventually swap: `src/runtime/surface.ts:33-35` (`createDemoScene`, `createDemoEffects`, `loadDemoImages`, `drawDemoViewmodel`) plus six debug importers of `@/demo/*`: `entity-workbench`, `prop-workbench`, `hud-attack-workbench`, `carried-workbench`, `floor-preview`, `render-panel`. Not touched by this plan; listed so nobody re-derives it.
- Dev server: `http://localhost:5273`. Gate: `npm run verify`. Three.js is already a dependency (used by both existing experiments).

### Child 2 — live world

Attach the world tick read-only (the same way the play surface steps it, without input-driven actions or with a minimal action bridge — executor's choice, it is disposable). Load the copied blocky skeleton for boned enemies, map the simulation's clip decisions onto the mixer as `block-runtime.ts` does. Slimes as vertex-deformed low-poly spheres. Structures as `BoxGeometry` assemblies mirroring the box builders in `demo-scene.ts`. Decal quads for ground marks; rods and particles for projectiles.

### Child 3 — close layer

Viewmodel as a camera-attached mesh first; if it reads worse than the current 2D overlay, mount the existing overlay canvas above the WebGL canvas and judge that instead (`drawDemoViewmodel` stays untouched either way — copy what its look requires). Exit marker via a second render pass with depth test off. Blast/weight kick as camera offsets sourced from the same world fields `demo-scene.ts` reads. HUD: mount the experiment under the debug page chrome with the DOM HUD absent — stacking is proven with a placeholder DOM strip over the canvas.
