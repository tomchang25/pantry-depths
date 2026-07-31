# The Block Skeleton Experiment

## Goal

Build a blocky, big-headed skeleton in the existing Blender pipeline, drive every clip from small numeric tables in the build script, and judge the result in the browser at the size the game actually draws enemies. The current enemy pipeline sits at a fidelity level nobody can afford: the body is detailed enough that script-authored poses read wrong, and hand-posing every clip for every weapon is a cost the project has measured and rejected. A blocky body lowers the animation bar to where numeric tables clear it — which makes the authoring loop automatable — and the recognised voxel-character style means the simplicity reads as style rather than as cheapness. Authoring in Blender rather than in the browser keeps two things the browser route would lose: the accepted result feeds the existing sprite bake without a port, and the fallback when a table reads wrong is opening the file in pose mode rather than building an editor.

## Requirements

1. The experiment's viewer lives in its own workbench behind its own debug route, beside the existing Three.js preview rather than inside it, so it can be judged, iterated, or killed without touching anything else. The workbench displays; it authors nothing.
2. The body is assembled from axis-aligned blocks at big-head proportions, identified by silhouette and flat colour alone — no textures. At the size the game draws an enemy, a big head is what makes the identity legible: a seven-head figure at forty pixels has a five-pixel skull, a four-head figure a ten-pixel one.
3. Every clip is a small table of joint angles over time in the Blender build script — the same architecture the existing sprite bake has always used. No inverse kinematics anywhere: every limb is one bone, so there is no middle joint to solve, and the two-handed grip that motivated the project's inverse-kinematics rig no longer exists once a weapon is bound one-handed along the arm. Editing a number and re-running the generator is the authoring cycle.
4. The fallback for a pose no table gets right is a person opening the generated file and rotating six bones in pose mode — a facility Blender provides and the user already knows — and never the construction of new tooling. This requirement exists because the alternative authoring route (browser-native tables) was considered and rejected precisely for lacking a fallback short of building a pose editor.
5. One melee clip set serves sword, hammer and javelin — the weapon is a mesh swap in the hand socket, and a javelin throw is the same overhead arc as a chop since the projectile is the simulation's to spawn, not the sprite's to draw. The crossbow alone carries its own two clips: a level hold and a reload, the reload being a pose the game's design notes already want a visible window for.
6. The strike is judged with a swing-arc effect over it, because the thesis under test is key poses plus effects rather than in-between frames. The arc is drawn by the viewer, not carried in the asset — in the shipped game the arc is the renderer's job, so the asset carrying poses and the presentation carrying effects is the honest division.
7. The primary judgment surface is consumption size: a live strip of all eight headings at game scale, drawn with the same camera geometry the sprite bake uses, with a pixelation toggle. The full-size orbit view exists to debug, not to judge; every prior misjudgment in this area came from evaluating bodies at workbench distance.
8. The workbench is verified by opening it. No new tests of any kind, per the standing test-operations contract.

## Design

### The fidelity fixed point

The project has now run the same experiment at three fidelity levels and the results triangulate. Script-authored pose tables driving an anatomical body shipped clips of which only two read correctly. Hand-posing that body through a full inverse-kinematics rig produced correct single poses at a cost — minutes per pose, a person's eye required throughout — that does not scale to seven clips across four weapon types. What was never tried is lowering the body to meet the tables. A blocky figure has so few degrees of freedom, and such coarse silhouette units, that a pose specified as "weapon arm raised 150 degrees, torso leaned back eight" is unambiguous — there is nothing subtle left to get wrong. Model fidelity, animation fidelity, and authoring capacity finally agree, and the agreeing point is the one where a script is a sufficient author and a person is needed only to say yes or no to the result.

The table-driven build script is not a new idea here — it is the architecture the sprite bake has always had, and the architecture that was blamed when its clips read wrong. The diagnosis this experiment encodes is that the tables were never the defect: the body they drove demanded more subtlety than tables can express. Lower the body to the tables' level and the original automation becomes sufficient, with the whole render-and-montage half of the pipeline already built and untouched.

