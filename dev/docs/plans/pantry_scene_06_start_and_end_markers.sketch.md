# Start and Exit Markers

Parent Plan: `pantry_scene_authoring.plan.md`

## Goal

Explore making a floor set's start position and its exit both placeable from the authoring surface, so level building stops depending on a fixed spawn corner and on hand-editing JSON to say where a run ends. This is the child that closes the parent plan's build-and-run loop: without placeable markers, a run cannot be started from the surface that built the level.

## Summary

This sketch was written while it stood alone, before any plan owned run boundaries, and it originally carried two halves of very different cost. That is no longer true — **the expensive half has been removed from this child.**

The completion model is settled: a run ends by interacting with an authored exit, not by defeating a goal enemy. The design document owns that decision, and the rule that implements it — the exit entity kind, the terminal interaction effect, the validator's terminal condition, and the deletion of the princess archetype — lands as standalone work well before this child, because `pantry_feel_04` and `pantry_floor_design_01` both need it first. See `pantry_run_exit.sketch.md`.

What remains here is authoring. Both halves are now the same kind of work: expose an existing content field through the map and the Cell Editor. Neither changes a gameplay rule, and neither changes the content schema beyond what the exit rule already introduced.

## Sketch

### Start marker — likely shape

- The floor-set contract's initial floor, cell, and facing already exist and are already validated against a passable base tile, so the authoring work is exposing them, not inventing them. Verify that the validator's initial-position check is the only rule guarding this.
- The Workbench has no control for the initial position today. A candidate shape is a start marker rendered as a map overlay plus a control in the Cell Editor to make the selected cell the start, mirroring how gameplay entities are placed. Verify against how the current selection and direct-edit path applies mutations.
- The start marker is an authoring-only overlay: visible on the map and in the live preview while editing, absent from a real run. Verify where that distinction can live without teaching the renderer about authoring state.
- The generator uses one fixed interior corner for both the initial cell and every floor's up-stair. Making the start placeable does not require the generator to randomize it, but the spec should decide whether the generator picks a start or keeps a deterministic corner.
- Facing is part of the start and has no control today. Likely reuses the four-cardinal control pattern already used for stair arrival facing and wall-decoration faces.

### Exit marker — likely shape

- By the time this child runs, the exit is an ordinary gameplay entity with a cell, so placing it should follow the same path as placing a key, a door, or a stair. Verify that assumption against whatever shape the exit rule actually landed; if the exit ended up as a floor-set field rather than an entity, the control looks more like the start marker than like entity placement.
- Unlike the start, the exit is visible in play. It needs no authoring-only rendering path, but it does need a map legend entry.
- A set with no exit, or with an unreachable one, is already a validation error by then. The authoring surface should surface that the same way it surfaces other structural violations rather than inventing its own guard.

### Candidate files to inspect

- The floor content schema and its validator, for the initial position and the exit's structural rules.
- The authoring mutation module and Cell Editor, for how a marker control applies and what guards exist around structural entities.
- The map overlay layer, for how a non-gameplay authoring marker is drawn beside real entities.
- The offline generator, for the fixed entry corner and its per-floor stair placement.
- The live preview and placed camera from earlier children, for starting a run from the editor.

## Non-Goals

1. Do not implement, revisit, or extend the exit rule itself; `pantry_run_exit` owns the entity, the terminal interaction, and the validator change.
2. Do not add unlock conditions to the exit. Those are recorded in `dev/docs/design/pantry_depths_v2_direction.md` and are not V1 scope.
3. Do not design the leaving presentation, statistics, or death screen; the feel plan owns those.
4. Do not add multiple simultaneous start positions or per-floor spawn points.
5. Do not fold generator totals or dimensions into this work; `pantry_authoring_04` owns them. Cross-floor locks belong to `pantry_cross_floor_locks.sketch.md`.
6. Do not build the preview surface or the placed camera a started run would use; earlier children of the parent plan own both.
7. Do not treat this sketch's codebase claims as verified; the spec author re-checks each one.

## Acceptance Criteria

1. A floor set's start position and facing are placeable without editing JSON by hand, and the authoring map shows where the start is.
2. The start marker is visible while editing and absent from a real run.
3. The exit is placeable and movable from the same surface, with a legend entry that distinguishes it from a stair.
4. Structural validation continues to prove that a generated or hand-authored candidate can be completed, and the authoring surface reports a missing or unreachable exit through its existing violation path.
5. A run can be started from the authoring surface using the placed start.
