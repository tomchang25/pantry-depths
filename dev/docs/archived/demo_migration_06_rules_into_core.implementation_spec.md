# Demo Migration 06 — Rules Into Core

Parent Plan: `demo_migration.plan.md`

## Goal

Move the rules half into `src/core/` — the floor assembly, the world, the tick, the minds, the actions, the impacts, extraction, tasks, rooms, movement, and the run clock — behind the machine rule that core imports only core. This is the child the previous two inversions existed to make possible, and the child that answers how core reads authored tables: they are injected, never imported.

## Summary

Fifteen demo modules become core modules. Three kinds of work make that legal, all behaviour-preserving:

- **The remaining vocabulary moves up.** Three more literal unions join the core contracts, by the same reasoning as the prop kinds: the sound cue ids (rules report cues typed by them — the deferral from the sound seam child lands here), the melee attack ids with the swing timings (the tick resolves cuts against them; the never-repeat choice becomes a core function over the id list, since its one caller only ever used the chosen id), and the enemy appearance ids (a field of the archetype record). The content schemas key off core, exactly as the prop display table already does.
- **Schemas move up; rows stay down; values are injected.** The archetype, prop, and progression _types_ — with the pure accessors and the rule constants (sight and disengage ranges, the charge geometry, the cut arc) — move into core contract modules. The authored _rows_ stay in content, now typed by core. A new core catalog contract names everything the rules read as data: the archetype table, the prop weight and behaviour tables, the default body weight, both blessing catalogues, the modifier catalogue, the core catalogue, and the sealed rates. Content assembles the one catalog value; the surface passes it when a world is created; the world carries it; every core read goes through it. This is the shape the platform standard prescribes and the shape the sibling project (tickstrike-web) ships with.
- **The modules move.** All eleven rules modules plus the four state-and-randomness remnants (blessing state, the core rolls, the sealed bank, the idle roll) relocate under `src/core/` with their names. Two seams are cut on the way: the run-end overlay builders leave extraction for the surface (they build HUD models, which is display work; extraction exposes what was last opened), and **the particle field moves with the rules — a declared deviation from the plan's non-goal**, which listed particles in the projection half. The evidence is against that listing: the tick itself steps the field and consumes its landings, twenty-five rule sites raise bursts, and the module is 193 lines of pure math with zero imports. What stays behind is the _drawing_ of particles, which is the scene's and does not move.

Two unit test files are named here and written in this child, per the standing gate: one on the drawn-floor refusals (the route and stranded-ground checks now living in core), one on the run-level derivation. Nothing else gains a test.

Verification: the gate, a capture run read frame by frame, and the plan's heaviest playtest — full floor loop, every enemy kind, throws, water, the stage, extraction.

## Relational Context

- After the move, `core-imports-only-core` stops being aspiration and starts binding fifteen more modules; the boundary check proves the whole child. The demo tree keeps its baseline rule (it still holds the projection half and the surface) and nothing new may import it.
- The catalog is injected at world creation and carried on the world, mirroring the resolved map. Core lookup helpers (prop behaviour and weight, the blessing step, the modifier and core finders used by rolls) take the catalog as their first argument; runtime- and app-side callers pass the content-assembled value directly.
- The sealed bank stays module state in core (it must outlive worlds); its resolution functions gain a catalog parameter from callers that all have one.
- The stage dressing and the surface stay in the demo tree until the runtime child; both may import core and content freely, so they read the moved modules and the content catalog without ceremony.
- The workbenches import moved modules by path only; every one of their imports is app → core, which is legal. The authoring tools import content parsers only and do not change.
- The sound-cue id union moving to core closes the deferral recorded in the sound seam child: events, the world queue, and the player now share one core-owned vocabulary, and the content cue table validates against it.

## Scope

### Included

- Three vocabulary moves, four contract modules, the catalog contract and its content assembly, fifteen module moves, the extraction overlay split, catalog threading at every core table read, import rewires across demo remnants and app, the two named test files, boundary-rule truth.

### Excluded

- Any behaviour, balance, or feel change; any rename (child 8); the surface, stage, HUD, and projection modules (child 7 and the interim tree); any test beyond the two named.

## Files to Change

| Surface                                                                   | Change Size | Purpose                                                           |
| ------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `src/core/sfx-cues.ts`, `src/core/melee-contract.ts`                      | New (small) | Cue and melee-attack vocabulary; timings; the never-repeat choice |
| `src/core/enemy-contract.ts`                                              | New         | Appearance union, archetype types, accessors, rule constants      |
| `src/core/prop-contract.ts`                                               | New         | Prop record types; catalog-taking lookups                         |
| `src/core/progression-contract.ts`                                        | New         | Modifier, core, and blessing definition types; roll axes          |
| `src/core/catalog.ts`                                                     | New (small) | What the rules read as data, as one injected record               |
| `src/content/catalog.ts`                                                  | New (small) | Assembles the one catalog value from the content tables           |
| Fifteen `src/demo/` modules → `src/core/`                                 | Move        | The rules half, paths and threading updated                       |
| `src/content/` tables (enemies, props, progression, schemas)              | Medium      | Keep rows; type against core; schemas key off core unions         |
| `src/demo/demo-surface.ts`                                                | Medium      | Passes the catalog; receives the run-end overlay builders         |
| App debug modules (~8)                                                    | Small each  | Import paths follow the moves                                     |
| `test/unit/core/map-contract.test.ts`, `test/unit/core/run-level.test.ts` | New         | The two named tests                                               |
| `.dependency-cruiser.cjs`                                                 | Small       | Comments reflect the tree; no rule pattern widens                 |

## Execution Outline

1. Vocabulary and contract modules first (sfx cues, melee, enemy, prop, progression, catalog), with content schemas and tables rewired to core types — the gate proves content still parses.
2. The extraction overlay split, so extraction is core-clean before it moves.
3. Move the fifteen modules; rewrite import paths mechanically; thread the catalog through world creation and the lookup helpers, typecheck-driven to zero.
4. The two named tests; `npm run verify`; a capture run read frame by frame; hand to the user for the heavy playtest before closeout.

## Implementation Notes

- The idle roll folds into the core world module rather than keeping a one-function file; its two consumers already import that module.
- The module-level crowd draw lists in the world module reference archetype rows directly today; they become reads through the injected catalog at world creation, not module state.
- The melee choice's caller uses only the chosen id, so the core function returns the id and the content definition table stays where the drawing is.
- `exactOptionalPropertyTypes` holds everywhere; conditional spreads, never explicit `undefined` fields.

## Edge Cases

| Case                                          | Expected Handling                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A workbench steps a world without the surface | It passed the catalog at creation, so every read works; queued cues stay silent as they do today |
| The stage restages a cast by kind             | Reads the world's own catalog; identical bodies stand up                                         |
| A cue id typo in the content table            | The schema validates against the core list and refuses the file                                  |

## Acceptance Criteria

1. Every rules module lives in core, and the boundary check passes with core importing nothing outside core — no exemption, no widened rule.
2. Every authored table the rules read arrives through the injected catalog; no core module names a content path.
3. The two named tests pass; no other test is added; the guard and budget tests are untouched.
4. The game plays identically: full floor loop, every enemy kind, throws, water, stage, extraction — confirmed by capture reading and the user's playtest.
