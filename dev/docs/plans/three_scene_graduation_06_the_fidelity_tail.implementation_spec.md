# The Fidelity Tail

Parent Plan: `three_scene_graduation.plan.md`

## Goal

Close the four picture gaps the porting survey left open after the seam swapped: the cursed altar's wear and the debris it sheds, the room lights that grow while a hold runs, the swing arc chasing the point a swing landed on, and how far a drowning body has actually gone under. This is the graduation plan's last child, and after it every gap the survey recorded is either closed or carrying a recorded decision to accept it.

## Summary

**Why this is worth doing.** Three of these four are things the ray-marched game told the player and the new runtime does not. An altar that looks identical through two of its three hits says nothing about how much of it has been spent; a blessing pad that does not brighten while it is being held gives the five-second claim no readout at all; a swing arc pinned to the middle of the stage points at nothing. The fourth is not a port at all but a defect found while checking one: a body pushed into water pops a third of the way under the instant it lands, because the sink reads a duration the rules do not use.

**What the survey said and what is actually true now.** The plan's execution notes for this child point at `demo-scene.ts` and `render-scene.ts`, both deleted by the demolition spec. Every coordinate below was re-derived against live code. One of the four turned out to need less work than the plan expected and one turned out to need different work:

| Gap              | What the plan expected                      | What is actually needed                                                                                         |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Structure detail | Port `weathered`, `ALTAR_DEBRIS`, `litFace` | As expected, but the colour ramp runs between the 3D module's own two altar colours rather than the raycaster's |
| Room lights      | Grow the blessing and extraction lights     | As expected; both source values live in the rules and are read directly                                         |
| Swing aim        | Wire the renderer's projection into the arm | As expected, plus the projection currently answers in the wrong pixel space and both its callers must agree     |
| Waterline cut    | Port the sprite pipeline's below-floor cut  | Not needed — a depth buffer and an opaque water plane already cut it. The sink curve itself is wrong instead    |

**What changes.** The altar's stone darkens continuously across its three hits instead of switching colour only when it is spent, sheds one lasting piece of rubble per hit, gains its snapped stump when spent, and takes an explicitly lit top face — the one fixture that gets one, because the other four are rebuilt shapes rather than ports and are not being made face-for-face. The blessing light widens and brightens with the hold and stays full once the blessing is taken; the extraction light widens, brightens and flickers faster with the extraction share. The renderer answers a projection in the same pixels its overlays are drawn in, hands the frame's swing point to the first-person layer, and the arm aims its arc and sparks at it. A drowning body's depth comes from the rules' own drown timer and from the body's own height, and it keeps its head above water until it dies, as the shipped game did.

**How it lands.** Five beats in one change: the two structure edits, the drown curve, the projection contract with its debug-panel caller fixed in the same beat so nothing is briefly wrong, then the aim wiring. Verification is `npm run verify` plus a playtest, because every one of these is judged by looking at it.

**What it looks like landed.** A floor where you can see how far gone the altar is from across the room, where standing on the blessing pad visibly charges it, where the way out gets louder as it is claimed, where a cut lands where you swung it, and where something knocked into water goes under at the speed it drowns.

## Relational Context

- `SceneRenderer.project()` currently answers in backing-store pixels, and the backing store is halved whenever the pixel grain is on. Both of its consumers draw into full-size viewport overlays, so both need viewport pixels. The renderer owns the grain scale, so the renderer converts: `project()` changes to answer in viewport pixels, and `src/app/debug/render-panel.ts`, which compensates for the mismatch today, stops compensating in the same change. Leaving that compensation in place would double-scale the debug panel's marks.
- The camera matrices a projection reads are refreshed inside the draw call, not by placing the camera, so the frame's aim is only correct once the scene has been drawn. That puts the first-person layer's sync last in the frame; it costs nothing, because that layer draws to its own stacked canvas rather than into the picture. Projecting immediately after the camera is positioned would aim the arc at where the view was a frame ago — worst exactly when a swing is turning. The first-person layer has no camera and must not acquire one: the aim is handed to it, not asked for by it.
- `world-structures.ts` owns two separate things with two different lifetimes — geometry cached against a signature, and a light list rebuilt every frame. The hold-driven light values move every frame and must stay out of the signature; putting them in would rebuild every fitting on the floor sixty times a second. The altar's debris count is a function of altar hit points, which the signature already covers.
- The rules own how long drowning takes and presentation owns how deep it looks. `world-bodies.ts` must read the drown duration from the rules rather than restating it, which is the defect being fixed.
- The dead are not this child's. Corpses are a single settling shape by the parent plan's recorded decision, and a drowned corpse continuing to sink belongs to the body plan that owns corpses.

