# The Shooter's Telegraph, And One Symbol Per Attack

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Give every wind-up a symbol that says which attack is coming, all in one warning red, and give the shooter the two cues it is missing: a line showing where its bolt will go, and a body that visibly gathers the shot before firing it.

## Summary

Three attacks currently share one exclamation mark in two colours, and the split is wrong in a way that is easy to miss: the marker is chosen by asking whether the intent is a charge, so a charge gets the red mark and _everything else_ — a shot and a skeleton's sword swing alike — gets the blue one. The swordsman winding up a cut is therefore wearing the shooter's badge.

This child replaces that with one symbol per intent, all red, because red is what the player should read as "something is about to hit you" without having to learn a palette: a reticle for the shot, a flame for the charge, a blade for the sword. The charger's flame is baked here with the other two so the vocabulary lands as one set; how the charger _uses_ it, along with the rest of its rework, stays child 03's.

The shooter then gets its own two cues. A line of small bright beads runs from it to the locked point, at the height the bolt flies, stopping at the first surface that would stop the bolt — that is what makes cover teachable, because sidestepping behind a barricade visibly shortens the line to the timbers. And its body inflates and gathers a bright core as the wind-up completes, so a shooter that has committed is legible from behind, from the side, and with the marker off screen.

Beads rather than a solid rod, and the reason is the renderer. A rod in this scene is opaque and shaded down by distance, so a warning line gets darker the further away the shooter is — the exact inverse of what a warning needs. Small additive dots are already synthesized from non-particle sources for projectile trails, they are depth-tested the same way, and a dotted line reads as a sight line on its own. This adds no renderer capability and touches nothing in the presentation layer.

## Relational Context

- Depends on child 01. The line is drawn to the locked point; without the lock it would sweep after the player and then the bolt would go somewhere else.
- The marker is currently selected by a single test for the charge intent, with everything else falling to the shooter's mark. Replace that with a branch per intent so each member of the closed intent set names its own symbol; a silent fallthrough here is what produced the swordsman-wearing-the-shooter's-badge defect.
- The intent union is dispatched through chains that end in a compile-time exhaustiveness check. Build the symbol selection so it keeps that property — a later intent added without a symbol should fail the build, not inherit one.
- The line's truncation rule must be the same predicate the bolt itself uses when it decides it has hit something. If the drawn line and the fired shot disagree about what stops them, the warning lies about cover, which is the failure this child exists to prevent.
- The scene layer derives every frame from world state and owns no state of its own. Symbol, line, and body swell all read the wind-up timer, the intent, and the locked point; nothing is stored for any of them.
- The particle channel already carries synthesized entries with no backing simulation particle — projectile trails are built this way. Follow that precedent for the beads rather than introducing a new scene primitive or extending the beam channel.
- The shooter is a soft body drawn as a deformed ring stack, so its wind-up posture is expressed through the body's own squash and wobble, exactly as the charger's will be. It has no frames to swap.
- The bead helper is reused by children 03 and 06, so it belongs somewhere both can reach rather than buried in the shooter's own path.
- The charger's lane and the mortar's landing circle belong to children 03 and 06. Each attack gets exactly one owner for where it will land.

## Scope

### Included

- Three red wind-up symbols, one per intent — reticle, flame, blade — replacing the shared exclamation mark and its two colours.
- Selecting the symbol per intent rather than by testing for the charge.
- A bead line from a shooter to its locked point while a direct-shot wind-up runs, truncated at the first cell that would stop the shot.
- The shooter's body gathering the shot: swelling, a brightening core, and a small light that rises with wind-up progress.

### Excluded

- Any change to shot damage, range, speed, wind-up duration, or cooldown.
- Everything else about the charger, including how it uses the flame symbol.
- The mortar's landing circle, the stun stars, and the swordsman's own body cue.
- Any change to the presentation layer.

## Files to Change

| File                       | Change Size | Purpose                                                                      |
| -------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `src/demo/demo-sprites.ts` | Medium      | Bake the three symbols; retire the two-colour exclamation mark               |
| `src/demo/demo-scene.ts`   | Medium      | Per-intent symbol selection, the bead line, and the shooter's body and light |

## Execution Outline

1. Bake the three symbols in one warning red and switch the telegraph builder to select by intent, so the swordsman stops wearing the shooter's mark. Land this beat on its own — it is visible immediately and needs nothing else.
2. Add a helper that walks from a start point toward a target at fixed spacing and yields bead positions, stopping at the first cell the shot predicate rejects and at a maximum equal to the shot's own range.
3. Emit beads for every enemy winding up a direct shot, scaling alpha and size by wind-up progress.
4. Add the shooter's body swell and its light.
5. Run `npm run verify`, then play: confirm the three symbols are distinguishable at a glance, the line points where the bolt lands, and a barricade shortens it.

## Implementation Notes

- The symbols must be readable as silhouettes at a distance, because that is the size they will usually be seen at. A reticle reads as a ring with ticks, a flame as a tapering tongue, a blade as an angled edge — keep each to one clear shape and resist detail that vanishes across a room.
- One red for all three. The blue is retired; nothing should still require reading a palette to work out whether it is dangerous.
- Bead spacing around a fifth of a cell, bead size around a twentieth of a cell growing modestly with progress, drawn additively. These are starting values to be judged by eye in the running demo.
- Put the beads at the height the bolt's own sprite flies at, not at floor level and not at eye level. A line drawn along the floor cannot tell the player whether crouching behind a low obstacle would work.
- Give the beads a small per-bead shimmer keyed off elapsed time so the line reads as live rather than as a painted stripe. Keep it subtle.
- The shooter's swell should read as filling, not as gathering to leap: taller and rounder with progress, with a bright core near the crown, and no crouch. The crouch is the charger's, and the two must not be confusable.
- A wind-up frozen because the enemy was stunned keeps its symbol, its line, and its swell. The enemy is still committed and will resume.
- No test may be added. `src/demo/` is verified by playing it.

## Edge Cases

| Case                                        | Expected Handling                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| The locked point is behind a wall           | The line stops at the wall; the bolt still fires and buries itself there |
| The locked point is beyond the shot's range | The line stops at maximum range                                          |
| The locked point coincides with the shooter | Emit no beads rather than dividing by a zero-length direction            |
| The shooter is stunned mid-wind-up          | Symbol, line, and swell all stay, frozen with the timer                  |
| Several shooters wind up at once            | Each draws its own line and swell; no shared or pooled state             |
| An enemy with no wind-up running            | No symbol is drawn, exactly as today                                     |

## Acceptance Criteria

1. A shooter, a charger, and a swordsman winding up are told apart by their symbols alone, and all three symbols are red.
2. A skeleton swordsman winding up a cut no longer shows the shooter's mark.
3. A shooter beginning a wind-up draws a visible line toward the point it will fire at, and the bolt travels along that line.
4. Interposing a wall or a barricade visibly shortens the line to that obstruction.
5. A shooter's body visibly gathers the shot through the wind-up and is identifiable as committed from any angle.
6. `npm run verify` passes.
