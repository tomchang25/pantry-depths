# Scene Routes

Parent Plan: none (standalone spec)

## Goal

Give each development scene an address of its own — `/soundstage` for the filming stage, `/testbed/<map>` for plain map testbeds — and retire the `?map=` query parameter on the ordinary play route. A scene becomes one catalog entry owning its address, its floor, its dressing, its keys, and its default screen, instead of five facts scattered across five files and keyed off a map-name string comparison.

## Summary

**Why.** The filming stage is currently a map name (`"stage"`) that `src/runtime/stage.ts` compares against inside the shipped play surface: the dressing, the Q/E/C keys, the hidden-instruments default, and the `nextCast` panel row are all gated on that comparison, and the stage is reached by typing `?map=stage` into the ordinary play address. Three costs follow: development floors ride on the shipped game's address (currently patched by ignoring the parameter outside development), a scene has nothing to own but a map name, and stage-only code ships in the production bundle because `surface.ts` imports it statically. A second scene would double the comparison.

**What changes.**

- `resolveAppRoute` learns a third class: `ordinary | debug | scene`. Scene resolution exists only in development; the production branch keeps returning `ordinary` for every pathname, exactly as it does for `/debug` today.
- A new development-only composition subtree `src/app/scene/` holds a scene catalog and the scenes themselves, crossed into from `main.ts` through a `import.meta.env.DEV`-guarded deferred import — the same production-exclusion mechanism the debug subtree uses.
- `src/runtime/` defines a `SceneHooks` contract (dressing, key handling, panel chips, panel commands, instruments default). `mountGame` accepts an options object carrying a map name and optional hooks. The runtime keeps no stage vocabulary: `stage.ts` moves wholesale into the soundstage scene module and is deleted from `src/runtime/`.
- `/soundstage` opens the stage map with the moved dressing — fixed arrival, unreachable descent, frozen minds, hidden instruments, Q/E/C keys, `Cast` chip, `Restage cast` command — behaving exactly as `?map=stage` does today.
- `/testbed/<map>` opens the named map with no dressing, replacing `?map=` entirely; the query-parameter read is deleted from `main.ts`. Unknown names keep the existing forgiving fallback (default map plus a console warning).
- No `/sandbox` route is built. The sandbox source tree has no residents, and the map named `sandbox` in `src/content/maps/` is reachable at `/testbed/sandbox`, so the word keeps its single meaning (the track). When a sandbox experiment first wants a play scene, it registers a catalog entry under `/sandbox/<experiment>` — the namespace-matching machinery `/testbed/` needs anyway.
- Downstream addresses update: the map workbench playtest button, the `capture:page` usage text and scene-file comment, and one line in the boss encounter brief.
- `dev/standards/project_structure.addendum.md` declares the routing deviation (development namespaces beyond `/debug`) and the new subtree. No dependency-cruiser change is needed: existing rules already make `src/app/` the only importer of `src/app/`.

**Result.** In development, `/soundstage` and `/testbed/<map>` are the only ways to reach development floors; `/` plays the game and ignores every query parameter it used to read. In production every address plays the ordinary game, and grepping the built output for stage-only identifiers finds nothing. Registering a second scene is one catalog entry plus one hooks module.

## Requirements

1. A development scene is selected by pathname, in development builds only. The route resolver gains a `scene` class beside `ordinary` and `debug`; in production it returns `ordinary` for every pathname, preserving the existing production route policy unchanged.
2. One scene owns its five facts in one place: its address (a catalog entry under a namespace the resolver knows), the map it opens, how a freshly built world is dressed, which keys it adds, and whether the instrument layer starts hidden. Adding a scene must not touch the play surface's own branches.
3. `/soundstage` reproduces today's `?map=stage` behavior in full: arrival fixed to the main room's south edge, descent and plinth offstage, minds frozen, instruments hidden on open, Q/E stepping the next-reset cast, C restaging, the `Cast` chip and `Restage cast` command on the instrument panel, and R meaning "shoot that again". Cast choice remains session state surviving restarts.
4. `/testbed/<map>` opens the named map as a plain play surface with no dressing. An unknown or missing name plays the default map and warns on the console, matching the existing unknown-map behavior.
5. The `?map=` query parameter is removed outright; no route reads it in any build. The `?capture` flag is untouched.
6. Dressing is scene identity, not map identity: opening or stepping onto the stage map anywhere outside `/soundstage` yields a plain undressed floor. The map-name comparison (`isStage`) ceases to exist.
7. Stage-only code leaves the production module graph: the scene subtree is reachable only through a compile-time development guard and a deferred import, and the built output contains no stage dressing or scene catalog code.

## Relational Context