### One pipeline, two doors

```
blocky body + clip tables (Python, in the Blender build script)
        │  regenerate on every table edit (seconds)
     .blend ──→ .glb (the export bridge already proven this week)
        │                    │
   on acceptance:       the three-block workbench:
   the existing bake    loads the file, plays its clips,
   renders and bakes    draws the swing arc, and shows the
   atlases unchanged    eight-heading strip at game size
```

What is judged in the browser is byte-for-byte the asset that would feed the bake — there is no port between experiment and production, so there is nothing to drift. The fallback path enters the same diagram from the side: a person opens the `.blend`, fixes a pose in pose mode, and the same export carries the fix out.

### The body

Roughly two units tall, four heads to the body. Blender-side it stands on the Z-up floor facing +Y, matching the existing bake's conventions; the glTF export converts to Y-up, and the viewer applies the half-turn the project's first import taught it to (an unturned import faces away from the camera). All parts are boxes; all joints are rotation-only pivots.

| Part      | Size (w × h × d)       | Notes                                                                                        |
| --------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Head      | 0.52 cube              | Centre near 1.72 high; two dark socket boxes and a nasal slit inset on the front face        |
| Rib slats | 0.44 × 0.10 × 0.16, ×3 | Stacked with gaps between 1.02 and 1.44 — the gaps are what say skeleton in silhouette       |
| Spine     | 0.10 × 0.50 × 0.10     | Behind the slats                                                                             |
| Pelvis    | 0.36 × 0.12 × 0.16     |                                                                                              |
| Arms      | 0.14 × 0.62 × 0.14     | Pivot at the shoulder, hanging; thin limbs are the skeleton identity within the blocky genre |
| Legs      | 0.14 × 0.80 × 0.14     | Pivot at the hip; no feet, legs end flat on the floor                                        |

Bones: root (whole-body lift and lean), head, arm.L, arm.R, leg.L, leg.R — six, plus a weapon bone parented to the weapon arm's end so the viewer can find the tip. A pose is at most seven entries. There are deliberately no elbows, knees, hands or feet: each absent joint is an absent way for a pose to be subtly wrong.

All four weapons — sword, hammer, javelin, crossbow — are small box assemblies bound to the weapon bone, their long axis continuing the arm's own: raise the arm and the blade points up, chop and it sweeps down. All four ship in the one file; the viewer shows one at a time. Flat colours only, reusing the bone, dark-bone, steel and brass values the existing preview proved; pixel-skin texturing is a possible later pass and deliberately not part of this experiment.

### The clip vocabulary

A clip is a named action whose keyframes come from a table of `(frame, pose)` rows, where a pose maps bone names to Euler degrees plus optional root lift and lean. Starting tables below, intents stated so the numbers can be corrected on sight — signs are expected to need a fixing pass against the live view, which is minutes per clip and is the authoring loop working as designed:

| Clip           | Length                      | Intent                                                                                                                                                                                          |
| -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle           | 1.6 s loop                  | Near-still: a few degrees of torso sway and head drift, nothing that reads at distance                                                                                                          |
| walk           | 0.8 s loop                  | Arms and legs swing opposite at ±35°, root bobs slightly — the Minecraft walk, which is the genre's own                                                                                         |
| windup         | 0.5 s, holds its last frame | Weapon arm sweeps up and back until the weapon points overhead-behind; torso leans back ~8°; free arm counterbalances. Held indefinitely because the simulation owns how long a telegraph lasts |
| strike         | 0.15 s                      | The arm chops through vertical to ~40° below horizontal, torso whips forward ~12°, root drops                                                                                                   |
| recovery       | 0.6 s                       | Returns to idle with a slight overshoot, so having-just-attacked is visibly distinct from idling                                                                                                |
| crossbowAim    | 0.4 s, holds                | Both arms level forward, weapon flat                                                                                                                                                            |
| crossbowReload | 1.2 s                       | Weapon arm drops, free hand makes two small cranking circles, head looks down at the work                                                                                                       |

