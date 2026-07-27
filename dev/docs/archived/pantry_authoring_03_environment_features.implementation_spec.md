# Environment Feature Authoring

Parent Plan: `pantry_authoring.plan.md`

## Goal

Make the environment-feature family authorable from the Floor Set Workbench's Cell Editor. Tile decorations, wall-face decorations, ambient lights, and effect emitters gain placement, preset editing, outward-face editing, and removal, so presentation-only metadata no longer requires hand-editing the JSON draft.

## Summary

The Cell Editor's `Environment Features` section stops being read-only. For the selected cell it lists every anchored record with a complete editable form, offers an add control for the kinds legal at that cell, and offers a remove control per record. Wall-face decorations are authored from their solid anchor cell using four explicit cardinal face controls plus optional light and effect preset slots.

Preset identity stays a free semantic string, matching the deliberate decision in the shipped rules layer that no renderer catalog validates these identifiers. Each preset input is backed by a suggestion list assembled from every preset ID already present in the current draft, so ordinary authoring reuses existing names without closing the field to a new one.

A new pure mutation surface in the existing authoring module owns creation defaults, immediate local rejection, and immutable application. It enforces exactly the environment rules the structural validator already owns and that an author can know at the moment of the gesture: unique content ID, non-empty required presets, a solid in-bounds wall anchor whose faced observation cell is passable, one wall decoration per anchor and face, one tile decoration per cell, and a passable base tile for every cell-anchored kind. Ambient lights and effect emitters remain freely stackable because the validator permits that.

The Workbench keeps sole ownership of draft text, validation authorization, and feedback. Accepted feature edits rewrite the complete JSON draft through the existing `applyDirectEdit` path, which already clears prior validation evidence and re-disables Export and Save. Nothing about terrain, gameplay entities, resizing, the read-only Floor Set Viewer, or the generator changes.

## Relational Context

- `floor-workbench` remains the single owner of draft text, validation state, selected floor and cell, and status messaging. The Cell Editor reports complete intents; it never writes the draft, parses text, or holds a second copy of the floor set.
- `floor-authoring` stays pure: it transforms immutable `FloorSetSource` values and returns the existing `FloorAuthoringResult`. It must not gain DOM access, text parsing, or topology search.
- Environment records and gameplay entities share one content-ID namespace. `contentIds` already pools both and is the authority for uniqueness; do not introduce a feature-only ID check.
- The local rules mirror `floor-validation`'s `validateReferences` environment branch. That validator remains the sole authority for whole-set and cross-floor concerns; the editor only pre-rejects what is knowable at one gesture.
- `paintTerrain` and `resizeConflicts` already protect existing feature anchors and observation cells. Adding feature mutation must not duplicate or weaken those guards.
- A wall decoration is authored from its **anchor** cell, not its observation cell. `projectAuthoredFloorCell` already groups wall decorations onto the solid `wallCell`, so the selected-cell editor sees them without a new lookup rule.
- Preset identifiers stay uncatalogued free strings. Suggestions are derived from the live draft only; introducing a `src/content/` preset catalog would pre-empt ownership that `pantry_presentation.plan.md` still holds.
- The read-only Floor Set Viewer composes `createCellInspector`, not `createCellEditor`. Feature mutation controls must reach only the Workbench path, exactly as gameplay-entity editing does today.
- Optional `lightPresetId` and `effectPresetId` are absent keys, never empty strings. An emptied optional field omits the key so the serialized draft stays schema-clean.

## Scope

### Included

- Pure immutable add, update, and remove operations for all four environment-feature kinds, with kind-aware default records and local rejection messages.
- A pure preset-suggestion collector over the current draft.
- An editable Cell Editor environment section: per-record forms, kind-filtered add control, remove control, four cardinal face controls, and written anchor rules.
- Workbench wiring through the existing direct-edit, invalidation, and rerender path.
- Focused mutation tests and aggregate verification.

### Excluded

- Relocating an existing feature to another cell; moving is remove plus re-add.
- Any preset catalog, content-contract change, or schema version change.
- Map-side environment gestures, drag, or a new map tool mode.
- Generator controls, undo, multi-select, clipboard, autosave, or live full validation.
- Any final-presentation preview of decorations, lighting, particles, or animation.

## Files to Change

