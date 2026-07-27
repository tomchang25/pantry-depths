# Floor Authoring Workbench Experience

> **Status**: Active. `pantry_authoring_01`, the independent Debug Surface Shell, `pantry_authoring_02`, and `pantry_authoring_03` have landed; `pantry_authoring_04` is the next handoff. Closeout for every shipped child is deferred until the whole plan is complete.

## Goal

Turn the floor authoring surface from a JSON textarea with a read-only picture beside it into a direct-manipulation editor, so terrain, gameplay content, and presentation metadata can be placed without mentally compiling grid coordinates. The workbench keeps one complete draft while a layered map and a cell editor make that draft understandable and editable.

## Requirements

1. The authored floor is edited by selecting cells on a two-dimensional map: terrain can be painted, gameplay entities can be placed and dragged, and environment features can be placed through the selected cell's editor. Coordinate arithmetic is the largest source of hand-editing mistakes, and the map must remove it from ordinary authoring.
2. The JSON text stays available and remains the complete draft authority in both directions. A map or cell-editor change updates the text, a text edit updates every representable map layer, and no operation may discard authored data outside the field it changes.
3. The authoring map distinguishes all base terrain materials and every gameplay entity. A breakable wall remains a gameplay entity, appears differently from a permanent wall, and exposes its directional hint faces while authoring; player-facing presentation may later normalize it to an ordinary wall and hide those hints.
4. The selected cell exposes a side editor for its base tile, optional gameplay entity, and environment-feature collection. Detailed parameters, faces, identifiers, destinations, colors, combat values, and preset identities belong in that editor rather than being crowded into every map cell.
5. Tile decorations, wall-face decorations, ambient lights, and effect emitters are authorable. The workbench edits their semantic placement, outward face, and named presets without attempting to preview final three-dimensional lighting, particles, animation, or decorative appearance.
6. Every overview symbol, badge, border, and selected-cell face indicator is explained next to the map. The overview must reveal that authored layers exist even when a gameplay entity and one or more environment features share a cell.
7. Generator counts are configured independently for red, blue, and yellow. Each color has separate door and key counts plus a link control, enabled by default, that drives both from one number while preserving the independent values when unlinked.
8. The two ways content leaves the page are labelled so the destructive one cannot be mistaken for the safe one. Export downloads a file without changing the repository; Save names and overwrites the canonical floor content.
9. Floors are selected from a wrapping row of numbered controls, one per floor. Switching floors takes one click, the floor count remains visible, and no interaction depends on a function key.
10. Each authored floor has independently editable width and height. Growth preserves existing coordinates and adds solid stone cells on the right or bottom; shrink keeps the top-left origin and is refused when it would remove authored content or invalidate the initial coordinate.
11. A stair links to another stair by globally unique ID. The destination stair owns its arrival cell and `arrivalFacing`, so every incoming link—including future many-to-one links—resolves to one consistent arrival presentation.
12. The generator accepts a width and height for newly generated floors, defaults both to the current 13-cell size, and constrains them to odd dimensions supported by the bordered maze. Generated dimensions do not prevent later per-floor manual resizing.
13. The workbench adopts the project-wide debug surface shell for page chrome and visual styling. The authoring plan owns its map and editing interactions, while the independent shell owns the reusable template shared by all debug scenes.

## Design

### One draft, several projections

The workbench owns one draft. The map, selected-cell editor, JSON text, and validation report are projections of that draft rather than independent stores. Map and cell-editor mutations patch only their owned fields and then re-render every projection. Text input may temporarily be invalid; an invalid text draft never causes the map to retain a misleading stale projection.

Structural validation remains on demand. An author commonly passes through incomplete or structurally invalid states, so ordinary painting and field edits do not run the full validator or enable Save and Export. Any edit after validation marks the draft unvalidated until the author validates it again.

### Layered authoring map

Each map cell has four conceptual layers:

