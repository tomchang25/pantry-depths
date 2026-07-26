# Floor Authoring Workbench Experience

> **Status**: Parked. Not on the V1 critical path and not blocking any `pantry_rules` child. Promote it when hand-authoring final floor content becomes the bottleneck.

## Goal

Turn the floor authoring surface from a JSON textarea with a read-only picture beside it into a direct-manipulation editor, so a floor can be shaped by pointing at it rather than by counting coordinates. The structural pipeline behind it already works; what is missing is a way to use it without mentally compiling grid text.

## Requirements

1. The authored floor is edited by direct manipulation of the grid: paint terrain, place an entity, and move an entity by dragging it. Coordinate arithmetic is the single largest source of hand-editing mistakes, and it is the one thing a grid view can remove entirely.
2. The JSON text stays available and stays authoritative in both directions — a manipulation updates the text, and a text edit updates the grid. Text remains the escape hatch for anything the grid cannot express, so it must never become a second source of truth.
3. Generator counts are configured per key color, with door counts and key counts settable independently, plus a link control that drives both from one number because most sessions want them equal and should not require entering the same value twice.
4. The size of the key-color palette is selectable rather than fixed at three. **This requirement is blocked on a product decision** — the design document assigns a meaning to each of the three current colors, and additional colors have no assigned meaning in V1. Resolve that before implementing.
5. Every symbol drawn on the grid is explained next to the grid. A legend is required because the surface encodes entity kind, key color, hint direction, and route membership at once, and none of that is guessable.
6. The two ways content leaves the page are labelled so the destructive one cannot be taken for the safe one. One writes committed game content in place; the other does not.
7. No control depends on a function key, and no floor is identified by a label that reads like one, because the browser owns those keys and will act on them first.

## Design

### Editing model

The workbench owns one draft. Three surfaces project it: the grid, the JSON text, and the validation report. Any surface may originate a change; all three re-render from the draft afterwards.

Direct manipulation covers:

- **Terrain painting.** Select a terrain kind, then click or drag across cells. Painting a solid kind over an occupied cell is rejected rather than silently deleting the entity standing there.
- **Entity placement.** Select an entity kind and its parameters, then click a passable cell. Placing onto an occupied cell is rejected; one authored entity per cell is an existing structural rule.
- **Entity movement.** Drag an entity to another passable, unoccupied cell. Its identity, colour, destination, and hint faces travel with it.
- **Entity removal.** A delete affordance on the selected entity.

Validation does not run on every stroke. It runs on demand, as it does today, because the author is mid-edit for long stretches and a half-built floor is expected to be invalid.

### Layout

The grid is the primary surface and sits directly under the generator controls. The JSON text moves below the grid, since it becomes the secondary surface once the grid can express most edits. The validation report stays adjacent to whichever surface caused the last change.

Floors are chosen from a row of numbered controls, one per floor, rather than a dropdown. A dropdown hides how many floors exist and costs two interactions per switch; a visible row makes floor count legible and switching a single click. The row must remain usable at the largest floor count the generator accepts, which means it wraps rather than scrolls off.

### Generator controls

Per key color, two counts: doors and keys. A link toggle, on by default, mirrors one into the other. When the palette size is reduced, counts for the removed colors are retained but not applied, so toggling the palette back does not lose the numbers.

Counts remain per floor, matching the existing generator contract.

### Departure paths

| Path   | Destination                                | Reversible                              |
| ------ | ------------------------------------------ | --------------------------------------- |
| Export | A file downloaded to the author's machine  | Yes — nothing in the repository changes |
| Save   | The committed floor content the game loads | No — it overwrites in place             |

Both require a draft that validated as it currently reads. The save path additionally names its target and states that it overwrites, because the only way to notice the overwrite today is to read a diff afterwards.

## Non-Goals

1. Do not add undo history, multi-cell selection, copy and paste, or clipboard interchange. Those are editor features, not authoring-pipeline features, and each one is larger than the surface it would sit on.
2. Do not introduce a UI framework or a rendering library. The existing no-framework deviation stands; a grid of cells with pointer handlers does not justify reversing it.
3. Do not add live validation on every edit, and do not auto-save. Both destroy the author's ability to pass through an invalid intermediate state.
4. Do not extend the editor to presentation-only environment features. Those belong to the deferred environment-feature slice.
5. Do not add gameplay meaning for any new key colour here. If the palette grows, the meaning is a design-document decision made before this plan implements it.

## Child Decomposition

| Child                 | Focus                                                                                       | Current document form |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| `pantry_authoring_01` | Layout rearrangement, numbered floor selection, symbol legend, and departure-path labelling | Not started           |
| `pantry_authoring_02` | Direct-manipulation grid editing with two-way draft synchronisation                         | Not started           |
| `pantry_authoring_03` | Per-colour generator counts, the link toggle, and palette sizing                            | Not started           |

Recommended landing order: `pantry_authoring_01` -> `pantry_authoring_02` -> `pantry_authoring_03`.

`pantry_authoring_01` is deliberately first: it is cheap, it removes the two things that actively mislead an author today, and it establishes the layout the editing surface will occupy. `pantry_authoring_03` is last because its palette requirement cannot start until the colour decision is resolved.

## Acceptance Criteria

1. A floor can be reshaped — terrain, entity placement, and entity position — without typing a coordinate, and the resulting content validates through the same structural validator used by committed content.
2. A change made on the grid appears in the JSON text, and a change typed into the JSON text appears on the grid, with neither surface holding state the other cannot see.
3. An edit that would break an existing structural rule, such as two entities in one cell or an entity inside a solid tile, is refused at the point of the gesture rather than surfaced later as a finding.
4. Generator door and key counts are set per colour and independently, and the link control keeps them equal without a second entry while it is engaged.
5. Every symbol on the grid has a visible written explanation on the same screen.
6. The path that overwrites committed content names its target and is visibly distinct from the path that only downloads a file.
7. Switching floors takes one click from a control that shows how many floors exist, and no interaction requires a function key.
