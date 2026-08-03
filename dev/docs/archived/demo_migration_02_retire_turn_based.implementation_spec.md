# Demo Migration 02 — Retire The Turn-Based Model

Parent Plan: `demo_migration.plan.md`

## Goal

Remove the turn-based combat model the demo replaced, so the repository holds one combat truth before the demo's rules move into core. Only the vocabulary the live render path genuinely uses survives.

## Summary

Deletion with one small move; no live behaviour changes, so no playtest.

- **The combat projection dies whole.** The core combat module — attack-minus-defense, hits-to-kill projection — has no live consumer; its only importer is its own test, which dies with it.
- **The grid module trims to its two live types.** The facing and cell types are load-bearing in the render contract (wall faces, floor patches). Everything else — the move-direction vocabulary, all four turn tables, every movement and adjacency function — has zero consumers outside the module itself (verified 2026-08-03) and is deleted.
- **The turn-based content tables die, and the appearance vocabulary moves out.** The old enemy table and player-stage table have no live importer. The one survivor, the enemy appearance identifier union, is imported type-only by ten modules across demo, presentation, content, and the entity workbench; it moves to a small module in the enemies content feature, beside the display schema that already keys off it, and the ten import paths follow. The combat content directory is then empty and removed.
- **Two tests follow their subjects.** The combat test is deleted with the model it covered. The skeleton definitions test loses only its third case — the claim that the retained turn-based "skeleton" row wears the authored swordsman's appearance is a statement about the deleted table; its other two cases cover live skeleton content and stay.

## Relational Context

- Every one of the ten appearance-identifier imports is `import type` — the move is a path rewrite with zero runtime effect, which is what makes this child safe without a playtest.
- The demo has its own archetype table under the same exported name; the similarity is coincidental and no demo module imports the dying content table. Do not touch the demo's table.
- The grid types stay in core: the render contract in presentation imports them, and presentation may import core. Moving them out of core would be a second decision this child does not own.
- Content may import only content and core; the appearance module's new home inside the enemies content feature keeps every existing importer legal under the boundary rules.
- The boundary checker's core rule comment still describes core as owning "the attack-minus-defense formula"; it is updated in the same change per the prose-and-rule pairing, without changing any rule pattern.

## Scope

### Included

- Delete the core combat module and its test; trim the grid module to the facing and cell types.
- Delete both turn-based content tables and their directory; move the appearance identifier union to the enemies content feature; rewrite ten import paths.
- Cut the skeleton definitions test's dead third case.

### Excluded

- Any change to the demo's own archetype table or any demo module beyond an import path.
- Moving the grid types out of core, renaming them, or reshaping the render contract.
- Any new test.

## Files to Change

| File                                                     | Change Size | Purpose                                            |
| -------------------------------------------------------- | ----------- | -------------------------------------------------- |
| `src/core/combat.ts`                                     | Delete      | Dead turn-based combat projection                  |
| `src/core/grid.ts`                                       | Medium      | Trim to `Facing` and `Cell`                        |
| `src/content/combat/enemies.ts`                          | Delete      | Dead enemy table; appearance union moves out       |
| `src/content/combat/player-stages.ts`                    | Delete      | Dead player-stage table                            |
| `src/content/enemies/enemy-appearances.ts`               | New (small) | New home of `EnemyAppearanceId`                    |
| Ten importers of the appearance union                    | Small each  | Import path rewrite only                           |
| `test/unit/core/combat.test.ts`                          | Delete      | Covered the deleted model                          |
| `test/unit/content/enemies/skeleton-definitions.test.ts` | Small       | Drop the dead third case                           |
| `.dependency-cruiser.cjs`                                | Small       | Core rule comment no longer names the dead formula |

## Execution Outline

1. Create the appearance module and rewrite the ten import paths; typecheck proves the move.
2. Delete the two content tables and their directory, the core combat module, and the combat test.
3. Trim the grid module; update the cruiser comment.
4. Trim the skeleton definitions test.
5. `npm run verify`; `npm run check:governance` after the closeout document edits.

## Acceptance Criteria

1. No module anywhere references the turn-based combat model, its tables, or its movement vocabulary.
2. The appearance identifier union has one home inside the enemies content feature, and every former importer resolves against it.
3. The aggregate gate passes; the unit stage runs without the two removed subjects and the remaining skeleton cases pass unchanged.
4. No runtime behaviour changes; the production build succeeds.
