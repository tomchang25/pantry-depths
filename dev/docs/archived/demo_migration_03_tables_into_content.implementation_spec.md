# Demo Migration 03 — Tables Into Content

Parent Plan: `demo_migration.plan.md`

## Goal

Move the demo's authored numbers — enemy statistics, prop weights and behaviours, the blessing and modifier catalogues, the core catalogue, and the sealed-reward rates — into content feature directories, so the data half of the rules lives where authored data lives before the rules themselves move into core.

## Summary

A home change for data, with zero behaviour change. Every exported symbol keeps its name — including the `Demo` prefixes, which read oddly in content but whose rename would mix a move with a rename across thirty import sites; child 8 owns the unified rename pass, so each symbol is renamed exactly once, in its final home. The cut per module:

| Source (demo)      | Moves to content                                                                                                                | Stays in demo                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `enemy-archetypes` | All types, the seven rows and their table, the tuning constants, the pure accessors (`isBoned`, `canCarry`, the attack getters) | `rollIdleSeconds` — the one random function; the module slims down to it   |
| `throw-weight`     | The whole module: weights, behaviours, types, pure lookups                                                                      | Nothing; the demo module is deleted                                        |
| `bless`            | Both catalogues, their id/definition types, `findBless`                                                                         | `BlessState` and everything reading or mutating it, including `grantBless` |
| `modifiers`        | The modifier catalogue and lookups, the core catalogue and lookups, the roll-axis list, the curse type                          | The two roll functions (random)                                            |
| `sealed`           | The two rate tables (core share, fragment effects)                                                                              | The bank, resolution, and equipped-core reads — all state or random        |

New content homes, following the existing `*-definitions` naming: the archetype module joins the existing enemies feature; props get a new feature directory; the blessing, modifier/core, and sealed-rate modules form a new progression feature.

One declared deviation from the plan's Execution notes: they suggested the pure predicates stay demo-side until the rules move. They move now instead, beside the type they read, because they are total lookups over the record — the same class as the prop lookups the notes do move — and splitting them from their type would force every importer to import the same concept from two layers for three children's time.

Verification is the gate plus the plan's first real playtest: a run that touches blessings, throws, and sealed cores. Closeout waits on that playtest.

## Relational Context

- Content may import only content and core. The moved archetype module imports the throw-weight type, the cast vocabulary, and the appearance union — all content after this child — so the props module must land with or before the archetype module.
- The demo may import content (machine-checked baseline); every rewrite here is demo → content or app → content, both legal. No content module may import back into the demo — the split of `bless`, `modifiers`, and `sealed` exists exactly so the state-and-randomness halves stay demo-side.
- The stacking-blessing step lives on the modifier catalogue and is read by the blessing state functions; that read crosses from demo into content after the move, which is the intended direction.
- The demo-side `modifiers` remnant keeps the roll functions and imports the catalogue it rolls from; the demo-side `sealed` keeps importing those rolls. Call directions are unchanged, only homes.
- The entity workbench imports the archetype table; its import follows to content. No workbench behaviour changes.
- The guard test bans test imports of the demo half; nothing here touches tests, and the moved tables gain no tests in this child (none was named in this spec).

## Scope

### Included

- Five new content modules; deletion of the demo throw-weight module; slimming of the demo archetype, bless, modifiers, and sealed modules; import-path rewrites in every consumer.

### Excluded

- Any rename of an exported symbol, any behaviour change, any new test.
- The behaviour halves: AI, actions, world state, award sites — they move in later children.

## Files to Change

| File                                                               | Change Size | Purpose                                                      |
| ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| `src/content/enemies/enemy-archetypes.ts`                          | New (large) | Types, rows, table, tuning constants, pure accessors         |
| `src/content/props/prop-definitions.ts`                            | New (large) | The whole throw-weight module                                |
| `src/content/progression/bless-definitions.ts`                     | New         | Both blessing catalogues and `findBless`                     |
| `src/content/progression/modifier-definitions.ts`                  | New         | Modifier and core catalogues, lookups, roll axes, curse type |
| `src/content/progression/sealed-reward-definitions.ts`             | New (small) | Core-share and fragment-effect rates                         |
| `src/demo/enemy-archetypes.ts`                                     | Shrink      | Keeps only `rollIdleSeconds`                                 |
| `src/demo/throw-weight.ts`                                         | Delete      | Fully moved                                                  |
| `src/demo/bless.ts`, `src/demo/modifiers.ts`, `src/demo/sealed.ts` | Shrink      | Keep state and randomness; import catalogues from content    |
| ~12 demo/app importers                                             | Small each  | Import-path rewrites only                                    |

## Execution Outline

1. Land the props module first (the archetype module's type source), then the archetype, progression, bless, and sealed-rate modules — each a verbatim move of the data half with its comments.
2. Slim the four demo modules to their state/random halves, importing catalogues from content.
3. Rewrite importers, steered by typecheck until clean.
4. `npm run verify`; then hand to the user for the playtest (blessings, throws, sealed cores) before closeout.

## Implementation Notes

- Move comments with their subjects — the tables' comments are the authored rationale and belong beside the numbers.
- `DemoArchetypeId` stays an alias of the cast vocabulary; after the move both alias and source live in content, which is strictly simpler than today.
- The slimmed demo `enemy-archetypes` keeps its module name so `rollIdleSeconds` importers do not churn; its header says what it now is and why it waits for the rules child.

## Acceptance Criteria

1. Every authored number the five modules held is read from a content module; no demo module holds a catalogue, weight table, or rate table.
2. No content module imports the demo; the boundary check stays at zero violations.
3. The aggregate gate passes with no behaviour change, and a playtest touching blessings, throws, and sealed cores plays identically to the previous commit.