1. **Base terrain**: passable floor, stone wall, old-brick wall, or iron-bar wall.
2. **Gameplay content**: at most one enemy, key, door, stair, breakable wall, or hot spring.
3. **Environment content**: zero or more cell- or wall-face-anchored decoration, light, and effect records allowed by the floor contract.
4. **Tool overlays**: current selection, structural-route membership, and validation evidence.

The overview keeps terrain and the gameplay entity as its primary cell presentation. Compact badges indicate environment-feature kinds without depicting their final visual effects. A selected cell may expose directional ticks around its edges for authored wall faces and breakable-wall hint faces; unselected cells remain legible at overview scale.

This plan does not implement the gameplay minimap or require one DOM component to serve both authoring and Canvas presentation. It establishes renderer-neutral map semantics that a future presentation projection may reuse where useful. The future gameplay projection remains free to apply discovery filtering, active-state filtering, hidden-hint rules, and presentation-specific drawing.

### Cell selection and editing

Selecting a grid cell opens the **Cell Editor** beside the map on wider screens and below it on narrower screens. The name is deliberate: the surface edits more than a base tile.

The editor is organized into:

- **Cell**: read-only coordinates and the base terrain control.
- **Gameplay Entity**: zero or one entity, with fields specific to its kind. Breakable-wall hint faces and wall-face directions use four explicit cardinal controls.
- **Environment Features**: a list of records at the selected cell or wall anchor, with add, edit, and remove controls for kind-specific preset and face data.

The map remains the fast spatial surface. Terrain supports click-and-drag painting, and an existing gameplay entity can be dragged to another valid cell. Creation, deletion, and detailed parameters live in the Cell Editor. Environment features use the Cell Editor because several records may legally share a cell and wall-face anchors cannot be expressed by one primary symbol.

Edits that violate an immediately knowable structural rule are rejected at the gesture or control that originated them. Painting a solid tile over an occupied cell does not delete the occupant. Gameplay entities require passable, unoccupied cells. Wall decorations require a solid wall and an outward face with a passable observation cell; cell decorations, lights, and emitters require passable cells. Full-route and cross-floor validation remains on demand.

### Generator controls

For each existing key color, the generator exposes separate door and key counts. A per-color link toggle is on by default and mirrors one count into the other. Unlinking restores independent control without losing either remembered value. The generator continues to operate per floor.

Variable palette sizing and additional key colors are outside this plan. White, black, or any other new color requires gameplay meaning and a separate product decision before it can enter the content contract or generator.

The generator also accepts width and height for the candidate floor set. Both default to 13 and use odd values so the solid border and odd-coordinate maze nodes remain well-defined. These settings apply to every floor in that generated candidate; an author may subsequently resize individual floors through the selected floor's settings.

### Floor dimensions

The selected floor exposes width and height above its Cell Editor. Floors remain independent non-empty rectangles, so resizing one floor never reshapes another.

Resize is anchored at the top-left origin. Increasing width appends solid stone columns on the right, and increasing height appends solid stone rows at the bottom. This preserves every existing coordinate and avoids opening accidental traversable space.

Shrinking is conservative. The operation is refused and identifies the conflicts when the removed region contains a gameplay entity (including a destination stair), environment feature or wall anchor, or the floor-set initial cell. Empty terrain may be cropped without moving retained content. Resize never silently deletes or relocates authored records.

### Departure paths

| Path   | Destination                                | Reversible                              |
| ------ | ------------------------------------------ | --------------------------------------- |
| Export | A file downloaded to the author's machine  | Yes — nothing in the repository changes |
| Save   | The canonical floor content the game loads | No — it overwrites that target in place |

Both require a draft that validated exactly as it currently reads. Save additionally names its canonical target and states that it overwrites it.

### Child overview