Sword, hammer and javelin play idle / walk / windup / strike / recovery. The crossbow plays idle / walk / crossbowAim / crossbowReload. The clip names above are a contract: the viewer selects animations by these exact names, so the build script and the viewer agree by string rather than by position.

### The swing arc

A flat fan of triangles the viewer sweeps along the weapon-tip path during the strike, additive-blended, faded over its short life. The tip path comes from the weapon bone's world position each frame, so the arc follows whatever the table says without being told. It exists because the demo's own combat already tells the strike with a blade arc, and the readability being judged is pose-plus-arc, not pose alone. A toggle turns it off so both states can be seen.

### The consumption-size strip

The centrepiece. A second, small canvas shows eight cells, one per heading, each rendered with the sprite bake's own camera geometry: orthographic, frame width 2.5 units, positioned at radius 5.8 and elevation 1.15 looking at height 1.08 — in practice a nearly level view. The heading step is the bake's mirrored wheel (clockwise, negated), and the mirror is accepted for the same reason the bake accepts it: a skeleton read in a mirror is a skeleton, and every clip mirrors with it. Cells render small — selectable at 32, 48 or 64 pixels — with antialiasing off and nearest-neighbour upscaling behind a pixelation toggle, so what is judged is what the game would actually composite. The strip animates live alongside the main view.

### What this experiment decides, and what happens on each answer

