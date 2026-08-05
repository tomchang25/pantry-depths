# Core Ownership Refactor — Child 9: The State Module Split

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Reduce the run state module to state, and give the layers outside the rules one place to read the run through. The module still held four unrelated jobs: the record, how a run ends, what a floor's work pays out, and where a dropped pickup lands.

## Summary

Four things move out and one thing arrives.

- **Run transitions** — how a run ends and how long it lasted — become their own module. One door out of playing, so the clock and any pad cannot be released by only one exit.
- **The blessing grant** moves to the progression tree it belongs to. It reads the catalogue and rolls what is granted; the only thing it touches on the run is the health the grant carries.
- **Prop placement** becomes its own module under the world tree — not beside the floor, because the floor tree stays queries and geometry so the fenced decision modules may keep importing it, and this writes.
- **Player movement** leaves the tick, taking the two pace penalties that multiply with it.
- **A compatibility facade** arrives at the world directory's index. The renderer, the interface, the frame loop and the development tools import from it rather than learning which module inside the rules owns which piece.

The tick module is renamed to say what it now is: the frame's ordering.

The facade is for the outside only. A rules-layer module that imported it would launder every fence in the plan through a re-export, since the fences are stated in terms of concrete modules — so the boundary checker forbids it, and that rule was declared back when the fences were.

## Relational Context

- Prop placement cannot live under the floor tree without making an owner reachable from a fenced resolver. The world tree is the correct home for that reason, not by preference.
- The facade re-exports from the modules that own each piece, so it depends on the rules layer and nothing in the rules layer may depend on it. Both directions matter: the second is the rule, the first is why the rule is needed.
- Player movement reads the carried weight and the walking speed from the player stats module, which is where the modifier layer was folded away, so the tick no longer touches progression even indirectly.

## Scope

### Included

- The four extractions, the tick rename, the facade, and every import update inside and outside the rules.

### Excluded

- Regrouping the state record's fields, which the plan defers past this work entirely.
- Any behaviour change.

## Files to Change

| File                                  | Change Size | Purpose                                  |
| ------------------------------------- | ----------- | ---------------------------------------- |
| `src/core/world/run-transition.ts`    | Small       | How a run ends, and its clock            |
| `src/core/progression/award-bless.ts` | Small       | The grant a floor's work pays            |
| `src/core/world/props.ts`             | Small       | Where a dropped pickup lands             |
| `src/core/player/movement.ts`         | Medium      | The player moving, and what slows them   |
| `src/core/world/index.ts`             | Medium      | The facade the outside layers read       |
| `src/core/world/step-world.ts`        | Medium      | The tick, renamed to what it is          |
| `src/core/world/world.ts`             | Medium      | Reduced to the record and its population |

## Acceptance Criteria

1. The state module holds the record, its creation, its population, and the reads that describe it.
2. Every layer outside the rules imports the run through one module.
3. No rules-layer module can import that facade, held by the boundary checker.
4. Nothing about the run's behaviour changes.
