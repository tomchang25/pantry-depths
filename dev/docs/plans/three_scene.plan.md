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

| Element of the current view                                                                                                            | Expected treatment                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Wall faces: procedurally textured ashlar, brick, iron bars, doors, with one material per damage step so breaking is a visible sequence | Reproduce: textured low-poly meshes sampling the same procedural texture generators                                                |
| Floor: one tiling texture with named patch cells (water, fouled and choked water)                                                      | Reproduce: textured plane with per-cell patch materials                                                                            |
| Open night sky: horizon-to-zenith gradient, stars, moon, boundary walls standing above interior ones                                   | Reinterpret: background gradient or skybox; stars may move into the world                                                          |
| Distance fog and torch-light falloff around the player                                                                                 | Reproduce, corrected 2026-08-03: the shipped renderer's own fog and torch formulas, not a physical lighting model                  |
| Ground marks at sub-cell resolution: blood, scorch, push pads, aim and blast circles                                                   | Reproduce: decal quads laid on the floor                                                                                           |
| Dust, embers, splashes, bone chips, plumes, projectile bead trails, wind-up markers                                                    | Reproduce, added 2026-08-03: soft billboards at the shipped sizes — their absence was most of the first session's verdict          |
| Boned enemies: currently sprite strips and an authored eight-way bake                                                                  | Replace: block models playing the existing table-driven clips                                                                      |
| Soft bodies (slimes): currently screen-space blobs with squash, shatter, and drowning stages                                           | **Rejected 2026-08-03**: the programmatic blob does not survive the move; slimes need authored models, owned by the modelling plan |
| Structures: the two altars, hot spring, extraction beacon, stairs, plinth, barricade iron, mortar                                      | Replace: block models, procedural or authored, judged the same way as enemies                                                      |
| Pickups lying on the floor                                                                                                             | **Stays 2D, ruled 2026-08-03**: billboard sprites drawn from the same artwork, never block models                                  |
| Projectiles and beams: rods and javelins in flight, tumbling props, lightning arcs, sparks                                             | Reproduce: mesh rods and particle sprites                                                                                          |
| The exit marker drawn through walls once the descent is unlocked                                                                       | Reinterpret: a render pass that ignores depth                                                                                      |
| First-person viewmodel: arms, held weapon, swing feedback                                                                              | **Stays 2D, ruled 2026-08-03**: the authored arm drawn over the frame; the mesh arm is cut                                         |
| Camera feel: blast kick and weight kick                                                                                                | Reproduce                                                                                                                          |
| HUD: plain DOM composited over the canvas                                                                                              | Unchanged; the spike only proves the stacking still works                                                                          |

Audio is untouched and out of scope; it does not know what draws the game.

### The first judging session

The author judged the built experiment on 2026-08-03 against a reference recording of the shipped renderer. The verdict: image quality up, performance up, atmosphere down, overall worse — not acceptable as built, and not yet a no. Four findings, each now folded into the checklist above: the picture is too dark because the lighting model is wrong in kind rather than in degree; the dust and smoke that carry the fights' atmosphere are missing because their channels were never ported; the programmatic slime is rejected outright; and the viewmodel and pickups must stay 2D — their earlier "reinterpret" rows were the plan's error.

Child 4 is the answer to that session: reproduce the shipped renderer's own light and effects rather than approximating them with a physical model. The final whole-view verdict waits until it ships and is judged the same way — frame-by-frame against the reference recording.

If child 4 still fails that judgement, the recorded fallback is the **live-sprite hybrid**: the raycaster keeps drawing everything, and Three.js becomes an offscreen sprite generator — each boned body rendered per frame at cell size from its viewing angle and fed through the existing billboard channel, so depth, fog, tinting and pixel grain stay the raycaster's for free. That path supersedes this plan's fourth Non-Goal, which forbade a _compositing_ hybrid; feeding sprites composites nothing.

### Children

