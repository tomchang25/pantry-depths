# Layered Authoring Map Foundation

Parent Plan: `pantry_authoring.plan.md`

## Goal

Make the floor workbench understandable before it becomes editable by placing a layered authored-floor map ahead of the JSON text and pairing cell selection with a complete read-only Cell Inspector. Preserve the existing draft, validation, export, and canonical-save contracts while establishing the projection that later editing children will mutate.

## Summary

The Floor Set Workbench will lead with the current draft's floor map immediately below the generator controls. Numbered floor buttons replace the dropdown, selecting a map cell opens a responsive Cell Inspector, and the map uses primary terrain/gameplay symbols plus compact environment markers so co-located authored records remain discoverable without crowding each cell.

Breakable walls remain visibly distinct from permanent terrain and expose their directional hint faces in the authoring inspector. Environment features remain semantic authoring metadata: the map identifies tile decorations, wall-face decorations, ambient lights, and effect emitters, while the inspector reports their anchors and preset IDs without simulating final presentation.

This child is read-only with respect to the map and inspector. JSON remains the only editable draft surface until the next child, full structural validation stays on demand, and Save or Export remains enabled only for the exact text that most recently produced a valid structural solution. The standalone Floor Set Viewer uses the same authored-map projection, but the runtime Action Viewer and future Canvas minimap are unchanged.

This child establishes the functional authored-map structure and localized responsive composition only. The shipped standalone Debug Surface Shell owns the polished page chrome, shared visual tokens, reusable panels and controls, Debug Hub redesign, and migration of every debug scene; that work may replace local presentation styles without changing this child's projection or selection contracts.

## Relational Context

- `floor-workbench` owns the current JSON text and validation gate. The new map and inspector read a parsed projection of that text; they do not create another draft or mutate authored content in this child.
- Schema parsing and structural validation remain separate operations. A schema-valid text edit may refresh the read-only map without running topology validation, while any text change invalidates the prior Save/Export authorization and removes solution-route evidence until the exact current text is validated again.
- Invalid JSON or schema input must not leave a stale map that appears to represent the current draft. The workbench reports the parse problem and clears the current authored projection while retaining the text for correction.
- The authored map consumes `FloorSource` directly and preserves all four tile meanings, the complete `GameplayEntitySource` union, every `EnvironmentFeatureSource`, and optional solution membership. It is a debug authoring projection, not a gameplay or presentation authority.
- A gameplay entity remains the primary occupant symbol, but environment badges and inspector records remain visible when environment features share that cell. Multiple environment features are never collapsed into one editable identity.
- A permanent solid tile and a `breakableWall` are different authored records. The authoring projection displays the latter distinctly and exposes `hintFaces`; it does not apply the future gameplay minimap's disguise rule.
- Floor and cell selection are local presentation state. Switching floors keeps selection valid for the chosen floor or clears it explicitly; it never changes the floor-set initial location or any authored coordinate.
- The Floor Set Viewer and embedded Workbench view call the same map projection and DOM rendering owner. The Action Viewer continues to render `RunWorld` plus `RunSnapshot` independently because runtime active state and authored-source metadata are different contracts.
- No `shared` or `presentation` layer is created for a future consumer. Extraction may happen only after a current non-debug renderer demonstrates the cross-layer ownership.
- The shipped independent Debug Surface Shell hosts and styles this viewer and workbench, but it does not own authored-cell semantics, floor selection, draft parsing, validation evidence, or inspector content. This map remains a debug authoring owner rather than a generic map component.
- Selectable map cells and numbered floor controls must be keyboard reachable, visibly focused, and text-labelled. Color, badges, and borders supplement rather than replace the Cell Inspector and legend.

## Scope

### Included

- Layer-aware authored-floor cell projection and reusable debug DOM map rendering.
- Numbered, wrapping floor selection controls.
- Read-only cell selection and a responsive Cell Inspector for terrain, gameplay, environment, and face metadata.
- A complete legend for primary symbols, environment badges, route evidence, and selection indicators.
- Workbench layout with the draft map before the JSON editor.
- Distinct and explicit Save versus Export labels and explanations.
- Focused pure projection tests and manual keyboard/layout verification.

### Excluded

- Terrain painting or any mutation from the map or Cell Inspector.
- Gameplay-entity placement, dragging, removal, or field editing.
- Environment-feature placement, removal, anchor editing, or preset editing.
- Generator count changes or link controls.
- Action Viewer refactoring, gameplay minimap behavior, discovery filtering, and Canvas presentation.
- Final decoration, light, particle, or atmosphere previews.
- Per-floor width or height controls and resize behavior.
- Project-wide debug page chrome, theme tokens, Hub cards, and migration of other debug scenes; the shipped Debug Surface Shell owns those surfaces.

