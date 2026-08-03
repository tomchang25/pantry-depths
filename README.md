# Pantry Depths

A first-person grid dungeon crawler in the 魔塔 tradition. Five baked floors, stationary enemies, three key colors, and one formula on both sides of every exchange:

```text
damage = max(0, attacker.attack − defender.defense)
```

Every action — stepping, turning, attacking, opening a door — lets each enemy already within reach hit you once. Stepping into that reach is free and stepping out of it is free; standing there and doing anything is what costs. So the cost of passing an enemy is known before you touch it, and the whole game is deciding which costs to pay.

Red keys open the way. Blue keys buy attack. Yellow keys buy defense. You spend HP to reach a key, and the stat it unlocks makes the rest of the route cheaper. Attack decides whether you can hurt something at all; defense decides how much it costs.

Rules live in `src/core/` and numbers in `src/content/`; those are the authority. The design documents under `dev/docs/design/` are frozen records of what the plans were derived from and are not read for current truth — see [`dev/standards/frozen_reference_directories.md`](dev/standards/frozen_reference_directories.md).

## Status

The playable demo is the game. It currently lives in `src/demo/` and is being migrated into the formal layers — see [`TODO.md`](TODO.md) for forward work and `dev/docs/plans/demo_migration.plan.md` for the migration.

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
  app/            Bootstrap
  core/           Deterministic rules: grid, turn resolution, damage
  content/        Authored data: enemy table, door effects, baked floors
  runtime/        Input to command, snapshot routing
  presentation/   Canvas 2D raycaster, procedural textures, sprites, audio
  harness/        Deterministic scenarios and the debug API
  ui/             HUD overlay (plain DOM; this project uses no UI framework)
dev/
  foundation/     Shared governance, pinned submodule
  docs/design/    Game design document
  standards/      Project addenda
```

Layer boundaries are machine-checked. `core/` imports nothing outside `core/` and never touches a DOM global — that is what keeps combat deterministic and testable without a browser.

## Governance

This repository is a consumer of [game-devkit](https://github.com/tomchang25/game-devkit), pinned as the `dev/foundation/` submodule. Clone with:

```bash
git clone --recurse-submodules <url>
```

If `dev/foundation/` is empty in an existing clone:

```bash
git submodule update --init --recursive
```
