# Composite Environment Presets

> **Status**: Queued. Recorded ahead of execution; no child has started. Landing waits for `pantry_authoring_04`.

## Goal

Replace the loose per-placement preset references in floor content with composite presets that are assembled and previewed once and then referenced as a single identity. Today a wall torch is three independent identifiers chosen by hand at every placement, with nothing validating that they belong together and nowhere to express how their parts are positioned relative to each other.

## Requirements

1. A composite preset is the single unit that floor content references, and all four environment-feature kinds reference one. Which decoration, light, and effect belong together is an assembly decision made once, not a combination re-selected at every placement.
2. A composite preset holds zero or more decoration, light, and effect components, each carrying its own offset from the composite origin. A standalone ambient light is a composite containing only a light component — unifying the four kinds keeps one preset concept in the contract instead of two.
3. Placement authors position the composite origin and nothing else. Component offsets belong to the preset because repeating them at every placement would duplicate identical values across every instance and turn one visual adjustment into a many-site edit.
4. Visual variation uses named variants rather than per-placement component overrides, so every authored combination remains one that was assembled and reviewed as a whole.
5. The floor content contract increases its schema version and canonical content migrates to it. The flat form is not retained in parallel — two readable shapes for the same data would reintroduce the ambiguity this plan exists to remove.
6. Composite presets are assembled in a dedicated surface that previews the assembled result. Whether a combination is correct is an eye judgement, and the floor authoring map deliberately does not make it.

## Design

### What a composite preset is

A composite preset has a stable identity, an origin, and a set of components. Each component declares its type — decoration, light, or effect — its own preset-level parameters, and an offset from the composite origin. The composite is the only thing floor content names.

This collapses the current four-kind distinction. A wall torch is a composite with a decoration component, a light component offset slightly in front of and above it, and an effect component emitting from the flame rather than the wall plane. A bare ambient light is a composite with one light component at zero offset. The kind of an environment feature stops being a schema branch and becomes a consequence of what its composite contains.

### Placement versus assembly

| Decision                                                                        | Owner                | Evidence it needs  |
| ------------------------------------------------------------------------------- | -------------------- | ------------------ |
| Which components form this assembly, and where each sits relative to the origin | The composite preset | Rendered preview   |
| Which composite goes here, and where its origin sits                            | The floor placement  | Flat authoring map |

A placement may move the composite origin. It may not move, add, remove, or reconfigure a component. That boundary is what makes a composite reviewable: if a placement could nudge one component, the previewed assembly would no longer be what actually renders.

Anchoring rules survive unchanged. A wall-anchored composite still requires a solid anchor cell and an outward face with a passable observation cell; a cell-anchored composite still requires a passable base tile. Those are structural rules about where content may exist, not about what it looks like.

### Variation

Variation is expressed as separate named composites — a warm torch and a cold torch are two identities, not one identity with an override. This costs one catalog entry per variant and buys the guarantee that every combination in use was assembled deliberately.

### Ownership

Authored content owns the composite catalog. Presentation reads it and owns rendering, animation, timing, and decorative behavior. Floor content references composites by identity only. The authoring workbench resolves an identity to a human-readable label but never redefines a composite.

### Migration

The floor content schema version increases and canonical content migrates in the same change. Each existing wall decoration becomes a composite whose components mirror the identifiers it currently carries, preserving today's rendering intent; each existing tile decoration, ambient light, and effect emitter becomes a single-component composite. Migrated composites start with zero component offsets, because the flat form never expressed any and inventing offsets during migration would change authored appearance silently.

### Child overview

| Child               | Focus                                                                                                  | Current document form |
| ------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- |
| `pantry_preset_01`  | Composite preset contract, catalog ownership, schema version increase, and canonical content migration | Not started           |
| `pantry_preset_01a` | Floor Set Workbench alignment to the composite contract                                                | Not started           |
| `pantry_preset_02`  | Composite assembly editor with rendered preview of components and offsets                              | Not started           |

Recommended landing order: `pantry_preset_01` -> `pantry_preset_01a` -> `pantry_preset_02`.

`pantry_preset_01a` is numbered as a follow-on rather than a peer because the workbench cannot keep working across the contract change. The data layer lands first and the workbench is knowingly broken between the two, which is accepted here: the workbench is a development-only surface with no gameplay dependency, and pairing the two into one change would make an already large migration unreviewable.

`pantry_preset_02` hard-depends on `pantry_presentation_01`. Previewing an assembly means rendering it, and no renderer exists until the faithful port lands.

### Relationship to other plans

`pantry_authoring_04` must land before `pantry_preset_01a`. Both change the Floor Set Workbench, and reversing the order would rewrite the generator controls underneath the child that just added them.

The presentation plan keeps its own decision about whether it consumes the flat contract or the composite one first, and in which order it implements them. This plan defines the composite contract; it does not schedule presentation's adoption of it.

## Non-Goals

1. Do not give composite presets, components, or offsets any gameplay meaning. They remain presentation-only and must not affect collision, visibility for rules, interaction, progression, or deterministic replay.
2. Do not add a rendered preview to the floor authoring map or its Cell Editor. Placement stays a flat spatial decision; assembly preview lives in its own surface.
3. Do not add component types beyond decoration, light, and effect.
4. Do not retain the flat three-slot form as a supported alternative after migration.
5. Do not decide the presentation port's implementation order between the flat and composite contracts; that remains the presentation plan's call.
6. Do not expand key colors, gameplay entities, or any other content contract that this migration happens to touch.

## Acceptance Criteria

1. Floor content references exactly one composite identity per environment placement, and no placement carries more than one preset identifier.
2. All four previously distinct environment-feature kinds are expressed through the same composite mechanism, with their differences carried by component content rather than by separate record shapes.
3. A composite defines each component's offset from its origin, and a placement can reposition the origin without being able to move, add, or remove a component.
4. Visual variants of the same assembly exist as separately named composites.
5. Canonical content migrates to the increased schema version with its current rendering intent preserved and no silently invented offsets.
6. An author can assemble a composite and see the assembled result rendered before it becomes available for placement.
7. Existing anchor rules continue to hold: wall-anchored composites need a solid anchor with a passable observation face, and cell-anchored composites need a passable base tile.
8. Composite presets remain presentation-only, leaving gameplay outcomes and deterministic replay unchanged.
