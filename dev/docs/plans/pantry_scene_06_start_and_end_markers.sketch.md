# Start and End Markers

Parent Plan: `pantry_scene_authoring.plan.md`

## Goal

Explore making a floor set's start position and its completion condition both explicit, authorable markers, so level building stops depending on a fixed spawn corner and on "defeat the goal enemy" being the only way a run can end. This is the child that closes the parent plan's build-and-run loop: without authored markers, a run cannot be started from the surface that built the level.

## Summary

This sketch was written while it stood alone, before any plan owned run boundaries. It is now the last child of the scene authoring plan, which owns the editing surface and the live preview that a started run would appear in. The parent plan owns its requirements; what follows is the implementation-facing exploration only.

The two halves cost very different amounts and the spec author should expect to treat them separately even though they are explored together here.

The **start** half is close to free. The floor-set contract already carries an explicit initial floor, cell, and facing; nothing about the start is hardcoded in content. What is hardcoded is the generator's fixed entry corner and the absence of any Workbench control for editing the initial position. Making the start authorable is therefore ordinary authoring work with no rule change and no schema change.

The **end** half is a gameplay rule change. Completion is currently reachable only by reducing a combat entity to zero health, and the content contract enforces that the goal must name an enemy. Letting an authored end marker complete a run means changing how a run terminates, which the design document owns as a product decision and which overlaps the ending presentation owned by the feel plan. The spec author must settle that ownership question before writing a spec; it cannot be resolved inside this child's implementation.

The favored direction is to keep both halves in one child so the authoring surface gains a matched pair of markers at once, but to land the start half first if the end half's product decision is still open when implementation begins.

## Sketch

### Start half — likely shape

- The floor-set contract's initial floor, cell, and facing already exist and are already validated against a passable base tile, so the authoring work is exposing them, not inventing them. Verify that the validator's initial-position check is the only rule guarding this.
- The Workbench has no control for the initial position today. A candidate shape is a start marker rendered as a map overlay plus a control in the Cell Editor to make the selected cell the start, mirroring how gameplay entities are placed. Verify against how the current selection and direct-edit path applies mutations.
- The generator uses one fixed interior corner for both the initial cell and every floor's up-stair. Making the start authorable does not require the generator to randomize it, but the spec should decide whether the generator picks a start or keeps a deterministic corner.
- Facing is part of the start and has no control today. Likely reuses the four-cardinal control pattern already used for stair arrival facing and wall-decoration faces.

### End half — likely shape and the hard part

- Completion is currently expressed as a defeat outcome on a combat entity, and the run state's terminal resolution only fires from a combat result. An end marker that completes on entry is a different trigger path, not a new entity field on the existing one. Verify where terminal outcome resolution actually sits before assuming it can be reached from an interaction effect.
- The content contract names a single goal entity and the validator requires it to be an enemy; the authoring layer separately refuses to let the goal stop being an enemy. All three of those guards assume the enemy-defeat model and would need to change together.
- The structural validator's topology search treats reaching the goal as its terminal condition. An end marker changes what the search is searching for, so the validator and the generator's solvability check are both affected, not just the runtime.
- Whether an end marker replaces the goal enemy or coexists with it is a product decision, not an implementation choice. Coexistence implies a run can end two ways, which the design document's ending section does not currently contemplate.
- The design document defines the ending as the princess reaching zero health, and the feel plan owns the ending sequence. Reconcile both before the spec, and record the outcome in whichever of those documents owns it.

### Candidate files to inspect

- The floor content schema and its validator, for the initial position, the goal entity rule, and the topology search's terminal condition.
- The core run state, for how a terminal outcome is currently produced and whether a non-combat trigger can reach it.
- The authoring mutation module and Cell Editor, for how a marker control would apply and what guards currently protect the goal.
- The offline generator, for the fixed entry corner and its per-floor stair placement.
- The design document's ending section and the feel plan's ending child, for ownership of what completes a run.

## Non-Goals

1. Do not design the ending presentation, statistics, or death screen; the feel plan owns those.
2. Do not add multiple simultaneous start positions or per-floor spawn points.
3. Do not change enemy behavior, combat, or the damage formula in order to remove the goal enemy.
4. Do not fold generator totals or dimensions into this work; `pantry_authoring_04` owns them. Cross-floor locks belong to `pantry_cross_floor_locks.sketch.md`.
5. Do not build the preview surface or the placed camera a started run would use; earlier children of the parent plan own both.
6. Do not treat this sketch's codebase claims as verified; the spec author re-checks each one.

## Acceptance Criteria

1. A floor set's start position and facing are authorable without editing JSON by hand, and the authoring map shows where the start is.
2. A run's completion condition is authorable as an explicit marker rather than being implied by one enemy's identity.
3. Structural validation continues to prove that a generated or hand-authored candidate can be completed, under whichever completion model is chosen.
4. Whatever completion model is chosen is recorded in the document that owns it before implementation begins.
