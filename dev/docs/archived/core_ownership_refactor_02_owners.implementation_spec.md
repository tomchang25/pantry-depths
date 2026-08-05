# Core Ownership Refactor — Child 2: Mutation Owners

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Give each domain of run state a named single writer: run feedback, enemy damage and death, player damage, and structure damage. Today three of those four live inside modules that decide something else — player damage inside enemy behaviour, structure damage inside player actions — so the module that decides what one enemy does also owns the end of the run.

## Summary

A behaviour-preserving relocation. Nothing changes about what the game does; what changes is which module is allowed to write what.

- **Run feedback** becomes its own module and its own leaf. It declares the shapes of its channels — sound events, visual effects, damage marks — and takes a narrow structural slice of the run rather than the whole state record, so nothing it depends on depends on it.
- **Enemy damage and death** move out of the combat directory unchanged, and gain the one entry that was missing: the hit a carried enemy absorbs on the player's behalf. Those statements lived inside the player-hurt path, which made player damage a second writer of enemy health, the corpse record and the kill count.
- **Player damage** becomes its own owner and composes the enemy owner through a returned outcome, keeping the hand — what the player is left holding — on its own side of the seam.
- **Structure damage** moves into the damage tree, not beside the floor it mutates, so the floor tree stays queries and geometry that the fenced decision modules may keep importing.
- **The area-impact module** stops taking its two collaborators as injected parameters. That injection existed only to dodge an import cycle that the owner extraction removes.

The carried-enemy death path is deliberately preserved statement for statement rather than routed through the ordinary kill exit: it leaves its corpse at the player's position, pays no drop roll, no lifesteal and no pool interaction, and its salvage is its drop. Rerouting it would change all of that.

## Relational Context

- Every kill route must keep arriving at one exit, or the drop roll and lifesteal apply to some routes and not others. The hostage entry is the one deliberate exception and states why in place.
- Player damage may import enemy damage; the reverse is forbidden by the boundary rules. The composition is a returned outcome, never a shared field.
- Feedback may not import the state module. The state module calls into feedback, so the reverse edge would be a runtime cycle the boundary checker refuses. This is why feedback owns its channel types and takes a structural slice.
- The identity allocator is used by both the state record and feedback, so it cannot live in either.
- Structure damage lives under the damage tree because the fenced decision modules import the floor tree; an owner there would be reachable from a resolver.
- The enemy record moves to its own module so modules below the owner stack can be typed against an enemy without acquiring the run state. The state module re-exports the type names, because the state record genuinely carries them.
- Outside-core layers keep working by having their import specifiers updated, not by a re-export shim. The project's implementation defaults forbid adding a redirect where owner and consumers can be updated together.

## Scope

### Included

- The four owner modules, the enemy state module, and the identity allocator.
- The hostage seam split across the enemy and player owners.
- Removal of the injected collaborators from the area-impact module.
- Import updates across every consumer, in and out of core.
- Boundary rule corrections the extraction exposes, and the addendum kept in step.

### Excluded

- Any behaviour change: no timing, geometry, damage number, message, or ordering differs.
- The player attack slice, the projectile path, and the enemy behaviour families. Later children.
- Splitting the state module itself.

## Files to Change

| File                                  | Change Size | Purpose                                                      |
| ------------------------------------- | ----------- | ------------------------------------------------------------ |
| `src/core/feedback/run-feedback.ts`   | Medium      | New leaf owner: channels, their shapes, and its target slice |
| `src/core/damage/enemy-damage.ts`     | Medium      | Moved kill and damage exit, plus the hostage entry           |
| `src/core/damage/player-damage.ts`    | Small       | New owner, composing the hostage outcome                     |
| `src/core/damage/structure-damage.ts` | Medium      | Moved wall, barricade and emplacement damage                 |
| `src/core/damage/area.ts`             | Medium      | Moved impacts, injection removed                             |
| `src/core/enemy/enemy-state.ts`       | Medium      | The enemy record, its vocabularies, and the stun transition  |
| `src/core/world/ids.ts`               | Small       | The identity allocator, shared by state and feedback         |
| `src/core/world/world.ts`             | Medium      | Loses the moved code; re-exports the record's own types      |
| `src/core/combat/actions.ts`          | Medium      | Loses structure damage; imports its owner                    |
| `src/core/combat/enemy-ai.ts`         | Medium      | Loses player damage; imports its owner                       |
| `src/core/world/simulation.ts`        | Small       | Import updates and two de-injected call sites                |
| `.dependency-cruiser.cjs`             | Small       | Rule corrections the extraction exposed                      |

## Execution Outline

1. Create the enemy state module and the identity allocator first: the state record's own types reference the enemy, and both the state module and feedback need the allocator.
2. Create the feedback leaf, moving its channel types with it.
3. Create the three damage owners, splitting the hostage statements across two of them.
4. Move the area-impact module and drop its injected parameters at both call sites.
5. Strip the moved code from the state, action, and behaviour modules; delete the two emptied files.
6. Repoint every importer, using the typecheck as the worklist.
7. Correct the boundary rules the extraction exposes and update the addendum in the same change.
8. Re-measure the census and confirm both totals fell.

## Implementation Notes

- **The hostage split.** Enemy damage owns health, the flinch, the corpse record, the kill count and the salvage roll, and returns the outcome. Player damage owns the hand and the message. The message text and its nested fallback are reproduced exactly.
- **Feedback's target type.** One structural type covering the nine fields the channels write. The run state satisfies it without naming it.
- **Do not reimplement the allocator.** It advances the counter before reading it; an inlined post-increment would shift every identity by one.
- **Boundary corrections expected.** Feedback needs the floor's stain queries; the owner-direction rule must exempt the enemy state vocabulary and must not catch the area executor, which composes all three owners by design.

## Edge Cases

| Case                                     | Expected Handling                                                     |
| ---------------------------------------- | --------------------------------------------------------------------- |
| The carried enemy absorbs a fatal hit    | Corpse at the player's position, kill counted, salvage in the hand    |
| A blast breaks walls                     | Still quiet: no per-wall message, debris and break sound unchanged    |
| An enemy dies in water                   | No corpse, no scatter; the pool still fills and the count still rises |
| A module below the owners needs an enemy | It imports the enemy state module, never the run state                |

## Acceptance Criteria

1. Every check the plan names for a child passes, and the boundary checker reports no cycle.
2. The census totals fall on both axes against the recorded baseline.
3. Each of the four domains has exactly one writing module, with the carried-enemy exception stated where it lives.
4. No behaviour differs: the same messages, the same numbers, the same ordering.
5. The addendum describes the owner stack as it actually landed.
