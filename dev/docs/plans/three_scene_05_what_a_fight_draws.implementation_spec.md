# Three-Scene 05 — What A Fight Draws

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 5. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Build the six checklist rows the porting survey found unbuilt. Every one of them appears only while a fight is happening, which is why the first judging session — held on a quiet, well-lit floor — did not miss them: detonations and lightning draw nothing at all, every warning a floor gives is drawn in the air instead of on the ground, a body driven into masonry leaves no mark, and four small readability cues are simply absent. A verdict given against the build as it stands would be a verdict on a version of the game nobody plays.

## Summary

A new `floor-decals.ts` builds the shipped decal list from the world, and `scene-lighting.ts` grows a decal uniform block that the ground fragment tests per pixel and blends into the texel before it is fogged — the shipped renderer's arrangement, not a quad laid on the floor. `world-effects.ts` gains detonations, lightning arcs, wall marks, pickup glows and drop shadows through a new textured-billboard sheet with per-instance alpha; `world-bodies.ts` gains the contact spark and the bodies riding a javelin; `scene-runtime.ts` gains the wind-up and detonation lights. `scene-sprites.ts` copies in the four drawings none of this had: the fireball, the contact spark, the lightning glow and the wall splatter.

## What owns what

- **`floor-decals.ts`** (new) — the whole of the shipped `floorDecals` projection: charge lanes, melee wedges, emplacement aim circles, the extraction pad, and the mark under a shell in the air. Pure function of the world to a flat list; owns no geometry.
- **`scene-lighting.ts`** — a second uniform block beside the light list, and the decal test inside the ground fragment. Nothing else reads it: a decal is floor, and only the floor is asked.
- **`world-effects.ts`** — detonations, lightning arcs, wall marks, the glow under a pickup, the shadow under a lobbed object, and the textured sheet all four are drawn through.
- **`world-bodies.ts`** — the spark at the point of contact, and the bodies a javelin is carrying.
- **`scene-runtime.ts`** — the per-frame decal collection, and three new classes of light: wind-up by intent, detonation, and arc.
- **`scene-sprites.ts`** — `blast`, `hitSpark` and `wallSplat`, quoted from the shipped drawings. The lightning bead needed nothing: `spark` was already copied at the shipped colours and had simply never been placed.

## Load-bearing decisions

- **The decals are in the ground shader, not on it.** A quad laid over the floor is the sticker the shipped renderer's own comment rejects: it takes its own brightness rather than the room's, and it fights the floor for depth. The ground fragment already has the per-pixel world position it needs, so a decal is a test against that position and a blend into the texel — before the fog and the torch gain, so a warning mark far away fogs like the stone it is painted on.
- **The decal loop is bounded by a radius test, not by cell marking.** The shipped renderer bounds cost by recording which cells each decal reaches; a fragment shader cannot ask that question, so each decal carries a bounding radius and the loop skips on one distance compare. The array is capped, and overflow is dropped the way the light list already drops past its own cap.
- **The dot field cannot draw a fireball.** Dots are flat filled circles by design — that is what the renderer's particle pass draws. A detonation is a radial gradient and a lightning arc is a soft glow, both of them pictures, so they need a textured sibling of the dot field: the same instanced sheet with the same per-instance alpha, sampling a texture and taking the sprite formula's fog and warmth.
- **A wall mark is not a billboard.** It is fixed to the face it is on, snapped to the cell boundary the body was travelling towards with a hair of clearance, and it keeps the other axis so a row of marks spreads along the wall rather than stacking. The sprite material already takes `billboard: false` for exactly this.
- **Bodies riding a javelin are real bodies.** The shipped renderer draws them from the impaled death bake; here they are the same block armature every other skeleton is, posed on the shaft and spaced behind the tip. They are keyed off the projectile rather than the enemy, because an enemy on a projectile is no longer in the enemy list.
- **The wind-up lights are per intent and not one light with three colours.** A shooter lights the ground it stands on, a swordsman pulses across a room, a charger lights the walls — three radii, three colours, two of them pulsing on the same clock as the mark over the body and the wedge on the ground.
- **Everything copied is copied, not imported.** The four drawings, the lane half-width, the ring thickness and the arc segment count all live in the demo tree the experiment may not import; they are quoted here and re-pointed on graduation like the texture generators before them.

## Deliberately left open

The finishing pass — air motes, the vignette, the red answer to a hit — is child 6 and nothing here anticipates it. Corpses are still one settling lump for all six ways of dying; that belongs to the graduation plan. The soft bodies stay rejected. Decals do not reach the trench floor's lower plane, which is drawn as its own surface and would need the test in a second place for a warning painted across a pit edge to be continuous.

## Verification

`npm run verify`, then open `/debug/three-scene`: flatten the floor, fill the crowd, and watch a fight — a bomb should throw a fireball and an ember ring, a charger should paint a lane, an emplacement should ring its ground, and a body thrown into a wall should leave a mark on it. The judgement of whether any of it reads right is the user's and is not claimed here.
