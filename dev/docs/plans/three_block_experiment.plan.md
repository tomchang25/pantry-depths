# The Block Skeleton Experiment

## Goal

Stand up a separate workbench that renders a blocky, big-headed skeleton whose every motion comes from small numeric tables, and judge it at the size the game actually draws enemies. The current enemy pipeline sits at a fidelity level nobody can afford: the body is detailed enough that script-authored poses read wrong, and hand-posing every clip for every weapon is a cost the project has measured and rejected. A blocky body lowers the animation bar to where numeric tables clear it — which makes the whole authoring loop automatable — and the recognised voxel-character style means the simplicity reads as style rather than as cheapness.

## Requirements

1. The experiment lives in its own workbench behind its own debug route, beside the existing Three.js preview rather than inside it, so it can be judged, iterated, or killed without touching anything else.
2. The body is assembled from axis-aligned blocks at big-head proportions, identified by silhouette and flat colour alone — no textures. At the size the game draws an enemy, a big head is what makes the identity legible: a seven-head figure at forty pixels has a five-pixel skull, a four-head figure a ten-pixel one.
3. Every clip is a small table of joint angles over time, sampled at runtime. No inverse kinematics, no Blender, no hand-posing anywhere in the loop: editing a number and reloading the page is the entire authoring cycle, because proving that loop is cheap and sufficient is the point of the experiment.
4. One melee clip set serves sword, hammer and javelin — the weapon is a mesh swap in the hand socket, and a javelin throw is the same overhead arc as a chop since the projectile is the simulation's to spawn, not the sprite's to draw. The crossbow alone carries its own two clips: a level hold and a reload, the reload being a pose the game's design notes already want a visible window for.
5. The strike carries a swing-arc effect, because the thesis under test is key poses plus effects rather than in-between frames — judging the pose without the arc would test a pipeline nobody intends to ship.
6. The primary judgment surface is consumption size: a live strip of all eight headings at game scale, drawn with the same camera geometry the sprite bake uses, with a pixelation toggle. The full-size orbit view exists to debug, not to judge; every prior misjudgment in this area came from evaluating bodies at workbench distance.
7. The workbench is verified by opening it. No new tests of any kind, per the standing test-operations contract.

## Design

### The fidelity fixed point

The project has now run the same experiment at three fidelity levels and the results triangulate. Script-authored pose tables driving an anatomical body shipped clips of which only two read correctly. Hand-posing that body through a full inverse-kinematics rig produced correct single poses at a cost — minutes per pose, a person's eye required throughout — that does not scale to seven clips across four weapon types. What was never tried is lowering the body to meet the tables. A blocky figure has so few degrees of freedom, and such coarse silhouette units, that a pose specified as "weapon arm raised 150 degrees, torso leaned back eight" is unambiguous — there is nothing subtle left to get wrong. Model fidelity, animation fidelity, and authoring capacity finally agree, and the agreeing point is the one where a script is a sufficient author and a person is needed only to say yes or no to the result.

### The body

Roughly two units tall, four heads to the body, on a Y-up world with the figure facing +Z. All parts are boxes; all joints are rotation-only pivots.

| Part      | Size (w × h × d)       | Notes                                                                                        |
| --------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Head      | 0.52 cube              | Centre near 1.72 high; two dark socket boxes and a nasal slit inset on the front face        |
| Rib slats | 0.44 × 0.10 × 0.16, ×3 | Stacked with gaps between 1.02 and 1.44 — the gaps are what say skeleton in silhouette       |
| Spine     | 0.10 × 0.50 × 0.10     | Behind the slats                                                                             |
| Pelvis    | 0.36 × 0.12 × 0.16     |                                                                                              |
| Arms      | 0.14 × 0.62 × 0.14     | Pivot at the shoulder, hanging; thin limbs are the skeleton identity within the blocky genre |
| Legs      | 0.14 × 0.80 × 0.14     | Pivot at the hip; no feet, legs end flat on the floor                                        |

Joints: root (whole-body lift and lean), head, arm.L, arm.R, leg.L, leg.R. Six rotating parts plus a root offset — a pose is at most seven entries.

The weapon socket sits at the end of the weapon arm, and a weapon's long axis continues the arm's own axis, exactly as the user specified: raise the arm and the blade points up, chop and it sweeps down. All four weapons — sword, hammer, javelin, crossbow — are small box assemblies in the palette the existing preview already uses for steel, brass, leather and bone.

Flat colours only. The bone, dark-bone, steel and brass values already proven in the sibling preview carry over as literals. Pixel-skin texturing is a possible later pass and deliberately not part of this experiment.

### The clip vocabulary

