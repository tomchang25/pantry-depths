# Core Ownership Refactor — Child 5: Player Verbs Dissolved

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Retire the module that owned every player verb at once. After the attack slice moved out, what remained was still one file holding throwing, shooting, grabbing, dropping, launching, aiming, and both button entries — four unrelated subjects sharing a namespace because they happened to be reached by the same two clicks.

## Summary

The file is replaced by five modules, each one subject:

- **Aim** — where the player is pointed, and what that puts in front of them. Shared by the two verbs that need a direction.
- **Launch** — a throw leaving the hand: its aim-capped range, its recoil, and the projectile it pushes. It joins the flight path it begins, not the verb that triggers it.
- **Throwing and shooting** — what leaves the hand and what is left in it.
- **Carrying** — taking something up, putting it down, and the pickup labels.
- **Input** — the two buttons and what each press commits to: which verb resolves, how long the arm is held, and the gate that ignores a press mid-swing.

Every consumer is repointed and the old module is deleted rather than left as a re-export.

## Relational Context

- The launch path belongs with the projectile it creates, not with the verb that calls it: it reads the player's pitch and recoil, while the flight that follows reads neither. It was named for this child in the previous child's notes and lands here, with the verb that needs it.
- Input imports the verbs; no verb imports input. A press resolves downward.
- The attack slice keeps its own aim helpers inside its fence, because a resolver may not import a module that names the run state. The small duplication is the fence working as designed.
- The pickup label table is read by the interface and two workbenches, so it travels with the carrying verb that owns it rather than staying behind.

## Scope

### Included

- The five modules, the deletion of the module they replace, and every import update.

### Excluded

- Any behaviour change to throwing, shooting, carrying, dropping, or either button.
- Any snapshot or effect contract for these verbs; they remain executors by the plan's design.

## Files to Change

| File                           | Change Size | Purpose                              |
| ------------------------------ | ----------- | ------------------------------------ |
| `src/core/player/aim.ts`       | Small       | Facing, and what is in front of it   |
| `src/core/projectile/spawn.ts` | Medium      | Launch, its range cap and its recoil |
| `src/core/player/throw.ts`     | Medium      | Throwing and shooting                |
| `src/core/player/carry.ts`     | Medium      | Grab, drop, and the pickup labels    |
| `src/core/player/input.ts`     | Small       | The two button entries               |
| `src/core/combat/actions.ts`   | Delete      | Replaced entirely                    |

## Execution Outline

1. Extract the aim helpers first; two of the new modules need them.
2. Extract launch into the projectile directory.
3. Extract throwing, then carrying, then the button entries.
4. Delete the old module and repoint the interface, the tick, and the two workbenches.

## Implementation Notes

- **The press gate is unchanged.** A press during a swing is ignored outright, not queued; that is the whole input model and it stays exactly as written.
- **The shooter branch stays in input**, because deciding whether a press is a shot or a throw is what the button is for.

## Acceptance Criteria

1. The combat action module no longer exists and nothing imports it.
2. Throwing, shooting, grabbing, dropping and both buttons behave exactly as before.
3. Each new module has one subject, decidable from its path.
4. The census does not rise and no boundary rule is weakened.
