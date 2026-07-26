# Provisional Floor Pipeline and Authoring Tools

Parent Plan: `pantry_rules.plan.md`

## Goal

Establish a deterministic offline floor-production pipeline that can create, edit, validate, preview, and explicitly save an arbitrary number of authored floors without shipping generation logic in the game. Land one playable provisional five-floor set plus read-only and authoring inspection surfaces so map structure can be tested now and replaced by final V1 content after route and balance tooling exists.

## Summary

This change adds a versioned JSON floor-set contract, deterministic seed-based development generator, independent topology validator, and catalog adapter that assembles authored records into the capability-driven `RunWorld`. The generator produces candidates only; committed JSON remains runtime authority, and the same validator runs after every manual edit. Canonical CLI commands and committed VS Code tasks expose generation and validation without making editor configuration the command owner.

The generator carves a seeded corridor maze with a few open rooms per floor, then places a lock-and-key chain along the required route so every candidate is solvable by construction. Key, door, and enemy counts are configured per floor and independently of each other, over the three fixed key colors. Each attempt is checked by the canonical validator before it is returned, and a failed attempt reseeds deterministically, so equal inputs always produce the same solvable output.

The provisional set exercises five connected floors, entries, bidirectional stairs, keys, doors, a breakable wall, a hot spring, and a reachable goal. Structural validation returns actionable findings plus one concrete start-to-goal solution path. It proves progression topology but deliberately does not promise a survivable HP budget or final placements; route replay and report mechanics belong to A05, while final V1 layouts and tuning belong to the independent final-floor design plan.

Breakable walls gain a directional-hint capability whose authored faces name the outward cardinal sides that visibly differ. The read-only Floor Set Viewer exposes these faces, topology findings, and the solution overlay. A Floor Set Workbench shares draft JSON across generation, editing, validation, and preview, and lets a validated draft leave the page two ways: a browser file download that touches no committed content, and an explicit canonical save through development-only middleware. The provisional world remains selectable in the Action Viewer for real command-driven play.

## Relational Context

- JSON under `src/content/floors/` is the only authored source for provisional geometry and placement. The content catalog validates and translates it into `FloorDefinition` and capability-driven `WorldEntity` records; core never imports content or parses authored kinds.
- `RunWorld` remains the immutable input to `GameSession`. The catalog may add a directional-hint capability to an entity, but command resolution must not branch on it or on entity kind.
- The offline generator lives under `dev/tools/`, accepts an explicit seed, positive floor count, and per-floor key, door, and enemy counts, and emits stable candidate output. It calls the canonical validator itself so a candidate is never returned without a solution. Browser authoring requests reach it through development-only Vite middleware; no generator, seed, retry behavior, or filesystem write enters `src/` or the production module graph.
- Topology validation consumes the same parsed floor-set contract as runtime assembly, CLI validation, and both debug tools. Manual JSON edits are validated directly; the validator never regenerates or normalizes them first.
- Lock-and-key reachability is exponential in the number of independent keys and doors, so the solver bounds its own search and reports an undecided result as its own finding rather than exhausting memory. That bound is a property of validation, not of the generator, and every caller sees the same finding.
- The Workbench owns only transient draft text. Generation comes from the development tool, validation comes from the canonical content validator, export is a browser download that writes nothing, and save requests are revalidated server-side before the one allowed canonical path is written.
- Static tile glyphs describe only passable floor or permanent environment walls. Stateful or interactive objects, including hot springs and stairs, remain entities. Presentation-only torches, ambient lights, emitters, and wall decorations are excluded for A06 rather than being forced into `WorldEntity`.
- A05 consumes the provisional catalog, solution annotations, and findings to build command replay and balance-report tooling. A06 adds presentation-only environment-feature ownership before presentation consumes the annotations. The independent final-floor design plan later replaces provisional placements after the playable presentation exists.

## Scope

### Included

- Versioned floor-set schema, parser, catalog assembly, and deterministic provisional five-floor JSON.
- Seeded N-floor maze-and-room candidate generator with independent per-floor key, door, and enemy counts over the three fixed key colors, a single goal enemy, solvable-by-construction placement, and deterministic reseeding when an attempt fails.
- Standalone committed-content validation command and matching VS Code tasks.
- Structural findings, concrete solution path, a bounded search that reports an undecided result as a finding, manual-edit revalidation, and focused tests.
- Directional breakable-wall capability without directional damage rules, plus validation for one hinted face or two opposing hinted faces.
- Development-only Floor Set Viewer, Floor Set Workbench with generator controls and validated file export, safe authoring middleware, and provisional-world Action Viewer selection.

