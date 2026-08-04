# Project Structure Addendum

Addendum to `dev/foundation/platforms/web-react/standards/project_structure_standard.md`. That standard remains the canonical owner of root vocabulary, source layer vocabulary, and import boundaries. This file records only the trees it does not name and the declared deviations.

## Declared Deviation: No React

Pantry Depths selects the `web-react` platform because it is the only Web platform axis the foundation offers. The project uses **no React and no UI framework**: the game is TypeScript plus Canvas 2D, and the HUD is plain DOM.

Consequences:

- `src/ui/` is a plain-DOM layer: the HUD, its icon builder, and its stylesheet, rendering view models they are handed. No React arrives with it — the deviation was about the framework, not about owning an interface layer.
- With no reactive binding layer, the runtime pushes view models into the DOM interface directly, so `src/runtime/` imports `src/ui/` — a declared deviation from the platform rule that runtime never imports ui, machine-checked as such. Reintroducing React retires this bullet with the rest.
- The following platform triggers never fire in this repository and reading them is not required: `react_component_standard.md`, `react_strict_mode_effects.md`, `browser_persistence_standard.md`, `indexeddb_upgrade_transactions.md`, `service_worker_cache_versioning.md`, and the service-worker and installability portions of `web_platform_standard.md`.
- V1 has no save system, no IndexedDB, no service worker, and no PWA manifest, so `public/` is omitted entirely.

Reintroducing React, persistence, or a service worker retires the corresponding part of this deviation and restores the trigger.

## Declared Deviation: A Random Real-Time Core

The platform standard expects `src/core/` to own deterministic gameplay state. The rules that live in core are the demo's, moved there by the demo migration (archived at `dev/docs/archived/demo_migration.plan.md`): a real-time, mutating tick that draws on global randomness and guarantees no replay. They arrived as they were, because making the tick injectable-random is a behaviour-affecting redesign the migration deliberately shipped none of. The screenshot harness seeds global randomness for reproducible captures, and that continues to work unchanged.

Making the tick deterministic later retires this deviation.

## Layer Status

The standard names `presentation/` and `shared/` as earned layers that are created only when the owning work exists. This table is the current truth of which layers exist and what each holds.

