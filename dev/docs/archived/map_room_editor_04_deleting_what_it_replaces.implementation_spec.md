# Deleting What It Replaces

Parent Plan: `map_room_editor.plan.md`

## Goal

Delete the floor-set tool chain the map and room editor replaces, along with the content, rules, commands and tests that only it still reaches. This is the plan's last child and the one it required a person to authorize separately, which has now been given.

## Summary

**Why it is worth doing.** The old tooling answers to a schema — floors as authored tile grids with keys, doors and per-cell entities — that no longer describes anything the game plays. Every floor a run arrives in is assembled from a map naming rooms; the provisional floor set is reachable only from the tool that edits it. Six thousand lines that compile, pass tests and mislead every reader about how floors work is a cost paid on every search through this repository.

**What goes.** The four floor tools in the debug hub's oldest corner, the floor content schema and its validation, the provisional floor-set content, the run-state module that only that schema still reads, two command-line tools and their npm scripts, the floor-set generator behind the authoring endpoint's one generate operation, and every test whose subject is any of those.

**What is touched but stays.**

| File                                                         | Why it survives                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `src/content/presentation/presentation-asset-definitions.ts` | Live presentation content; its three-literal key-colour type moves in-house  |
| `dev/tools/authoring/{api-contract,authoring-api}.ts`        | The endpoint stays; only its floor-set target and generate operation go      |
| `test/unit/dev/tools/authoring/authoring-api.test.ts`        | The endpoint's suite; its floor-set fixtures and cases go with the target    |
| `src/app/debug/debug-tools.ts`                               | The catalogue; one entry shorter                                             |
| `test/e2e/debug-route.spec.ts`                               | The one browser spec; it opens the Map Workbench instead of the deleted tool |
| `package.json`                                               | Loses `generate:floor-set` and `validate:floor-set`, both project-additional |
| `src/content/combat/enemies.ts`                              | Deliberately untouched: six live modules still reach it                      |

## Relational Context

- **`src/core/run-state.ts` cannot simply go.** A live presentation file imports its `KeyColor` type. The type is three string literals; it moves to the one file that still wants it, and dies with the rest of the module. Nothing else under `src/` or `dev/` imports from run-state except files being deleted.
- **The endpoint's generate operation exists only for the floor-set target**, so the operation goes with the target rather than surviving as a verb with nothing to generate. The whitelist keeps its shape; it is one entry shorter.
- **`npm run verify` does not run the browser suite**, so the e2e spec naming the deleted tool would fail silently later rather than loudly now. It is updated in the same change, and run once to prove it.
- **The deleted npm scripts are project-additional.** The command surface standard requires `dev`, `build`, `verify`, `format`, `test`; neither floor-set script is among them or feeds `verify`.
- **Nothing deleted is reachable from the game.** The demo assembles floors from maps; the floor-set schema's only consumers are the tools being deleted and their tests. The one shared name — `KeyColor` — is handled above.

## Scope

### Included

- Deleting the nine source files, the provisional floor-set JSON, the two command-line tools, the floor-set generator, and every test and fixture whose subject they are.
- The seven surviving files listed above, each touched only as described.
- Removing the stale `FLOOR_TOOL_CONFIG_PATH` name in `vite.config.ts` — the constant survives (it is the authoring runner's config) but stops claiming to belong to a floor tool.

### Excluded

- `src/content/combat/enemies.ts`, still live.
- Any change to the map and room editor itself.
- Dead CSS classes in `debug.css` that only the deleted tools used — removed only where obviously theirs; anything shared stays.

## Files to Change

| File                                                         | Change Size | Purpose                                                         |
| ------------------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| Nine floor files + JSON + two CLI tools + generator + tests  | Deleted     | The subject of this child                                       |
| `src/content/presentation/presentation-asset-definitions.ts` | Small       | Owns its own key-colour literals                                |
| `dev/tools/authoring/api-contract.ts`                        | Small       | Whitelist loses the floor-set target                            |
| `dev/tools/authoring/authoring-api.ts`                       | Medium      | Loses the floor-set branch and generate operation               |
| `test/unit/dev/tools/authoring/authoring-api.test.ts`        | Small       | Loses the floor-set fixtures and cases                          |
| `src/app/debug/debug-tools.ts`                               | Small       | One catalogue entry fewer                                       |
| `test/e2e/debug-route.spec.ts`                               | Small       | Opens the Map Workbench                                         |
| `package.json`                                               | Small       | Two scripts fewer                                               |
| `vite.config.ts`                                             | Small       | The authoring runner's config stops wearing a floor tool's name |

## Execution Outline

1. Move the key-colour type into the presentation file that uses it.
2. Delete everything listed, sources before tests only in the sense that one commit holds both.
3. Trim the endpoint: whitelist entry, validation branch, generate operation, generator import; update its test's fixtures alongside.
4. Trim the catalogue and the two npm scripts; rename the stale config constant.
5. Point the browser spec at the Map Workbench.
6. Sweep for survivors: any remaining reference to the deleted names is a missed edge.
7. `npm run verify`, then `npm run test:e2e`, then open the debug hub and look at it.

## Edge Cases

| Case                                                      | Expected Handling                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| A dead CSS class shared with a surviving tool             | Stays; only classes provably reachable from deleted files alone are removed |
| The e2e suite run against a user-owned dev server on 5273 | Reuses it per the test contract; never restarted or reconfigured            |

## Acceptance Criteria

1. The floor-set tools, schema, content, commands and generator are gone, and no file in the repository still names them.
2. The debug hub lists no Floor Set Workbench, and the browser spec passes by opening the Map Workbench.
3. The authoring endpoint still reads, lists and saves maps, rooms and every single-file target, and refuses everything else exactly as before.
4. The verification gate passes, and no test file is added.