### Excluded

- Final V1 layouts, final enemy or landmark placements, and required-route annotations.
- Combat survivability, the 90/120 health budget, forced command replay, and generated balance reports.
- Runtime generation, procedural recovery, final minimap behavior, renderer textures, and wall VFX. Presentation-only environment-feature records are deferred to A06.

## Files to Change

| File                                               | Change Size | Purpose                                                                                              |
| -------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `package.json`                                     | Small       | Expose canonical generation and validation commands.                                                 |
| `dev/agent_rules/test_operations.md`               | Small       | Document the durable floor-set validation layer and pass criteria.                                   |
| `dev/tools/floor-set-generator.ts`                 | Large       | Own seeded maze carving, solvable lock-and-key placement, and validate-then-reseed candidate output. |
| `dev/tools/generate-floor-set.ts`                  | Medium      | Parse CLI input and write or print candidate data without touching canonical content by default.     |
| `dev/tools/validate-floor-set.ts`                  | Small       | Report canonical topology findings and fail on errors.                                               |
| `dev/tools/floor-authoring-api.ts`                 | Large       | Own request parsing, path confinement, generation delegation, and validation-before-save.            |
| `.vscode/tasks.json`                               | Medium      | Make floor generation, validation, and Workbench startup discoverable with prompted arguments.       |
| `.gitignore`                                       | Small       | Track the shared VS Code task file while leaving other local editor state ignored.                   |
| `vite.config.ts`                                   | Medium      | Register the development-only authoring middleware without adding production endpoints.              |
| `src/core/run-state.ts`                            | Small       | Carry a directional-hint capability without consuming it in command logic.                           |
| `src/content/floor/floor-schema.ts`                | Large       | Define parsed floor data and one tile-definition table for glyph, material, and collision semantics. |
| `src/content/floor/floor-catalog.ts`               | Large       | Import canonical JSON and assemble the playable `RunWorld`.                                          |
| `src/content/floor/floor-validation.ts`            | Large       | Validate schema relationships, hint configurations, and bounded structural progression.              |
| `src/content/floors/provisional-floor-set.json`    | Large       | Hold committed provisional geometry and placement data.                                              |
| `src/harness/floor-scenario.ts`                    | Small       | Create a fresh session from the provisional catalog.                                                 |
| `src/app/debug/action-viewer.ts`                   | Medium      | Allow compact or provisional scenarios through the same controls.                                    |
| `src/app/debug/floor-viewer.ts`                    | Large       | Render reusable floor selection, entity and hint overlays, solution path, and findings.              |
| `src/app/debug/floor-workbench.ts`                 | Large       | Own transient JSON editing, generation controls, validation results, preview, export, and save UI.   |
| `src/app/debug/debug-tools.ts`                     | Small       | Register Viewer and Workbench through the existing catalog.                                          |
| `test/unit/content/floor/floor-catalog.test.ts`    | Medium      | Prove parsing, world assembly, and provisional content integration.                                  |
| `test/unit/content/floor/floor-validation.test.ts` | Large       | Prove invalid placements, locks, transitions, hints, and concrete solution output.                   |
| `test/unit/dev/tools/floor-set-generator.test.ts`  | Medium      | Prove seed determinism, arbitrary positive floor counts, and schema-compatible output.               |
| `test/unit/dev/tools/floor-authoring-api.test.ts`  | Large       | Prove request parsing, path confinement, validation-before-save, and generator delegation.           |

## Execution Outline

1. Define the authored contract and tile-definition table, convert raw hint metadata into a capability, strengthen face validation, and cover those contracts first.
2. Rename the pure generator and thin CLIs around the `floor-set` artifact, then register canonical package commands and committed VS Code tasks.
3. Extract reusable floor-set rendering, preserve the read-only Viewer, and add the Workbench with one draft shared by generation, editing, validation, and preview.
4. Add development-only authoring middleware whose pure request handler confines paths, delegates generation, and revalidates immediately before an explicit save.
5. Update design and plan ownership, including the deferred A06 environment-feature slice, then run focused content, endpoint, boundary, governance, browser, and aggregate verification.

