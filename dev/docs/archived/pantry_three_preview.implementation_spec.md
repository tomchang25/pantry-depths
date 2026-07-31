# Standalone Three.js Preview

Parent Plan: none (standalone spec)

## Goal

Add a development-only, interactive Three.js proof of concept that demonstrates whether runtime 3D characters, hierarchical motion, destructible skeletons, procedural props, and ballistic effects are viable for Pantry Depths without changing the existing Canvas gameplay renderer.

## Summary

The debug hub gains a lazily loaded `/debug/three-preview` tool. The tool owns one reusable WebGL renderer, camera, orbit controls, diagnostics surface, and scene lifecycle; five selectable showcases plug into that runtime and dispose cleanly when changed or reset.

The visual subject is a recognizable flat-shaded, low-poly skeleton swordsman built from a real `THREE.Bone` hierarchy with detachable rigid bone meshes and a sword socket. A small quaternion motion player layers stance and attack poses with one final skeleton writer. The same live-pose handoff powers a waist-level bisection and deterministic bone-fragment explosion. Separate procedural altar and mortar showcases exercise modeled silhouette, emissive state, transform ownership, projectile motion, recoil, impact, and reuse of the skeleton explosion.

The result remains a manual visual experiment. It does not composite Three.js into gameplay, replace sprites, import external models, add a physics engine, or add automated presentation tests. Normal and deliberately pixelated render modes plus live renderer statistics provide the evidence for choosing runtime 3D, 3D-to-sprite authoring, or the existing 2D path.

## Requirements

1. The preview must be reachable only through the development debug namespace and remain absent from the production-reachable module graph.
2. One shared preview runtime must own rendering, timing, camera controls, resize, diagnostics, scene selection, pause, reset, playback speed, auto replay, and disposal.
3. The skeleton swordsman must use a `THREE.Bone` hierarchy, recognizable rigid low-poly bone meshes, a right-hand sword socket, flat-shaded materials, and optional skeleton-helper visibility.
4. The motion runtime must sample local quaternions with slerp, preserve a base pose, separate lower- and upper-body responsibilities, and commit one final skeleton pose per frame.
5. The attack must visibly distinguish idle, windup, forward step, slash, follow-through, and recovery while exposing phase, normalized time, sword-tip position, and an optional trail.
6. Bisection must transfer the current animated world pose into independently moving upper and lower assemblies without returning to bind or idle pose.
7. Bone explosion must transfer the current animated world pose into deterministic fragments with gravity, angular motion, ground response, friction, and sleep.
8. The altar must be a procedural low-poly model with readable geometry, dormant and active states, emissive motion, and particles.
9. The mortar must separate yaw, pitch, recoil, barrel, and muzzle transforms; fire a visible ballistic arc from the muzzle; align trajectory and impact; and reuse the skeleton explosion at the target.
10. All five showcases must support repeated playback, reset, scene switching, normal and pixelated rendering, and complete cleanup.
11. Existing gameplay, Canvas rendering, simulation, enemy behavior, and sprite assets must remain unchanged.
12. Verification must use repository static gates plus manual browser inspection; no new automated presentation tests are added.

## Relational Context

- `src/app/debug/debug-tools.ts` is the sole registration owner: it lazily imports the preview so production routing never reaches Three.js.
- The preview tool may use `createDebugPage` for shared page landmarks, but all Three.js state and styles remain inside its own subtree.
- One preview runtime owns the only request-animation-frame loop. Showcase modules receive update/render context and never schedule independent loops or global listeners.
- The active showcase owns its scene objects and transient simulation. Switching or resetting disposes that owner before another is installed.
- The skeleton motion player is the only animated-pose writer. Destruction captures world state after motion and then disables that writer before taking ownership.
- Bisection and explosion consume one shared live-pose capture contract; the mortar calls the same explosion implementation rather than duplicating fragment creation.
- Gameplay does not import or call the preview. The call direction remains debug catalog -> preview shell -> showcase/runtime modules.
- Existing debug route tests enumerate the catalog and therefore cover reachability without adding a new test case; visual correctness remains manual.

## Scope

### Included

