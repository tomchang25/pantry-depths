# Retiring The Interim Projection And Rebuilding The Entity Workbench

Parent Plan: none (standalone spec)

## Goal

Leave the repository with one renderer. Every development surface that still inspects the interim projection either moves onto the Three.js runtime or is deleted, and the interim projection, the ray-marched renderer, and the image pipeline and baked artwork that only they read go out behind them.

## Summary

This replaces child 5 of `three_scene_graduation.plan.md`, which is cancelled in the same change. That child assumed the entity workbench would be rewired onto the runtime and left the fate of the shared scene vocabulary as an open question it would answer in conversation. Both assumptions are now settled and the answers are different enough that editing the child would have been rewriting it: the entity workbench is deleted rather than rewired, the block viewer takes its route, and the scene vocabulary dies outright because the two surfaces that were expected to keep it — the floor preview and the shared render panel — both hand the runtime a world instead.

**What is already true.** The game draws through `SceneRenderer`. `src/app/debug/render-panel.ts` has been rewritten to host that renderer, take a world per frame, and expose measurement marks through an overlay canvas that projects through the renderer's own camera. The prop, carried, HUD-attack and floor-preview surfaces are already rewired onto it. What remains on the interim projection is the entity workbench and a panel written to keep it there.

**What changes.**