## Implementation Notes

- The schema and validator must not contain a five-floor constant. Five is data in the provisional set; generator and validator accept any positive count, including one.
- Stable seed output includes deterministic identifiers and ordering. Candidate generation requires an explicit destination before CLI writing and never overwrites canonical content by default.
- Each generated floor is a corridor maze on odd coordinates with a few odd-aligned rooms carved over it, which adds open space without disconnecting anything. The floor's required route runs from its arrival cell to the farthest reachable cell, which carries the down stair or, on the deepest floor, the single goal enemy.
- Gating doors sit on that required route, and each matching key is placed in the region still reachable with its own door and every later one closed. That makes the floor solvable by construction rather than by search. Doors beyond the available keys land only on dead ends so they can never seal a key away, and spare keys and enemies take any remaining free reachable cell.
- The solver keeps only state that can change reachability. Key counts are derived from the collected and opened sets, and enemies and breakable walls are cleared on contact because both are unconditional and permanent. A solution therefore records each clearing step once, at its first occurrence.
- Directional hint faces use outward normals. Validation permits one face or two opposing faces, rejects duplicates, and requires every named face to have an in-bounds standable observation cell.
- Static tile definitions are one data table for glyph recognition, environment material, and collision. Interactive hot springs and stairs remain entity overlays; presentation-only annotations wait for A06.
- Workbench generation, editing, validation, preview, and export never write committed content. Export is a browser download of the validated draft text. Save is explicit, accepts only the canonical provisional path, and repeats parse and topology validation on the server before formatted JSON is written. Both leave the page only for a draft that validated as it currently reads.
- VS Code tasks call canonical package scripts and expose arguments through prompts. Tasks are discoverability adapters, not alternate command owners.

## Edge Cases

| Case                                                                    | Expected Handling                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Zero or negative requested floor count                                  | Reject without producing candidate content.                              |
| Negative requested key, door, or enemy count per floor                  | Reject without producing candidate content.                              |
| More doors requested per floor than the route has interior cells        | Gate what the route allows and place the remainder on dead ends.         |
| Requested density exceeds the validator's search budget                 | Report the undecided finding and refuse without reseeding.               |
| Malformed rows, unknown glyphs, duplicate IDs, or out-of-bounds records | Return deterministic error findings and refuse catalog assembly.         |
| Stair destination is missing, blocked, or not reciprocated              | Report an error and exclude the set from playable catalog creation.      |
| A required key is reachable only after its consuming door               | Report no structural solution with the blocking relationship identified. |
| A wall has zero, duplicate, non-opposing, or more than two hint faces   | Report a deterministic hint-configuration error.                         |
| A hinted face is outside the map or behind a permanent wall             | Report an invalid hint-face finding.                                     |
| Manual edits preserve schema but remove all goal paths                  | Validation fails and both authoring surfaces show the finding.           |
| Equal generation inputs                                                 | Produce byte-stable authored data after canonical formatting.            |
| A Workbench save is invalid or targets another path                     | Reject without writing any file.                                         |

## Acceptance Criteria

1. An explicit seed and any positive floor count deterministically produce schema-compatible candidate content, while production contains no generator code or seed input.
2. Two different seeds produce different floor geometry, and every returned candidate carries a concrete structural solution. Per-floor key, door, and enemy counts are set independently over the three fixed key colors, with exactly one goal enemy in the set.
3. The committed provisional five-floor set assembles into the canonical world contract and is playable through the normal session and command boundary.
4. Validation reports structural errors and returns at least one concrete legal start-to-goal path only when progression is solvable. A set too dense to decide within the search budget reports its own finding instead of exhausting memory or being reported as unsolvable.
5. Breakable walls expose a directional-hint capability with one face or two opposing faces while remaining attackable, damageable, and passable-after-destruction from every direction.
6. The Floor Set Viewer exposes all provisional floors, entities, hint faces, solution steps, and findings without color-only meaning.
7. The Floor Set Workbench can generate a random solvable draft, edit it, validate and preview it, export it as a file, and explicitly save valid canonical JSON, while invalid drafts and non-canonical paths cannot be written or exported.
8. Canonical CLI commands and VS Code tasks expose generation, its per-floor counts, and validation, and production excludes every debug and authoring surface.
