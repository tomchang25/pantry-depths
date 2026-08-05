# Core Ownership Refactor — Child 7: The Charge Family

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Move the charging family behind the behaviour contract. It is the family the contract was designed against: the only one with a live step, the only one that moves its own body while attacking, and the only one whose effects have an order that is part of the rules rather than an accident of how the code was written.

## Summary

The charge commits to a lane, gathers sparks while held, launches, and then runs — hitting the player it catches, or stalling against masonry and paying a stun for the miss.

Under the contract, moving along the committed lane stays a direct write, because the enemy's own position is the enemy's own business. Everything else is returned in order, and the order carries meaning:

1. **The ground it reached is probed first.** A charge that overran into water is drowning before anything else asks where it is.
2. **A caught player is hit, then shoved.**
3. **On a stall, the wall is spent, its dust is thrown, and only then does the stun land.** A charge that breaks through ends in the opening rather than stunned against masonry it has already removed.

That last step is why the self-stun is an effect and not a write: an effect states the order, a write leaves it to luck. In the module this replaces, the wall damage and the stun happened to be adjacent statements whose order nothing enforced.

## Relational Context

- The clearance every enemy keeps from a wall is an enemy fact, so it moves to the enemy state vocabulary where a fenced family can import it; it was in the run state module, which they may not reach.
- The movement helpers take the grid, which is why the view carries the floor rather than a predicate. The type is read-only, so a mutating floor entry does not satisfy it.
- The chassis's live-step call replaces the inline charge branch entirely; the registry now answers for two of the three intents.

## Scope

### Included

- The charge family behind the contract, its three inline functions removed, and the clearance constant relocated.
- Two more cases in the named spec: a catching frame and a stalling frame, both asserting the order.

### Excluded

- The melee family and making the registry total. The next child.
- Any change to charge geometry, damage, knockback, stun length, or wall cost.

## Files to Change

| File                                             | Change Size | Purpose                           |
| ------------------------------------------------ | ----------- | --------------------------------- |
| `src/core/enemy/behaviors/charge.ts`             | Medium      | The family behind the contract    |
| `src/core/enemy/behaviors/registry.ts`           | Small       | Its row                           |
| `src/core/enemy/enemy-state.ts`                  | Small       | Gains the wall clearance constant |
| `src/core/combat/enemy-ai.ts`                    | Medium      | Loses three inline functions      |
| `test/unit/core/enemy/behaviors/release.test.ts` | Small       | The two ordering cases            |

## Implementation Notes

- **The stall probe looks along the lane, not underfoot**, because a stall stops just short of what caused it.
- **A stall is measured against distance covered**, not against a collision result, so it catches anything that stopped the charge.

## Acceptance Criteria

1. The charging family cannot reach run state, the owners, or the particle field.
2. A caught player takes the same damage and the same shove as before.
3. A stalled charge spends the wall before the stun, asserted by the spec rather than left to statement order.
4. The charger's wind-up, lane, overrun and wall stun behave as before.
