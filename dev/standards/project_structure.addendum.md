# Project Structure Addendum

Addendum to `dev/foundation/platforms/web-react/standards/project_structure_standard.md`. That standard remains the canonical owner of root vocabulary, source layer vocabulary, and import boundaries. This file records only the trees it does not name and the one declared deviation.

## Declared Deviation: No React

Pantry Depths selects the `web-react` platform because it is the only Web platform axis the foundation offers. The project uses **no React and no UI framework**: the game is TypeScript plus Canvas 2D, and the HUD is plain DOM.

Consequences:

- `src/ui/` holds plain DOM modules, not React components or hooks. Every other `ui/` rule from the standard still applies, including the prohibition on repository-wide `components/`, `hooks/`, or `utils/` trees and on importing `platform/` or `app/` directly.
- The following platform triggers never fire in this repository and reading them is not required: `react_component_standard.md`, `react_strict_mode_effects.md`, `browser_persistence_standard.md`, `indexeddb_upgrade_transactions.md`, `service_worker_cache_versioning.md`, and the service-worker and installability portions of `web_platform_standard.md`.
- V1 has no save system, no IndexedDB, no service worker, and no PWA manifest, so `public/` is omitted entirely.

Reintroducing React, persistence, or a service worker retires the corresponding part of this deviation and restores the trigger.

## Project-Owned Root Trees

| Tree        | Ownership                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port-ref/` | The original single-file browser prototype (`game.js`, `index.html`, `style.css`). Reference material for the presentation port. Outside the game layer vocabulary, outside the runtime module graph, excluded from typecheck, lint, format, and the boundary check. Never imported by `src/`. |

`port-ref/` is read-only source material. Code moves out of it into the layer that owns the behavior; it is never edited in place to keep a running copy alive.

## Layer Status

The standard names `presentation/` and `shared/` as earned layers that are created only when the owning work exists. Both are absent from the tree until then, as is `platform/`, which V1 is not expected to need at all. The remaining layers carry a scaffolded empty directory so that the layer vocabulary is visible in the tree and a file lands in the right place on the first try.

| Layer               | Directory | Status                                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `src/app/`          | Present   | Ordinary/debug route boundary and development tools; ordinary runtime is still a placeholder.          |
| `src/core/`         | Present   | Empty. Will own grid state, turn resolution, and the attack-minus-defense formula.                     |
| `src/content/`      | Present   | Empty. Will own the enemy table, door effects, and the five baked floors.                              |
| `src/runtime/`      | Present   | Empty. Will own input-to-command flow and snapshot routing.                                            |
| `src/harness/`      | Present   | Owns the deterministic action scenario; will also own the forced-route scenario and debug API.         |
| `src/ui/`           | Present   | Empty. Will own the HUD overlay.                                                                       |
| `src/presentation/` | Absent    | Earned layer. Created by the renderer port; will own the raycaster, textures, sprites, VFX, and audio. |
| `src/platform/`     | Absent    | Not expected in V1. No persistence, desktop shell, or distribution API.                                |
| `src/shared/`       | Absent    | Earned layer. Create only on demonstrated cross-feature ownership.                                     |

A scaffolded empty directory is not a claim that the layer is earned. It carries a `.gitkeep` and nothing else; the first real module in it is still the change that has to justify the placement.

`src/app/debug/` follows the shared development-tool route surface without a routing deviation. Pantry's ordinary policy currently renders the game placeholder for every non-debug development path and every production path, including the `/debug` namespace. Debug navigation uses native full-document anchors.

## Feature Placement Detail

- The five floor maps are authored data, not code. They live in `src/content/floors/` as JSON and are the only source of map geometry. No generator ships in `src/`; the offline bake script belongs in `dev/tools/`.
- Numeric records the design document owns — player base stats, the four door effects, the enemy table, sprite `scale` and `anchorY` — live in `src/content/`. They must not be duplicated as literals inside `src/core/` or `src/presentation/`.
- Image assets exist in two trees with different lifetimes. The baked 512×512 runtime PNGs live under `src/content/**/assets/`, are imported through source so the bundler fingerprints them, and are version-controlled — they are the only copy the game or the repository depends on. The editable sources that bake them live in `/assets/` at the repository root, are never imported at runtime, and are **deliberately outside version control** (`/assets/` is ignored): they are a local re-baking convenience, so a working copy without them is correct and must not be treated as missing files to restore. A change to runtime artwork therefore ships the baked PNG; the source is the author's to keep.
- Environment surfaces — walls, floor, ceiling — stay procedurally drawn and ship no image file. Enemies, world sprites, and stand-in placeholders are the exceptions that use images.
- The forced-route balance simulation is a `src/harness/` scenario driven by a `dev/tools/` script, so balance can be re-derived without a manual playthrough. The harness also owns the derived balance model — stage identity, accumulated health cost, opened-entity state, and route membership — because those are measurements over a deterministic scenario. The tooling script serializes and writes that model; it never derives a value the model does not already carry.

## Offline Tooling Ownership

`dev/tools/` is the offline tooling tree. A file directly under it is an executable entrypoint: a CLI, a process adapter, or a runner configuration. Reusable implementation lives in a named subdirectory of it, so a reader can tell an entry from an implementation by path alone. The path is the signal; file size is not.

Placement inside the tree follows the same test as the source layers. Deterministic measurement over a scenario belongs in `src/harness/` and is imported, not reimplemented. Content schema and structural validation belong in `src/content/` and are imported, not reimplemented. What legitimately remains in `dev/tools/` is what no game layer may own: offline authoring algorithms that must not ship, artifact serialization, filesystem access, argument parsing, exit status, and development-server request handling.

Import directions, machine-checked by the boundary rules:

- `dev/tools/` imports `src/core/`, `src/content/`, and `src/harness/` through the `@/` alias. It never imports `src/app/`, `src/runtime/`, `src/ui/`, or a renderer; a tool that needs those is a debug tool and belongs in `src/app/debug/`.
- `src/` never imports `dev/`. The shipped module graph must not depend on development-time tooling.
- `dev/tools/` is the one sanctioned consumer of `src/harness/` outside `src/app/`, which is why the harness rule names both.

The development authoring endpoint namespace is declared once in the tooling tree. The workbench client keeps its own literal because client code must not import `dev/`; a unit test holds that one copy equal to the declaration. Editor tasks invoke existing npm scripts and own no parameters, defaults, or behavior of their own — a prompt-driven flag surface belongs to the CLI or to the workbench, not to a third entry point.