Three children shipped on 2026-08-03 — the static floor, the live world, and the close layer — and their rows are cut. The first judging session then found the result unacceptable as built and ordered a fourth child rather than a verdict.

| #   | Focus                                                                                                                  | Form                            |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 4   | Faithful pass: replicate the shipped renderer's light formulas, port the missing effect channels, return the 2D layers | Execution subsection, no sketch |

**The plan is not closeable**: two of its acceptance criteria are verdicts only the author can give, and that sitting waits until child 4 ships.

### What building it turned up

Two findings from the build survive the first judging session as open facts rather than as fixed problems.

Physical lighting was the wrong frame entirely. The first build gave the torch a real point light and rolled the result off with a tone curve; the session judged the whole picture too dark and too cold. The shipped renderer has no physical model to approximate — it has three short analytic formulas (walls, planes, bodies), and child 4 replaces the physical stack with those formulas verbatim. This retires the earlier note here about tone mapping being load-bearing: it ships out with the model it patched.

Bodies are expensive. Each skeleton arrives as its own cloned armature of a dozen meshes, so a full crowd costs a couple of hundred draw calls where the floor itself costs six. The session found performance up regardless, so this stays a note rather than a problem — instancing and merging both apply if it ever becomes one.

### What the verdict decides

A full yes makes the follow-up a formal-track plan: graduate the approach into the presentation layer, swap the one seam the runtime draws through, migrate the debug workbenches that inspect the interim projection, and delete the demo tree — none of which this plan performs. A no, or a partial no on a load-bearing row, is recorded and the folder is deleted. Until the verdict lands, all renderer-bound visual polish elsewhere stays frozen, and the boss encounter's rendering question stays parked on this plan's outcome.

## Non-Goals

1. No graduation, no replacement of the interim projection layer, and no changes to the presentation, runtime, or interface layers — this plan only answers whether the replacement is worth planning.
2. No new authored model content: the existing blocky skeleton and procedurally built block geometry are enough to judge with. Authoring the real roster — including the slime the first session rejected — is the follow-up modelling plan's subject.
3. No performance work beyond staying smoothly playable on the development machine.
4. No compositing fallback: if the whole view cannot be reproduced, the answer is no, not an overlay of two renderers. Amended 2026-08-03: the live-sprite path recorded under the first judging session is not a compositing fallback — it feeds images into the existing billboard channel — and is the sanctioned next move after a failed final verdict.

## Acceptance Criteria

1. The experiment opens from the debug hub, loads a real authored floor, and can be walked through at a playable frame rate.
2. Every checklist row carries a verdict given by the user looking at the running experiment; none is left implicit.
3. The final whole-view verdict — viable or not — is stated by the user in one sitting with the experiment open.
4. The ordinary verification gate passes, and the production module graph is provably unchanged.

## Execution

Perishable notes, recorded 2026-08-03. Every child's own subsection is cut; what remains is the shared half, kept because the follow-up work it points at has not happened yet.

### Shared facts

