# Development-Only Debug Hub

Parent Plan: `pantry_rules.plan.md`

## Goal

Establish a development-only debug hub before gameplay rules land, so later rules work gains one discoverable observation surface instead of accumulating ad hoc test routes and throwaway viewers. The hub must be absent from production and must not invent a second gameplay model.

## Summary

The application bootstrap will distinguish development `/debug` routes from ordinary play. Development debug routes load a small debug subtree containing a catalog, a dispatcher, and an empty hub index. Production and all ordinary routes retain the current ordinary-play placeholder and load no debug code.

The catalog is the only registration point for future tools. It will initially be empty and the hub will explain that no tools are registered; the combat explorer in the next rules child becomes the first entry. This slice creates no scenario, debug API, gameplay data, command, renderer, or placeholder 2.5D view.

## Relational Context

- The application bootstrap is the only route and composition owner. It currently renders the ordinary-play placeholder; it must remain the fallback for every non-debug path and for every production path.
- The debug subtree is development-only and must be reached through a build-time development guard plus a deferred import. Wrong shape to avoid: a static top-level import that packages the hub, catalog, or future viewer modules into production.
- The debug router consumes the catalog and either loads one exact registered tool or renders the hub. The hub consumes that same catalog, so future tools add one registration instead of a router branch and a separate navigation list.
- The catalog records descriptive metadata and a deferred tool loader, but A01 contains no registered tool. Tool modules later render from real snapshots and issue canonical commands; the catalog and hub never own state, formulas, scenarios, or mutation shortcuts.
- The project permits only application composition to import the harness. This child creates no harness module or import; later viewers may use that existing seam rather than letting rules, content, presentation, or UI import harness directly.
- The project has no router or UI framework. Native DOM creation and ordinary anchors are sufficient for this zero-tool index; do not introduce a routing dependency or framework abstraction.
- The structure addendum is the discoverable owner of the project-specific debug-route and harness-wiring rule. Its boundary prose must describe the new development-only subtree in the same change as the source implementation.

## Scope

### Included

- A development-only `/debug` dispatch path and production ordinary-play fallback.
- A single empty debug-tool catalog, exact-path dispatcher, and accessible hub index.
- An explicit developer-facing failure state when the deferred debug subtree cannot load.
- The project-structure addendum update that documents the debug subtree and its ownership boundary.

### Excluded

- Any registered viewer, scenario, debug API, gameplay state, command, content definition, or test fixture.
- Any 2D or 2.5D map, combat, route, or presentation implementation.
- Changes to the ordinary-play placeholder beyond using it as the non-debug fallback.
- React, a router package, production debug toggles, browser acceptance automation, or gameplay tests.

## Files to Change

| File                                          | Change Size | Purpose                                                                                            |
| --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `src/app/main.ts`                             | Medium      | Dispatch development debug routes through a deferred debug subtree while preserving ordinary play. |
| `src/app/debug/debug-tools.ts`                | Small       | Define the single future-tool catalog contract and its initially empty registry.                   |
| `src/app/debug/debug-router.ts`               | Small       | Select an exact catalog tool or the hub from the current path.                                     |
| `src/app/debug/debug-hub.ts`                  | Small       | Render the semantic zero-tool development hub.                                                     |
| `dev/standards/project_structure.addendum.md` | Small       | Document the development-only debug subtree and application-only harness seam.                     |

## Execution Outline

1. Add the empty catalog contract and hub renderer first, so dispatch has one authority even before the first viewer exists.
2. Add the debug router that resolves an exact catalog path and falls back to the hub for `/debug` and unknown development debug paths.
3. Update the bootstrap to defer loading the debug router only for development `/debug` paths, show a developer-facing load failure when that import fails, and keep ordinary play for all other cases.
4. Update the structure addendum to record the debug subtree, production exclusion, and harness wiring boundary.
5. Verify formatting, type safety, linting, import boundaries, production build exclusion, governance checks, and manual development navigation to `/debug` and an unknown debug path.

## Implementation Notes

- Treat `/debug` and `/debug/…` as development debug paths; use the current browser pathname rather than adding URL-state infrastructure.
- Defer the whole debug subtree behind the build-time development condition. A production request to `/debug` must render ordinary play without attempting a debug import.
- Make catalog entries sufficient for both hub display and dispatch: stable id, exact path, title, description, and deferred renderer loader. Keep the registry read-only.
- Render the hub with a `main` landmark, heading, explanatory empty state, and an unordered list only when entries exist. Registered tools use native anchor navigation.
- The import-failure surface is developer-facing only and must explain that the debug subtree failed to load; it does not expose a production fallback path because production never enters this branch.
- Do not create CSS, tests, harness code, or reusable debug abstractions in this slice. Browser-default styling is intentional until a tool needs more structure.

## Edge Cases

| Case                                             | Expected Handling                                               |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Development `/debug` with an empty catalog       | Render the hub and its explicit no-tools state.                 |
| Development unknown `/debug/<path>`              | Render the hub rather than a blank page or ordinary play.       |
| Production `/debug` or `/debug/<path>`           | Render ordinary play and do not load debug modules.             |
| Deferred debug module cannot load in development | Replace the mount with a concise developer-facing load failure. |

## Acceptance Criteria

1. Development `/debug` renders an accessible debug hub, and unknown development debug paths render that same hub.
2. The hub lists tools from one catalog only and clearly represents its empty state before the first viewer lands.
3. Ordinary play renders on all non-debug paths, and production renders ordinary play for all paths without loading the debug subtree.
4. Adding a future debug tool requires one catalog registration and no new top-level route branch.
5. The hub, catalog, and router own no gameplay data, gameplay mutation, scenario, formula, or renderer.
6. The structure documentation records the app-owned development debug surface and harness boundary, and all required project checks pass.
