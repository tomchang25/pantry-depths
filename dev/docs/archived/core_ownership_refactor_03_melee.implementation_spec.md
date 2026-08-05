# Core Ownership Refactor — Child 3: The Player Attack Slice

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Turn the player's swing into a decision a reviewer can read in one folder. Today the swing's rules — the arc, the target priority, the cleave, where the blow visibly lands — are interleaved with the writes that apply them, inside a module that also throws, shoots, grabs and drops, and every one of those functions holds the whole run state.

## Summary

The swing becomes three modules with three different privileges.

- **A contract** declaring what a swing is decided from and what it can decide: a snapshot of the actor's pose, the resolved attack numbers, the candidates near enough to matter, the altar if one still stands, and a read-only view of the floor; plus the effects a swing can produce.
- **A resolver** that is a pure function of that snapshot. It owns every rule worth tuning — the sweep arc, nearest-first ordering, the everyone-in-the-arc cleave, the priority order of enemies then altar then breakable cell then miss, and the point the arc is drawn through. It cannot name the run state, cannot reach an owner, and returns an ordered list of effects.
- **An executor** that assembles the snapshot, calls the resolver, and applies each effect through the owners in one exhaustive branch a reviewer reads once to know every consumer.

Beside them, the attack numbers themselves move into a player stats module, so the progression layer — blessings and the equipped reward — is folded into plain numbers before the resolver sees anything. The resolver never learns that blessings exist.

The reading claim this child is measured by: changing the arc, the priority, the cleave rule, or the reach handling should mean reading the resolver and its contract, and nothing else.

## Relational Context

- The resolver is inside a fenced tree. The boundary rules already forbid it reaching run state, the owners, the particle field, or progression, including type-only imports; the executor beside it is the declared exemption because holding raw state on the slice's behalf is its job.
- The floor arrives as a predicate rather than the maze, so the resolver cannot reach a mutating floor entry even by accident. This is the strongest form of the read-only-view rule the addendum states.
- Candidate assembly is mechanical: a radius cut at the attack's reach, which is exactly the set the arc test could accept, and nothing else. Whether a drowning enemy is a target is a rule, so it travels on the candidate and the resolver decides it.
- The executor must capture enemy references when it builds the snapshot, not look them up afterwards. Applying a fatal hit removes an enemy from the run's list, and the remaining effects still have to land.
- The point the arc is drawn through is computed from snapshot positions, which are pre-hit. That is what the current code achieves by reading the target's position before its damage loop.
- The attack numbers module is imported by the area-impact executor and the tick, which read thrown damage and player speed from it. It is not an owner and is not caught by the owner-direction rule.
- The swing's entry point stays where it is this child. The runtime calls it, and moving the entry belongs to the child that dissolves the player verbs.

## Scope

### Included

- The attack numbers module, moved out of the action module with its constants.
- The melee contract, resolver, and executor.
- The first named unit spec, covering the resolver's geometry and priority.
- The action module reduced to throwing, shooting, carrying, and the two button entries.

### Excluded

- Throwing, shooting, and carrying, which stay executors and move in a later child.
- The altar's own state transition, which stays with the executor rather than becoming a resolver decision — it is a mutation, not a choice.
- Any change to what a swing does.

## Files to Change

| File                                                | Change Size | Purpose                                                     |
| --------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `src/core/player/stats.ts`                          | Small       | The resolved attack numbers, moved with their constants     |
| `src/core/player/melee/contract.ts`                 | Medium      | Snapshot, candidate, effect, and floor view types           |
| `src/core/player/melee/resolve-melee.ts`            | Medium      | The pure decision: arc, ordering, priority, cleave, landing |
| `src/core/player/melee/execute-melee.ts`            | Medium      | Assembly, dispatch, and the altar transition                |
| `src/core/combat/actions.ts`                        | Large       | Loses the swing and the numbers                             |
| `test/unit/core/player/melee/resolve-melee.test.ts` | Small       | The four named cases                                        |

## Execution Outline

1. Move the attack numbers into the player stats module and repoint the tick and the area-impact executor.
2. Write the contract, deriving the snapshot's shape from what the current swing actually reads.
3. Write the resolver by lifting the sweep, the arc test, the altar range check, and the wall ray, returning effects instead of writing.
4. Write the executor: assembly, the exhaustive dispatch, and the altar transition lifted whole.
5. Point the existing swing entry at the executor and delete the code it replaces.
6. Add the named spec and run the narrow checks.

## Implementation Notes

- **Effect order is the applied order.** The resolver returns effects in the sequence the executor applies them, so the list reads as the swing's script.
- **One deliberate, non-observable normalisation.** In the current wall branch the arc's landing point is written between the impact sound and the wall damage. Under the contract the structure effect carries both sound and damage, so the landing lands after them. Nothing reads either field in between, so the state at the end of the tick is identical; it is recorded here so a reader diffing the two does not go looking for a behaviour change.
- **Impact only when connected.** A swing that meets nothing still draws its arc but must not produce the impact hitch.
- **The cleave count is reported after the landing**, as it is today.

## Edge Cases

| Case                                      | Expected Handling                                                  |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Several enemies inside the arc            | All struck at full damage and shove; nearest is where the arc goes |
| An enemy inside reach but outside the arc | Not struck, and does not suppress the altar or wall                |
| A drowning enemy inside the arc           | Not a target; the swing continues to the next priority             |
| The altar stands but is out of reach      | Skipped; the swing falls through to the wall ray                   |
| Nothing in front at all                   | Arc drawn straight ahead at arm's length, no impact hitch          |

## Acceptance Criteria

1. The resolver is a pure function that cannot name the run state, proved by the boundary check and the census.
2. Changing the arc, the target priority, the cleave rule, or the reach requires editing only the resolver and its contract.
3. Every consumer of a swing effect is visible in one dispatch.
4. A swing behaves exactly as before against enemies, the altar, a wall, and nothing.
5. The named spec exists with its four cases and no other test is added.