- Experiment folder: `src/sandbox/three-scene/`. One catalog entry in `src/app/debug/` mounts it, following the deferred-loader pattern of the existing experiments (see `THREE_BLOCK_EXPERIMENT` in `src/sandbox/three-block/three-block.ts:70`).
- Boundary rules: the experiment may import only its own folder, `@/core/*`, and `@/content/*`. It may **not** import `src/presentation/` — the procedural texture generators in `src/presentation/procedural-textures.ts` must be copied into the experiment folder. Graduation later re-points to the originals.
- Experiments never import each other. Reusable know-how in `src/sandbox/three-block/` (glTF loading, clip tables, weapon-bone visibility, bake camera constants in `block-contracts.ts` and `block-runtime.ts`) and the asset `src/sandbox/three-block/assets/skeleton-blocky.glb` are copied, not imported.
- The scene vocabulary the current renderer consumes is enumerated in `src/presentation/render-scene.ts`; the projection that feeds it is `src/demo/demo-scene.ts`, whose builder functions (`surfaces`, `boxes`, `altarBoxes`, `stairBoxes`, `floorDecals`, `lights`, `emitters`, `NIGHT_SKY`, `EXIT_XRAY`) are the authoritative list of what each checklist row means concretely.
- The seam the follow-up plan will eventually swap: `src/runtime/surface.ts:33-35` (`createDemoScene`, `createDemoEffects`, `loadDemoImages`, `drawDemoViewmodel`) plus six debug importers of `@/demo/*`: `entity-workbench`, `prop-workbench`, `hud-attack-workbench`, `carried-workbench`, `floor-preview`, `render-panel`. Not touched by this plan; listed so nobody re-derives it.
- Dev server: `http://localhost:5273`. Gate: `npm run verify`. Three.js is already a dependency (used by both existing experiments).
- What the experiment copied rather than imported, and would stop copying on graduation: the procedural texture generators, the blocky skeleton asset, and its clip and weapon names. The authored arm and the entity display table are imported from `src/content/` and need no such change.
- `window.__sceneRuntime` is a development-only handle exposing the world and a `stand` call, so a session can pose the camera and take a picture from the same place twice. It follows the arrangement `src/sandbox/three-preview/` and the play surface both already use.
- The reference recording is `D:\Videos\Export\maze-first.mp4` (~40s of the shipped renderer). Frames extract with `ffmpeg -i <video> -vf "fps=10" out-%04d.png` for the side-by-side; the harness already proved headless capture of the experiment works via `__sceneRuntime.stand(...)` plus a Playwright screenshot.

### Child 4 — faithful pass

The finding this child exists on: the shipped renderer's look is not a physical model plus taste — it is three short analytic formulas, and the first build approximated them instead of running them. Every subsection below either runs the real formula, ports a channel the first build skipped, or returns a layer the author ruled must stay 2D.

**1. Replace the lighting stack with the shipped formulas.** Delete the `AmbientLight`, the torch `PointLight`, the four fitting `PointLight`s, the `FogExp2`, and the ACES tone mapping in `scene-runtime.ts` (`toneMapping`/`toneMappingExposure` lines and the light construction around `scene-runtime.ts:131-162`). Replace `MeshLambertMaterial` throughout the experiment with a custom `ShaderMaterial` family (or `onBeforeCompile` on `MeshBasicMaterial`) implementing, per surface class, the formulas read from `src/presentation/canvas-gameplay-renderer.ts` on 2026-08-03 — re-check them against the live file first:

- Shared inputs as uniforms: camera world position, elapsed seconds, and the scene's light list (position, radius, intensity, rgb) as a fixed-size uniform array — one shader for any light count, no per-light recompile. Torch flicker is `0.96 + sin(elapsed * 7.1) * 0.025` (renderer line ~1214). `MAX_DEPTH = 18` (line 32). Depth is view distance to the fragment.
- **Walls** (line ~1916-1924 and `#tintedWallTexture` ~615-662): `fog = clamp(depth/18, 0, 0.88)`; the texel is mixed toward `rgb(13, 5, 24)` by `fog`; then `torch = clamp(1.15 - depth/7.5, 0, 1) * flicker` overlays `rgb(255, 112, 35)` at `torch * 0.16` alpha. Add the per-face shade the renderer folds in as `(1 - shade) * 0.15` extra fog — north/south vs east/west faces differ; take the constants from `RayHit.shade`'s producer.
- **Floor and trench planes** (line ~1306-1311, 1487-1489): `fog = clamp(1 - depth/18, 0.12, 1)`; `torch = clamp(1.2 - depth/8, 0, 1) * flicker`; `out = texel * fog + (18, 11, 28) * (1 - fog) + (31, 12, -3) * torch` (the flat-plane fog tint; the ceiling variant does not apply — there is no ceiling).
- **Bodies, structures, pickups, particles** (line ~2623-2666): `fade = 1 - clamp(depth/18, 0, 0.82)`; `warmth = clamp(1 - depth/7, 0, 0.42)` raised to `clamp(1 - distance/radius, 0, 1) * intensity` of whichever scene light reaches highest, taking that light's colour as `warmColor`; `out = albedo * fade + warmColor * warmth * 0.3`, clamped. The hit flash then lerps the result toward white, which replaces the current emissive trick in `world-bodies.ts`.
- The light list is rebuilt per frame from `world-structures.ts`'s `lights()` — all of them, not the nearest four; `aimFittingLights` and the `fittings` array go away.
- The sky dome and stars stay unlit and unfogged, exactly as now.