## Scope

### Included

- The cursed altar's wear ramp, its shed debris, its spent stump, and its lit top faces.
- The blessing and extraction room lights growing with their holds.
- The drowning sink curve for both boned and soft living bodies.
- The projection's pixel space, its debug-panel caller, and the swing aim reaching the arm.

### Excluded

- The other four fixtures' geometry. They are rebuilt shapes, not ports, and the parent plan asks only for weathering and debris.
- Lit top faces anywhere but the altar.
- Corpses, including a drowned one's continued sinking.
- Soft-body deformation, death clips, and everything else the parent plan records as knowingly accepted.
- Any new test of any kind.

## Files to Change

| File                                            | Change Size | Purpose                                                                      |
| ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `src/presentation/scene-3d/world-structures.ts` | Medium      | Altar wear ramp, debris, stump and lit faces; hold-driven room lights        |
| `src/presentation/scene-3d/world-bodies.ts`     | Small       | Drown stage from the rules' timer, depth from the body's own height          |
| `src/presentation/scene-3d/scene-renderer.ts`   | Small       | Projection answers in viewport pixels; the frame's swing aim reaches the arm |
| `src/presentation/scene-3d/viewmodel.ts`        | Small       | Take the aim and convert it into the authored stage's coordinates            |
| `src/app/debug/render-panel.ts`                 | Small       | Drop the backing-store compensation the renderer now owns                    |

## Execution Outline

1. Altar in `world-structures.ts`: replace the two-state stone with a ramp across the same two authored colours, give the capstone and the debris an explicit lit top face, add the spent stump, and shed one debris box per hit taken at fixed offsets. Fixed offsets rather than rolled ones, because geometry is rebuilt on every terrain change and a rolled scatter would move the same rubble each time a wall came down.
2. Room lights in the same file: the blessing light grows with the held fraction and pins to full once the blessing is taken; the extraction light grows with the extraction share and speeds its own flicker with it. No signature change.
3. Drown curve in `world-bodies.ts`: derive one stage value from the rules' drown duration and the stage a body has reached by death, then apply it to both the boned and the soft body as a fraction of that body's own height.
4. Projection in `scene-renderer.ts` and its caller in `render-panel.ts`, in one beat: `project()` divides out the grain scale, and the panel's own scaling goes. Doing these separately leaves one of the two wrong.
5. Aim in `scene-renderer.ts` and `viewmodel.ts`: move the first-person layer's sync to after the scene is drawn, project the world's swing target there, pass the result into that sync, and have the arm invert its own stage transform to place the arc and sparks. A frame with no swing target, or one behind the eye, passes nothing and the arc stays where it is authored.
6. `npm run verify`, then a playtest of a whole floor covering all four.

## Implementation Notes

**`world-structures.ts`.** The ramp interpolates between the module's existing altar and spent colours; do not import the raycaster's old RGB values, which were authored for a different lighting model. Wear is the damage fraction clamped to `[0, 1]`; the box dimensions keep using the absolute hit count they use today. The altar takes three hits, so the debris table holds three entries and the loop that places them is bounded by damage taken. The lit face is a fixed brightening authored for the altar alone — everywhere else keeps the module's own default top colour, which the collector already applies.

**`world-bodies.ts`.** One helper answering "how far under is this body", zero when not drowning, reaching the shipped game's at-death stage when the timer runs out. Both call sites then convert that stage into a world-space offset using the body's own display height plus a small margin, so a stage of one clears the surface rather than leaving a sliver above it. The current hardcoded duration and the boned body's hardcoded depth both go.

