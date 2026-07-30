# Lock A Wind-Up's Target When It Begins

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Make a committed enemy attack resolve against the point it was aimed at when its wind-up started, instead of re-picking the player's current position at the instant it fires. Every telegraph this plan adds is a promise about where an attack will land, and none of them can be true until the attack stops re-aiming.

## Summary

The shooter and the charger both compute their direction at the _end_ of the wind-up, from wherever the player happens to be standing then. The result is that both attacks track perfectly: the "!" marker and the charger's floor chevrons are drawn every frame against the live player position, so they describe the present rather than the future, and the only counter the player has is cover.

This child adds a locked aim point to the enemy: the wind-up records the player's position when it begins, and the shot direction, the charge direction, and the drawn lane all read that recorded point afterwards. Nothing else about the attacks changes — same wind-up durations, same damage, same ranges, same cooldowns.

The visible result is that both attacks become dodgeable by walking. A shooter that starts winding up sends its bolt through where the player was a second ago; a charger runs down the lane it painted rather than following the player around it. Contact melee is deliberately untouched, because it already re-checks range when it resolves and misses a player who stepped away.

## Relational Context

- Enemy behavior is the single authority for enemy state; the scene layer only reads it. The locked point is therefore stored on the enemy record and written exactly once per wind-up, at the moment the wind-up begins.
- The wind-up entry point is the only writer of the locked point. Every attack resolution is a reader. Do not recompute the point at resolution time under any condition, including when the recorded point is unreachable or coincides with the enemy's own position.
- The charge reads the locked point only to derive its _direction_. Its travel distance stays a fixed charge distance along that direction — the charge does not stop at the aim point and must not be converted into a move-to-target.
- The demo scene's telegraph builder currently derives the charger's floor lane from the live player position. After this change it must derive it from the enemy's locked point, or the drawn lane and the actual charge will disagree in the one case this child exists to fix.
- Contact melee keeps its existing behavior: it resolves by re-checking distance against the live player position and simply misses when out of range. Do not route it through the locked point.
- New state on the enemy record must be initialized wherever an enemy is constructed, or a body that has never wound up carries an undefined aim.

## Scope

### Included

- A locked aim point on the enemy record, written when a wind-up begins.
- Direct shot and charge launch reading that point instead of the live player position.
- The charger's existing floor lane drawn from that point.

### Excluded

- Any change to wind-up durations, damage, cooldowns, ranges, or speeds.
- The sight line, the lane strip, the charger burn, the stun stars, the damage marks, and the mortar emplacement — all later children.
- Contact melee resolution.

## Files to Change

| File                     | Change Size | Purpose                                                                 |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| `src/demo/world.ts`      | Small       | Carry the locked aim point on the enemy record and initialize it        |
| `src/demo/enemy-ai.ts`   | Small       | Write the point at wind-up start; read it when the shot and charge fire |
| `src/demo/demo-scene.ts` | Small       | Draw the charger's floor lane from the locked point                     |

## Execution Outline

1. Add the locked aim fields to the enemy record and initialize them at construction, so no later reader can observe an unset value.
2. Give the wind-up entry point access to the world and have it record the player's current position. This is the only write site.
3. Switch the direct shot's direction derivation to the recorded point.
4. Switch the charge launch's direction derivation to the recorded point, leaving its fixed travel distance alone.
5. Switch the scene's charger lane to the recorded point, so the drawn chevrons and the launched charge agree.
6. Run `npm run verify`, then play the demo and confirm the dodge is real for both attacks.

## Implementation Notes

- The wind-up entry point does not currently receive the world. Widening its parameters is the intended change; do not reach for a module-level cache or read the player through some other owner.
- Preserve the existing zero-length guard when normalizing a direction. A player standing exactly on the enemy is an ordinary case here, not an error.
- Store a world position rather than a normalized direction. A direction is enough for the two attacks in this child, but the lane strip and the landing circle later need the point itself, and having two representations of the same lock is how they drift apart.
- No test may be added for any of this. `src/demo/` is verified by playing it, and the repository has a machine check that fails the gate if a test imports it.

## Edge Cases

| Case                                                     | Expected Handling                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The locked point coincides with the enemy's own position | Fall through the existing zero-length guard; the attack fires in whatever direction that yields |
| The player breaks line of sight during the wind-up       | The attack still fires at the locked point. The shot simply buries itself in the obstruction    |
| The enemy is stunned, drowned, or killed mid-wind-up     | Unchanged. Those paths already clear the wind-up before it can resolve                          |
| The player dies during a wind-up                         | Unchanged. Enemy stepping already halts while the run is not playing                            |
| An enemy is spawned as a reinforcement                   | Its locked point is initialized at construction like every other field                          |

## Acceptance Criteria

1. A shooter that begins a wind-up while aimed at the player fires at where the player stood when the wind-up began; walking two paces sideways during the wind-up is enough to be missed.
2. A charger runs down the lane its chevrons are drawn along, and a player who steps off that lane is not hit.
3. A charger that commits and is then walked away from still travels its full charge distance along the committed lane rather than turning to follow.
4. Contact melee still connects when the player stays in reach and misses when they leave it.
5. `npm run verify` passes.