A clip is a duration, a loop flag, an ordered list of `(time, pose)` keys, and an optional effect window. A pose is a partial map of joint names to Euler degrees plus optional root lift and lean; sampling interpolates between neighbouring keys with smoothstep, and joints a pose omits hold their previous value. Starting tables, intents stated so the numbers can be corrected on sight — signs get fixed in minutes against the live view and are expected to need it:

| Clip           | Length                      | Intent                                                                                                                                                                                          |
| -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle           | 1.6 s loop                  | Near-still: a few degrees of torso sway and head drift, nothing that reads at distance                                                                                                          |
| walk           | 0.8 s loop                  | Arms and legs swing opposite at ±35°, root bobs slightly — the Minecraft walk, which is the genre's own                                                                                         |
| windup         | 0.5 s, holds its last frame | Weapon arm sweeps up and back until the weapon points overhead-behind; torso leans back ~8°; free arm counterbalances. Held indefinitely because the simulation owns how long a telegraph lasts |
| strike         | 0.15 s                      | The arm chops through vertical to ~40° below horizontal, torso whips forward ~12°, root drops; the arc effect flashes across the whole window                                                   |
| recovery       | 0.6 s                       | Returns to idle with a slight overshoot, so having-just-attacked is visibly distinct from idling                                                                                                |
| crossbowAim    | 0.4 s, holds                | Both arms level forward, weapon flat                                                                                                                                                            |
| crossbowReload | 1.2 s                       | Weapon arm drops, free hand makes two small cranking circles, head looks down at the work                                                                                                       |

Sword, hammer and javelin all play idle / walk / windup / strike / recovery. The crossbow plays idle / walk / crossbowAim / crossbowReload.

### The swing arc

A flat fan of triangles swept along the weapon-tip path during the strike window, additive-blended, faded over its short life. It exists because the demo's own combat already tells the strike with a blade arc, and the readability being judged is pose-plus-arc, not pose alone. A toggle turns it off so both states can be seen.

### The consumption-size strip

The centrepiece. A second, small canvas shows eight cells, one per heading, each rendered with the sprite bake's own camera geometry: orthographic, frame width 2.5 units, positioned at radius 5.8 and elevation 1.15 looking at height 1.08 — in practice a nearly level view. The heading step is the bake's mirrored wheel (clockwise, negated), and the mirror is accepted for the same reason the bake accepts it: a skeleton read in a mirror is a skeleton, and every clip mirrors with it. Cells render small — selectable at 32, 48 or 64 pixels — with antialiasing off and nearest-neighbour upscaling behind a pixelation toggle, so what is judged is what the game would actually composite. The strip animates live alongside the main view.

### What this experiment decides, and what happens on each answer

