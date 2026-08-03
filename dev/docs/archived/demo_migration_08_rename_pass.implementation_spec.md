# Demo Migration 08 — The Rename Pass

Parent Plan: `demo_migration.plan.md`

## Goal

Strip the `Demo` prefix from every symbol that survived the moves, in one mechanical, typecheck-verified change, so the formal layers stop carrying the name of the tree they came from.

## Summary

Seventy-eight prefixed symbols are defined in the formal layers today. Three kinds of treatment:

- **Six aliases dissolve into their sources.** `DemoPropKind`, `DemoArchetypeId`, `DemoTileKind`, and `DemoRoomRole` are bare re-namings of `PropKind`, `MapCastKind`, `MapTileKind`, and `MapRoomRole`; `DemoCell` and `DemoCellLike` are two identical restatements of the grid module's `Cell`. Each alias's definition is deleted and every reader imports the source — one union, one name, and the grid module's cell becomes the one cell everything speaks.
- **Three renames step around collisions or vacuity** rather than dropping the prefix blindly: `DemoSfxCue` → `SfxEvent` (a bare `SfxCue` already names the content cue definition, and the thing is an event), `DemoInput` → `PlayerInput`, `DemoStatus` → `RunStatus` (bare `Input` and `Status` say nothing).
- **Everything else drops the prefix mechanically** — `DemoWorld` → `World`, `DemoEnemy` → `Enemy`, `DemoMaze` → `Maze`, the HUD model family to `Hud*`, and the rest — including the five prefixed functions (`createDemoWorld` → `createWorld`, `stepDemoWorld` → `stepWorld`, `buildDemoFloor` → `buildFloor`, `mountDemoHud` → `mountHud`, `mountDemoDevOverlay` → `mountDevOverlay`) and the surface's entry pair (`mountDemo` → `mountGame`, `MountedDemo` → `MountedGame`).
- **Formal-layer filenames shed the prefix too**: the runtime surface, its overlay, and the ui HUD modules and stylesheets. Symbols and files _defined in the interim demo tree_ keep their names — that tree is scheduled to die with the renderer decision, and renaming dying code is churn; its imports of renamed core symbols follow like everyone else's.
- CSS class names are strings, not symbols, and are untouched.

Verification is the gate alone — a rename that changes no behaviour needs no playtest, which is why it is its own child.

## Scope

### Included

- The symbol sweep across `src/`, `test/`, and `dev/tools/`; the six dissolutions with import repoints; the five formal-layer file renames with path fixes.

### Excluded

- Any definition inside `src/demo/`; CSS class strings; the dev-only `window.demoWorld` handle (a string the capture harness reads); any behaviour change.

## Execution Outline

1. Word-boundary regex sweep for the mechanical renames, longest names first.
2. Dissolve the six aliases: delete definitions, repoint imports, typecheck to zero.
3. Rename the five files; fix their import paths; typecheck to zero.
4. `npm run verify`; `npm run check:governance` after closeout edits.

## Acceptance Criteria

1. No symbol defined in core, content, runtime, or ui carries the `Demo` prefix, and no formal-layer filename does.
2. Each dissolved vocabulary has exactly one name and one home; the grid cell is the one cell type.
3. The aggregate gate passes with zero boundary violations and the production build succeeds; no behaviour changes.
