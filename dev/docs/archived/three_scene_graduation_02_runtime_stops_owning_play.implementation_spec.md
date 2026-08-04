# Three-Scene Graduation 02 — The Runtime Stops Owning Play

Parent plan: `dev/docs/plans/three_scene_graduation.plan.md`, child 2.

## Goal

Take the frame loop, the input handling and the world away from the Three.js runtime, leaving something that is handed a world and a time step and draws it. That is the shape the play surface already knows how to talk to, and acquiring it is the whole of what stands between the runtime and the seam.

## Summary

The runtime keeps everything about drawing — the renderer, the camera, the sub-systems, the sizing, the presentation preferences — and loses everything about playing. What it gains is the two answers the surface will need from it: where a world point lands on screen, and a metrics readout. The debug tool becomes the driver: it creates the world, steps it, reads the keyboard and the mouse, and calls the runtime once per frame. The game is still drawn by the raycaster and nothing in `src/runtime/` is touched.

## Relational Context

- **Call direction, before.** The debug tool created a runtime and then poked it: pause it, restart it, kill everything on it, tell it a key went down. The runtime owned the world and drove itself off `requestAnimationFrame`.
- **Call direction, after.** The debug tool owns the world and the loop, and calls the runtime once per frame with the world and the frame's own numbers. The runtime never reaches back.
- **Ownership.** The world belongs to whoever created it, which is now the caller. The runtime holds no reference between calls except the caches it derives from what it was last shown — the floor geometry, the blood grid, the per-body armatures — each keyed on the world's own version counters so a caller that hands over a different world is answered correctly rather than silently.
- **Changed integration contract.** Before: `new SceneRuntime(viewport, map, { onStatus })`, then `holdKey` / `look` / `strike` / `grab` / `setPaused` / `restart` / `killEverything` / `flatten` / `fillCrowd`, with `inspected` and `stand` for a development session. After: `new SceneRenderer(viewport)`, then `render(world, frame)` per frame, plus `project`, `metrics`, `resize` and the three presentation toggles. Everything in the first list moves to the caller.
- **Wrong shape to avoid.** A runtime that keeps a world reference "for convenience" between renders. The seam's whole value is that the surface hands over the world it already owns; a second reference is a second authority, and the first frame where the two disagree is a bug nobody can see.

## Scope

### Included

- Removing the loop, the input, and the world from the runtime, and the status callback with them.
- Adding the screen projection, the metrics readout, and the frame parameters the runtime can no longer derive.
- The driver in the debug tool: world, loop, input, cheats, readouts, and the development handle.

### Excluded

- Any change to `src/runtime/`, the interim projection, or the raycaster. The seam swap is child 3.
- Choosing the pitch limits the shipped game will use. See Implementation Notes.
- Splitting the stylesheet, which child 3 forces.

## Files to Change

- `src/presentation/scene-3d/scene-runtime.ts` → `scene-renderer.ts`: the reshaping and the rename.
- `src/app/debug/three-scene.ts`: the driver.

## Execution Outline

1. Narrow the runtime to its drawing surface, taking the frame parameters as an argument.
2. Add the projection and the metrics readout.
3. Build the driver in the debug tool: world, loop, input, cheats, status, handle.
4. Run the gate and open the tool.

## Implementation Notes

**The pitch limits are not decided here, and that is the correct outcome rather than a deferral.** The plan flagged that the experiment clamps the look symmetrically while the play surface clamps it asymmetrically — downward much harder — because the raycaster's pitch is a screen shear that smears the floor when it looks down, and a real perspective camera has no such artefact. The resolution falls out of the child: pitch limits are input, input moves to the caller, so the limits belong to whoever owns input. The debug tool keeps the symmetric ones it was judged with. When the surface drives the runtime in child 3 it brings its own, and whether the asymmetric clamp should survive a renderer that no longer needs it is a feel question for that child's playtest.

**The name went with the responsibilities.** It was a runtime while it owned a loop, an input reader and a world, which is what a debug tool with nobody to hand those to has to be. Once all three left, the name was describing the file it used to be — and describing it as a member of a layer this repository actually has, so a reader who knows `src/runtime/` reads it as orchestration that wandered into the wrong layer. It is `SceneRenderer` in `scene-renderer.ts` now, beside the `CanvasGameplayRenderer` it exists to replace. Renamed inside this child rather than after it, because every later child's notes name the symbol and the cheapest moment to change them is before they are followed.

The development handle keeps its name. It is not the renderer: it exposes the world, a call that poses the eye, and the three cheats, all of which belong to the driver — and a driver is a runtime in the ordinary sense, so the name is honest even though the class it once matched is gone.

**The camera's own reactions stay.** The blast kick, the weight kick and the melee hitch are computed from world state and applied to the camera, so they are drawing rather than playing and they stay on this side of the seam. They still duplicate the interim projection's copies; the plan reserves that reconciliation for child 5.

**The development handle moves with the world it inspects.** It keeps its name and its two members — the world, and a call that stands the eye somewhere — because a session and a capture script both reach for it by name. The plan records that this arrangement and the surface's own capture flag should not both survive; that is child 3's to settle, and until then the handle keeps working exactly as it did.

**Caches key on the world, not on construction.** The floor rebuilds when the terrain version moves or the maze's extent changes, and the blood grid does the same. That was already true; what changes is that the first build now happens on the first render rather than in the constructor, which is what lets a caller hand over a freshly created world without the runtime having made one.

## Edge Cases

- A caller that renders a different world than the one it rendered last frame — which is what restarting and descending both are — gets a correct floor because the caches are keyed on the world's own counters rather than on having been told.
- A paused caller passes no elapsed time, so animation that advances on its own holds still while animation driven by simulation state stays where the rules put it. That is what pausing did before, expressed as an argument rather than as a flag.
- The runtime is constructed before any world exists, so nothing it builds in its constructor may read one.

## Acceptance Criteria

1. The gate and the governance check pass, and the boundary checker reports no violations.
2. `/debug/three-scene` opens and plays exactly as it did: walking, looking, striking, grabbing, pausing on pointer release, restarting, the map picker, the three toggles, the three cheats, and every diagnostic reading.
3. The runtime holds no world reference between renders and creates no world of its own.
4. The ordinary route plays identically; nothing outside the two changed files is touched.
