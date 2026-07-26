# Offline Tooling Ownership and Boundary Enforcement

Parent Plan: `pantry_rules.plan.md`

## Goal

Return the derived-balance model to its domain owner, separate reusable tooling implementation from executable entrypoints inside `dev/tools/`, and bring the offline tooling tree under the machine-checked import boundary so placement stops depending on reviewer memory.

## Summary

`dev/tools/` is the only tree in this repository whose layering is not machine-checked: `check:boundaries` cruises `src` alone. Typecheck, lint, and unit tests do cover it, so the gap is specifically layering. Three consequences have already landed and A06 will enlarge all of them, because it edits floors and routes repeatedly and re-runs this exact tooling each time.

| Symptom                                                                                                                                                                                           | Evidence                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The report generator is an entrypoint and a library at once, and derives balance facts — stage identity, accumulated cost, opened-door state, route membership — that no other consumer can reach | It exports its renderer for a unit test and needs a `process.env.VITEST` guard to avoid writing the report during that test                                        |
| A 498-line maze/graph authoring algorithm sits as a peer file of 32- and 50-line CLI entrypoints, with no path or naming signal separating implementation from entry                              | `dev/tools/floor-set-generator.ts` beside `dev/tools/run-floor-authoring-request.ts` and `dev/tools/validate-floor-set.ts`                                         |
| The development authoring API root is written out three times with nothing holding the copies equal                                                                                               | `dev/tools/floor-authoring-api.ts`, `vite.config.ts`, and `src/app/debug/floor-workbench.ts` each declare `/__debug/floor-set`                                     |
| `only-app-imports-harness` is factually "app and dev/tools", and the boundary rules do not say so                                                                                                 | The report generator imports `src/harness/` from outside the cruised tree, through relative `../../src/` paths that bypass the alias visibility the standard wants |

None of this was forced by the structure addendum. That addendum requires only that no generator ships in `src/` and that the balance simulation is a harness scenario driven by a `dev/tools/` script. It never placed the analysis or the serialization inside the CLI.

The change establishes one rule — **a file directly under `dev/tools/` is an entrypoint; reusable implementation lives in a named subdirectory of it** — and moves code to match. The structured balance model becomes a harness module that the report, the tests, and any future debug viewer read from one place. HTML serialization becomes a tooling module with no CLI lifecycle. The floor generator and authoring API move into a `floor-set/` subdirectory that also owns the API-root constant. `check:boundaries` is then extended over `dev/tools/` with rules that state the real permitted directions, so the next misplacement fails a gate instead of a review.

Behavior does not change. The landed result is the same commands producing the same output: regenerating the balance report after the refactor must leave the committed HTML byte-identical, and floor generation, validation, and workbench save must behave exactly as before.

## Relational Context

- The harness module owns the derived balance model and is the single authority for stage identity, accumulated health cost, opened-entity state, and route membership. Both the HTML serializer and any later debug viewer read that model; neither recomputes those values from snapshots. The model derives from the existing replay, content catalog, and core projection owners and adds no gameplay rule.
- Call direction is one-way: `dev/tools/` imports `src/`, and `src/` never imports `dev/`. The report entrypoint calls the model, then the serializer, then writes; the serializer performs no filesystem access and no analysis.
- `dev/tools/` is the second sanctioned importer of `src/harness/` after `src/app/`. The boundary configuration must state this explicitly rather than leaving it true only because the tree is uncruised.
- `src/app/debug/floor-workbench.ts` is client code and must not import `dev/`. It keeps its own API-root literal; a unit test imports both the client literal and the tooling constant and asserts equality. This is the only sanctioned duplication of that string, and `vite.config.ts` must import the tooling constant rather than declare a third copy.
- The Vite development middleware keeps spawning the authoring request runner as a child process. Path constants in `vite.config.ts` are updated for the moved files; the process protocol is unchanged.
- The `process.env.VITEST` guard exists only because the entrypoint is also imported as a library. Once the model and serializer move out, the entrypoint exports nothing and the guard is deleted rather than relocated. Tests import the model and serializer directly.
- The structure addendum and `dev/README.md` currently describe `dev/tools/` as validators and as the home of the bake script. Both must be updated in the same change to describe the entrypoint/implementation split, per the standard's rule that boundary prose and boundary configuration change together.
- The VS Code tasks own a six-flag parameter surface over the floor-set CLI. That surface is now covered by the Floor Workbench, so the tasks lose it and keep only invocations that add no parameters of their own.

## Scope

### Included

- A harness-owned structured balance model, extracted from the report generator with no numeric change.
- Serialization-only HTML rendering, separated from analysis, filesystem access, and CLI lifecycle.
- A `dev/tools/` entrypoint/implementation split, with the floor generator, authoring API, and API-root constant moved under it.
- Boundary enforcement extended over `dev/tools/`, with the permitted import directions written into both the rule configuration and the governance prose.
- Test relocation and one new test pinning the duplicated API root.
- VS Code task reduction to parameterless invocations.

### Excluded

- Any change to gameplay rules, authored content, floor geometry, route fixtures, generation output, validation findings, or report values.
- Adding a Balance Report tool or a regenerate action to the debug hub. That depends on this landing and is separate work.
- Creating new root trees under `dev/`, renaming npm scripts, or changing the `verify` stage list.
- A06 content work.

## Files to Change