| Child                 | Focus                                                                                                                                 | Current document form                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pantry_authoring_01` | Layered read-only map, cell selection and inspector, floor controls, legend, and departure-path labelling                             | [Implementation spec](pantry_authoring_01_layered_map_foundation.implementation_spec.md) |
| `pantry_authoring_02` | Per-floor resizing, terrain painting, gameplay-entity placement and dragging, editable Cell Editor, and two-way draft synchronization | [Implementation spec](pantry_authoring_02_direct_floor_editing.implementation_spec.md)   |
| `pantry_authoring_03` | Environment-feature placement plus wall-face, light, effect, decoration, and preset editing through the Cell Editor                   | [Implementation spec](pantry_authoring_03_environment_features.implementation_spec.md)   |
| `pantry_authoring_04` | Generated width and height plus per-color red, blue, and yellow generator counts with the default-linked door/key controls            | Not started                                                                              |

Recommended landing order: `pantry_authoring_01` -> independent Debug Surface Shell (shipped) -> `pantry_authoring_02` -> `pantry_authoring_03` -> `pantry_authoring_04`.

The first child establishes a readable projection and selection model before any surface can mutate the draft. The shipped independent shell gives it and every other debug scene a shared visual page template without moving authoring ownership out of this plan. The second child adds conservative per-floor resizing before terrain and gameplay editing, and the third adds the multi-record environment family. Generator dimension and color-count controls remain last because they are independent of direct map editing and must not distract from the hand-authoring bottleneck.

## Non-Goals

1. Do not implement the gameplay minimap, discovery fog, runtime entity filtering, or a presentation renderer in this plan.
2. Do not preview final three-dimensional decorations, lights, particles, animation, audio, or atmosphere. The authoring surface edits semantic preset identities and anchors only.
3. Do not add undo history, multi-cell selection, copy and paste, clipboard interchange, auto-save, or live structural validation on every edit.
4. Do not introduce a UI framework or rendering library. The existing no-framework deviation stands.
5. Do not add white, black, or any other key color, variable palette sizing, or gameplay meaning for a new color.
6. Do not define or implement the cross-debug page shell, theme, or migration of other debug scenes in this plan; the shipped Debug Surface Shell owns that work.

## Acceptance Criteria

1. Terrain, gameplay entities, and environment features can be placed or moved without typing a coordinate, and the resulting content validates through the same structural validator used by canonical content.
2. A map or Cell Editor change appears in the JSON text, and a valid JSON text change appears in every applicable map and editor layer, without losing untouched fields or co-located records.
3. The authoring overview distinguishes permanent wall materials from a breakable wall; selecting the breakable wall exposes all authored hint faces.
4. Selecting a cell reveals its coordinates, base tile, optional gameplay entity, and every environment feature in one adjacent Cell Editor without requiring all details to remain visible inside the map cell.
5. Decorations, ambient lights, effect emitters, and wall-face decorations can be placed and configured by semantic preset and anchor data without introducing a final-presentation preview.
6. An edit that would break an immediately knowable structural rule, such as two gameplay entities in one cell, an entity inside permanent solid terrain, or a wall decoration on an invalid face, is refused at the originating interaction.
7. Every symbol, environment badge, overlay, and face indicator has a visible written explanation on the same screen.
8. Generator door and key counts are set independently for red, blue, and yellow, and each color's link control keeps the two values equal without duplicate entry while engaged.
9. The path that overwrites canonical content names its target and is visibly distinct from the path that only downloads a file.
10. Switching floors takes one click from a wrapping control row that exposes the floor count, and map selection and editing remain keyboard accessible without function keys.
11. An authored floor can be resized independently without moving retained coordinates; growth adds solid stone terrain, while a shrink that would remove authored records or referenced coordinates is refused with visible conflict information.
12. Generated candidates use the selected odd width and height, defaulting to 13 by 13, while each resulting floor remains independently resizable afterward.
13. The completed workbench appears within the shared debug surface shell without duplicating page chrome or changing the draft, map, or editor ownership defined by this plan.