**2. Port the missing effect channels.** The authoritative producers are in `src/demo/demo-scene.ts` (unimportable — read for numbers, reimplement in the experiment): `particles(world)` (~line 2362), `emitters(world)` (~3122), `warnMarkerSprite` (~365), `beams(world)`/`beadLine` (~2257/2471), `landingBeacons` (~2415), `sightLines` (~2550). Concretely:

- **Particles as soft billboards, at shipped sizes.** The current `THREE.Points` at size 0.09 is the single largest atmosphere gap — the reference frames are full of large soft discs. Replace with camera-facing quads (instanced) using a radial-gradient texture, sized from each particle's own `size` field in world cells, colour by kind as `demo-scene`'s particle table has it, alpha fading with `age/life`. The world's particle field is already read; only the drawing is wrong.
- **Emitters**: `RenderEmitter` (kind `embers | steam`, density, optional colour — `render-scene.ts:339`) drawn as rising, fading soft discs seeded per emitter id. Torches, springs and the altar breathe through this channel.
- **Wind-up markers**: the shape over a committed enemy. Copy the three marker drawings (`warnMelee`, `warnShoot`, `warnCharge`) from `src/demo/demo-sprites.ts` into the experiment's own sprite module (they are small canvas drawings, not files), then billboard the right one over each enemy with `windupSeconds > 0`, scaled and offset by the authored display table already imported in `world-bodies.ts`.
- **Projectile bead trails**: the flights currently draw only a rod; the shipped look is a chain of glowing beads along `projectile.trail`. Add instanced soft discs along the trail with the bead spacing and colours from `beadLine`.
- **Ground glow and drop shadows**: flat quads under pickups and under placed lights, from the `groundGlow`/`dropShadow` drawings in `demo-sprites.ts`, which is most of why the shipped fittings appear to pool light on the floor.

**3. Return the 2D layers the author ruled on.** Pickups: replace the instanced boxes in `world-effects.ts` with camera-facing quads drawing the real artwork — copy the prop drawings (stick, rock, bomb, hammer, piles) from `demo-sprites.ts`; the skeleton pickup PNGs import directly from `@/content/enemies/skeleton-pickup-definitions` (`SKELETON_PICKUP_URLS`). Sized by the authored prop display table (`@/content/presentation/prop-display*`), shaded by the body formula. Viewmodel: delete the mesh arm from `viewmodel.ts` entirely, make the authored 2D overlay the default and only arm, keep the `none` option for clean captures.

**4. Pixel grain.** The shipped image is coarse — the demo halves plane resolution both ways. Render the WebGL frame at a reduced backing scale (start at 0.5× the CSS size) with `image-rendering: pixelated` upscale, as a sidebar control defaulting on, so the comparison is not clean-renderer-versus-grainy-renderer.

**5. The comparison surface.** Add a headless capture script under the scratchpad pattern already used (Playwright, `__sceneRuntime`), or extend the sidebar: what matters is that the judging session can put an experiment frame beside a reference frame at the same place and heading. No new test of any kind; the sandbox unit-test budget stays unspent.

Out of scope for this child, restated: the slime body (modelling plan), any raycaster change, any graduation step. The structure colours in `world-structures.ts` stay flat colours — under the body formula they inherit distance fade and torch warmth, which is what the shipped box channel does to them.
