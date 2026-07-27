# Scene Authoring and Live Preview

> **Status**: Queued. Supersedes the Composite Environment Presets plan, whose first two children are carried over unchanged and whose assembly-editor child is replaced by the live preview children below. No child has started.

## Goal

Give authored presentation content one identity per placement, and give the surface that authors it a view of what the placement actually looks like. Today a wall torch is three loose identifiers chosen by hand at every placement, and every judgement about composition, size, and offset is made against a flat grid that cannot show the result — so the only way to see a change is to rebuild the game and walk to it.

## Requirements

1. A composite preset is the single unit that floor content references, and all four environment-feature kinds reference one. Which decoration, light, and effect belong together is an assembly decision made once, not a combination re-selected at every placement.
2. A composite preset holds zero or more decoration, light, and effect components, each carrying its own offset from the composite origin. A standalone ambient light is a composite containing only a light component — unifying the four kinds keeps one preset concept in the contract instead of two.
3. Placement authors position the composite origin and nothing else. Component offsets belong to the preset because repeating them at every placement would duplicate identical values across every instance and turn one visual adjustment into a many-site edit.
4. Visual variation uses named variants rather than per-placement component overrides, so every authored combination remains one that was assembled and reviewed as a whole.
5. The floor content contract increases its schema version and canonical content migrates to it. The flat form is not retained in parallel — two readable shapes for the same data would reintroduce the ambiguity this plan exists to remove.
6. The authoring surface renders the authored floor the way the game renders it, from a camera the author places and moves on the grid being edited, and reflects each edit without a rebuild. An eye judgement needs an eye, and a flat map cannot supply one.
7. Every authored placement number is editable against that live view and persists as authored content: component offsets, and the display size and floor anchor of each world sprite. A number that can only be changed by editing source is a number that never gets tuned.
8. A floor set's start position and its exit are placed and moved from the authoring surface, so the surface that builds a level can also start a run inside it. What makes the exit terminal is a settled gameplay rule owned by the standalone Run Exit work; this plan places the markers and does not decide how a run ends.

## Design

### What a composite preset is

A composite preset has a stable identity, an origin, and a set of components. Each component declares its type — decoration, light, or effect — its own preset-level parameters, and an offset from the composite origin. The composite is the only thing floor content names.

This collapses the current four-kind distinction. A wall torch is a composite with a decoration component, a light component offset slightly in front of and above it, and an effect component emitting from the flame rather than the wall plane. A bare ambient light is a composite with one light component at zero offset. The kind of an environment feature stops being a schema branch and becomes a consequence of what its composite contains.

### Placement versus assembly

| Decision                                                                        | Owner                | Evidence it needs           |
| ------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| Which components form this assembly, and where each sits relative to the origin | The composite preset | Live preview                |
| Which composite goes here, and where its origin sits                            | The floor placement  | Flat map, then live preview |

A placement may move the composite origin. It may not move, add, remove, or reconfigure a component. That boundary is what makes a composite reviewable: if a placement could nudge one component, the previewed assembly would no longer be what actually renders.

Anchoring rules survive unchanged. A wall-anchored composite still requires a solid anchor cell and an outward face with a passable observation cell; a cell-anchored composite still requires a passable base tile. Those are structural rules about where content may exist, not about what it looks like.

### Why the flat map now gets a preview

The superseded plan explicitly excluded a rendered preview from the floor authoring map, reasoning that placement is a flat spatial decision and only assembly needs an eye. That reasoning assumed no renderer existed to embed.

One does now, and the first authored floor it drew showed a key pickup at roughly twice its intended size, floating at eye height. The value that caused it had passed review, type checking, and every automated gate; it was wrong in the only medium that could show it. Placement judgements fail the same way composition judgements do, so both are made in the same surface and the exclusion is withdrawn.

The preview is a view of settled authored content. It consumes the same read-only scene projection the game consumes and holds no authority over it: nothing an author sees in the preview may become a source of gameplay truth, and the preview may not write content except through the same authoring mutations the flat map already uses.

### Where placement numbers live

Authored placement numbers currently sit in three unrelated homes: enemy display size and floor anchor travel with the enemy archetype table; the non-enemy world sprites carry their own separate record; and the first-person player layer's sizes and offsets are not authored at all, existing only as constants inside the renderer.

Requirement 7 converges the first two into one editable, persisted mechanism, because an editor that can tune only some sprites leaves two ways to change the same kind of number. The third is deliberately excluded: the player layer is drawn in screen space and never enters world projection, so it is judged against the viewport rather than against a placed camera. A separate standalone effort owns it.

Persisting these numbers as authored content follows the precedent already set by floor content: authored data lives as content with a parser that rejects unknown shapes, and the authoring surface writes it through a tooling-owned mutation rather than by editing source directly.

### Variation

Variation is expressed as separate named composites — a warm torch and a cold torch are two identities, not one identity with an override. This costs one catalog entry per variant and buys the guarantee that every combination in use was assembled deliberately.

### Ownership

