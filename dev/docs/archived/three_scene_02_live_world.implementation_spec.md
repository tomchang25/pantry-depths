# Three-Scene 02 — Live World

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 2. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Put the game itself inside the Three.js floor: the real simulation stepping, block skeletons and low-poly slimes standing on it, the floor's fittings built, and everything a fight leaves behind drawn. The static floor proved the room; this proves the room with the game in it.

## Summary

The experiment stops assembling a bare floor and starts creating and stepping the world exactly as the play surface does. Three new modules draw what the world holds — bodies, structures, and transient effects — and the runtime gains the two mouse actions, so the floor can be fought rather than only walked.

## What owns what

- **`world-bodies.ts`** — the skeleton armature loaded once and cloned per enemy, its clip chosen from simulation state by the same ladder the Canvas projection uses; soft bodies as deforming low-poly ellipsoids; corpses as settling lumps.
- **`world-structures.ts`** — the cursed altar, blessing dais, hot spring, extraction beacon, stairs, caltrops and emplacements as block assemblies, merged one mesh per colour, rebuilt only when their state changes. It also reports the lights the fittings throw.
- **`world-effects.ts`** — pickups and flights as pooled instances, particles as one point buffer, and the floor's staining as a single canvas texture over the whole grid, redrawn only when the rules bump their stain version.
- **`block-clips.ts`** — the armature's clip and weapon names, copied from the block experiment because one experiment never imports another.
- **`scene-runtime.ts`** — now owns a world rather than a maze: it steps it, rebuilds the floor when terrain changes, hands the nearest fittings the few real lights a forward renderer can afford, and holds the world still whenever nobody has the mouse.

## Load-bearing decisions

- **Body height is authored, not modelled.** The armature is about two cells tall in its own space and the authored table says a skeleton stands 0.755 cells. The template is measured at load and every clone scaled to the authored height, because a body twice the height of the walls around it is the loudest way a port can look wrong.
- **Held clips are driven, not ticked.** A wind-up's length belongs to the simulation, so a holding clip is placed on the fraction the rules report rather than advanced by frame time. Only looping clips get the mixer's own clock.
- **Tone mapping is a fix, not a style.** A point light falls off with the square of distance, so a torch carried at the eye turns any wall the player stands against pure white. The Canvas renderer clamps its light accumulation per pixel; ACES filmic tone mapping is the equivalent, and without it the floor can only be looked at from the middle of a room.
- **Four fitting lights at once.** A forward renderer pays per light on every fragment and recompiles per light count, so the nearest few fittings win and the rest go dark. That is a limitation of the approach and is left visible rather than hidden.
- **The world holds still when nobody has the mouse**, so the picture is safe to walk away from and a screenshot is comparable with the last one.

## Deliberately left open

Six deaths become one settling lump; a pickup is one cream box whatever it is; ground marks are one coarse stain layer with none of the aim, blast, or push circles; the exit's through-wall marker, the camera kicks, and the viewmodel are child 3's.

## Verification

`npm run verify`, then open `/debug/three-scene` and play it. Photographs taken through the development handle recorded the crowd at authored scale and a corridor under fog; the verdicts on both are the user's and are not claimed here.
