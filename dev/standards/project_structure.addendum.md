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
| `src/app/`          | Present   | Bootstrap only.                                                                                        |
| `src/core/`         | Present   | Empty. Will own grid state, turn resolution, and the attack-minus-defense formula.                     |
| `src/content/`      | Present   | Empty. Will own the enemy table, door effects, and the five baked floors.                              |
| `src/runtime/`      | Present   | Empty. Will own input-to-command flow and snapshot routing.                                            |
| `src/harness/`      | Present   | Empty. Will own the forced-route scenario and the debug API.                                           |
| `src/ui/`           | Present   | Empty. Will own the HUD overlay.                                                                       |
| `src/presentation/` | Absent    | Earned layer. Created by the renderer port; will own the raycaster, textures, sprites, VFX, and audio. |
| `src/platform/`     | Absent    | Not expected in V1. No persistence, desktop shell, or distribution API.                                |
| `src/shared/`       | Absent    | Earned layer. Create only on demonstrated cross-feature ownership.                                     |

A scaffolded empty directory is not a claim that the layer is earned. It carries a `.gitkeep` and nothing else; the first real module in it is still the change that has to justify the placement.

## Feature Placement Detail

- The five floor maps are authored data, not code. They live in `src/content/floors/` as JSON and are the only source of map geometry. No generator ships in `src/`; the offline bake script belongs in `dev/tools/`.
- Numeric records the design document owns — player base stats, the four door effects, the enemy table, sprite `scale` and `anchorY` — live in `src/content/`. They must not be duplicated as literals inside `src/core/` or `src/presentation/`.
- Enemy art is the one place this project uses image assets. Editable sources (SVG or the generation script) live in `assets/enemies/` and are never imported at runtime; the baked 512×512 PNGs live in `src/content/enemies/assets/` and are imported through source so the bundler fingerprints them. Environment surfaces — walls, floor, ceiling — stay procedurally drawn and ship no image file.
- The forced-route balance simulation is a `src/harness/` scenario driven by a `dev/tools/` script, so balance can be re-derived without a manual playthrough.
