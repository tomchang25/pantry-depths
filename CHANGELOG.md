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
- 2026-07-27 — [code_style] Added `dev/standards/code_style.addendum.md`: a branch chain over a closed enumeration ends in a compiler-proved exception branch, never an unguarded fallthrough yielding one of the members. TypeScript is the only enforcement, because the linter runs without type information.

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
- 2026-07-27 — [pantry_run_exit] A run now ends by interacting with an authored exit, and no enemy defeat produces a terminal outcome. The princess is gone as a type: its stats stay unchanged as an ordinary purple slime, the hardest row of the enemy table with no boss identity. This separates where a run ends from which enemy is hardest, so both can be placed independently and every map closes the same way.
- 2026-07-27 — [pantry_run_exit] Floor content moved to schema version 4. `goalEntityId` and `defeatOutcome` are deleted rather than renamed; a floor set now carries exactly one `exit` entity, which the validator checks by kind. Structural validation proves the exit reachable under the unchanged key-and-door rules and reports a missing, duplicated, or unreachable exit as a distinct finding.
- 2026-07-27 — [pantry_run_exit] The exit renders through a baked block placeholder rather than authored artwork, and B5's provisional tail became a one-wide corridor so the last encounter is unavoidable by geometry. The exit carries no unlock condition in V1; switches and kill gates are recorded in `dev/docs/design/pantry_depths_v2_direction.md`.

### Development Tooling

- 2026-07-26 — [pantry_debug_surface] Shipped a shared development workspace shell, responsive tool hub, consistent inspection panels, and readable floor and action map workflows.
- 2026-07-27 — [pantry_browser_acceptance] Shipped a Playwright browser layer scoped to what a DOM-less unit environment cannot observe in the development console: debug-route boot and lazy tool loading, the Workbench's round trip through the development authoring endpoint, and the interlock holding export and canonical overwrite disabled until the exact draft validates. Debug panel sections became named landmark regions in the same change.
- 2026-07-27 — [pantry_browser_acceptance] Gameplay presentation, input feel, VFX, and audio remain manual-playtest boundaries, and no browser test may invoke the authoring endpoint's save operation. `dev/agent_rules/test_operations.md` owns both lines.
- 2026-07-27 — [pantry_authoring] Shipped direct floor authoring: a layered selectable map, independent per-floor resizing, terrain painting, gameplay-entity placement and dragging, environment-feature anchor and preset editing, and two-way JSON draft synchronization. Placing content no longer requires typing a coordinate, immediately knowable violations are refused at the control that caused them, and export and canonical overwrite stay disabled until the exact draft validates.
- 2026-07-27 — [pantry_authoring] Generator counts became per-color candidate totals alongside an independent odd width and height, replacing the per-floor counts that silently multiplied by floor count. A total is now honored exactly or generation is refused, and every generated candidate still arrives structurally solvable.
- 2026-07-27 — [pantry_presentation] Shipped the complete 2.5D gameplay renderer. The ordinary route now draws a first-person view of the authored floor: DDA walls with depth-buffered billboards, projected floor and ceiling, procedural materials, purple fog, warm torch light, the torch-and-sword viewmodel, and synthesized ambience. Fifteen baked slime state images plus the world sprite manifest are validated before play, and a failed asset keeps the scene non-interactive behind a retryable error.
- 2026-07-27 — [pantry_presentation] Authored environment features render as presentation-only annotations: wall decorations obey their outward face, ambient lights tint nearby sprites with their own colour, and emitters carry embers and steam. Display size and floor anchor for every world sprite are authored content, and the renderer holds no such number as a literal.
- 2026-07-27 — [pantry_presentation] Deferred evidence, accepted at closeout: side-by-side parity against `port-ref/` was not performed, and reduced-motion and silent-audio behaviour was not exercised in a browser. Semantic-event feedback — hurt and attack poses, the white hit flash, the two-piece death, and impact audio — is implemented but has never executed, because command input is a Non-Goal of this plan and nothing yet delivers events. `pantry_feel` is the first consumer that can close all three.