- `src/app/main.ts` is the only guard point. Its production branch mounts ordinary play without consulting scene or debug resolution; the scene crossing is `import.meta.env.DEV`-guarded and deferred, mirroring the existing debug crossing. A static import from any production-reachable module into `src/app/scene/` breaks requirement 7.
- The resolver stays a pure pathname classifier. It knows only the scene namespace list (`/soundstage`, `/testbed`, matched as exact segment or segment prefix, the same rule `/debug` uses); which scene a pathname is belongs to the catalog in `src/app/scene/`. This is the same address split the debug surface already has between `app-route.ts` and `debug-tools.ts`.
- `src/runtime/` defines the `SceneHooks` type; `src/app/scene/` implements it and hands it in as a value. This keeps the import direction legal (app → runtime; runtime never imports app). Scene hook implementations may import `src/core/` and `src/content/` directly (for `standCast`, `mainRoom`, `announce`, `ENEMY_ARCHETYPES`) — the app layer is unconstrained as an importer.
- `mountGame` builds a fresh world twice: at mount and in `restart`. The dress hook must run at both sites (today `dressStage` does), because restart-as-retake is the soundstage's core behavior. Map stepping (`,`/`.`) goes through `restart` and therefore re-dresses only under the scene's own hooks — which, with dressing now scene-owned, correctly yields a plain floor when stepping onto the stage map.
- Scene key handling runs in `handleKeyDown` before the surface's own bindings; a consumed key refreshes the instrument panel and stops. The global C binding and its off-stage refusal message are deleted with the `isStage` branches — off the soundstage, C does nothing.
- `DevOverlayModel.nextCast` and `DevOverlayActions.restageCast` are stage vocabulary in the runtime and are replaced by generic scene-provided chips (per-frame text rows) and commands (mount-time label-plus-action list). `hud-attack-workbench.ts` passes a `restageCast` noop today and must drop it with the actions shape.
- Cast-choice session state lives at module scope in the soundstage scene module, exactly as it lives in `stage.ts` today — it survives restarts because the module does.
- The capture harness's curated scenes use the bare play route and are unaffected; only `capture-page.mjs`'s usage string and `scenes.mjs`'s address comment mention map addresses and need the new forms (`/testbed/circle-water`, `/soundstage`).
- No dependency-cruiser rule changes: every non-app layer is already forbidden from importing `src/app/`, and `src/app/` is unconstrained as an importer. The structure addendum carries the prose declaration (routing deviation and new subtree) in the same change.

## Scope

### Included

- Third route class, scene catalog and router, `SceneHooks` contract, soundstage and testbed scenes.
- Moving `src/runtime/stage.ts` into the soundstage scene; deleting `?map=`; genericizing the instrument panel's scene rows.
- Address updates in the map workbench, capture tooling text, and the boss brief.
- Structure addendum declaration; TODO entry graduation; updated route unit tests.

### Excluded

- The floor-contract question (stairs, plinth, hardcoded objectives a scene cannot decline) — the sibling TODO draft owns it.
- A `/sandbox` route or any sandbox-track wiring; the tree has no residents.
- Debug hub changes (scenes are not tools and get no hub listing), `?capture`, map-name changes, and any change to how the ordinary game plays.

## Files to Change

| File                                          | Change Size | Purpose                                                                                  |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `src/app/app-route.ts`                        | Small       | Third route class; scene namespace matching, development only                            |
| `test/unit/app/app-route.test.ts`             | Small       | Updated cases: scene resolution in development, `ordinary` in production                 |
| `src/app/main.ts`                             | Small       | Scene branch behind the DEV guard; delete the `?map=` read                               |
| `src/app/scene/scene-router.ts`               | Medium      | Scene catalog, pathname→scene resolution, mounting play with scene options               |
| `src/app/scene/soundstage.ts`                 | Medium      | The moved stage dressing, keys, chips, and commands as `SceneHooks`                      |
| `src/runtime/stage.ts`                        | Deleted     | Content moves to the soundstage scene                                                    |
| `src/runtime/surface.ts`                      | Medium      | `mountGame` options, hook call sites, removal of every `isStage` branch and stage import |
| `src/runtime/dev-overlay.ts`                  | Small       | Generic scene chips and commands replace `nextCast`/`restageCast`                        |
| `src/app/debug/hud-attack-workbench.ts`       | Small       | Drop the `restageCast` noop with the actions shape                                       |
| `src/app/debug/map-workbench.ts`              | Small       | Playtest button opens `/testbed/<name>`                                                  |
| `dev/tools/capture-page.mjs`                  | Small       | Usage string uses `/testbed/<map>`                                                       |
| `dev/tools/capture/scenes.mjs`                | Small       | Address comment uses the new forms                                                       |
| `dev/standards/project_structure.addendum.md` | Small       | Declare the scene route deviation and the `src/app/scene/` subtree                       |
| `dev/docs/briefs/boss_encounter.brief.md`     | Small       | `?map=boss-test` becomes `/testbed/boss-test`                                            |
| `TODO.md`                                     | Small       | Handled at spec creation: draft entry replaced by the Plan pointer                       |

