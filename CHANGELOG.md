# Changelog

Append-only history of shipped outcomes. Forward work lives in `TODO.md`; product rules and numbers live in `dev/docs/design/pantry-depths_v1.md`.

---

## 0.1.0 — Repository scaffold

Turned the single-file browser prototype into a governed TypeScript project. No gameplay is implemented yet.

### Governance

- Initialized the Git repository and pinned `game-devkit` v0.10.2 (`3252e00`) as the `dev/foundation/` submodule.
- Selected the `web-react` platform with no profiles. Recorded the no-React deviation in `dev/standards/project_structure.addendum.md`: the project is TypeScript plus Canvas 2D, `src/ui/` is plain DOM, and the React, IndexedDB, service-worker, and PWA triggers do not fire here.
- Scaffolded the three required operation contracts, then replaced the placeholder text in `dev/agent_rules/test_operations.md` with the real environment, layers, commands, and pass criteria.
- Declared `port-ref/` as a project-owned root tree holding the original prototype as read-only reference material.
- Recorded the V1 lifecycle reduction in `dev/docs/README.md`: the design document is the draft, and work goes straight to standalone implementation specs.

### Toolchain

- Vite, TypeScript, Vitest, Prettier, oxlint, and dependency-cruiser. 99 packages; no UI framework, no renderer library, no desktop shell.
- `npm run verify` implements the command surface standard's six stages in order: format check → typecheck → lint → boundary check → unit tests → build. Green.
- `npm run check:governance` runs the local contract checker and the foundation consumer verifier. Both report OK.
- Encoded the design document's layer boundaries as machine-checked rules, including the ones for layers not yet earned, so earning a layer later starts from an enforced boundary rather than an open door.

### Product

- Design document v1.3 at `dev/docs/design/pantry-depths_v1.md`. Five floors, `max(0, attack − defense)` on both sides, three key colours mapped to route / attack / defense, a forced-route budget of 90 of 120 HP, and a `Frozen extensions` list that scopes V1.
- v1.2 moved enemy art from procedural Canvas drawing to fixed 512×512 sprite files, with the authoring spec, per-enemy `scale` and `anchorY`, the distance-tint requirement, and the pre-baked hit flash. Environment surfaces stay procedural.
- v1.3 settled the fiction against the project name: the dungeon is a manor's five-level cellar and the player descends rather than climbs. Floor themes became wine cellar / ice cellar / meat larder / guard level / deepest storeroom, and the stair tile characters now follow the roguelike convention (`>` down, `<` up). Themes affect texture palette and decor only; no rule changes.
- Moved the original prototype (`game.js`, `index.html`, `style.css`) into `port-ref/`. Its mouse-look, gold, chests, potions, and inventory are cut by the design document and will not be ported.

### Rules and Content

- 2026-07-26 — [pantry_rules] Shipped deterministic combat and action rules, provisional five-floor content, development inspection surfaces, replayable balance evidence, enforced offline-tool ownership, and presentation-only environment annotations.
- 2026-07-26 — [pantry_rules] Final floor quality is judged through playable presentation and manual play; generated balance evidence remains descriptive and carries no numeric pass threshold.

### Development Tooling

- 2026-07-26 — [pantry_debug_surface] Shipped a shared development workspace shell, responsive tool hub, consistent inspection panels, and readable floor and action map workflows.
