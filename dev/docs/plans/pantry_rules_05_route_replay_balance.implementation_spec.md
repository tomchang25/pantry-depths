# Provisional Route Replay and Balance Evidence

Parent Plan: `pantry_rules.plan.md`

## Goal

Add a deterministic forced-route replay for the provisional floor set and use its canonical command results to make progression and health costs inspectable. Generate the balance report from current rules and content so it exposes provisional evidence now and remains useful when the independent final-floor design plan replaces the floor layout.

## Summary

The provisional route will be an authored harness fixture: a fixed sequence of normal player commands with named checkpoints through the two early upgrades, the B4 convergence upgrades, the route door, and the princess. The replay engine dispatches every command through a fresh `GameSession`, recording before and after snapshots, accepted or rejected results, and semantic events. It stops at the first rejected command or terminal outcome, so a content edit that invalidates the route produces evidence instead of silently discovering a replacement path.

The development-only Route Replay viewer will show the resulting checkpoints, player stage, health, keys, opened entities, accumulated cost, and final outcome. The report generator will consume that same replay plus canonical combat content and floor validation to overwrite the existing balance-report skeleton with the enemy table, cost matrix, provisional route budget, topology status, floor placements, and route membership. All displayed numbers remain derived from the real core and content owners; the report will explicitly identify the result as provisional rather than claiming the final-floor plan's balance target.

## Relational Context

- `GameSession.dispatch()` remains the sole mutable command gateway. The replay engine records its returned `CommandResult`; it must never call the core resolver with a separately maintained snapshot or modify a `RunSnapshot` directly.
- The forced route is a harness-owned scenario over `PROVISIONAL_RUN_WORLD`, not authored floor data or a new gameplay rule. The independent final-floor design plan owns final required-route annotations and may replace this provisional fixture when final content lands.
- `PROVISIONAL_FLOOR_VALIDATION.solution` proves structural reachability only. The replay and generated report consume its findings as topology evidence but use their own canonical command trace for facing, retaliation, attack penetration, health, and victory evidence.
- The Route Replay viewer and the report generator both consume the replay result; neither recalculates command outcomes, health cost, keys, door state, or player upgrades from copied rules.
- The viewer is registered through the one debug catalog and stays behind the existing deferred development route boundary. No ordinary or production route imports harness code.
- The report generator is a development tool that imports the harness scenario through the Vite-node alias configuration. It owns deterministic HTML rendering and the one explicit write to `dev/docs/reports/pantry_depths_balance.html`; the generated HTML is a human-readable view, never a rules or content authority.

## Scope

### Included

- A reusable command-replay trace with explicit rejection and terminal handling.
- One provisional forced route and named progression checkpoints.
- Development-only route replay inspection.
- A regenerable balance-report command and generated report populated from canonical content, core combat projections, topology validation, and route replay evidence.
- Focused harness and generator tests.

### Excluded

- Final floor geometry, enemy placement, required-route annotations, or balance tuning.
- Automatic pathfinding, alternate-route recovery, or treating topology output as a combat simulation.
- Gameplay-rule, session, content-schema, renderer, HUD, production-route, or browser-automation changes.

## Files to Change

| File                                                  | Change Size | Purpose                                                                          |
| ----------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `src/harness/route-replay.ts`                         | Medium      | Replay normal commands and retain the canonical per-command trace.               |
| `src/harness/provisional-route.ts`                    | Medium      | Own the fixed provisional scenario and named checkpoints.                        |
| `src/app/debug/route-replay.ts`                       | Large       | Render replay evidence for development inspection.                               |
| `src/app/debug/debug-tools.ts`                        | Small       | Register the deferred Route Replay viewer.                                       |
| `dev/tools/generate-balance-report.ts`                | Large       | Render and write the deterministic human-readable report.                        |
| `package.json`                                        | Small       | Expose the canonical report-generation command.                                  |
| `dev/docs/reports/pantry_depths_balance.html`         | Large       | Hold generated evidence rather than the skeleton placeholders.                   |
| `test/unit/harness/route-replay.test.ts`              | Medium      | Prove deterministic canonical replay and failure handling.                       |
| `test/unit/dev/tools/generate-balance-report.test.ts` | Medium      | Prove report content comes from canonical evidence and contains no placeholders. |
| `dev/docs/plans/pantry_rules.plan.md`                 | Small       | Point the A05 child overview at this executable handoff.                         |

## Execution Outline

1. Add the generic replay trace and provisional forced-route fixture, then cover deterministic replay, expected progression, victory, and route-invalidity behavior with harness tests.
2. Add the development-only viewer through the existing catalog so route checkpoints and final evidence are inspectable from the real trace.
3. Build the report renderer and explicit Vite-node command around the replay, combat projections, content catalog, and topology validation; regenerate the committed HTML.
4. Add generator assertions, update the parent handoff, and run documentation, focused, boundary, and aggregate verification.

## Implementation Notes

- The fixture includes only `GameCommand` inputs and checkpoint labels. Expected HP, costs, stats, keys, door state, and victory are test assertions or derived report fields, never fixture-owned duplicate truth.
- Trace records must preserve rejected results as observations, then stop. A terminal accepted result also ends the replay, preventing commands after death or victory from being presented as valid progress.
- A route checkpoint is represented by the replay position after its declared command, including the initial checkpoint. Accumulated cost is derived from initial maximum health and the checkpoint snapshot; a stage label derives from the canonical ordered player stages.
- The generator must deterministically escape authored display text and write only the known report path. It should report topology findings separately from route replay status: structural validity cannot imply survivability.
- The generated report keeps the existing Traditional Chinese audience and accessible text/table semantics. Report values must be readable without relying on color alone.

## Edge Cases

| Case                                                         | Expected Handling                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| A fixture command is rejected after a floor edit             | Preserve the rejected result, stop the trace, and render the rejection as failed route evidence.             |
| The player dies or reaches victory before fixture exhaustion | Preserve the terminal result and stop without dispatching later commands.                                    |
| A player stat combination does not match a canonical stage   | Render an explicit unmatched label instead of inventing a stage.                                             |
| Topology has errors or no structural solution                | Report the findings and failed topology status while still rendering replay evidence when it can be created. |
| An entity is inactive at a checkpoint                        | Show its active state from the snapshot; do not infer it from route labels.                                  |
| An enemy is impossible to defeat at a player stage           | Keep the core projection's impassable result and render it as such.                                          |

## Acceptance Criteria

1. Replaying the same provisional forced route from fresh canonical sessions produces equal traces and reaches the route's declared terminal outcome without rejected commands.
2. Each replay checkpoint exposes the real stage, health, keys, door/entity activity, accumulated health cost, and semantic events at that point.
3. A changed route that rejects a command or ends terminally cannot continue and is visibly reported as invalid evidence.
4. The development Route Replay surface reads the canonical replay trace and remains unavailable from ordinary and production routes.
5. One command regenerates a report that contains the current enemy table, full combat matrix, provisional route budget and checkpoints, topology findings, floor placements, and route membership without hand-maintained gameplay numbers or skeleton placeholders.
6. The report distinguishes structural topology status from route combat and survivability evidence, and labels the latter as provisional until the independent final-floor design plan finalizes content.