| File                                          | Change Size | Purpose                                                                              |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `src/harness/balance-analysis.ts`             | Large       | Own the structured balance model derived from replay, content, and core projections. |
| `dev/tools/balance/report-html.ts`            | Medium      | Serialize the model to HTML; no analysis, no filesystem, no lifecycle.               |
| `dev/tools/generate-balance-report.ts`        | Medium      | Reduce to model, serialize, write, exit status.                                      |
| `dev/tools/floor-set/generator.ts`            | Small       | Move the offline authoring algorithm out of the entrypoint level.                    |
| `dev/tools/floor-set/authoring-api.ts`        | Small       | Move the request handler and filesystem dependency factory.                          |
| `dev/tools/floor-set/api-contract.ts`         | Small       | Own the development authoring API root.                                              |
| `dev/tools/generate-floor-set.ts`             | Small       | Update the moved import.                                                             |
| `dev/tools/run-floor-authoring-request.ts`    | Small       | Update the moved imports.                                                            |
| `vite.config.ts`                              | Small       | Import the API root and the moved runner paths instead of redeclaring them.          |
| `.dependency-cruiser.cjs`                     | Medium      | Add the tooling tree rules and adjust the orphan exemption for entrypoints.          |
| `package.json`                                | Small       | Extend the boundary check over the tooling tree.                                     |
| `.vscode/tasks.json`                          | Medium      | Drop the duplicated flag surface.                                                    |
| `dev/standards/project_structure.addendum.md` | Small       | Record the entrypoint/implementation split and the sanctioned harness importer.      |
| `dev/README.md`                               | Small       | Correct the `dev/tools/` ownership line.                                             |
| `test/unit/harness/balance-analysis.test.ts`  | Medium      | Prove the model's derived fields against canonical evidence.                         |
| `test/unit/dev/tools/*`                       | Medium      | Relocate to mirror moved paths; add the API-root equality test.                      |

## Execution Outline

1. Extract the balance model into the harness and cover its derived fields with focused tests, leaving the report generator calling it. The report output must not change at this beat.
2. Split the serializer out of the report generator, delete the `process.env.VITEST` guard, and repoint the generator test at the model and serializer. Regenerate the report and confirm an empty diff.
3. Move the floor generator, authoring API, and API-root constant into the tooling subdirectory; update the CLI entrypoints, the process adapter, and the Vite configuration; relocate the affected tests.
4. Add the API-root equality test, then extend the boundary check over the tooling tree and add the direction rules. Fix any placement the newly enforced rules reject rather than widening a rule.
5. Reduce the VS Code tasks, update the addendum and `dev/README.md` in the same beat as the rule configuration, and run governance, boundary, and aggregate verification.

## Implementation Notes

- The model is a plain data structure: enemy rows, the stage-by-enemy cost matrix, route checkpoint observations, route and topology status, floor placements, and bypassable enemies. It carries no HTML, no escaping, and no display strings that only a report would need. Impassable combat results stay as the core projection reports them; the model must not substitute a placeholder.
- HTML escaping stays with the serializer, since it is a serialization concern. The serializer must remain deterministic — no timestamps, no environment reads — because the empty-diff regeneration check depends on it.
- Extending the cruise over `dev/tools/` will surface the `no-orphan-modules` warning for CLI entrypoints, which nothing imports by design. Extend the existing orphan exemption to cover them; do not silence the rule globally.
- Keep `vite.config.ts` outside the cruised set. It is build configuration, and cruising it would pull the Vite plugin graph into the boundary result.
- The report output path stays resolved against the process working directory, and the npm script keeps its Prettier pass over the generated file.
- Moves are moves. Resist rewriting the maze generator, the request handler's error mapping, or the checkpoint derivation while relocating them; any behavior change in this child is a defect.

## Edge Cases

| Case                                                                         | Expected Handling                                                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Regenerating the report after the move produces a non-empty diff             | Treat as a defect in the extraction, not as new evidence; the refactor is behavior-preserving by definition.      |
| The newly enforced boundary rejects an existing tooling import               | Move the code to the owner the rule names. Widening the rule to admit the current placement is not an option.     |
| The client workbench literal and the tooling API root diverge                | The equality test fails. Fix the client literal; do not make client code import the tooling tree to satisfy it.   |
| A tooling entrypoint is reported as an orphan module                         | Extend the orphan exemption to the entrypoint level only, keeping the rule active for implementation modules.     |
| The replay stops early because content changed while this child is in flight | The model still reports the unreached checkpoints; the extraction does not add recovery or substitute-path logic. |
| A future consumer needs a balance value the model does not expose            | Add the field to the model, not to the serializer. The serializer never derives.                                  |

## Acceptance Criteria

1. Regenerating the balance report before and after the change produces identical committed output, and floor generation, validation, and workbench save behave as before.
2. The derived balance model has one owner in the game layer, is unit-tested directly, and is the only place stage identity, accumulated cost, opened-entity state, and route membership are computed.
3. Report serialization performs no analysis, no filesystem access, and no process lifecycle work, and no module needs to detect the test runner to stay safe to import.
4. Every file directly under the offline tooling tree is an executable entrypoint, and every reusable implementation module sits in a named subdirectory of it.
5. The development authoring API root has one owning declaration, the development server reads it rather than restating it, and the one remaining client copy is held equal by a test.
6. The import boundary check covers the offline tooling tree, rejects an import from the game layer into it, and states the permitted directions in the same change as the prose that describes them.
7. Editor tasks invoke existing commands without owning parameters, defaults, or behavior of their own.
