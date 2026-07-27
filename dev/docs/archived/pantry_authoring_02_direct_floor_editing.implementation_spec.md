# Direct Floor Editing

Parent Plan: `pantry_authoring.plan.md`

## Goal

Turn the Floor Set Workbench's selected-cell inspection surface into direct editing for terrain and gameplay entities. Allow authors to resize individual floors and keep the map, Cell Editor, and JSON draft synchronized without weakening the current validation and Save/Export gates.

## Summary

The workbench will retain one schema-valid draft and will serialize every accepted map or Cell Editor mutation back to its JSON textarea. Parsed text continues to redraw the map and editor, while unparseable text clears their projection. Each direct edit invalidates the prior structural validation, solution evidence, and Save/Export authorization until the author validates the exact new text.

The selected floor will expose positive width and height controls. Growth appends stone terrain on the right or bottom. A shrink remains top-left anchored and is refused with a visible conflict list if it would crop gameplay content (including destination stairs), environment anchors, or the initial location.

The map gains explicit Select/Move and terrain-brush modes. A terrain mode supports pointer dragging and keyboard activation; Select/Move keeps ordinary cell selection and lets an existing entity move only to a passable, empty target. The Cell Editor provides terrain selection, entity creation, removal, and complete kind-specific editing. Entity creation is atomic, starts from legal content-derived defaults, and gives a unique editable ID, so direct interaction never leaves a partial schema record in the draft.

## Relational Context

- `floor-workbench` remains the sole owner of current draft text, validation authorization, selected floor/cell state, and user-facing mutation feedback. It applies a pure edit result, serializes the complete floor set, then rerenders every projection.
- A new pure authoring module transforms immutable `FloorSetSource` values and checks immediately knowable local placement and resize rules. It does not parse text, run topology search, access the DOM, write canonical content, or become a second draft store.
- `floor-map` continues to own the authored map projection and DOM controls. Its optional edit callbacks report selection, terrain, and entity-move intents to the Workbench; without those callbacks, the Floor Set Viewer remains read-only.
- The Cell Editor is a Workbench-only mutation surface. It edits one selected cell and reports a complete intent; environment-feature fields and controls remain absent until `pantry_authoring_03`.
- Terrain changes reject a solid tile over an occupied gameplay cell. Entity add or move rejects out-of-bounds, solid, or occupied targets. Existing environment records survive every supported mutation unchanged.
- Resize checks every affected authored placement before changing tiles: the selected floor's entities and environment anchors, plus the floor-set initial cell when applicable. Because stairs target authored stair IDs, retaining the target stair retains its destination. A rejected resize returns all detectable conflicts and leaves the draft unchanged.
- Direct edits deliberately may leave cross-floor topology, stair links, goals, or balance invalid. Only the existing on-demand structural validator decides those global concerns and re-enables departure actions.
- Content catalogs remain the option source for enemy archetypes and door upgrade effects. Key and door controls expose only the existing red, blue, and yellow colors; no palette or content-contract expansion occurs.
- Map cells remain native buttons. Select/Move and terrain brushes expose their active state in text and ARIA, and Cell Editor controls provide keyboard-accessible equivalents for direct editing and pending entity moves.

## Scope

### Included

- Pure immutable terrain, gameplay-entity, ID, and per-floor resize mutations with local rejection results.
- Terrain brush and entity move gestures for the editable Workbench map.
- A selected-cell editor for all existing gameplay entity kinds and a top-left anchored floor-size editor.
- Map, editor, JSON, validation, and departure-gate synchronization after direct edits.
- Focused mutation tests plus aggregate verification.

### Excluded

- Environment-feature placement, removal, face editing, or preset editing.
- Generator width, height, key/door counts, link toggles, or variable key palettes.
- Undo, multi-cell selection, clipboard operations, autosave, or live full structural validation.
- Gameplay minimap behavior, runtime map editing, or final presentation previews.

## Files to Change

