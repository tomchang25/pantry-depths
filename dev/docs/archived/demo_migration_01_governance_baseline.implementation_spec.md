# Demo Migration 01 — Governance Baseline

Parent Plan: `demo_migration.plan.md`

## Goal

Put the migration's ground truth in place before anything moves: the structure addendum stops describing a repository that no longer exists, and the demo tree gets machine-checked import boundaries describing exactly what it does today, so every later child tightens a watched rule instead of moving code through a hole no checker sees.

## Summary

Documentation and configuration only; no live module changes, so no playtest.

- **Structure addendum truth-restoration.** The addendum still declares `port-ref/` as a root tree (the directory was deleted), calls `src/core/` and `src/content/` empty, and lists `src/presentation/` as absent. All rows are updated to the tree that exists. `src/demo/` — today the repository's only unbounded tree — is declared with its migration status and end state; `src/runtime/` and `src/ui/` are pre-declared as layers the migration plan earns; the no-React bullet that pins the HUD inside the demo tree is flagged for rewriting by child 7; and the plan's accepted deviation — the rules stay real-time and random as they move into core — is recorded as a declared deviation so the platform's determinism expectation is superseded on paper before child 6 needs it.
- **Boundary rules for the demo tree.** Two dependency-cruiser rules pin today's verified reality: the demo imports only itself, presentation, content, and core; nothing imports the demo except the app layer (bootstrap plus the debug workbenches). Prose and rule land in the same commit per the platform enforcement pairing.
- **Dead-reference sweep for `port-ref/`.** The deleted directory is still named by the addendum, `tsconfig.json`'s exclude list, the linter's ignore list, and the README (which also still claims the game layers are unimplemented). All four stop referring to it; the README claim is corrected minimally in passing.
- **Bootstrap comment correction.** The bootstrap's header comment names `src/harness/` as its wiring point; that layer does not exist. Comment-only edit.

## Relational Context

- The platform structure standard owns layer vocabulary and boundary rules; the addendum records only trees the standard does not name and declared deviations. The demo tree is declared in the addendum for the same reason the sandbox tree is: the platform vocabulary does not name it.
- Boundary prose and `.dependency-cruiser.cjs` must change in the same commit — the platform enforcement section forbids the two drifting apart.
- The new rules must describe current imports exactly, not aspirationally. Verified baseline (2026-08-03): every `src/demo/` import resolves into `src/(demo|presentation|content|core)/`; every importer of `src/demo/` sits in `src/app/` (`main.ts` plus eight debug workbenches). A rule wider than reality hides drift; a rule narrower than reality fails `verify` immediately.
- `dev/tools/check_governance.py` pins no strings in the structure addendum, but its frozen-reference scan covers `dev/standards/` — the edited addendum must not name the two frozen directories.
- The randomness deviation and the runtime/ui pre-declarations are forward statements about plan children; they must be worded as owned by the migration plan, not as descriptions of the current tree.
- The no-React bullet is flagged, not rewritten — child 7 owns that rewrite when the HUD actually moves.

## Scope

### Included

- Structure addendum: `port-ref/` removal, layer-status truth, demo-tree declaration, runtime/ui pre-declaration, randomness deviation, child-7 flag.
- Two dependency-cruiser rules for `^src/demo/`.
- Dead `port-ref/` references in `tsconfig.json`, `.oxlintrc.json`, `README.md`.
- The bootstrap's stale `src/harness/` comment.

### Excluded

- Any file move, rename, or code change in `src/`.
- The no-React bullet rewrite (child 7), the guard test, both operation contracts (child 8).
- Any README rewrite beyond the dead references and the false scaffold-only claim.

## Files to Change

| File                                          | Change Size | Purpose                                                      |
| --------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `dev/standards/project_structure.addendum.md` | Medium      | Truth-restoration, demo-tree declaration, deviations         |
| `.dependency-cruiser.cjs`                     | Small       | Two baseline rules for the demo tree                         |
| `tsconfig.json`                               | Small       | Drop dead `port-ref` exclude                                 |
| `.oxlintrc.json`                              | Small       | Drop dead `port-ref` ignore                                  |
| `README.md`                                   | Small       | Drop dead `port-ref` references and the stale scaffold claim |
| `src/app/main.ts`                             | Small       | Comment-only: stop naming a layer that does not exist        |

## Execution Outline

1. Addendum first — it is the prose half of the enforcement pairing and the source the rule comments cite.
2. `.dependency-cruiser.cjs` rules in the same change; run `npm run check:boundaries` alone to prove the baseline matches reality before the full gate.
3. Dead-reference sweep and the bootstrap comment.
4. `npm run verify` and `npm run check:governance`, reported separately.

## Implementation Notes

- Rule shapes: from `^src/demo/` to `^src/` with `pathNot ^src/(demo|presentation|content|core)/` (error), and from `^src/` with `pathNot ^src/(demo|app)/` to `^src/demo/` (error). Core is allowed in the first rule although the demo imports none of it today — the migration's own children route through core, and the rule's job is stopping new outward reach, not freezing the inward direction the plan is about to use.
- Keep the existing cruiser file's comment style: each rule names why it exists and points at the owning document.
- The addendum's demo-tree section should state the end state (projection half awaiting the 3D runtime decision) so the declaration does not need editing again until child 8.

## Acceptance Criteria

1. The structure addendum describes only directories that exist, and every layer row's status matches the tree.
2. The boundary check passes with the two new rules active, proving the declared baseline is the real one.
3. No file in the repository references the deleted prototype directory outside history documents.
4. The aggregate gate and the governance check both pass; no runtime behaviour changes.
