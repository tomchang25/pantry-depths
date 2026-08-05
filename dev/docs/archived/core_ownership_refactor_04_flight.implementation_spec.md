# Core Ownership Refactor — Child 4: Flight Paths Out Of The Tick

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Move everything that flies — thrown weapons, enemy fire, and the emplacements that lob shells — out of the tick module into directories of their own. The tick is currently the single largest module in the rules layer because it owns the whole projectile resolution alongside the frame's ordering.

## Summary

A relocation with no change of shape. These paths stay executors holding the whole run state, on the census allowlist, exactly as the plan's non-goals say: giving them a snapshot-and-effect contract is future work and is not attempted here.

What lands is placement. The flight curve every airborne thing shares becomes its own module, because a curve is geometry and is read by presentation as well as by the rules. The projectile resolution — piercing, cleaving, reaping, pinning, barging, and what each landing is worth — becomes one directory. Enemy fire and the emplacement cycle become another. The line-of-sight query joins the floor queries it belongs with.

The tick keeps what a tick is: the order things happen in.

Consumers are repointed rather than given a re-export, per the project's implementation defaults.

## Relational Context

- Call order inside the tick is load-bearing and unchanged: projectiles resolve before hazards, hazards before drowning, and the floor change is last.
- The projectile family is deeply interconnected — flight, hit tests, landings, and the wall-stop cue table all reference each other — so it moves as one unit rather than being split by concern.
- The flight curve is read by the renderer for trails and shell arcs, so it must stay importable from outside the rules layer.
- The emplacement cycle reads terrain to decide which emplacements still exist, and writes hazards. It is an executor and stays one.
- Nothing in this child may reach the fenced decision trees, and nothing in those trees may reach these modules; the existing rules already state both directions.

## Scope

### Included

- The shared flight curve, the projectile resolution, projectile spawning, enemy fire, and the emplacement cycle, each into its own module.
- The line-of-sight query moved beside the floor's other predicates.
- Import updates across the rules, presentation, and debug layers.

### Excluded

- Any snapshot or effect contract for these paths.
- Any change to flight behaviour, hit resolution, landing outcomes, or the emplacement cycle.
- The player verbs that spawn throws, which move in the next child.

## Files to Change

| File                                      | Change Size | Purpose                                             |
| ----------------------------------------- | ----------- | --------------------------------------------------- |
| `src/core/projectile/flight.ts`           | Small       | The shared curve, read by rules and by the renderer |
| `src/core/projectile/step-projectiles.ts` | Large       | The whole projectile resolution family              |
| `src/core/projectile/spawn.ts`            | Small       | Launch, its recoil, and the aim-capped range        |
| `src/core/hazard/step-hazards.ts`         | Medium      | Enemy fire in flight                                |
| `src/core/hazard/mortars.ts`              | Medium      | The emplacement cycle and its shell geometry        |
| `src/core/floor/maze.ts`                  | Small       | Gains the line-of-sight query                       |
| `src/core/world/simulation.ts`            | Large       | Reduced to the frame's ordering                     |
| `src/core/world/world.ts`                 | Small       | Loses the flight curve and line of sight            |

## Execution Outline

1. Move the flight curve first; everything else that flies reads it.
2. Move the projectile family as one unit, then the spawn path.
3. Move enemy fire and the emplacement cycle.
4. Move the line-of-sight query to the floor.
5. Repoint every consumer using the typecheck as the worklist, then run the narrow checks.

## Implementation Notes

- **The tick keeps its sequence verbatim.** Reordering anything here would be a behaviour change wearing a relocation's clothes.
- **Spawning stays separate from resolution.** A throw's launch reads the player's aim and recoil; its flight does not. They are two modules for that reason.
- **The wall-stop cue table travels with the resolution**, since it is total over the landing vocabulary and would rot if it lived apart from the branch it covers.

## Acceptance Criteria

1. Flight, projectile resolution, enemy fire, and the emplacement cycle each live in one module, none of them inside the tick.
2. The tick module contains the frame's ordering and the player's movement, and no flight resolution.
3. Every throw kind, enemy shot, and shell behaves exactly as before.
4. The census does not rise, and no boundary rule is weakened.