| Surface                                        | Ending                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/debug/entity-workbench`                      | Deleted whole. Its route, name and title are taken over by the block viewer.                                                       |
| `/debug/three-block`                           | Graduates out of `src/sandbox/` into `src/app/debug/entity-workbench/` and becomes the entity workbench.                           |
| `/debug/three-preview`                         | Deleted. Its bone-burst and bisection showcases are rebuilt against the block rig inside the new workbench; nothing else survives. |
| `/debug/three-scene`                           | Deleted, after its four knobs move into the game's own development panel.                                                          |
| `/debug/hud-attack-workbench`                  | Unchanged in what it asks and shows. It keeps the rewiring already done, because it cannot survive the deletion otherwise.         |
| `/debug/map-workbench`, `/debug/sfx-workbench` | Untouched.                                                                                                                         |

**How.** Six ordered stages: the workbench swap, the pickup and display authoring moving into it, the preview experiment's ending, the scene tool's ending, the demolition itself, then the governance the demolition invalidates. Nothing is deleted while a reader survives — every stage rewires before it removes.

**What it looks like landed.** One renderer, one preview host, one place a body is judged. Roughly fifteen thousand lines and eighty-one megabytes of baked skeleton artwork leave the repository, about a thousand lines move in, and `src/sandbox/` is empty with its track still declared.

**One judgement worth flagging on review.** Carrying the bone burst and the bisection over is a rebuild, not a move: those showcases animate a procedural swordsman that the block rig replaces, so the effect code moves and the body it acts on becomes the rig the game actually ships. If that is not worth its cost, cut stage 3's second half and delete the experiment outright — nothing else in this document depends on it.

## Requirements

1. Exactly one renderer exists in the repository when this lands. The interim projection tree, the ray-marched renderer, and the image pipeline and baked artwork that only they read are deleted rather than left dormant, because dormant code that once drew the game is the most convincing wrong answer a later reader can find.
2. Every debug route still opens and still does its job. The map workbench and the HUD workbench keep every control and every judgement they have today; what changes behind them is the picture, not the question.
3. The entity workbench becomes the block viewer rather than being rewired. The deleted tool previewed sprite projections that will not exist after this change, and rebuilding it against the runtime would be writing the same tool twice.
4. Authoring survives the deletion. `entity-display.json` is live content the runtime reads every frame, and the deleted workbench was the only surface that wrote it; the replacement writes it and previews unsaved values against the runtime rather than against a second projection of its own.
5. The sandbox tree empties without the track ending. One experiment graduates into the debug layer, the other is deleted, and the track, its import boundaries and its machine-enforced test budget stay declared for whatever is tried next.
6. The game's own picture and feel do not change. The only edit inside `src/runtime/` is the development panel gaining the four knobs the deleted scene tool held.
7. No new tests of any kind. The debug surfaces are verified by opening them and the game by playing it, per `dev/agent_rules/test_operations.md`.

## Relational Context

- `render-panel.ts` is the single preview host: it owns a `SceneRenderer`, takes a `World` per frame, and draws authoring aids on an overlay canvas fed by the renderer's own projection. A workbench hands it a world, never a picture. The shape to avoid is the one being deleted — pushing marks through the renderer, which made it carry a channel that existed only for tools.
- `createWorkbenchWorld()` in `render-panel.ts` builds a real world from the default map through `createWorld`. Callers pose that world with the game's own functions — `createEnemy` and `dropProp` from `@/core/world` — rather than assembling a stage by hand; a hand-built stage agrees with the game right up until it silently stops.
- `world-bodies.ts` parses `entity-display.json` once at module scope into a module constant, so there is no way in for an unsaved slider value. The new workbench needs a display-override channel on the renderer, in the same shape as the attack override `viewmodel.ts` already carries and set by nothing else.
- The sandbox boundary rule `sandbox-imports-only-itself-content-core` forbids `src/sandbox/` reaching `src/presentation/`. The block viewer hosts `SceneRenderer` after this change, so it cannot stay a sandbox experiment. Per `dev/standards/project_structure.addendum.md`, graduation is a move into the owning layer with the sandbox folder deleted in the same change — never an in-place promotion and never a relaxed boundary.
- `dev/tools/generate-blocky-skeleton.py` writes the rig into the sandbox folder, while `world-bodies.ts` imports the copy under `src/content/enemies/assets/`. The content copy is the survivor and the generator is repointed at it; two copies is how the browser and the build disagree about which rig is current.
- `block-clips.ts` under `scene-3d` and `block-contracts.ts` in the experiment hold the same clip and weapon names, copied. `block-clips.ts` survives and the workbench imports it; the contracts module keeps only the bake camera, the bake lights and the bone names, which are the workbench's own and nothing else's.
- Deletion order is load-bearing: nothing is removed while a reader survives. Entity workbench, then `legacy-render-panel.ts`, then `src/demo/`, then `canvas-gameplay-renderer.ts`, then `render-scene.ts` with `procedural-textures.ts`, `presentation-image-loader.ts` and `presentation-asset-definitions.ts`, then the skeleton appearance chain and its atlases.
- `window.demoWorld` and `window.demoRenderer` in `surface.ts` are development handles the capture harness reads by name rather than importing, so a rename fails silently instead of loudly. Both stay. `window.__sceneRuntime` was the scene tool's second, incompatible arrangement of the same idea and goes with it.
- `test/unit/app/debug/debug-router.test.ts` asserts the entity workbench's id, path and title against the catalog. Keeping all three unchanged is what lets that test stay true without being edited.
- `test/unit/repository/sandbox-test-budget.test.ts` guards the sandbox track and passes over an empty tree. It is not edited, exempted, or relocated.

## Scope

### Included

- The entity workbench swap, and the pickup and display-number authoring moving into it.
- The preview and scene debug tools ending, including the four knobs the scene tool held moving into the game's development panel.
- Deleting the interim projection tree, the ray-marched renderer, the image pipeline they shared, and the baked skeleton artwork only they read.
- The governance, boundary rules and plan edits the deletion invalidates.

### Excluded

- Any change to the map workbench, the sfx workbench, or the room workbench.
- Any change to what the game draws, how it plays, or how it feels. The runtime edit is additive and confined to the development panel.
- The fidelity tail: structure weathering, hold-driven room lights, swing aim, and the waterline cut stay child 6 of the graduation plan.
- Corpse and soft-body work, which `humanoid_block_bodies.plan.md` and `slime_bodies.plan.md` own.
- Any new test, browser spec, or promoted picture comparison.

## Files to Change

| File                                                                                                                                    | Change Size | Purpose                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `src/app/debug/entity-workbench.ts`                                                                                                     | Large       | Deleted whole, after its display-authoring strip and its enemy-posing arithmetic have been read out of it. |
| `src/sandbox/three-block/**`                                                                                                            | Large       | Moves to `src/app/debug/entity-workbench/`; the folder and its duplicate rig asset are deleted.            |
| `src/app/debug/entity-workbench/entity-workbench.ts`                                                                                    | Large       | The new tool: the rig viewer, the room panel, the display strip, the pickup, and the destruction previews. |
| `src/app/debug/entity-workbench/entity-workbench.css`                                                                                   | Medium      | The experiment's stylesheet, renamed off its `three-block__` class prefix.                                 |
| `src/app/debug/entity-workbench/block-contracts.ts`                                                                                     | Small       | Narrowed to the bake camera, bake lights and bone names; clip and weapon names now imported.               |
| `src/app/debug/prop-workbench.ts`                                                                                                       | Small       | Keeps its rewired form and gains its new owner.                                                            |
| `src/app/debug/debug-tools.ts`                                                                                                          | Small       | Two catalog entries become one; two entries are removed.                                                   |
| `src/app/debug/legacy-render-panel.ts`                                                                                                  | Small       | Deleted; it exists only to keep the deleted workbench on the old renderer.                                 |
| `src/app/debug/three-scene.ts`, `three-scene.css`                                                                                       | Medium      | Deleted after their knobs move.                                                                            |
| `src/sandbox/three-preview/**`                                                                                                          | Large       | Deleted; two showcases are rebuilt against the block rig first.                                            |
| `src/presentation/scene-3d/scene-renderer.ts`, `world-bodies.ts`                                                                        | Small       | Gain the display-override channel the workbench authors through.                                           |
| `src/runtime/dev-overlay.ts`, `src/runtime/surface.ts`                                                                                  | Medium      | Gain map selection and the torch, grain and viewmodel-kind toggles.                                        |
| `src/demo/**`                                                                                                                           | Large       | Deleted.                                                                                                   |
| `src/presentation/canvas-gameplay-renderer.ts`, `render-scene.ts`, `procedural-textures.ts`, `presentation-image-loader.ts`             | Large       | Deleted.                                                                                                   |
| `src/content/presentation/presentation-asset-definitions.ts`                                                                            | Small       | Deleted with the loader that read it.                                                                      |
| `src/content/enemies/skeleton-appearance.ts`, `skeleton-action-definitions.ts`, `skeleton-death-definitions.ts`, `assets/skeleton-*/**` | Large       | Deleted; eighty-one megabytes of baked atlases leave with them.                                            |
| `dev/tools/generate-blocky-skeleton.py`                                                                                                 | Small       | Repointed at the surviving rig asset.                                                                      |
| `.dependency-cruiser.cjs`                                                                                                               | Medium      | Demo rules removed; the runtime rule's allowed set loses the demo tree.                                    |
| `dev/standards/project_structure.addendum.md`                                                                                           | Medium      | The demo tree and two-renderer declarations retire; the sandbox residents paragraph is rewritten.          |
| `dev/docs/plans/three_scene_graduation.plan.md`                                                                                         | Medium      | Child 5 cancelled; child 6's wall-materials bullet cut.                                                    |
| `TODO.md`, `CHANGELOG.md`                                                                                                               | Small       | Tracker pointer and shipped outcome.                                                                       |

## Execution Outline

1. **The workbench swap.** Read the display-authoring strip and the body-posing arithmetic out of `entity-workbench.ts`, then delete it. Move the experiment's five modules into `src/app/debug/entity-workbench/`, rename the shell and stylesheet, point the rig import at the content copy, narrow the contracts module against `block-clips.ts`, and delete `src/sandbox/three-block/` with its duplicate asset. Merge the two catalog entries into one keeping the entity workbench's id, path and title. Repoint the generator script. The route opens and the rig viewer works before anything else lands.
2. **The room, the numbers and the pickup.** Add the display-override channel to the renderer, then give the workbench a room panel built on `createRenderPanel` and `createWorkbenchWorld` that stands one body of the chosen archetype in front of the camera. Hang the four display sliders and the save and reload buttons on that panel, previewing through the override. Mount `createPropWorkbench()` beside it.
3. **The preview experiment ends.** Rebuild the bone burst and the bisection against the block rig inside the new workbench, then delete `src/sandbox/three-preview/` and its catalog entry.
4. **The scene tool ends.** Move map selection and the torch, grain and viewmodel-kind toggles into the game's development panel and confirm each works from inside the game. Then delete `three-scene.ts`, its stylesheet and its catalog entry.
5. **The demolition.** Delete `legacy-render-panel.ts`, then `src/demo/`, then the ray-marched renderer, then the scene vocabulary with the texture generator, the image loader and the asset definitions, then the skeleton appearance chain and its atlases — each only once the previous deletion has removed its last reader.
6. **The governance.** Cut child 5 from the graduation plan and child 6's wall-materials bullet, retire the demo-tree and two-renderer declarations, rewrite the sandbox residents paragraph, remove the demo boundary rules, add the tracker pointer, and record the outcome.

## Implementation Notes

**The new workbench.** The rig viewer is the tool's spine and the eight-heading strip stays: whether a body reads from every heading is still the question a workbench answers that play does not. The room panel is the second view, not the first — it exists so a body and a pickup are judged at game distance in the game's own light, which is where every misjudgement this project has made about a body was made.

**Posing a body.** Clear the world's enemies and place one through `createEnemy`, then drive its pose fields directly. The workbench steps no minds; the fields are set to the shape a body that has not thought about anything yet would hold, which is what the deleted tool did and the reason to read it before deleting it.

**The display override.** It carries one archetype's four numbers at a time and is cleared when the workbench closes. Saving goes through the existing authoring client target, which already writes this file; nothing new is needed on the tooling side.

**The scene tool's knobs.** The development panel already owns the cheats, so the four knobs join what is there rather than arriving as a second panel. Map selection restarts the run on the chosen map; the three renderer toggles are live.

**Deleting the artwork.** The atlases are the largest single item and the easiest to delete too early. Confirm nothing imports the appearance chain — the deleted workbench and the deleted projection tree are its only readers — and delete the definitions and the asset directories together, not in two passes.

**The bundle.** Recording the play chunk's size after the demolition is worth one line in the change summary. The graduation plan measured 233.78 kB raw and 76.15 kB gzipped before Three.js entered the production bundle; this change removes the renderer that number was measured against.

## Edge Cases

| Case                                         | Expected Handling                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The rig asset fails to load in the workbench | The panel reports it in its status line and stops its own loop, as the preview host already does; the rest of the tool stays usable.                       |
| A slime is selected in the room panel        | The body-scale slider goes inert, because a soft body's size comes from its own profile rather than from the display table.                                |
| An archetype that never winds up is selected | The three marker controls go inert; there is no mark to place.                                                                                             |
| Display values are slid but never saved      | They are lost on reload, and reload says so. The dev server does not watch these files, so saving cannot reload the page out from under whoever is tuning. |
| The capture harness runs after the deletion  | It still reads `window.demoWorld` for its stats and still writes pictures; no field it reads is renamed.                                                   |
| `src/sandbox/` is empty                      | The track, its boundary rules and its test budget stay declared and the budget guard passes over an empty tree.                                            |

## Acceptance Criteria

1. Exactly one renderer exists in the repository, nothing imports the interim projection, and neither that layer nor the baked skeleton artwork it read is still present.
2. Every debug route listed in the catalog opens from the hub and does what its description says.
3. The entity workbench shows a rig at sprite size across every heading, a body at game distance in a real room, a pickup on the same floor, and the two destruction previews; its display sliders move what the renderer draws and its save button writes the authored file.
4. The map workbench and the HUD workbench ask and show exactly what they asked and showed before, and the floor preview still draws an assembled floor from where the run arrives.
5. Map selection and the torch, grain and viewmodel-kind toggles are reachable from inside the game.
6. A full floor plays from the ordinary address with sound, readouts, pause, damage, death, restart and descent behaving as before, judged by playing it.
7. The aggregate verification gate passes, the governance check prints both of its clean lines, and the production build succeeds and opens in a browser.