## Execution Outline

1. Define `SceneHooks` in `src/runtime/` and extend `mountGame` to an options object (`mapName`, optional hooks), wiring the dress hook at both world-build sites, the key hook ahead of the surface's bindings, and the chips/commands through the instrument panel's new generic rows. Keep the old stage imports working until step 2 so the tree never passes through a broken state.
2. Create `src/app/scene/soundstage.ts` by moving `src/runtime/stage.ts`'s content into a `SceneHooks` implementation; delete `src/runtime/stage.ts` and every `isStage` branch, the global C binding, and the stage imports in `surface.ts`; update `hud-attack-workbench.ts` for the actions shape.
3. Add the scene class to `resolveAppRoute` (development only), the catalog and router in `src/app/scene/scene-router.ts` (soundstage exact, testbed namespace), and the DEV-guarded scene branch in `main.ts`; delete the `?map=` read. Update `test/unit/app/app-route.test.ts` in the same beat.
4. Update the downstream addresses: map workbench playtest button, capture tooling text, boss brief line.
5. Declare the deviation and subtree in the structure addendum.
6. Verify: `npm run verify`; `npm run check:governance` (governance documents changed); confirm a stage-only identifier is absent from `dist/` after the production build; then open `/soundstage`, `/testbed/circle-water`, and `/` in the dev server and play each briefly — dressing, keys, and panel are feel subjects a person judges.

## Implementation Notes

- Suggested hooks shape: `dress?(world)`, `onKey?(world, key): boolean`, `chips?(world): readonly string[]`, `commands?: readonly { label: string; run(world: World): void }[]`, `instrumentsHidden?: boolean`. Commands receive the world at call time because `mountGame` rebinds its `world` variable on restart; the surface wraps each command so it always reads the current binding.
- The instrument panel creates its chip elements at mount; scene chip count is fixed per scene, so mount-time creation from the initial list plus per-frame `textContent` updates suffices — no dynamic node churn.
- `instrumentsHidden` initial value: `hooks?.instrumentsHidden ?? false`, replacing `isStage(world)`. It is a mount-time default only, as today.
- Testbed needs no hooks module: the router derives the map name from the pathname remainder (`decodeURIComponent`) and mounts with hooks omitted. `mapNamed` already owns the unknown-name fallback.
- The soundstage catalog entry carries the stage map name (`"stage"`), so the name lives beside the scene rather than in the runtime. `STAGE_MAP_NAME` disappears with `stage.ts`.
- `resolveAppRoute` keeps its `(pathname, isDevelopment)` signature and purity; the scene namespaces are a literal list beside the `/debug` literal. Strings in a production-reachable module are acceptable; module-graph leakage is not.

## Edge Cases

| Case                                                   | Expected Handling                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `/soundstage/extra` in development                     | Not a catalog match; the scene router falls back to plain default-map play    |
| `/testbed` or `/testbed/` (no name)                    | Default map plays, as an empty name does today                                |
| `/testbed/<unknown-name>`                              | Default map plays with the existing console warning                           |
| Any scene address in production                        | Resolver returns `ordinary`; the game plays the default map                   |
| Stepping onto the stage map via `,`/`.` on any surface | Plain undressed floor; dressing belongs to `/soundstage` only                 |
| Q/E/C outside the soundstage                           | Nothing happens; the previous C refusal announcement is gone with the binding |
| `?map=` on any route, any build                        | Ignored entirely; the read no longer exists                                   |

## Acceptance Criteria

1. In development, the soundstage address opens the filming stage exactly as the old map query did: fixed arrival facing the room, no reachable descent, minds frozen, instruments hidden, cast stepping and restaging on their keys, and restart returning the scene to its opening state.
2. In development, a testbed address opens the named map as a plain floor; an unknown name plays the default floor and warns on the console.
3. The map query parameter has no effect on any route in any build, and the ordinary address plays the default floor.
4. In a production build every address plays the ordinary game, and the built output contains no stage-dressing or scene-catalog code.
5. Registering another scene requires only a catalog entry and a hooks module — no play-surface branch, no route-resolver edit beyond a namespace the catalog does not already cover.
6. The aggregate verification gate and the governance check both pass.
