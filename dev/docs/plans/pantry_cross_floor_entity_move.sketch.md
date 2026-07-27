# Cross-Floor Gameplay Entity Move

Parent Plan: none (standalone sketch)

## Goal

Explore letting the Floor Set Workbench move an authored gameplay entity from one floor to another, so relocating an enemy, key, door, or stair one floor up does not require deleting it and re-authoring every field by hand.

## Requirements

1. An authored gameplay entity can be moved to a cell on a different floor without losing its identity or any of its kind-specific fields, because delete-and-recreate is the only path today and it silently discards combat values, colors, hint faces, and stair destinations.
2. The move keeps the entity's ID, so every inbound reference — a stair pointing at it, the floor set's goal entity — survives the move without the author repairing links afterwards.
3. Destination legality is enforced at the gesture that originates the move, on the destination floor, in the same way a same-floor move already refuses an occupied or impassable cell.
4. Structural validation stays on demand. A cross-floor move may leave the candidate unsolvable; that is the validator's job to report, not the move gesture's job to prevent.

## Summary

This is a standalone sketch: the authoring plan's boundary is direct editing of the selected floor, and `pantry_authoring_02` already shipped the same-floor move it owned. Cross-floor movement is a different seam — it makes an editing gesture span two floors, which is the first authoring operation that would — so filing it as a late child of a plan whose stated scope is the selected floor would stretch that plan rather than clarify ownership. If the authoring plan later adopts the work, this sketch moves into it as a child.

The favored direction is to widen the existing two-click move mode rather than add a new control. The Workbench already has a `Move Entity` button in the Cell Editor that arms a pending move and then commits on the next map click, and that pending state appears to already survive an internal floor switch. What fails is the commit: the mutation looks the entity up on the _destination_ floor and reports `Unknown gameplay entity`. So the visible gap is likely one missing piece of state — the source floor — plus a mutation that currently cannot span two floors.

The expected outcome if this holds up is small: the pending-move state carries a source floor alongside the entity ID, the authoring mutation takes a source and a destination floor, and the two-click gesture works unchanged across a floor switch. The later spec must verify the pending-state lifetime claim directly in the browser rather than by reading, because it depends on how the inspector re-renders on a floor switch.

## Sketch

### What likely blocks the move today

- `moveGameplayEntity` in `src/app/debug/floor-authoring.ts` takes a single `floorId` and resolves both the entity and the destination cell against that one floor. Its own doc comment says it moves an entity "within its current floor." The destination-floor lookup fails first, so the author sees an unknown-entity error rather than an illegal-cell error. Verify this is the whole failure, and not one of several.
- `src/app/debug/floor-workbench.ts` holds the pending move as `movingEntityId: string | undefined` with no floor beside it. The map's commit callback passes the rendered floor's ID, which is the _destination_, so once the author switches floors there is no longer any record of where the entity came from. A candidate shape is a `pendingMove: { entityId, floorId }` record instead of a bare ID.
- Nothing in the Workbench appears to clear `movingEntityId` when the inspector switches floors — the floor buttons are internal to `renderFloorSetInspector` in `src/app/debug/floor-viewer.ts` and re-render without notifying the Workbench. That is convenient here, but the spec author should confirm it by exercising the gesture rather than trusting this reading; the interaction object is built once per Workbench render and reused across internal floor switches, which is exactly the kind of detail that is easy to misread.

### Candidate shape for the mutation

- Give the authoring mutation an explicit source and destination floor. The same-floor case stays a special case of the general one rather than a separate function, which avoids two mutation paths that can drift apart.
- Cell legality on the destination floor is the destination floor's own question, and the existing per-floor cell check appears to already answer it. The `ignoredEntityId` argument that lets an entity move onto its own cell is only meaningful when source and destination are the same floor; a cross-floor move likely wants no exclusion at all. Verify the exact shape at spec time.
- The breakable-wall hint-face check runs against the floor the entity lands on, not the one it left. That is likely already correct if the check is simply passed the destination floor, but it is a real behavioral difference worth an explicit test: a hint-face configuration that was legal on the source floor can be illegal on the destination.

### Cross-floor references that ride along

