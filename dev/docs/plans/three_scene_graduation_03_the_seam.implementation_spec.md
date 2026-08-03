# Three-Scene Graduation 03 — The Seam

Parent plan: `dev/docs/plans/three_scene_graduation.plan.md`, child 3.

## Goal

Swap the four calls the play surface makes to the drawing side, so the game is drawn by the Three.js renderer. This is the child where the picture changes and the only one that a player would notice happening.

## Summary

The surface stops building a scene, effect envelopes, an image map and a first-person layer for the raycaster, and instead hands its world to the scene renderer once a frame. Its canvas becomes a viewport the renderer fills with its own three layers, and the element styling those layers need moves out of the debug tool and into a stylesheet the presentation module ships. Everything the surface owns that is not drawing — sound, readouts, pointer handling, pause, the run's screens, the instrument panel, the stage, the capture flag — is untouched and keeps working.

## Relational Context

- **Call direction.** Unchanged in shape: the surface owns the frame and asks the drawing side for a picture. What changes is who answers and how many calls it takes — four become one, plus an aim query.
- **Ownership.** The surface still owns the world, the loop, the input and the DOM around the view. The renderer owns the three canvases inside the viewport it is given, and nothing else.
- **Changed integration contract.** Before: load an image map, build a renderer over the surface's own canvas, then per frame resize it, project the world into a scene, build effect envelopes, render, project the swing target, and paint the first-person layer onto the same canvas's 2D context. After: build a renderer over a viewport element, await its armature, then per frame render the world and ask where the swing landed.
- **Wrong shape to avoid.** Teaching the renderer anything the surface already knows. It gets a world and two numbers; it does not learn about pausing, about the run's status, about cards, or about whether the pointer is held. A renderer that knows the game is paused is a renderer that will be asked to know the next thing too.

## Scope

### Included

- The seam swap and the DOM and stylesheet changes it forces.
- Moving the renderer's element styling out of the debug tool into the presentation module.
- The pitch units correction described below, and the surface's look handling that depends on it.

### Excluded

- Deleting anything. The raycaster, the interim projection and the six workbenches all stay until child 5.
- The death treatments, which are child 4.
- Reduced motion, which the finishing pass still has no path for.

## Files to Change

- `src/runtime/surface.ts`, `src/runtime/surface.css`: the seam and the viewport.
- `src/presentation/scene-3d/scene-renderer.ts`, `viewmodel.ts`, `finishing-pass.ts`, and a new `scene-3d.css`: element classes and the stylesheet that owns them.
- `src/app/debug/three-scene.css`: drops the two rules that move.
- `src/core/world.ts`: the pitch field's documented meaning.

## Implementation Notes

**Pitch changes units, and this is the finding that makes the child bigger than the plan thought.** The stored look is one number on the world, and the two renderers read it as different quantities. The raycaster shears its horizon by it as a fraction of canvas height — its clamps are 1.5 screen-heights up and 0.48 down, asymmetric because a shear smears the floor when it looks down and a real rotation does not. The scene renderer reads the same field as radians. So the surface's numbers cannot carry across: kept as they are, the look would be scaled by a factor nobody chose and clamped at angles nobody picked.

The field becomes radians, because after this plan the only thing that reads it is a camera. The surface adopts the look handling the experiment was judged with — its sensitivity, applied without the raycaster's compensating factor, clamped symmetrically — on the ground that this is the feel the verdict was given against, and that the asymmetry existed to hide an artefact that no longer exists. **That is a feel change and it is the one thing in this child a playtest has to judge rather than confirm.** Whether the downward clamp should stay tighter than the upward one now that looking down costs nothing is a real question; it is asked with the game in hand, not here.

**The renderer's elements get styling the presentation layer owns.** They carried debug-tool class names because the debug tool was their only mount. The game is about to be the second, and a play surface reaching into a debug stylesheet for the rule that sizes its own canvas is the kind of coupling that survives for years. The module ships its own stylesheet for the two rules its elements need; the page around them stays each caller's.

**The armature is awaited before the first frame.** Bodies arrive from a glTF, and until it resolves nothing skeletal draws. A debug tool opening with a second of empty floor is unremarkable; a game doing it is a bug. The renderer already tracks that promise and now exposes it.

**The cursor and the grain are the game's to state, not the renderer's.** The renderer keeps drawing at half resolution because that is what the game looks like; the surface's stylesheet keeps hiding the cursor. Neither moves into the other.

## Edge Cases

- The first-person layer no longer shares a 2D context with the picture, so the context and its guard leave the surface entirely.
- The image map the surface loaded fed both the raycaster and the old first-person layer; the renderer builds its own artwork and loads its own pickups, so the load and its await go with the seam. A workbench still loads that map for the raycaster and is untouched.
- The capture harness photographs the page and reads the surface's development handle, both of which are unchanged. The renderer's own handle stays with the debug tool that owns a world.

## Acceptance Criteria

1. The gate, the governance check and the boundary checker pass.
2. A whole floor plays from the ordinary address drawn by the scene renderer, with sound, readouts, pause, damage feedback, death, restart and descent all behaving as before.
3. The debug tool still opens and plays.
4. Nothing is deleted: the raycaster, the interim projection and every workbench still build and still work.