- Three.js dependencies, lazy debug registration, standalone preview UI/runtime, five showcases, diagnostics, lifecycle cleanup, manual visual verification, and phase-based local commits.

### Excluded

- Gameplay compositing, renderer migration, external assets, GLB loading or retargeting, skinned geometry slicing, full ragdolls, third-party physics, WebGPU, production content changes, new automated tests, branch changes, pushes, and pull requests.

## Files to Change

| File                             | Change Size | Purpose                                                                                                          |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `package.json`                   | Small       | Declare Three.js runtime and type dependencies.                                                                  |
| `package-lock.json`              | Medium      | Lock the installed dependency graph.                                                                             |
| `src/app/debug/debug-tools.ts`   | Small       | Register the lazy development-only preview route.                                                                |
| `src/app/debug/three-preview/**` | Large       | Own the preview shell, runtime, models, motion, destruction, particles, altar, mortar, and showcase composition. |
| `TODO.md`                        | Small       | Track this standalone implementation while active.                                                               |
| `CHANGELOG.md`                   | Small       | Record the shipped proof of concept during closeout.                                                             |

## Execution Outline

1. Add Three.js and register a lazy debug tool, then land the accessible preview shell, shared renderer lifecycle, controls, diagnostics, render modes, and empty showcase contract.
2. Build the procedural bone hierarchy and sword, then add the quaternion motion player, layered attack, phase diagnostics, and sword-tip trail.
3. Add shared live-pose capture, deterministic fragment integration, bisection, and bone explosion with repeatable reset and sleep.
4. Add the procedural altar and mortar hierarchy, ballistic trajectory, recoil, impact effects, and mortar-to-skeleton explosion reuse.
5. Run repository verification, inspect all modes and repeated lifecycle paths in a real browser, fix visual or cleanup failures, and close the standalone work with local commits only.

## Implementation Notes

- Prefer focused modules under the preview subtree, but merge files when separation would create vague owners or pass-through wrappers.
- Use actual `THREE.Bone` transforms with attached rigid meshes; continuous skinning is deliberately unnecessary for a segmented skeleton.
- Keep fragment simulation fixed and deterministic enough to compare resets while integrating elapsed time safely under variable display frames.
- Pixelated mode must lower the drawing-buffer resolution and upscale the canvas, not merely apply a CSS label.
- Reduced-motion preference should start the preview paused or suppress auto replay while leaving explicit playback available.
- Use native controls and visible focus states. Dynamic phase and renderer statistics should use a restrained status region rather than noisy per-frame announcements.
- Local commits are allowed only after a coherent stage passes the relevant verification. Work on the current branch, never create or switch branches, and never push.

## Edge Cases

| Case                                  | Expected Handling                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| WebGL is unavailable                  | Render an explicit unsupported message and leave navigation usable.                                         |
| A frame is delayed or the tab resumes | Clamp or substep simulation time so fragments and projectiles do not tunnel or explode.                     |
| Scene changes during an effect        | Dispose the current showcase and all transient objects before installing the next one.                      |
| Reset after destruction               | Remove fragments and restore the complete skeleton, base pose, deterministic seed, camera, and diagnostics. |
| Repeated mortar playback              | Maintain one projectile/effect set with no accumulated smoke, listeners, or fragments.                      |
| Reduced motion is requested           | Disable automatic replay while retaining explicit Play and Reset controls.                                  |

## Acceptance Criteria

1. The debug hub opens a functional 3D preview with five selectable showcases and the required controls and diagnostics.
2. The skeleton attack reads clearly across all named phases and exposes a stable optional sword trail.
3. Bisection and explosion continue from the live animated pose and settle without persistent jitter or floor penetration.
4. The altar reads as an altar at near and far views, and its active state is visible without relying on text.
5. The mortar visibly aims, fires from its muzzle, recoils, follows its displayed trajectory, impacts the target, and reuses skeleton destruction.
6. Normal and pixelated modes provide a meaningful visual comparison.
7. Repeated reset, replay, and scene switching leave no visible remnants or active lifecycle leaks.
8. The existing game remains behaviorally and structurally unchanged.
9. Repository verification passes and manual browser review records visual results and renderer statistics.