| File                                          | Change Size | Purpose                                                                                            |
| --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `src/app/debug/floor-authoring.ts`            | Medium      | Own environment-feature defaults, local validation, immutable mutation, and preset collection.     |
| `src/app/debug/floor-map.ts`                  | Large       | Replace the read-only environment list with keyboard-accessible editing controls.                  |
| `src/app/debug/floor-workbench.ts`            | Small       | Wire feature intents into the existing direct-edit and invalidation path.                          |
| `src/app/debug/debug.css`                     | Small       | Style the per-record forms and add row inside the Cell Editor.                                     |
| `test/unit/app/debug/floor-authoring.test.ts` | Medium      | Prove immutability, every local rejection, optional-key omission, and untouched-data preservation. |

## Execution Outline

1. Add the pure environment surface to `floor-authoring.ts` — default record creation, shared local validation, add, update, remove, and preset collection — and land its focused tests first, so every rejection rule is proven before any DOM depends on it.
2. Extend `CellEditorOptions` and rebuild the environment section of `createCellEditor` with per-record forms, a legality-filtered add control, and written anchor rules. Leave `createCellInspector` and the viewer path untouched.
3. Wire the three new callbacks plus preset suggestions in `floor-workbench.ts` through `applyDirectEdit`.
4. Add the small CSS needed for the record forms, then run focused tests and `npm run verify`.
5. Manually review the Workbench in a browser for pointer, keyboard, and narrow-width behavior, since no automated browser layer exists.

## Implementation Notes

- **Defaults.** A new record's ID follows the existing `defaultId` shape (floor, kind, coordinates, numeric suffix on collision). A required preset slot defaults to the first suggestion already present in the draft for that slot, falling back to a visibly provisional `unspecified` when the draft has none. A new wall decoration picks the first cardinal face that is currently legal; when none is, creation is refused rather than producing an invalid record. Creation stays atomic — never write a partial record and repair it afterwards.
- **Update.** Changing a record's kind is refused with the same guidance as gameplay entities: remove it and add the new kind. Coordinates and the wall anchor cell are not editable fields; only ID, face, and preset slots are.
- **Add-control filtering.** Offer only the kinds legal at the selected cell — wall decoration on a solid cell with at least one legal face, the three cell-anchored kinds on a passable cell without a conflicting tile decoration — and state in text why the others are unavailable. Keep all four cardinal face controls visible on the wall-decoration form and reject an illegal face on apply, so a hand-authored face is never silently dropped.
- **Suggestions.** Collect decoration, light, and effect preset IDs separately across the whole draft, deduplicated and sorted, and expose each through a `datalist` bound to its text input. The input stays free.
- **Trimming.** Trim IDs and preset values before validating and before writing, and reject values that are empty after trimming.

## Edge Cases

| Case                                                                   | Expected Handling                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Add is attempted on a cell where no feature kind is legal              | Offer no kinds and explain the anchor rule instead of failing after the gesture.   |
| A second tile decoration is added to a cell                            | Reject with a duplicate-anchor message; the existing record is untouched.          |
| A wall-decoration face has a solid or out-of-bounds observation cell   | Reject the apply and keep the previous face.                                       |
| A wall-decoration face collides with another record on the same anchor | Reject the apply and name the conflict.                                            |
| A feature ID duplicates any entity or feature ID                       | Reject atomically with the existing shared duplicate-ID message.                   |
| An optional light or effect preset is cleared                          | Omit the key entirely from the serialized record.                                  |
| A feature is removed                                                   | Remove only that record; co-located records and the cell's gameplay entity remain. |
| Any accepted feature edit                                              | Rewrite the JSON draft, clear validation evidence, and disable Export and Save.    |
| Terrain paint or resize would invalidate a feature anchor              | Existing terrain and resize refusals continue to apply unchanged.                  |

## Acceptance Criteria

1. An author can add every environment-feature kind at a legal selected cell without typing a coordinate, and the result passes the same structural validator used for canonical content.
2. An author can edit an existing record's identifier, outward face, and required and optional preset identities, and can remove it, from the selected cell's editor.
3. Wall-face decorations are authored from their solid anchor cell through four explicit cardinal controls, and their optional light and effect presets can be set and cleared.
4. Preset identities remain free semantic text, with suggestions drawn from identities already used in the current draft.
5. An immediately knowable violation — duplicate identifier, empty preset, non-solid anchor, blocked observation cell, occupied anchor face, or a second tile decoration on one cell — is refused at the control that originated it with a visible explanation, leaving the draft unchanged.
6. Co-located records, the cell's gameplay entity, terrain, and all other authored data survive every accepted feature edit.
7. Each accepted feature edit rewrites the JSON draft, clears prior validation evidence, and disables download and canonical overwrite until the exact draft validates again.
8. The anchor and face rules governing the environment controls are explained in visible text on the same screen, and the controls are keyboard accessible.
9. The read-only floor viewing surface remains non-mutating and gains no environment editing controls.