## Files to Change

| File                                    | Change Size | Purpose                                                                                                                |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/app/debug/floor-map.ts`            | Large       | Own the pure authored-cell projection, layered DOM grid, selection contract, legend, and inspector.                    |
| `src/app/debug/floor-viewer.ts`         | Large       | Compose validation and structural-solution evidence around the shared authored map and floor buttons.                  |
| `src/app/debug/floor-workbench.ts`      | Large       | Reorder the workbench, render schema-valid draft projections independently of validation, and clarify departure paths. |
| `test/unit/app/debug/floor-map.test.ts` | Medium      | Prove the pure cell projection preserves terrain, gameplay, environment, hint-face, and co-location semantics.         |

## Execution Outline

1. Introduce the authored-floor projection and focused unit tests first, including co-located gameplay/environment records and breakable-wall hint faces, so the DOM refactor relies on a proven semantic shape.
2. Build the selectable semantic grid, complete legend, and read-only Cell Inspector around that projection with keyboard-accessible cells and responsive composition.
3. Refactor the Floor Set Viewer to use numbered floor controls and the new map while retaining all findings and structural-solution evidence.
4. Refactor the Workbench so a schema-valid current draft renders above the JSON editor without triggering structural validation; preserve exact-text Save/Export gating and clear stale map/solution evidence on invalid or changed text.
5. Add explicit Export and canonical-overwrite explanations, then run focused projection tests, aggregate verification, and a manual development-route check for keyboard selection, reflow, and label completeness.

## Implementation Notes

- Keep projection logic free of DOM globals so Vitest's Node environment can test it without adding a browser emulator.
- Model a cell with separate base, optional gameplay entity, environment-feature collection, solution membership, and derived authoring indicators. Do not reuse the current single `primary` presentation shape as the data contract.
- Environment markers identify semantic kinds only. Exact feature IDs, wall faces, and preset IDs belong in the selected-cell inspector and accessible labels.
- Use one selected cell per chosen floor. Floor changes must never reuse an out-of-bounds coordinate, and rerendering the same parseable draft should preserve a still-valid selection.
- Keep topology findings and route steps outside the map owner. The caller supplies solution cells only when they belong to the exact validated text currently displayed.
- Save copy must name the canonical target and say that it overwrites. Export copy must say that it downloads a file and leaves canonical content unchanged.

## Edge Cases

| Case                                                                 | Expected Handling                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A gameplay entity and one or more environment features share a cell  | The entity stays primary, environment badges remain visible, and the inspector lists every record.                            |
| Several environment features share a cell                            | Each record remains separately listed; overview markers may summarize kinds but never imply only one record exists.           |
| A wall decoration anchors to a wall cell and face                    | The selected wall inspector reports the outward face and preset metadata; the overview uses a face-aware authoring indicator. |
| The JSON is valid JSON but not a valid floor schema                  | Keep the text editable, clear the authored projection, report the schema error, and leave Save/Export disabled.               |
| The text changes after successful structural validation              | Refresh the schema-valid map when possible, remove route evidence, and disable Save/Export until revalidation.                |
| The selected coordinate does not exist after a floor or draft change | Clear selection and show the inspector's empty instruction rather than selecting another authored cell silently.              |
| The floor button row exceeds the available width                     | Wrap controls without horizontal page overflow or hidden floors.                                                              |
| The viewport cannot fit map and inspector side by side               | Stack the inspector without losing selection, labels, or keyboard access.                                                     |

## Acceptance Criteria

1. A schema-valid workbench draft displays a layered floor map immediately below the generator controls, before the JSON editor, without running structural validation.
2. Every floor is available from a numbered, wrapping one-click control, and selecting a cell opens a read-only inspector for its coordinates, base terrain, gameplay entity, environment features, presets, and authored faces.
3. Permanent wall materials and breakable walls are visually and textually distinct in authoring, and a selected breakable wall exposes every `hintFaces` value.
4. Co-located gameplay and environment content remains discoverable through overview indicators, the legend, accessible labels, and separate inspector records.
5. Invalid or changed text cannot leave stale route evidence or an apparently current stale map, and only the exact successfully validated text enables Export and canonical Save.
6. Export clearly promises a download with no repository change, while Save names the canonical floor-set target and warns that it overwrites.
7. Map cells and floor controls are keyboard reachable with visible selection/focus, and the map/inspector layout remains usable when it stacks at narrow widths.