If the strip reads — windup, strike and recovery distinguishable at 48 pixels, weapon identity clear per type — then this body and clip format become the enemy art direction, and the follow-up work (not this plan's) is: point the existing bake's render-and-montage half at the blocky body and its actions, retire the anatomical authoring rig from the enemy pipeline, and archive the long-sword-guards plan whose direction this supersedes. If it does not read, the first correction is cheap by construction — tables are numbers, and the pose-mode fallback stands behind them — and if the direction itself fails, the experiment is a build script, a folder and a catalog entry, deleted at the cost of an afternoon.

## Non-Goals

1. No baking to sprite atlases yet, and no changes to the existing skeleton build script or the ImageMagick pipeline — the blocky generator is a sibling, not an edit.
2. No integration with the demo, its enemies, or its content tables.
3. No textures; flat colour is part of what is being tested.
4. No deaths, hurt, or stunned clips — the seven clips above are enough to judge the thesis, and the rest are additions to a format that will already have been accepted.
5. No changes to the existing Three.js preview or the anatomical authoring rig; no shared modules between the two workbenches — the small helpers this needs are duplicated deliberately so the experiment stays killable.
6. No inverse kinematics and no new rig tooling of any kind; the pose-mode fallback is the entirety of the manual path.
7. No runtime-3D-versus-sprites decision; both consumers remain possible on purpose, and this pipeline feeds either.
8. No in-page clip editor; the authoring loop under test is edit-the-table-and-regenerate.
9. No new tests.

## Acceptance Criteria

1. Running one generator command rebuilds the `.blend` and the `.glb` from nothing; running it twice produces the same result.
2. The workbench opens from the debug hub at its own route, loads the exported file, and offers selectors for weapon and clip, play/pause, scrubbing, and speed.
3. Sword, hammer and javelin play the identical melee clip set with only the visible weapon differing; the crossbow plays its own hold and reload.
4. The eight-heading strip runs live at a selectable game scale with the pixelation toggle, using the bake camera's orthographic geometry and mirrored heading order.
5. The strike shows the viewer-drawn swing arc within its window, and the arc can be toggled off.
6. A person holding the strip at 48 pixels can tell windup, strike and recovery apart, and can tell which weapon a figure carries. This judgment is the user's and is not automated.
7. A pose corrected by hand in pose mode on the generated file survives the export and appears in the workbench — the fallback path is demonstrated once, not merely asserted.
8. `npm run verify` passes; the repository changes are the new build scripts, the new folder, one catalog entry, the exported asset, and the plan-tracking bookkeeping, nothing else.
9. No test files are added or modified.

## Execution

Perishable: this records the codebase on 2026-07-31; re-check coordinates against live code before acting on them. The implementing session needs Blender only through the generator commands — never interactively — and the patterns for every Blender-touching step already exist in the repository and are named below.

### Files

Blender side, following the generator/implementation split the tooling tree already uses:

- `dev/tools/skeletons/blocky_build.py` — new implementation: builds the blocky body and its six-bone armature, creates the seven actions from the numeric tables, stashes every action into its own NLA track, and exports the `.glb`. Mirror the structure of `dev/tools/skeletons/authoring_rig.py` (bone/armature construction, the crash-to-exit-code guard at the bottom, the build report printed on every run) and of `dev/tools/skeletons/build.py` `create_actions` (keyframing actions from tables).
- `dev/tools/generate-blocky-skeleton.py` — new entrypoint directly under `dev/tools/`, mirroring `dev/tools/generate-authoring-rig.py`: finds Blender (`shutil.which` then the known path `C:\Program Files\Blender Foundation\Blender 3.6\blender.exe`), deletes the targets first, runs the implementation headless, verifies both files exist afterwards. Targets: `assets/enemies/skeleton-blocky/skeleton-blocky.blend` (outside version control, the pose-mode fallback surface) and `src/app/debug/three-block/assets/skeleton-blocky.glb` (committed, the viewer's input).

Browser side, everything new under `src/app/debug/three-block/`:

- `three-block.ts` — the shell: page DOM via `createDebugPage` from `@/app/debug/debug-shell`, sidebar controls, WebGL-failure fallback. Mirror `src/app/debug/three-preview/three-preview.ts`.
- `three-block.css` — own stylesheet, imported by the shell.
- `block-contracts.ts` — the clip-name and weapon-name unions and the per-weapon clip map from Design, plus the strike's arc window. These strings are the contract with the Python tables.
- `block-runtime.ts` — renderer, perspective camera with OrbitControls, lights, floor disc, `GLTFLoader` + `AnimationMixer`, the render loop, and the strip: a second small `WebGLRenderer({ antialias: false })` on its own canvas, eight orthographic cameras, scissored cells. The loader pattern — including the `?url` asset import and the half-turn after import — is proven in `src/app/debug/three-preview/authored-swordsman.ts`.
- `block-vfx.ts` — the swing arc: sample the weapon bone's world tip each frame during the strike window, sweep a fan, fade it.

One existing file changes: `src/app/debug/debug-tools.ts` — add an entry to `DEBUG_TOOLS` (id `three-block`, path `/debug/three-block`, lazy import of the shell) beside the `three-preview` entry at the top of the array.

Bookkeeping: `TODO.md` already carries the `[three_block]` line pointing at this plan; when the work ships, record the outcome in `CHANGELOG.md` and cut the line per the tracker's own rules.

### Facts pulled from the codebase

- Catalog pattern: `src/app/debug/debug-tools.ts` line 14 on — `DEBUG_TOOLS` is a readonly array of `{ id, path, title, description, load }`, `load` returning `import(...).then` mapped to `{ render }`.
- The bake camera, from `dev/tools/skeletons/build.py` `configure_render` and `aim_camera`: orthographic with `ortho_scale = 2.5` (frame is 2.5 world units wide), positioned at `outward * 5.8 + (0, 0, 1.15)` looking at `(0, 0, 1.08)`, where `outward` comes from `angle = π/2 − (direction / 8) · 2π`. Blender is Z-up; the viewer is Three.js Y-up, so the same geometry is `position = (cos(angle)·5.8, 1.15, sin(angle)·5.8)` with `lookAt(0, 1.08, 0)` — reusing the negated (mirrored) step, whose justification lives in the comment above `aim_camera` and does not need re-deriving.
- Three.js `OrthographicCamera` takes half-extents: frame width 2.5 means `left/right = ∓1.25`, `top/bottom = ±1.25`.
- GLB export from a script: `dev/tools/skeletons/export_glb.py` shows the working call — select the rig and every mesh carrying the `skeleton_part` custom property, then `bpy.ops.export_scene.gltf(export_format="GLB", use_selection=True, export_animations=True, ...)`. The blocky build should tag its meshes with the same `skeleton_part` property and reuse the selection idiom.
- **The multi-clip wrinkle, known in advance:** the existing export carries a single active action and sets `export_nla_strips=False`. Seven separate clips need each action stashed in its own NLA track (`rig.animation_data.nla_tracks.new()` then `track.strips.new(name, start, action)`, one track per action, `use_fake_user` set on each) and `export_nla_strips=True`, which makes the glTF exporter emit one named animation per track. Name the tracks exactly as the clip contract spells them — the viewer selects by these strings.
- Import orientation: glTF converts Blender's Z-up to Y-up, which leaves the body facing −Z in Three.js; `src/app/debug/three-preview/authored-swordsman.ts` documents the symptom (a body showing the camera its back, arms hidden behind the ribs) and the fix (`scene.rotation.y = Math.PI` after load).
- Blender-side keyframing of actions from tables: `dev/tools/skeletons/build.py` `create_actions` is the working reference. Blender exits zero even when a `--python` script crashes, so the implementation keeps the try/except-to-`sys.exit(1)` guard and the entrypoint keeps the delete-first, verify-after discipline — both already written in `dev/tools/skeletons/authoring_rig.py` and `dev/tools/generate-authoring-rig.py` and worth copying verbatim.
- Colour literals to copy (not import) from `src/app/debug/three-preview/skeleton-swordsman.ts`: bone `0xd7c9a4`, dark bone `0x9d8f70`, steel `0xc8d0d8`; brass `0x92713c` and grip `0x38251c` appear in its sword builder. The Blender-side materials use the same values through the `material()` helper in `dev/tools/blender-kit/primitives.py`.
- Small helpers worth copying (not importing) from `src/app/debug/three-preview/preview-utils.ts`: `disposeObject`, `createStandardMaterial`. Duplication is deliberate per Non-Goal 5.
- The dependency-cruiser orphan rule warns on modules nothing imports; every new browser module is reached from the shell, and the shell from the catalog's lazy import. Python under `dev/tools/` is not cruised.
- The single browser spec `test/e2e/debug-route.spec.ts` boots the hub and opens one lazily loaded tool. It is outside `verify`. Read it before assuming a new catalog entry is invisible to it; if it enumerates tools, report the conflict rather than patch the spec — editing tests without being asked is forbidden here.
- Vite dev server: `http://localhost:5273`, strict port, user-owned — never restart it. A `.glb` under `src/` imports through `?url` and is fingerprinted by the bundler like the existing PNGs are.

### Implementation order

1. Catalog entry + shell + empty runtime rendering a floor: the route opens.
2. `blocky_build.py` body + armature + a single idle action; generator command runs end to end; viewer loads and plays it.
3. The remaining six actions from the tables; NLA stash; viewer's clip and weapon selectors.
4. The strip with bake-camera geometry + pixelation: judgment surface live.
5. The swing arc.
6. Sign-fixing pass on the tables against the live strip — expected, budgeted, and the reason the tables are data.

### The iteration loop, stated once

Edit a table in `blocky_build.py` → `python dev/tools/generate-blocky-skeleton.py` (seconds) → reload the workbench tab → look at the strip. When a pose resists the tables, open `assets/enemies/skeleton-blocky/skeleton-blocky.blend`, fix the bone in pose mode, key it, save, re-run only the export half — and fold the fixed numbers back into the table afterwards so the generator stays the source of truth.

### Verification

`npm run verify` (all six stages; must exit 0). Then open `/debug/three-block` from the hub and exercise: every weapon × every clip, scrub each, strip at each scale with pixelation on and off, arc on and off, switch to another tool and back for cleanup. Demonstrate the fallback once per Acceptance Criterion 7. Report what was seen, per the test-operations contract's reporting section — the judgment in Acceptance Criterion 6 belongs to the user and ends the experiment one way or the other.
