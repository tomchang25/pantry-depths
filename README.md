# Pantry Depths

A first-person, real-time dungeon crawler rendered by a Canvas 2D raycaster. A floor is assembled from authored rooms and stands its crowd on arrival — slimes that cost you position and skeletons that want a distance — with every attack telegraphed before it lands and avoidable if you read it. Clear the main task to open the way down, pay the side tasks for blessings, smash what stands in the way, throw what the dead drop, and descend.

Rules live in `src/core/` and numbers in `src/content/`; those are the authority. The design documents under `dev/docs/design/` are frozen records of what the plans were derived from and are not read for current truth — see [`dev/standards/frozen_reference_directories.md`](dev/standards/frozen_reference_directories.md).

## Status

The demo migration is complete (2026-08-03): the game lives in the formal layers. What remains of the old demo tree is the interim projection half in `src/demo/` — scene building, sprite loading, the viewmodel — held in place until the 3D renderer decision replaces it. Forward work lives in [`TODO.md`](TODO.md); the migration plan is archived at `dev/docs/archived/demo_migration.plan.md`.

## Running

```bash
npm install
```

```bash
npm run dev
```

The dev server binds `http://localhost:5273`.

## Verification

```bash
npm run verify
```

That is the single aggregate gate: format check → typecheck → lint → import boundary check → unit tests → production build. Governance checks run separately with `npm run check:governance` and additionally require Python 3.

`dev/agent_rules/test_operations.md` is the authoritative contract for what each layer proves and what it does not. Presentation, input feel, audio, and VFX have no automated coverage; they are verified by playing.

## Structure

```text
src/
  app/            Route boundary, bootstrap, and the debug tool surface
  core/           The rules: contracts and vocabulary, floor assembly, the world and its tick, enemy minds
  content/        Authored data: maps, rooms, enemies, props, progression, sfx, presentation assets
  demo/           Interim projection half: scene building, sprites, viewmodel — until the 3D renderer decision
  presentation/   Canvas 2D raycaster, procedural textures, image loading, audio
  runtime/        Frame loop, input, mounting, stage dressing
  sandbox/        Disposable experiments, entered through the debug hub
  ui/             Plain-DOM HUD (this project uses no UI framework)
dev/
  foundation/     Shared governance, pinned submodule
  standards/      Project addenda
  tools/          Offline tooling: authoring, capture, repository checks
```

Layer boundaries are machine-checked. `core/` imports nothing outside `core/` and never touches a DOM global; authored tables reach it through an injected game catalog. That is what keeps the rules portable and testable without a browser — the tick itself is real-time and deliberately random, a declared deviation recorded in `dev/standards/project_structure.addendum.md`.

## Governance

This repository is a consumer of [game-devkit](https://github.com/tomchang25/game-devkit), pinned as the `dev/foundation/` submodule. Clone with:

```bash
git clone --recurse-submodules <url>
```

If `dev/foundation/` is empty in an existing clone:

```bash
git submodule update --init --recursive
```
