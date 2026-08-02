# Project Structure Addendum

Addendum to `dev/foundation/platforms/web-react/standards/project_structure_standard.md`. That standard remains the canonical owner of root vocabulary, source layer vocabulary, and import boundaries. This file records only the trees it does not name and the one declared deviation.

## Declared Deviation: No React

Pantry Depths selects the `web-react` platform because it is the only Web platform axis the foundation offers. The project uses **no React and no UI framework**: the game is TypeScript plus Canvas 2D, and the HUD is plain DOM.

Consequences:

- `src/ui/` is omitted. The development demo's plain-DOM HUD lives beside its simulation in `src/demo/`; that whole real-time surface remains a manual-play boundary rather than a reusable application UI layer.
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
| `src/presentation/` | Absent    | Earned layer. Created by the renderer port; will own the raycaster, textures, sprites, VFX, and audio. |
| `src/platform/`     | Absent    | Not expected in V1. No persistence, desktop shell, or distribution API.                                |
| `src/shared/`       | Absent    | Earned layer. Create only on demonstrated cross-feature ownership.                                     |

A scaffolded empty directory is not a claim that the layer is earned. It carries a `.gitkeep` and nothing else; the first real module in it is still the change that has to justify the placement.

## The Sandbox Tree

`src/sandbox/` is the sandbox track's source tree — see `dev/standards/sandbox_track.md` for what belongs on that track. It is declared here because the platform layer vocabulary does not name it. One experiment is one directory, `src/sandbox/<experiment>/`, and files never sit directly under `src/sandbox/`.

- **Development-only, entered through the debug hub.** A sandbox experiment gets one catalog entry in `src/app/debug/` whose deferred loader crosses into the experiment's folder, exactly as any other debug tool loads. It thereby inherits the debug namespace's production exclusion; nothing under `src/sandbox/` is production-reachable.
- **Import directions, machine-checked by the boundary rules:** an experiment imports its own folder, `src/core/`, and `src/content/`, and nothing else in `src/`. Nothing imports `src/sandbox/` except `src/app/debug/`. Experiments never import each other — a module two experiments want is evidence the code wants to graduate, not grounds for a sandbox commons.
- **Graduation is a move, never an in-place promotion.** An experiment that earns permanence moves into the layer that owns the behavior, arriving as formal-track work under the full ceremony; its sandbox folder is deleted in the same change. The other normal ending is deleting the folder outright. What never happens is the import boundary opening so the rest of `src/` can reach into the sandbox.
- `src/app/debug/three-block/` and `src/app/debug/three-preview/` predate this tree and stay where they are as legacy debug tools; new experiments do not join them there.

`src/app/debug/` follows the shared development-tool route surface without a routing deviation. Pantry's ordinary policy currently renders the game placeholder for every non-debug development path and every production path, including the `/debug` namespace. Debug navigation uses native full-document anchors.

## Feature Placement Detail

- The five floor maps are authored data, not code. They live in `src/content/floors/` as JSON and are the only source of map geometry. No generator ships in `src/`; the offline bake script belongs in `dev/tools/`.
- Numeric records the design document owns — player base stats, the four door effects, the enemy table, sprite `scale` and `anchorY` — live in `src/content/`. They must not be duplicated as literals inside `src/core/` or `src/presentation/`.
- Image assets exist in two trees with different lifetimes. The baked 512×512 runtime PNGs live under `src/content/**/assets/`, are imported through source so the bundler fingerprints them, and are version-controlled — they are the only copy the game or the repository depends on. The editable sources that bake them live in `/assets/` at the repository root, are never imported at runtime, and are **deliberately outside version control** (`/assets/` is ignored): they are a local re-baking convenience, so a working copy without them is correct and must not be treated as missing files to restore. A change to runtime artwork therefore ships the baked PNG; the source is the author's to keep.
- Environment surfaces — walls, floor, ceiling — stay procedurally drawn and ship no image file. Enemies, world sprites, and stand-in placeholders are the exceptions that use images.

## Offline Tooling Ownership

`dev/tools/` is the offline tooling tree. A file directly under it is an executable entrypoint: a CLI, a process adapter, or a runner configuration. Reusable implementation lives in a named subdirectory of it, so a reader can tell an entry from an implementation by path alone. The path is the signal; file size is not.

Placement inside the tree follows the same test as the source layers. Content schema and structural validation belong in `src/content/` and are imported, not reimplemented. What legitimately remains in `dev/tools/` is what no game layer may own: offline authoring algorithms that must not ship, artifact serialization, filesystem access, argument parsing, exit status, and development-server request handling.

Import directions, machine-checked by the boundary rules:

- `dev/tools/` imports `src/core/` and `src/content/` through the `@/` alias. It never imports `src/app/`, `src/demo/`, or a renderer; a tool that needs those is a debug tool and belongs in `src/app/debug/`.
- `src/` never imports `dev/`. The shipped module graph must not depend on development-time tooling.

The development authoring endpoint namespace is declared once in the tooling tree. The workbench client keeps its own literal because client code must not import `dev/`; a unit test holds that one copy equal to the declaration. Editor tasks invoke existing npm scripts and own no parameters, defaults, or behavior of their own — a prompt-driven flag surface belongs to the CLI or to the workbench, not to a third entry point.