**`scene-renderer.ts` and `viewmodel.ts`.** The aim is part of the frame the first-person layer is given, not state either side holds between frames. The stage transform the arm applies is translate-scale-translate; the inverse is the same three terms read backwards, and the bob offset is part of it — an aim converted without the bob drifts vertically as the player walks.

**`render-panel.ts`.** Its scaling exists only because the renderer answered in the wrong space; the comment explaining it goes with the code.

## Edge Cases

| Case                                         | Expected Handling                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Altar at full hit points                     | No debris, no darkening, no stump — identical to the picture today                         |
| Altar spent                                  | Ramp at its ruined end, all three pieces of rubble on the floor, stump instead of capstone |
| Blessing already taken                       | Light stays at its full value rather than dropping when the hold resets                    |
| Player leaves the blessing pad mid-hold      | Light falls back with the hold, on the next frame, because the hold itself resets          |
| Swing with no target, or a target behind eye | Arc and sparks stay at their authored place; no aim is passed                              |
| Pixel grain toggled off                      | Aim and debug marks land in the same place they did with it on                             |
| Body entering water                          | Starts at the surface, not already partly under                                            |
| Body dying in water                          | Still shows above the surface at the moment of death; the corpse is unchanged              |

## Acceptance Criteria

1. The cursed altar reads differently after each of its three hits, from across the room and from behind: the stone darkens, the shape loses more of itself, and each piece knocked off is still lying on the floor afterwards.
2. The blessing light's radius and intensity follow the hold, and pin to full once the blessing is taken. Read as a change on the ground only beyond the reach the player's own torch already saturates — see the recorded finding below.
3. The extraction light's radius, intensity and flicker rate follow the extraction share, under the same limit.
4. A melee swing that connects places its arc and its sparks on the thing it hit rather than at a fixed point on the stage, and does so identically whether or not the pixel grain is on.
5. A body knocked into water begins at the surface and goes under over the time the rules give drowning, with part of it still showing at the moment it dies.
6. Development surfaces that pin a mark to a world point still land on that point.
7. The game plays as it did at the commit before this one in every other respect, confirmed by a playtest of a whole floor, and the aggregate verification gate passes.

## Recorded Finding: This Renderer's Lighting Cannot Carry A Hold

Found by playtest after the work above landed, and recorded here rather than repaired, because repairing it is a visual decision this plan's non-goals put outside it.

**What was expected.** Criteria 2 and 3 were written from the shipped game, where the blessing dais brightened and its pool of light widened as the five-second hold accumulated, and the extraction pad did the same as its share ran. That growth was the readout for both holds.

**Why it does not appear.** The shipped renderer lit its floors and walls through an accumulation buffer: every light added its own colour into the texel, on a gentle falloff curve, so an intensity above one genuinely meant more light and two lights over the same ground meant more still. The new runtime has no additive term anywhere. Its ground takes the strongest single light that reaches it and then clamps the result at one. The player's torch is intensity 1.35 at a radius of 8.5 and travels with them, so within the whole of a three-cell pad it already saturates that clamp on its own. A room light rising from 0.5 to 1.6 under it changes nothing a player standing on the pad can see, and the same holds for the extraction light rising from 1.05 to 1.95.

**What is therefore true of what landed.** The values are ported faithfully and are correct; the growth is visible only where the torch has fallen off enough to lose the comparison, which is at the far edge of a lit room rather than underfoot. This is not a defect in the ported values and is not fixed by changing them — a bigger number clamps at the same place.

**What is not in this document.** The extraction's ground pad, which fills from the middle as its share runs, is a decal rather than a light, was already present before this child, and is untouched by any of it. It is the one hold readout in the game that this renderer's lighting cannot swallow, and it is the shape the repair takes. `scene_3d_hold_readouts.implementation_spec.md` owns that repair, along with the extraction plumes that vented harder with the hold in the shipped game and vent at a fixed rate here — a survey gap nobody recorded, found in the same pass.
