# Three-Scene 04 — Faithful Pass

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 4. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Answer the first judging session. The experiment was built with a physical lighting model and judged too dark, too cold, and stripped of the dust that carries a fight; the pickups and the arm had been turned into 3D against the author's intent. This child replaces the model with the shipped renderer's own formulas, ports the effect channels that were never built, and returns the two layers that were always meant to stay 2D.

## Summary

A new `scene-lighting.ts` holds four analytic shading formulas quoted from `canvas-gameplay-renderer.ts` — one each for masonry, ground, structures and bodies — plus a fifth for dots. Every material in the experiment is built from it, and the ambient light, the torch point light, the four fitting lights, the scene fog and the tone curve are all gone. `world-effects.ts` was rewritten around the particle field the projection actually raises, and `scene-sprites.ts` copies in the artwork it needs.

## What owns what

- **`scene-lighting.ts`** — the formulas, the shared light list, and a material factory per surface class. One vertex shader serves masonry, instanced geometry and the skinned armature; a second billboards.
- **`scene-sprites.ts`** — the shipped procedural drawings the floor is dressed with: the soft blobs every particle is made of, the three wind-up markers, the pickups, the glows.
- **`world-effects.ts`** — particles, projectile trails, sight lines, cut arcs, landing beacons, fitting plumes, pickups as pictures, flights, and the stain overlay.
- **`world-bodies.ts`** — bodies on the body formula, plus the marker over a committed body and the stars over a clubbed one.
- **`viewmodel.ts`** — the authored arm only. The mesh arm is deleted.

## Load-bearing decisions

- **The formulas are quoted, not approximated.** Walls composite fog ink then a torch wash; ground adds a flat fog term and a torch gain with a negative blue; structures take distance and face and no warmth at all; bodies and sprites mix toward fog ink by distance then toward the strongest reaching light at 0.22. Each is the shipped arithmetic with the shipped constants.
- **Every number is an sRGB byte over 255, unmanaged.** The Canvas renderer composites onto a canvas, so its sums happen on encoded values; the same sums on linearised ones give a visibly darker picture. Textures upload with `NoColorSpace`, colours are raw triples rather than `THREE.Color`, and the fragment writes what it computed with no conversion. This was the single largest remaining difference once the formulas were in.
- **Walls and floors never read the light list.** Their warmth is distance to the eye and nothing else, because the renderer's lightmap is switched off everywhere. Only bodies, pickups and effects consult placed lights — and all of them do, since a uniform array costs a loop rather than a shader recompile, which retires the four-light cap the first build carried.
- **Particles are flat filled circles at world size.** The renderer draws `arc` and `fill`, not a soft sprite; the first build's point cloud at a fixed tiny size is what lost the atmosphere. Dust swells as it disperses; embers blend additively.
- **A billboard reads its own scale.** The first build's billboard shader took the raw vertex offset and ignored the matrix, so every marker and pickup drew one cell across whatever it had been authored at.
- **Rounded bodies opt out of the face convention.** The box rule brightens every upward-facing facet, which caps a sphere in white. Block bodies keep it; the slime does not.
- **The frame is drawn at half scale and blown up.** The shipped renderer halves its plane resolution both ways, and comparing a crisp render against a grainy one judges the wrong thing.

## Deliberately left open

The slime is still a programmatic blob and still rejected — it belongs to the modelling plan. Bodies still cost a draw call per mesh. The authored arc does not chase the point a swing landed on, which needs the renderer's own projection wired through.

## Verification

`npm run verify`, then open `/debug/three-scene`. Side-by-side frames against the reference recording were built for the judging session and are in `capture-output/adhoc/`; the verdict on them is the user's and is not claimed here.
