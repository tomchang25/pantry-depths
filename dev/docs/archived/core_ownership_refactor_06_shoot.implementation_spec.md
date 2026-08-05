# Core Ownership Refactor — Child 6: The Behaviour Contract And The Shoot Family

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Declare the contract every enemy attack family will answer, and move the first family behind it. Today all three attack families live inside the same module as the movement and decision plumbing every enemy shares, and each can reach anything the run state holds.

## Summary

The contract is four types and a registry.

- **A narrow self.** An attack receives only the fields an attack uses: where it stands, where it faces, what it is committed to, the wind-up clocks, the locked aim, the charge lane, and the two attack timers. Health, the decision state, the errand, and the flinch timers are absent from the type, so a family cannot touch them by accident.
- **A read-only view.** The player's position and the floor, typed so a mutating floor entry does not satisfy it.
- **Typed effects.** Everything beyond the enemy's own attack fields — hurting the player, shoving them, sending a shot, breaking a structure, probing the ground, stunning itself, and throwing sparks — is returned, not written. The chassis applies them in the order they arrive.
- **Four seams and a registry** mapping intent to family.

Sparks are asked for by name rather than as a particle specification. A family says where the sparks go and how hard; what they look like stays with the chassis. That keeps the particle vocabulary out of the fenced tree, which the boundary rules require anyway, and keeps a presentation tweak from being an edit to a decision module.

The shoot family lands behind it. The other two keep their inline branches until their own children, so the registry is partial here and becomes total — a missing row failing to compile — when the last family arrives.

## Relational Context

- Behaviour modules are fenced: they may not reach run state, the owners, the particle field, or progression. The chassis is the executor that applies what they return.
- The wind-up commit is shared by every family that telegraphs, so it lives beside them in the fenced folder rather than in the chassis, which they may not import.
- The chassis calls the telegraph seam before the shared wind-up work, so a family's per-frame telegraph effects land in the same position the inline versions did.
- The registry is partial by design during the extraction. The chassis treats a missing row as "keep the inline branch", which is what lets the families land one at a time.

## Scope

### Included

- The contract, the shared wind-up commit, the registry, the shoot family, the chassis's effect dispatch, and the spark presets.
- The second named unit spec, started with the shoot release cases.

### Excluded

- The charge and melee families, and making the registry total. Their own children.
- Any change to what a shot does.

## Files to Change

| File                                             | Change Size | Purpose                                     |
| ------------------------------------------------ | ----------- | ------------------------------------------- |
| `src/core/enemy/behaviors/contract.ts`           | Medium      | Self, view, effects, seams                  |
| `src/core/enemy/behaviors/windup.ts`             | Small       | The shared commit and telegraph progress    |
| `src/core/enemy/behaviors/shoot.ts`              | Small       | The first family                            |
| `src/core/enemy/behaviors/registry.ts`           | Small       | Intent to family, partial during extraction |
| `src/core/combat/enemy-ai.ts`                    | Medium      | Effect dispatch, spark presets, shoot wired |
| `test/unit/core/enemy/behaviors/release.test.ts` | Small       | The shoot release cases                     |

## Execution Outline

1. Write the contract, then the shared wind-up commit it depends on.
2. Write the shoot family and the registry row for it.
3. Add the chassis's effect dispatch and the spark presets.
4. Point the two shoot dispatch sites at the registry.
5. Add the spec cases and run the narrow checks.

## Implementation Notes

- **One non-observable reorder.** The shot's own timers are set inside the family, before the chassis pushes the hazard the family asked for; the inline version pushed first. Nothing reads either in between.
- **A row with no shot produces nothing**, and the wind-up still ends. That is today's behaviour and the spec covers it.

## Acceptance Criteria

1. A behaviour module cannot name run state or a field outside the narrow self, held by the compiler and the boundary checker.
2. Every effect a family can return is applied in one branch in the chassis.
3. Both shooter types telegraph, fire and recover exactly as before.
4. The named spec covers a release with and without a shot row.
