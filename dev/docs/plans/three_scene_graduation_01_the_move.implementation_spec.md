# Three-Scene Graduation 01 — The Move

Parent plan: `dev/docs/plans/three_scene_graduation.plan.md`, child 1.

## Goal

Move the Three.js runtime out of the sandbox and into the presentation layer, so the layer that owns everything that draws owns it too. The game still draws through the Canvas raycaster at the end of this change; what moves is where the replacement lives and which rules bind it.

## Summary

Fourteen modules leave `src/sandbox/three-scene/` for `src/presentation/scene-3d/`, the debug page that mounts them becomes an ordinary debug tool in `src/app/debug/`, and the block armature becomes authored content beside the enemy artwork it belongs with. The sandbox import rules stop applying and the ordinary presentation rules take over, with no rule text changed — the boundary checker was already describing both destinations correctly. Nothing in `src/runtime/` is touched and no pixel changes.

## Relational Context

- **Call direction.** The debug tool reads the runtime; the runtime reads `src/core/` and `src/content/`. Nothing reaches the other way, and nothing outside the debug tool reaches the runtime yet — the surface still calls the interim projection and the raycaster.
- **Ownership.** The runtime owns what is drawn and how it is lit. The debug tool owns the page around it: the map picker, the toggles, the diagnostics readout, and the stylesheet that lays them out. That split existed before the move and survives it unchanged.
- **Changed integration contract.** The page was described to a sandbox adapter and built by it; it is built directly from the debug shell now. Before: the module exported a descriptor and `mountSandboxExperiment` turned it into a render function. After: the module exports the render function and asks the shell for its own page.
- **Wrong shape to avoid.** A third module reaching for whichever procedural texture generator is nearer. Two renderers live in the presentation layer for the length of this plan and each was tuned against its own surfaces; the pairing is what is being kept intact, and a shared texture commons would quietly break the renderer that did not ask for it.

## Scope

### Included

- The fourteen runtime modules, the debug page and its stylesheet, and the glTF armature.
- The import rewiring the move forces, and the retirement of the sandbox page adapter for this one tool.
- The structure addendum: the presentation layer's contents, the scheduled end of the demo tree, and the temporary two-renderer duplication.

### Excluded

- Any change to `src/runtime/`, the interim projection, or the raycaster. The game is drawn identically before and after.
- Retiring the texture and artwork copies. See Implementation Notes — this is a correction to the parent plan, not an omission.
- The other two sandbox experiments, which are untouched and stay where they are.

## Files to Change

- `src/sandbox/three-scene/*.ts` → `src/presentation/scene-3d/` (fourteen modules), and the directory is removed.
- `src/sandbox/three-scene/three-scene.{ts,css}` → `src/app/debug/`.
- `src/sandbox/three-scene/assets/skeleton-blocky.glb` → `src/content/enemies/assets/`.
- `src/app/debug/debug-tools.ts`: the catalog entry's dynamic import and render adapter.
- `dev/standards/project_structure.addendum.md`: layer table, demo-tree schedule, two-renderer declaration.

## Execution Outline

1. Move the runtime modules, then the page and its stylesheet, then the asset.
2. Rewire: the page's three imports, the armature's URL import, the catalog's dynamic import.
3. Replace the sandbox descriptor with a render function that builds its own page.
4. Update the structure addendum.
5. Run the gate and the governance check.

## Implementation Notes

**The parent plan's requirement 4 cannot be met in this child, and the conflict is in the plan rather than in the code.** It asks that every copy the experiment made be retired in the same change that moves it. Two of the three copies have live consumers that outlast this child: `src/presentation/procedural-textures.ts` is read only by the raycaster, which child 5 deletes, and `src/demo/demo-sprites.ts` is read by the surface and by a workbench until children 3 and 5. Retiring either set now changes what one of the two renderers draws, which acceptance criterion 1 forbids — the game must play identically after every child. The two requirements cannot both hold, so the retirement moves to child 5, where the renderer that reads the losing set is deleted anyway and the retirement costs nothing. The plan's requirement 4 is corrected to say so. The armature is the one copy with no such conflict and it moved here as planned.

**No boundary rule needed changing.** The plan expected to edit `.dependency-cruiser.cjs`; nothing required it. The presentation rule already permits exactly what the moved code does, the debug layer was already free to read presentation, and the sandbox rules simply stop matching a tree that no longer contains this code. The checker passes unchanged, which is the stronger outcome — a move that needed the rules relaxed would have been a move into the wrong layer.

**Directory name.** The plan proposed `scene3d`; the naming standard requires kebab-case for directories, so it is `scene-3d`. `scene/` alone was rejected: `render-scene.ts` — the raycaster's scene vocabulary — already sits directly in the presentation layer, and two neighbours called scene something would be read as one thing.

**The clip-name copy stays a copy.** `block-clips.ts` holds names copied from the block-skeleton experiment. Presentation may not import the sandbox, so the copy is now permanent rather than temporary — which is correct: that experiment is reference-only and outlives nothing.

## Edge Cases

- The stylesheet moved whole rather than being split, so the classes the runtime's own elements carry are still defined in a debug stylesheet. That is invisible now and becomes child 3's, when the runtime mounts under the play surface and needs its element styling to arrive without the debug page.
- The debug tool's default map is still a literal rather than a read of the runtime layer's answer, because the debug layer has no business reaching into `src/runtime/` for one default.

## Acceptance Criteria

1. The gate passes, the governance check passes, and the boundary checker reports no violations with its rule text unchanged.
2. `/debug/three-scene` opens and plays exactly as it did before the move.
3. The ordinary route plays identically: the raycaster, the interim projection, and every workbench are untouched.
4. Nothing under `src/sandbox/` refers to the moved code, and nothing outside `src/app/debug/` imports the sandbox tree.