| Layer               | Directory | Status                                                                                                                                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/`          | Present   | Route boundary, bootstrap, and the debug tool surface. The ordinary route mounts the demo surface.                                                                                                     |
| `src/core/`         | Present   | The rules: contracts and vocabulary, floor assembly, the world and its tick, the minds, actions, impacts, extraction, progression state. Reads authored tables only through the injected game catalog. |
| `src/content/`      | Present   | Authored data by feature: maps, rooms, enemies, combat tables, sfx, presentation assets, viewmodel definitions.                                                                                        |
| `src/presentation/` | Present   | Earned by the renderer port: the audio stack, and the Three.js runtime in `scene-3d/` that draws the game.                                                                                             |
| `src/runtime/`      | Present   | The frame loop, input, mounting, the cue drain, the stage dressing, and the address-bar map question.                                                                                                  |
| `src/ui/`           | Present   | The plain-DOM HUD, its icons, and its stylesheet — see the No React deviation above.                                                                                                                   |
| `src/platform/`     | Absent    | Not expected in V1. No persistence, desktop shell, or distribution API.                                                                                                                                |
| `src/shared/`       | Absent    | Earned layer. Create only on demonstrated cross-feature ownership.                                                                                                                                     |

A scaffolded empty directory is not a claim that the layer is earned. It carries a `.gitkeep` and nothing else; the first real module in it is still the change that has to justify the placement.

## One Renderer

`src/presentation/` held two for a while — the Canvas 2D raycaster the game drew through, and the Three.js runtime in `src/presentation/scene-3d/` that was replacing it — each with its own procedural surfaces and its own artwork. That is over. The raycaster, the interim projection tree at `src/demo/` that fed it, the shared image pipeline, and the baked enemy atlases only they read were deleted on 2026-08-04, and `scene-3d/` is the only thing that draws the game.

The declarations those two trees needed are gone with them, and so are their boundary rules. What is worth keeping is the reason they existed: the surfaces a renderer was tuned against belong to that renderer. A second renderer arriving here would bring its own again, and it would be a declared temporary duplication with a scheduled end rather than a commons.

## The Sandbox Tree

`src/sandbox/` is the sandbox track's source tree — see `dev/standards/sandbox_track.md` for what belongs on that track. It is declared here because the platform layer vocabulary does not name it. One experiment is one directory, `src/sandbox/<experiment>/`, and files never sit directly under `src/sandbox/`.

- **Development-only, entered through the debug hub.** A sandbox experiment gets one catalog entry in `src/app/debug/` whose deferred loader crosses into the experiment's folder, exactly as any other debug tool loads. It thereby inherits the debug namespace's production exclusion; nothing under `src/sandbox/` is production-reachable.
- **Import directions, machine-checked by the boundary rules:** an experiment imports its own folder, `src/core/`, and `src/content/`, and nothing else in `src/`. Nothing imports `src/sandbox/` except `src/app/debug/`. Experiments never import each other — a module two experiments want is evidence the code wants to graduate, not grounds for a sandbox commons.
- **Graduation is a move, never an in-place promotion.** An experiment that earns permanence moves into the layer that owns the behavior, arriving as formal-track work under the full ceremony; its sandbox folder is deleted in the same change. The other normal ending is deleting the folder outright. What never happens is the import boundary opening so the rest of `src/` can reach into the sandbox.

The tree has no residents at the moment, and the directory is therefore not there — it comes back with the next experiment. Its first two, `three-block` and `three-preview`, moved here from `src/app/debug/` when it was created and both ended on 2026-08-04: the block viewer graduated into `src/app/debug/entity-workbench/` and became the entity workbench, and the preview experiment was deleted after two of its showcases were rebuilt against the rig that ships. Those are the two normal endings, one each. The rules above stay declared and machine-checked against an absent tree, because what they describe is what the next experiment gets, not what these two had.

`src/app/debug/` follows the shared development-tool route surface without a routing deviation. Pantry's ordinary policy currently renders the game placeholder for every non-debug development path and every production path, including the `/debug` namespace. Debug navigation uses native full-document anchors.

## Feature Placement Detail

- Maps and rooms are authored data, not code. They live in `src/content/maps/` and `src/content/rooms/` as JSON and are the only source of map geometry. No generator ships in `src/`; offline authoring algorithms belong in `dev/tools/`.
- Numeric records the design document owns — player base stats, the four door effects, the enemy table, sprite `scale` and `anchorY` — live in `src/content/`. They must not be duplicated as literals inside `src/core/` or `src/presentation/`.
- Image assets exist in two trees with different lifetimes. The baked 512×512 runtime PNGs live under `src/content/**/assets/`, are imported through source so the bundler fingerprints them, and are version-controlled — they are the only copy the game or the repository depends on. The editable sources that bake them live in `/assets/` at the repository root, are never imported at runtime, and are **deliberately outside version control** (`/assets/` is ignored): they are a local re-baking convenience, so a working copy without them is correct and must not be treated as missing files to restore. A change to runtime artwork therefore ships the baked PNG; the source is the author's to keep.
- Environment surfaces — walls, floor, ceiling — stay procedurally drawn and ship no image file. Enemies, world sprites, and stand-in placeholders are the exceptions that use images.

## Offline Tooling Ownership

`dev/tools/` is the offline tooling tree. A file directly under it is an executable entrypoint: a CLI, a process adapter, or a runner configuration. Reusable implementation lives in a named subdirectory of it, so a reader can tell an entry from an implementation by path alone. The path is the signal; file size is not.

Placement inside the tree follows the same test as the source layers. Content schema and structural validation belong in `src/content/` and are imported, not reimplemented. What legitimately remains in `dev/tools/` is what no game layer may own: offline authoring algorithms that must not ship, artifact serialization, filesystem access, argument parsing, exit status, and development-server request handling.

Import directions, machine-checked by the boundary rules:

- `dev/tools/` imports `src/core/` and `src/content/` through the `@/` alias. It never imports `src/app/` or a renderer; a tool that needs those is a debug tool and belongs in `src/app/debug/`.
- `src/` never imports `dev/`. The shipped module graph must not depend on development-time tooling.

The development authoring endpoint namespace is declared once in the tooling tree. The workbench client keeps its own literal because client code must not import `dev/`; a unit test holds that one copy equal to the declaration. Editor tasks invoke existing npm scripts and own no parameters, defaults, or behavior of their own — a prompt-driven flag surface belongs to the CLI or to the workbench, not to a third entry point.
