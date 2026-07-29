# Directional Marks For Damage Taken

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Turn "I am losing health" into "turn left": a soft arc around the crosshair pointing at the world position a hit came from, for every hit with a known source. Today the only feedback is a full-screen red flash, which in a room with twenty enemies and shots arriving from off screen says something happened and nothing about what to do next.

## Summary

Every place the player takes damage already knows where it came from — the melee attacker's position, the charging body, the incoming bolt — and passes it in, because a separate rule already uses it to decide whether a hit arrived from the front. Nothing new needs to be measured; the origin just needs to be kept for a moment and drawn.

A hit records its source's world position, a severity, and a lifetime. While the mark is alive, an arc is drawn on the crosshair ring at the bearing from the player's current facing to that stored position. Several live marks stack, so being caught between two attackers draws itself as two arcs.

The stored value is a world position and the bearing is recomputed every frame. That is the whole difference between an indicator that makes the player turn and one that decorates the screen: a mark that keeps its screen position while the player turns is pointing at a place the threat is not.

It is drawn in the per-frame overlay pass that already paints the sword arm and the carried object, not in the DOM HUD. The HUD is the home of discrete readouts that change when state changes; a continuously fading arc that follows the view is a per-frame drawing.

## Relational Context

- Damage to the player funnels through one function, which is already the single write point for the hit flash. The mark is recorded there, next to the flash, so the two cues can never disagree about whether a hit registered.
- Record the mark before the god-mode gate. God mode is defined as the player keeping their points while the hit reads exactly as it otherwise would; a cheat that also hides the direction defeats the purpose of playing with it on.
- The hit flash is raised for a hit the carried hostage absorbs as well. Record the mark at the same point for the same reason: the shot still came from somewhere and the player still needs to know where.
- Aging and expiry belong to the world step alongside the other decaying timers, not to the drawing pass. The drawing pass reads and never mutates.
- The overlay pass takes a narrowed view of the world rather than the whole record. Widening that view to include the player's pose and the mark list is the intended change.
- The source origin is optional at the damage entry point and a caller that omits it means "no direction". Draw nothing for those rather than inventing a bearing.
- The list is unbounded by nature — a player standing in a crowd takes many hits a second. Cap it, dropping oldest first.

## Scope

### Included

- A short-lived list of damage marks on the world, each with a source position and a severity.
- Recording a mark wherever player damage is applied with a known origin.
- Ageing and expiring marks in the world step.
- Drawing the arcs in the per-frame overlay pass.

### Excluded

- Any change to damage amounts, sources, or the hit flash itself.
- A directional cue for damage the player deals.
- Any change to the DOM HUD.

## Files to Change

| File                         | Change Size | Purpose                                                  |
| ---------------------------- | ----------- | -------------------------------------------------------- |
| `src/demo/world.ts`          | Small       | The mark record, the list, and its initialization        |
| `src/demo/enemy-ai.ts`       | Small       | Record a mark where player damage is applied             |
| `src/demo/simulation.ts`     | Small       | Age and expire marks alongside the other decaying timers |
| `src/demo/demo-viewmodel.ts` | Medium      | Draw the arcs, and widen the pass's view of the world    |

## Execution Outline

1. Add the mark record and list to the world, initialized empty for both a new run and a descent.
2. Record a mark at the damage entry point when an origin was supplied, capping the list.
3. Age marks in the world step and drop the expired ones.
4. Widen the overlay pass's view of the world and draw one arc per live mark.
5. Run `npm run verify`, then play: take a hit from directly behind and confirm the arc sits below the crosshair, then turn to face the attacker and confirm the arc sweeps to the top before it fades.

## Implementation Notes

- Bearing is the shortest signed turn from the player's facing to the direction of the stored point, wrapped to a half turn either way. Screen-up is straight ahead, and screen-right is a positive turn; the canvas angle convention differs from the world one by a quarter turn, and the fastest way to confirm the sign is to take a hit from behind and look.
- Radius roughly a sixth of the smaller canvas dimension, arc width around forty-five degrees, drawn with a thick round-capped stroke. Judge all three by eye in the running demo.
- Fade on a curve rather than linearly, so the mark is at full strength for most of its life and then goes. A linear fade spends half its lifetime too faint to read.
- Severity scales opacity and thickness but never lifetime. A big hit should be louder, not longer — a long-lived mark from a single heavy hit sits on screen after the threat has been dealt with.
- Marks are cleared on descent along with the rest of the floor's transient state.
- No test may be added. `src/demo/` is verified by playing it.

## Edge Cases

| Case                                         | Expected Handling                                                |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Damage applied with no origin                | No mark is recorded                                              |
| The source is at the player's exact position | No mark is recorded rather than drawing an arbitrary bearing     |
| Many hits land in the same frame             | Each records its own mark, oldest dropped past the cap           |
| A hit lands while god mode is on             | The mark is recorded and drawn as normal                         |
| A hit the carried hostage absorbs            | The mark is recorded, matching the hit flash                     |
| The player dies                              | Live marks fade out normally under the death overlay             |
| The player descends with marks alive         | The list is cleared with the rest of the floor's transient state |

## Acceptance Criteria

1. A hit from behind raises an arc below the crosshair; a hit from the left raises one to its left.
2. Turning to face the source sweeps the arc to the top of the crosshair before it fades.
3. Two attackers on opposite sides raise two arcs at once.
4. A heavier hit raises a louder arc without one that lasts longer.
5. Damage with no known source raises no arc.
6. `npm run verify` passes.
