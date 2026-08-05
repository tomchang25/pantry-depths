# Core Ownership Refactor — Child 8: The Melee Family, And The Chassis De-Branched

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Move the last attack family behind the contract, make the registry total over the attack vocabulary, and reduce the module that held all three to the chassis it was always meant to be.

## Summary

The melee family — the committed cut through a cone fixed in the world — lands behind the contract, asking for its sparks by name like the other two.

With every intent answered by a row, the registry becomes total: `Readonly<Record<WindupIntent, EnemyBehavior>>`. Adding a fourth family without registering it stops compiling, which is the same guarantee the two inline dispatch sites used to get from their exhaustiveness checks, in a form that survives the families living in modules of their own.

The chassis loses its per-intent branches entirely. Opening an attack, running a telegraph, and resolving a release are each one lookup. What remains is what every enemy shares: timers, knockback, crowd separation, pathing, steering, walking, sight, and the five-state decision frame. The module is renamed to say so, and the steering helper both it and the melee cone need moves to the movement module they both may import.

One asymmetry is now stated rather than implied: a shot has nothing left to run once it is away, so the chassis clears the commitment after a release; a charge keeps its own, because what it is committed to outlives its wind-up.

## Relational Context

- The cone test needs the shortest-turn helper, which lived in the chassis. A fenced family may not import the chassis, so it moves to the movement module, which the fence allows.
- The registry becoming total is what lets the chassis drop its branches; the two changes are one change and cannot land apart.
- The rename is the last step, so the diff before it reads as code removal rather than as a file move.

## Scope

### Included

- The melee family, the total registry, the de-branched chassis, its rename, the helper relocation, and the two cone cases.

### Excluded

- Any change to cut geometry, reach margin, damage, or the strike hold.
- The decision frame itself, which is chassis work and unchanged.

## Files to Change

| File                                             | Change Size | Purpose                          |
| ------------------------------------------------ | ----------- | -------------------------------- |
| `src/core/enemy/behaviors/melee.ts`              | Medium      | The last family                  |
| `src/core/enemy/behaviors/registry.ts`           | Small       | Total over the intent vocabulary |
| `src/core/enemy/chassis.ts`                      | Large       | De-branched and renamed          |
| `src/core/floor/movement.ts`                     | Small       | Gains the steering helper        |
| `test/unit/core/enemy/behaviors/release.test.ts` | Small       | In-cone and out-of-cone cases    |

## Acceptance Criteria

1. The chassis contains no family-specific code, judged by reading.
2. Adding a fourth family requires one module and one registry row, and omitting the row fails compilation.
3. A behaviour module cannot name a field outside the narrow self.
4. Each hunter type telegraphs, attacks and recovers as before, and a cut still misses a player who steps out of the cone.