If the strip reads — windup, strike and recovery distinguishable at 48 pixels, weapon identity clear per type — then this body and this clip format become the enemy art direction, and the follow-up work (not this plan's) is: port the accepted tables into the existing Blender bake as the sprite source or bake directly from this runtime, retire the anatomical authoring rig from the enemy pipeline, and archive the long-sword-guards plan whose direction this supersedes. If it does not read, the experiment is a folder and a catalog entry, deleted at the cost of an afternoon — which is the shape an experiment should have.

## Non-Goals

1. No baking to sprite atlases and no changes to the existing Blender or ImageMagick pipeline — this workbench answers whether the style reads, not how it ships.
2. No integration with the demo, its enemies, or its content tables.
3. No textures; flat colour is part of what is being tested.
4. No deaths, hurt, or stunned clips — the seven clips above are enough to judge the thesis, and the rest are additions to a format that will already have been accepted.
5. No changes to the existing Three.js preview, the authoring rig, or anything under the sibling folder; no shared modules between the two — the small helpers this needs are duplicated deliberately so the experiment stays killable.
6. No runtime-3D-versus-sprites decision; both consumers remain possible on purpose.
7. No in-page clip editor; the authoring loop under test is edit-the-table-and-reload.
8. No new tests.

## Acceptance Criteria

1. The workbench opens from the debug hub at its own route, with selectors for weapon and clip, play/pause, scrubbing, and speed.
2. Sword, hammer and javelin play the identical melee clip set with only the socketed mesh differing; the crossbow plays its own hold and reload.
3. The eight-heading strip runs live at a selectable game scale with the pixelation toggle, using the bake camera's orthographic geometry and mirrored heading order.
4. The strike shows the swing arc within its window, and the arc can be toggled off.
5. A person holding the strip at 48 pixels can tell windup, strike and recovery apart, and can tell which weapon a figure carries. This judgment is the user's and is not automated.
6. `npm run verify` passes; the repository changes are the new folder, one catalog entry, and the plan-tracking bookkeeping, nothing else.
7. No test files are added or modified.

## Execution

Perishable: this records the codebase on 2026-07-31; re-check coordinates against live code before acting on them. The implementing session needs no Blender, no bake run, and nothing from the `assets/` tree — the whole experiment is TypeScript against the browser.

### Files

Everything new lives in `src/app/debug/three-block/`:

- `three-block.ts` — the shell: builds the page DOM (title, viewport, sidebar controls, strip canvas), instantiates the runtime, wires selectors. Mirror the structure of `src/app/debug/three-preview/three-preview.ts`, which is the proven pattern for a lazily loaded Three.js tool, including the `createDebugPage` import from `@/app/debug/debug-shell` and the WebGL-failure fallback.
- `three-block.css` — own stylesheet, imported by the shell exactly as `three-preview.css` is.
- `block-contracts.ts` — the joint-name union, `BlockPose`, `BlockClip`, weapon and clip id unions.
- `blocky-skeleton.ts` — builds the body described in Design as a `THREE.Group` hierarchy with named pivot groups; exposes `setPose(pose)`, the weapon socket, and a `dispose()`.
- `block-weapons.ts` — the four weapon meshes, each a function returning a group sized to the socket.
- `block-clips.ts` — the clip tables from Design as data, plus `sampleClip(clip, time): BlockPose` with smoothstep between keys and hold-at-end for non-looping clips.
- `block-vfx.ts` — the swing arc mesh and its fade.
- `block-runtime.ts` — renderer, main perspective camera with OrbitControls, lights, floor disc, the render loop, and the strip: a second small `WebGLRenderer({ antialias: false })` on its own canvas, eight orthographic cameras, scissored cells.

One existing file changes: `src/app/debug/debug-tools.ts` — add an entry to `DEBUG_TOOLS` (id `three-block`, path `/debug/three-block`, lazy import of the shell) beside the `three-preview` entry at the top of the array.

Bookkeeping: `TODO.md` already carries the `[three_block]` line pointing at this plan; when the work ships, record the outcome in `CHANGELOG.md` and cut the line per the tracker's own rules.

### Facts pulled from the codebase

- Catalog pattern: `src/app/debug/debug-tools.ts` line 14 on — `DEBUG_TOOLS` is a readonly array of `{ id, path, title, description, load }`, `load` returning `import(...).then` mapped to `{ render }`.
- The bake camera, from `dev/tools/skeletons/build.py` `configure_render` and `aim_camera`: orthographic with `ortho_scale = 2.5` (frame is 2.5 world units wide), positioned at `outward * 5.8 + (0, 0, 1.15)` looking at `(0, 0, 1.08)`, where `outward` comes from `angle = π/2 − (direction / 8) · 2π`. Blender is Z-up; this workbench is Three.js Y-up, so the same geometry is `position = (cos(angle)·5.8, 1.15, sin(angle)·5.8)` with `lookAt(0, 1.08, 0)` — reusing the negated (mirrored) step, whose long justification lives in the comment above `aim_camera` and does not need re-deriving.
- Three.js `OrthographicCamera` takes half-extents: frame width 2.5 means `left/right = ∓1.25`, `top/bottom = ±1.25`.
- Colour literals to copy (not import) from `src/app/debug/three-preview/skeleton-swordsman.ts`: bone `0xd7c9a4`, dark bone `0x9d8f70`, steel `0xc8d0d8`; brass `0x92713c` and grip `0x38251c` appear in its sword builder.
- Small helpers worth copying (not importing) from `src/app/debug/three-preview/preview-utils.ts`: `disposeObject`, `createStandardMaterial`. Duplication is deliberate per Non-Goal 5.
- The dependency-cruiser orphan rule warns on modules nothing imports; every new module is reached from the shell, and the shell from the catalog's lazy import, so nothing trips it. The boundary rules do not constrain `src/app/debug/` beyond that.
- The single browser spec `test/e2e/debug-route.spec.ts` boots the hub and opens one lazily loaded tool. It is outside `verify`. Read it before assuming a new catalog entry is invisible to it; if it enumerates tools, it must not be edited to accommodate the new one without the user asking — check, and if there is a conflict, report rather than patch.
- Vite dev server: `http://localhost:5273`, strict port, user-owned — never restart it. HMR makes the edit-table-reload loop immediate.

### Implementation order

1. Catalog entry + shell + empty runtime rendering a floor: the route opens.
2. `blocky-skeleton.ts` + weapons: body stands, weapon swaps.
3. Clips + sampler + transport controls: motion plays, scrubbing works.
4. The strip with bake-camera geometry + pixelation: judgment surface live.
5. The swing arc.
6. Sign-fixing pass on the clip tables against the live view — expected, budgeted, and the reason the tables are data.

### Verification

`npm run verify` (all six stages; must exit 0). Then open `/debug/three-block` from the hub and exercise: every weapon × every clip, scrub each, strip at each scale with pixelation on and off, arc on and off, scene switch away and back for cleanup. Report what was seen, per the test-operations contract's reporting section — the judgment in Acceptance Criterion 5 belongs to the user and ends the experiment one way or the other.
