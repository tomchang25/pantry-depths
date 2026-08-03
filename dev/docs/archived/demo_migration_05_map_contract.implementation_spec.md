# Demo Migration 05 — The Map Contract

Parent Plan: `demo_migration.plan.md`

## Goal

Turn the floor vocabulary right side up: core owns what a tile, room, cast, crowd, and resolved map _are_, and the content layer parses and validates authored files into core-typed values. This is the second contract inversion, done while floor assembly still sits in the demo tree so the rules move stays a move.

## Summary

Three new core modules take the vocabulary; every parser, resolver, and library stays in content and now produces core-typed values.

- **`src/core/prop-kinds.ts`** — the prop kind union, moved from the display schema. One step past the plan's named list, and forced by it: the scatter declaration says which prop kinds a floor holds, so the room vocabulary cannot move to core while the kind union it references stays in content. It is the same class of vocabulary as the rest — what kinds of loose object exist — and content's display and behaviour tables now key off core, which is the standard's intended direction.
- **`src/core/room-contract.ts`** — tile kinds and the unfillable-ground list, room roles, cast kinds and members, quantities and ranges, scatter, reinforcement, crowd, wall mix, structure, and the room record itself.
- **`src/core/map-contract.ts`** — the slot vocabulary, the resolved-map contract (what assembly is handed), and the drawn-floor contract with its three refusals (stranded ground, the walk check, the route check) — these validate what assembly _built_, which is a rules question, not a file question.
- **Content keeps every verb**: both file parsers with their patterns and limits, the author-cell validation, the resolver that turns names into rooms, and the two libraries. Their type imports flip to core; their behaviour is untouched.
- The moved declarations' comments said "declared here because content may not reach the runtime" — true when written, and this child is the correction: the vocabulary now lives where the standard always meant it to, and the comments are updated to say so. A stale reference to the deleted turn-based table goes with them.

No behaviour change anywhere: every move is a type or a pure function changing home, verified by the gate plus a capture run (or a playtest) on the shipped map and one authored map.

## Relational Context

- Import legality after the move: core modules import only core (prop-kinds ← nothing, room-contract ← prop-kinds, map-contract ← room-contract); content imports core (already allowed); demo imports both (baseline rule); `dev/tools/` imports content parsers only and is untouched.
- The resolver's contract — names are answered by the file parser, rooms by the resolver, assembly refusals by the drawn-floor checks — is unchanged; only the homes of the types it returns move.
- The authoring endpoint writes parser return values verbatim into files; parsers therefore stay content and keep answering names, exactly as their headers demand.
- The cast-kind union is the source the content archetype table keys off (its id alias); after this child both alias and source resolve through core, and the "equal by construction" mechanism is unchanged.
- The workbenches (map, room, carried, prop, floor-preview) import vocabulary and parsers; their vocabulary imports flip to core, their parser imports stay content. App may import both.

## Scope

### Included

- The three core modules; type-import rewires in six content modules, three demo modules, five app modules; comment corrections on the moved declarations.

### Excluded

- Any change to parsing, validation, resolution, assembly, or any authored file; any rename; the archetype-table question (rules child); any new test.

## Files to Change

| File                                              | Change Size | Purpose                                           |
| ------------------------------------------------- | ----------- | ------------------------------------------------- |
| `src/core/prop-kinds.ts`                          | New (small) | The prop kind union                               |
| `src/core/room-contract.ts`                       | New (large) | Room vocabulary and record types                  |
| `src/core/map-contract.ts`                        | New (large) | Slots, resolved map, drawn floor and its refusals |
| `src/content/maps/room-schema.ts`                 | Shrink      | Keeps parsing and author-cell validation          |
| `src/content/maps/map-schema.ts`                  | Shrink      | Keeps the file shape and parser                   |
| `src/content/maps/map-resolver.ts`                | Small       | Returns core types; keeps the resolver            |
| `src/content/presentation/prop-display-schema.ts` | Small       | Kind union moves out; display table keys off core |
| ~11 importers across content, demo, app           | Small each  | Type-import path rewires only                     |

## Execution Outline

1. Core modules first, verbatim moves with corrected comments: prop-kinds, then room-contract, then map-contract.
2. Rewire the four content modules; typecheck.
3. Rewire demo (maze, world, maps) and app (five modules); typecheck to zero.
4. `npm run verify`; capture run on the shipped map plus an authored map, or hand to playtest.

## Implementation Notes

- The room-contract's cast comment referenced "the turn-based game's enemy table", which no longer exists; the correction names the content archetype table.
- `UNFILLABLE_GROUND` is read by both a content-side author-cell check and the core-side stranded-ground check; it moves to core with the tile kinds and content imports it — one list, two readers, unchanged.
- `MIN_ROOM_EXTENT`, both name patterns, and the map area cap are parse-side numbers and stay in content.

## Acceptance Criteria

1. Core owns the tile, role, cast, crowd, scatter, structure, room, slot, resolved-map, and drawn-floor contracts, and imports nothing outside core.
2. Content parses and validates authored files exactly as before, producing values typed by core contracts; the authoring endpoint round-trip is unchanged.
3. The aggregate gate passes with zero boundary violations, and the shipped map plus one authored map assemble and play identically.
