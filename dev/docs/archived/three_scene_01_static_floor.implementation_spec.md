# Three-Scene 01 — Static Floor

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 1. Sandbox track, so this is the short architectural note `dev/agent_rules/implement_operations.md` calls for rather than the full spec structure.

## Goal

Stand a real authored floor up in Three.js — walls, ground, open night sky, distance fog, and the player's torch — and let a person walk through it. This is the child that decides whether the atmosphere survives the move at all, so it deliberately carries no bodies, no simulation, and no effects.

## Summary

A new experiment at `src/sandbox/three-scene/` builds its floor by calling the game's own floor assembler on an authored map, then draws that floor with a WebGL renderer of its own. One catalog entry in the debug tool registry mounts it. Nothing outside the experiment folder and that one entry changes.

## What owns what

- **`scene-textures.ts`** — a copy of the procedural texture generators the Canvas renderer uses, cut down to the eight wall materials and six floor materials an assembled floor actually emits. It is a copy because the sandbox import boundary forbids reaching into the presentation layer; graduation replaces the copy with the original. The two material unions it is keyed by are inlined as local literal unions for the same reason.
- **`floor-meshes.ts`** — turns an assembled floor into Three.js geometry: one instanced box mesh per wall material, one merged ground plane per floor material, and the taller outer boundary as its own mesh with a vertically repeated texture.
- **`sky.ts`** — the backdrop that replaces the ceiling: a gradient dome, a star field, and a moon.
- **`scene-runtime.ts`** — the renderer, the camera, the fog, the torch, the walk, and the frame loop.
- **`three-scene.ts` / `three-scene.css`** — the experiment descriptor and the page chrome it fills.

## Load-bearing decisions

- **Camera field of view is derived, not chosen.** The Canvas raycaster projects every height as `canvasHeight / depth`, which pins its vertical half-angle at `atan(0.5)`. The Three.js camera therefore takes a vertical field of view of `2·atan(0.5)` ≈ 53.13°, because a spike whose camera is wider than the renderer it is judged against would fail the atmosphere comparison on framing rather than on lighting.
- **The atmosphere numbers are taken from the live scene builder, not re-invented**: wall height 1, boundary height 3, eye height 0.5, ambient `[0.16, 0.14, 0.24]`, torch radius 8.5 with colour `[255, 176, 104]` and its two-term flicker, sky horizon `[38, 30, 58]` to zenith `[8, 7, 20]`, 220 stars, moon at 2.1 radians.
- **Fog is the reinterpretation under test.** The Canvas renderer has no fog term of its own — distance darkening falls out of the torch's radial falloff. Three.js gets both: exponential fog tinted to the sky's horizon, plus the torch as a real point light. The two together are what child 1 asks a person to judge.
- **Walking is collided against the floor's own walk rule** rather than flying free, because a camera that passes through masonry cannot judge whether masonry reads right.

## Deliberately left open

Which map opens is a picker, defaulting to the map the game itself defaults to. Nothing is authored, saved, or exported. No enemy, prop, decal, structure, or projectile appears — those are child 2's, and their absence is what keeps this child judgeable.

## Verification

`npm run verify`, then open `/debug/three-scene` and walk the floor. The atmosphere verdict is the user's and is not claimed here.