| File                                          | Change Size | Purpose                                                                                                |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `src/app/debug/floor-authoring.ts`            | Large       | Own pure immutable floor-set edit, local-rejection, resize, and default-entity operations.             |
| `src/app/debug/floor-map.ts`                  | Large       | Add editable map gesture contracts and the keyboard-accessible Cell Editor DOM surface.                |
| `src/app/debug/floor-viewer.ts`               | Medium      | Allow the embedded Workbench projection to compose optional edit controls without changing the viewer. |
| `src/app/debug/floor-workbench.ts`            | Large       | Own edit modes, draft serialization, mutation feedback, validation invalidation, and rerendering.      |
| `src/app/debug/debug.css`                     | Medium      | Style active map tools, editing feedback, dimension controls, and Cell Editor form layout.             |
| `test/unit/app/debug/floor-authoring.test.ts` | Large       | Prove immutable edits, local rejections, resize conflict reporting, and untouched-data preservation.   |

## Execution Outline

1. Add the pure authoring mutation surface and focused tests first, including terrain/entity restrictions, unique IDs, expansion, and every shrink-reference conflict.
2. Extend the map and embedded inspector composition with optional editing callbacks, brush and move interaction states, and a complete keyboard-accessible Cell Editor while preserving the read-only viewer path.
3. Connect the Workbench to the mutation surface so accepted edits rewrite the complete JSON draft, clear validation state, preserve valid selection, and surface rejected actions without changing the draft.
4. Add per-floor size controls and entity kind-specific controls backed by existing content options; keep environment records visible but read-only.
5. Add responsive edit styling, run focused tests and aggregate verification, then manually review pointer, keyboard, and narrow-layout behavior on the Workbench.

## Implementation Notes

- Use a user-visible Select/Move mode plus one mode per terrain material. A terrain mode paints on pointer traversal and button activation; Select/Move retains ordinary selection. Starting an entity move from the editor gives keyboard users a target-selection path.
- New entity IDs use a deterministic floor, kind, and coordinate base with an incrementing suffix only when needed. Authors may change the resulting ID through the entity form, but duplicate IDs are rejected locally.
- New enemy, key, door, stair, breakable-wall, and hot-spring records use schema-valid defaults from the existing catalogs and valid enum values. A stair first filters by destination floor and then links to an existing destination stair ID. Each stair owns the `arrivalFacing` used by every other stair that arrives there; the source link owns no duplicate destination coordinate or facing. Renaming a stair rewrites inbound links atomically, while removing a referenced stair is refused. Required entity fields are submitted atomically rather than written as incomplete JSON.
- A breakable-wall editor exposes all four cardinal hints but rejects zero, duplicate, non-opposing pairs, and faces without a passable observation cell before it changes the draft.
- Treat unchanged resize dimensions as a no-op. Positive integer sizes have no new arbitrary maximum; unsupported values are rejected before mutation.

## Edge Cases

| Case                                                              | Expected Handling                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A terrain brush reaches an entity cell                            | Reject that cell, retain the entity and its base terrain, and report the local conflict.       |
| An entity move targets solid terrain or another entity            | Reject the move and leave the source entity in place.                                          |
| Entity ID edit duplicates any entity or environment record        | Reject the edit atomically with a visible duplicate-ID message.                                |
| A floor shrinks over an environment wall anchor or a stair entity | Refuse the entire resize and identify each affected placement.                                 |
| Two or more stairs target the same destination stair              | Accept the directed links; all arrivals use the destination stair's cell and `arrivalFacing`.  |
| A text edit follows direct manipulation                           | Reparse and redraw if schema-valid; otherwise clear the projection and retain text for repair. |
| A valid selection falls outside a resized floor                   | Clear selection rather than silently selecting another cell.                                   |
| An edit follows successful validation                             | Clear route overlays and disable Export/Save until exact-text validation succeeds again.       |

## Acceptance Criteria

1. Authors can select a floor, resize it independently, and see safe growth or an explanatory shrink refusal without moving retained coordinates.
2. Authors can paint each base terrain material and add, edit, remove, or move every gameplay entity kind without typing map coordinates.
3. The selected Cell Editor exposes coordinates, terrain, entity fields, and `breakableWall` hint faces while preserving environment records as read-only context.
4. A map or Cell Editor change rewrites JSON and every valid JSON text change redraws the editable map and editor without losing unaffected authored data.
5. Immediately invalid placements, duplicate IDs, invalid breakable-wall hints, and destructive shrinks are refused at their originating control with a visible explanation.
6. Every direct edit clears previous validation/solution evidence and disables Export/Save until the exact current draft has a structural solution.
7. Read-only floor viewing remains non-mutating, and Workbench editing controls remain keyboard accessible and usable at narrow widths.
