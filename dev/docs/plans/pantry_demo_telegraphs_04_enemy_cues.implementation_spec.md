# Stun Stars, And The Swordsman's Own Wind-Up Cue

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Give stun a picture — three stars orbiting over any enemy whose stun timer is running — and give the skeleton swordsman the body cue the other two archetypes are getting, which it cannot express the way they do.

## Summary

Two enemy states are currently invisible on the body itself.

Stun is the first. A stunned enemy simply stops, which in a crowded room is indistinguishable from one that has not noticed you yet. After child 03 a stalled charger lies helpless for five seconds, which makes stun the most valuable window in a fight and the one state most worth spotting at a glance. Thrown bodies and barged enemies produce it too. Three star sprites orbit above the body, depth-correct because they are ordinary world-space billboards at real positions rather than a screen overlay, and they apply to every enemy rather than only the slimes: the state is one state, and a cue that appears on some bodies and not others reads as a bug.

The swordsman's wind-up is the second. Children 02 and 03 give the shooter and the charger a body that visibly gathers, but both are soft bodies the scene deforms at will, and the swordsman is an authored sprite sheet with fixed frames — there is nothing to squash. What it can have instead is the path of the cut: a bright arc swept along where the blade is about to travel, brightening as the swing commits, plus a small light on the body. That reads as a wind-up from every angle, which its attack frames alone do not.

The ordinary slime is deliberately left with nothing. It has no wind-up at all — it simply touches you — so there is no window for a cue to occupy, and inventing one would advertise a commitment it never makes.

## Relational Context

- Both cues are derived per frame from timers the world already keeps — the stun timer and the wind-up timer with the melee intent. Nothing is stored, and no enemy field is added.
- **Scene sprites carry no per-instance alpha.** The stars fade in and out through scale, not opacity; there is no opacity field on the sprite record to reach for. The swordsman's arc is built from additive particles, which do carry alpha.
- The stars ride above the body's own crown, and the two enemy presentations have very different heights — the soft bodies are drawn from a profile the scene owns, the skeleton from an authored sheet at its own display scale. Take the height from whichever the enemy uses, or the skeleton wears its stars at waist height.
- Orbit positions are real world positions, so the near star correctly occludes and the far one is correctly occluded. Do not fake the ring by offsetting a single sprite horizontally.
- Every source of stun is covered because the cue reads the timer rather than the cause. Do not branch on what applied the stun.
- The swordsman is the only archetype with a melee wind-up; the ordinary slime and the shooter both land contact damage without one. Key the arc on the wind-up-with-melee-intent state rather than on the archetype, so the cue follows the mechanic rather than the creature.
- The swordsman keeps tracking the player at a bounded turn rate through its wind-up, so the arc must be built from the facing on the frame it is drawn, not from the facing when the wind-up began.
- The blade symbol over its head is child 02's. This child adds the cue on the body; the two are the "an attack is coming" and "here is the swing" halves of the same telegraph.

## Scope

### Included

- A star asset, and three orbiting stars over any enemy with a running stun timer, sized in and out with it.
- A swept arc along the path of a committed sword cut, brightening with wind-up progress, plus a light on the body.

### Excluded

- Any change to stun durations, sources, or behavior.
- Any change to melee wind-up duration, damage, reach, or the authored attack frames.
- A cue for the ordinary slime, which has no wind-up to occupy.
- A stun cue for the player, who cannot be stunned.

## Files to Change

| File                       | Change Size | Purpose                                                     |
| -------------------------- | ----------- | ----------------------------------------------------------- |
| `src/demo/demo-sprites.ts` | Small       | Bake the star asset                                         |
| `src/demo/demo-scene.ts`   | Medium      | The orbiting stars, and the swordsman's swept arc and light |

## Execution Outline

1. Bake a small bright star with a soft glow, in the style of the existing marker assets.
2. Emit three stars per stunned enemy at evenly spaced orbit angles driven by elapsed time, anchored above that body's crown, with scale ramping up at the start of the stun and down as it expires.
3. Emit the swept arc for any enemy winding up a melee cut, built from the current facing and brightening with progress, and add its light.
4. Run `npm run verify`, then play: throw a body into a crowd and confirm the barged enemies wear stars for exactly as long as they are helpless; then let a swordsman wind up and confirm the arc shows which way the cut is going.

## Implementation Notes

- Orbit radius around a third of a cell and a period of roughly two seconds. Tilt the ring slightly by varying each star's height with its orbit angle, so it reads as a ring around the head rather than three sprites sliding left and right.
- Give each enemy's ring a phase offset derived from its identity, so a crowd stunned by the same throw does not spin in lockstep.
- The arc is a short sweep at about chest height, spanning roughly the reach and the half-angle the cut actually covers, so what is drawn is the area about to be dangerous rather than a decoration. Reuse the bead helper from child 02, walked along the sweep rather than along a straight line.
- Keep the arc dim for most of the wind-up and bright at the end. Its job is to say "now", and a cue that is at full strength from the first frame says only "soon".
- No test may be added. `src/demo/` is verified by playing it.

## Edge Cases

| Case                                     | Expected Handling                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| A stunned enemy is also drowning         | Drowning wins; suppress the stars once the body is going under                    |
| A stun is refreshed before it expires    | The ring stays up; it is derived from the timer, which is what refreshed          |
| A stunned enemy is killed                | The stars stop with it, since they are derived from a living enemy                |
| A stunned enemy is picked up and carried | A carried body is no longer in the world's enemy list, so no stars are drawn      |
| Many enemies are stunned at once         | Each wears its own ring; no pooled or shared state                                |
| A swordsman is stunned mid-wind-up       | It wears stars and keeps its frozen arc; both are true and both are derived       |
| A swordsman turns during its wind-up     | The arc follows the current facing, so it always shows where the cut is now aimed |

## Acceptance Criteria

1. Any enemy with a running stun timer has three stars orbiting over its head for the duration, whatever caused the stun.
2. Both the soft bodies and the skeleton wear the stars above their own heads.
3. The stars shrink away as the stun runs out rather than vanishing at full size. They arrive at full size, which is correct and was settled at promotion: the world keeps only the stun's remaining time and not its original length, so there is nothing to ease an entrance against — and the stun itself is instant, so an eased entrance would misreport the frame the player most needs to trust.
4. A swordsman winding up a cut shows a bright arc along the path the blade will sweep, and turning during the wind-up turns the arc with it.
5. The ordinary slime shows neither cue, because it has no wind-up.
6. `npm run verify` passes.