Authored content owns the composite catalog, the placement numbers, and the start and exit markers. Presentation reads them and owns rendering, animation, timing, and decorative behavior. Floor content references composites by identity only. The authoring surface resolves an identity to a human-readable label, previews the result, and writes authored values, but never redefines what a composite means to the renderer.

### Child overview

| Child             | Focus                                                                                                  | Current document form                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `pantry_scene_01` | Composite preset contract, catalog ownership, schema version increase, and canonical content migration | Not started                                                                                          |
| `pantry_scene_02` | Floor Set Workbench alignment to the composite contract                                                | Not started                                                                                          |
| `pantry_scene_03` | Live rendered preview of the authored floor inside the authoring surface                               | Not started                                                                                          |
| `pantry_scene_04` | Author-placed camera on the editing grid, with edits reflected as they are made                        | Not started                                                                                          |
| `pantry_scene_05` | Component offset and world-sprite placement editing against the live preview                           | Not started                                                                                          |
| `pantry_scene_06` | Start and exit marker placement, closing the build-and-run loop                                        | [`pantry_scene_06_start_and_end_markers.sketch.md`](pantry_scene_06_start_and_end_markers.sketch.md) |

Recommended landing order: `pantry_scene_01` -> `pantry_scene_02` -> `pantry_scene_03` -> `pantry_scene_04` -> `pantry_scene_05` -> `pantry_scene_06`.

`pantry_scene_02` is numbered as a follow-on rather than a peer because the workbench cannot keep working across the contract change. The data layer lands first and the workbench is knowingly broken between the two, which is accepted here: the workbench is a development-only surface with no gameplay dependency, and pairing the two into one change would make an already large migration unreviewable.

`pantry_scene_03` carries the only real technical risk in this plan and is isolated for that reason. The shipped renderer assumes it owns a full-viewport surface and drives its own frame loop, resize observation, and asset lifetime; hosting it in a panel, possibly beside a second instance, re-opens every one of those assumptions.

`pantry_scene_05` follows the camera child rather than preceding it because an offset is judged by moving around it. Tuning against a fixed viewpoint would produce values that only look correct from one angle.

`pantry_scene_06` lands last because starting a run from the editor needs both the authored markers and the placed camera to exist. Its gameplay half is gone: the completion model was settled outside this plan and the exit rule lands as standalone work before the milestone, so what remains here is placement and the run-from-editor loop.

### Relationship to other plans

This plan supersedes Composite Environment Presets and carries its first two children over unchanged. Its third child, a dedicated composite assembly editor with its own preview surface, is withdrawn: once the authoring surface renders the authored floor from a placed camera, a second preview surface built only for assemblies would duplicate the harder half of the work.

The shipped presentation port adopted the flat per-placement form, so the composite contract arrives as a substitution the renderer has to follow rather than as a choice it still gets to make. Migrating canonical content is therefore this plan's work, and updating the rendering path to read composites travels with it.

The renderer this plan embeds is the one the presentation port already delivered, so nothing here is blocked on it. The preview children are the first work to host it outside a full-viewport surface.

## Non-Goals

1. Do not give composite presets, components, offsets, or authored placement numbers any gameplay meaning. They remain presentation-only and must not affect collision, visibility for rules, interaction, progression, or deterministic replay.
2. Do not add component types beyond decoration, light, and effect.
3. Do not retain the flat three-slot form as a supported alternative after migration.
4. Do not make the preview playable. It renders authored content from a camera and accepts camera movement; command interpretation, combat resolution, and progression stay with the game.
5. Do not tune the first-person player layer here. Its sizes and offsets are screen-space values with their own standalone effort.
6. Do not add a HUD, crosshair, combat text, health bar, or minimap to the preview.
7. Do not decide the presentation port's implementation order between the flat and composite contracts.
8. Do not expand key colors, gameplay entities, or any other content contract this migration happens to touch.

## Acceptance Criteria

1. Floor content references exactly one composite identity per environment placement, and no placement carries more than one preset identifier.
2. All four previously distinct environment-feature kinds are expressed through the same composite mechanism, with their differences carried by component content rather than by separate record shapes.
3. A composite defines each component's offset from its origin, and a placement can reposition the origin without being able to move, add, or remove a component.
4. Visual variants of the same assembly exist as separately named composites.
5. Canonical content migrates to the increased schema version with its current rendering intent preserved and no silently invented offsets.
6. The authoring surface shows the authored floor rendered as the game renders it, and an edit to terrain, placement, or a placement number is visible there without a rebuild.
7. An author places and moves the preview camera on the same grid being edited, and the rendered view matches what a player standing in that cell and facing that direction would see.
8. Component offsets and world-sprite display size and floor anchor are edited against the live view and persist as authored content, with no such value left reachable only by editing source.
9. A floor set's start position and its exit are placed and moved from the authoring surface, the start is visible while editing and hidden in play, and a run can be started from the authoring surface using them.
10. Existing anchor rules continue to hold: wall-anchored composites need a solid anchor with a passable observation face, and cell-anchored composites need a passable base tile.
11. Authoring, preview, and the authored numbers remain presentation-only, leaving gameplay outcomes and deterministic replay unchanged.