- Entity IDs appear to be unique across the whole floor set, not per floor — the validator raises `entity.duplicateId` while walking every floor with one shared ID set. If that holds, a cross-floor move needs no rename and no ID collision handling, which removes the largest source of complexity this feature could have had. Verify before relying on it.
- A stair carries `destinationStairId`, so moving a stair to another floor keeps its outbound link and every inbound link intact by ID. What changes is the topology: a stair can end up on the same floor as its destination, which the reference validator does not obviously forbid — it only requires the destination to be a different stair. Whether the move gesture should refuse that, or leave it to structural validation, is a seam to inspect rather than an established rule.
- `goalEntityId` lives on the floor set, not on a floor, so moving the goal enemy to another floor should need no special handling — but it changes which floor terminates a run, and the removal path already carries a hard guard against touching the goal entity. Check whether that guard's reasoning extends to moves.
- The floor set's `initial` position is not an entity and should be unaffected. `pantry_scene_06_start_and_end_markers.sketch.md` owns making it authorable.

### Interaction and feedback

- The status line currently reports `Gameplay entity <id> moved.` A cross-floor move probably deserves to name both floors, because the author's map has changed underneath them and the confirmation is the only evidence of where the entity went.
- After the commit, the destination floor's Cell Editor should probably select the landing cell so the author can immediately edit what they just moved. Verify how selection is published today — the Workbench stores the inspector's selection but the inspector owns floor and cell state, so pushing a selection back in may not be a supported direction.
- The pointer-drag path in `src/app/debug/floor-map.ts` is same-floor by construction: it commits on `pointerenter` over another cell of the same rendered grid. It should stay that way. Cross-floor movement belongs to the two-click mode, which is the only gesture that can span a floor switch.
- Arming a move and then never committing it leaves the Workbench in move mode across floors. Consider whether the pending move should be visible outside the source floor's Cell Editor — the author may switch floors, forget, and have their next map click relocate an entity instead of selecting a cell.

### Candidate files to inspect

- `src/app/debug/floor-authoring.ts` for the move mutation and the shared cell and breakable-wall guards.
- `src/app/debug/floor-workbench.ts` for the pending-move state, the commit callback, and the status reporting.
- `src/app/debug/floor-map.ts` for the two commit paths — pointer drag and armed click — and the Cell Editor's move button label.
- `src/app/debug/floor-viewer.ts` for floor switching, selection publication, and whether a selection can be pushed in from outside.
- `src/content/floor/floor-validation.ts` for entity ID uniqueness scope, stair destination rules, and the goal entity rule.
- `test/unit/app/debug/floor-authoring.test.ts` and `test/e2e/floor-workbench.spec.ts` for where the same-floor move is covered today and where the cross-floor case would join it.

## Non-Goals

1. Do not add cross-floor movement for environment features. They have no move gesture at all today, and giving them one is separate work with its own anchor rules.
2. Do not add multi-entity selection, cut and paste, or a whole-floor content transfer. This is one entity, one destination.
3. Do not change the pointer-drag gesture into something that can leave its floor.
4. Do not change structural validation, stair topology rules, or what completes a run. Start and end markers belong to `pantry_scene_06_start_and_end_markers.sketch.md`; generator allocation belongs to `pantry_authoring_04` and `pantry_cross_floor_locks.sketch.md`.
5. Do not add undo for a move. The authoring plan already excludes undo history.
6. Do not treat this sketch's codebase claims as verified; the spec author re-checks each one against the current code.

## Acceptance Criteria

1. An authored gameplay entity can be moved to a cell on a different floor, and every field it carried before the move — including its ID, kind-specific values, and any stair destination — is unchanged afterwards.
2. Every reference to the moved entity, including an inbound stair link and the floor set's goal entity, still resolves after the move without the author repairing it.
3. A cross-floor move onto an out-of-bounds, impassable, or already-occupied destination cell is refused at the gesture, with a message that names the actual reason.
4. The draft is marked unvalidated after a cross-floor move, and Export and Save remain unavailable until the exact current draft validates again.
5. The author can tell from the on-screen confirmation which floor the entity left and which floor it landed on.
