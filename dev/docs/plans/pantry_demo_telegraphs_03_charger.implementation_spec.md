# The Charger Becomes A Battering Ram

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Stretch the charger's wind-up to three seconds, make it unmistakable while it gathers, replace its floor chevrons with one red strip that carries both the lane and the countdown, and make a charge that reaches masonry break it while leaving the charger stunned for five seconds.

## Summary

At a 0.8-second wind-up the charger is a thing that hits you before you have finished reading it. At three seconds it stops being a threat at all — the player can walk away, come back, and land several swings before it launches. That is a deliberate category change, and it only pays for itself if the charge becomes something the player _wants_ to happen: so the charge now damages the wall it slams into, and a stalled charger lies stunned for five seconds afterwards.

The result is a piece the player positions. Line a charger up against a stone wall, step out of the lane, and it opens the wall for you and then hands you five free seconds on its body. That is squarely what the demo is for.

The floor chevrons go. In their place is one strip laid down the locked lane, running the charge's full distance and stopping at the first wall in the way. It is drawn dim along its whole length the moment the lane locks — that is where — and a bright fill sweeps outward from the charger as the wind-up completes — that is when. One object answers both questions. The mark over its head stays, and child 02 has already turned it into the charger's own flame — that one says an attack is coming, the strip says where and when, and they are not redundant.

While it winds up, the charger crouches and gathers, throws embers off its body at a rising rate, and carries a light that reddens and swells, so a charge being prepared is visible across the room rather than only from in front of it.

## Relational Context

- Depends on child 01. The lane strip is drawn along the locked direction; without the lock it would sweep after the player for three seconds and then the charge would go somewhere else entirely.
- The charge travels a fixed distance along its locked direction. It does not stop at the locked point. The strip therefore runs the full charge distance, not the distance to the aim point.
- The strip truncates at the first cell that blocks travel, using the same tracer child 02 introduces for the sight line. A strip drawn through a wall promises a lane the charger cannot use.
- **Scene sprites carry no per-instance alpha.** The dim length and the bright fill must be two separate baked assets drawn over each other, not one asset at two opacities. Reaching for an opacity field on the sprite record is the wrong shape and there is no such field.
- Wall damage is owned by the player-actions module, which is the single authority for what happens to a tile. Enemy behavior must call that authority rather than editing tile health itself — tile health, the terrain version bump, and the debris all belong together and are already handled there.
- Enemy behavior does not currently import the actions module. A direct import is preferred and introduces no cycle, because actions does not reach back into enemy behavior. If the boundary check reports a new cycle warning, pass the wall-damage function into the enemy step the same way the blast path already receives it, rather than weakening the boundary configuration.
- The charger is a soft body drawn as a deformed ring stack, so its wind-up posture is expressed through the body's own squash, lean, and wobble in the scene layer. It has no authored frames to swap.
- The chevron asset has exactly one consumer. Once the strip replaces it, delete it rather than leaving it baked and unreferenced.

## Scope

### Included

- Charger wind-up 0.8 s to 3.0 s; stall stun 1.6 s to 5.0 s; a new charge-into-masonry damage value of 2.
- The lane strip replacing the chevrons, with a dim full length and a bright sweeping fill.
- Wind-up presentation: body crouch and gather, rising ember emission, a reddening swelling light.
- Deleting the now-unused chevron asset.

### Excluded

- Charge speed, charge distance, charge damage to the player, knockback, trigger distance, and cooldown — all unchanged.
- The stun stars, which are child 04 and cover every enemy rather than only this one.
- Any change to how the charge resolves against the player or against water and spikes.

## Files to Change

| File                           | Change Size | Purpose                                                                   |
| ------------------------------ | ----------- | ------------------------------------------------------------------------- |
| `src/demo/enemy-archetypes.ts` | Small       | Wind-up, stall stun, and the new charge wall-damage value                 |
| `src/demo/enemy-ai.ts`         | Medium      | Damage masonry on a stalled charge; emit embers through the wind-up       |
| `src/demo/demo-scene.ts`       | Medium      | Lane strip in place of chevrons; wind-up body posture; the charging light |
| `src/demo/demo-sprites.ts`     | Small       | Two lane-strip assets; delete the chevron asset                           |

## Execution Outline

1. Move the three numbers in the archetype module first, so the rest of the work is judged at the durations it will ship with.
2. On a stalled charge, probe the cell immediately ahead along the charge direction and damage it through the wall-damage authority, then apply the longer stun. Order matters: the wall is spent before the charger settles, so a charge that opens a wall leaves the charger in the opening rather than against a wall that no longer exists.
3. Emit embers from the charger during a charge wind-up, at a rate that climbs with progress.
4. Replace the chevron loop in the scene's telegraph builder with the two-pass strip, truncated by the shared tracer.
5. Add the charging light to the scene's light list and the crouch-and-gather posture to the charger's body.
6. Bake the two strip assets and delete the chevron one.
7. Run `npm run verify`, then play: confirm a charge can be baited into a wall, that the wall gives, and that five seconds is as long as it sounds.

## Implementation Notes

- Stone walls take 4 damage and wood 2, so a charge is worth half a stone wall and a whole wooden one. That is deliberately less than a bomb, which still flattens stone in one throw.
- The existing stall test compares distance actually moved against distance expected. Keep it; it already catches both a wall and a barricade, and the wall-damage authority itself ignores anything that is not breakable.
- Emit embers by gating on elapsed time rather than emitting a burst every frame. A few particles per tenth of a second, scaled by progress, is enough; a per-frame burst at sixty frames a second will bury the particle field.
- The light belongs in the scene's light list beside the torch and the altar light, keyed off the same wind-up progress the strip uses, so all three cues move together.
- The body should read as gathering, not as dying: shorter and wider with progress, with a rising shiver, and no droop. Droop is what a corpse does.
- No test may be added. `src/demo/` is verified by playing it.

## Edge Cases

| Case                                                | Expected Handling                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The charge stalls against the outer boundary        | The wall-damage authority already refuses the boundary and announces it; the stun still applies |
| The charge stalls against a barricade               | The barricade takes the damage through the same authority, as a blast already does              |
| The charge stalls against another enemy or a corner | Damage is applied to the probed cell, which is not breakable, so nothing happens but the stun   |
| The charger is killed mid-wind-up                   | Strip, light, and embers stop with it, since all three are derived per frame                    |
| The charger drowns mid-wind-up                      | Unchanged: the hazard path already clears the wind-up and the charge                            |
| The locked lane runs immediately into a wall        | The strip is drawn short, and the charge stalls almost at once — which is a legible outcome     |

## Acceptance Criteria

1. A charger that commits paints one red strip down its locked lane and holds it for three seconds.
2. The strip's bright fill reaches the far end exactly as the charge launches.
3. The charger visibly burns and gathers through the wind-up, and the glow is noticeable from across a room.
4. A charge that slams into a stone or wooden wall damages it, and repeated charges break it open.
5. A stalled charger lies stunned and harmless for five seconds.
6. The strip stops at a wall standing in the lane rather than being drawn through it.
7. `npm run verify` passes.
