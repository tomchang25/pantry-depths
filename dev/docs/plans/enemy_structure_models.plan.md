# Enemy And Structure Block Models

> **Draft — not queued.** This plan is deliberately incomplete. The spike it was waiting on returned a viable verdict on 2026-08-03 and its findings are folded into the questions below; what remains is to complete the requirements and acceptance criteria against them. It authorizes nothing in this state.

## Goal

Give every enemy and every structure the game draws an authored low-poly block model with table-driven animation clips, replacing the two things bodies are drawn from today: baked sprite atlases, whose cost is roughly 50 MB of PNG per authored enemy and does not amortise, and procedural box stacks, which are code rather than content and cannot be authored without editing the renderer.

## Requirements

Provisional; renumber and complete against the closed questions below.

1. Every boned enemy type is one block model with one clip set, built by the same script-driven Blender pipeline the block skeleton already uses, so authoring stays a numeric-table edit rather than a hand-animation task.
2. Every structure — the two altars, the hot spring, the extraction beacon, the stairs, the plinth, the barricade — becomes an authored model or a declared procedural assembly, decided per structure, so a structure can be changed without editing renderer code.
3. Model scale and display numbers stay authored content, extending the existing entity-display table rather than inventing a second authoring surface.
4. The entity workbench remains the judging surface: every model and clip is viewable there at game distance, at simulation-given clip lengths.

## Open Questions

The first three are closed by what the spike built and the verdict accepted. The last two remain, and each blocks queueing until answered.

1. ~~Soft bodies: do slimes become deforming block models, or keep a shader-side treatment?~~ **Closed 2026-08-03**: neither — the programmatic blob was rejected outright, so slimes join the authored roster this plan builds, as modelled bodies with faces rather than shapes a renderer computes. What remains open is only their clip treatment: whether a soft body's squash-and-lunge is armature clips like the skeletons' or a small set of blend-shape poses.
2. ~~Texturing: do models sample the same procedural texture generators as the walls, or carry authored colours?~~ **Closed 2026-08-03**: authored colours. Each mesh's base colour is read from the model once and then shaded analytically by distance and the light list — the same formula every other body in the scene takes — and no body samples a wall texture. The verdict accepted that look, so a model carries its colours and the renderer carries the light.
3. ~~Structure split: which structures earn authored models and which stay procedural assemblies?~~ **Closed 2026-08-03, in the negative**: none earned one. Both altars, the spring, the extraction beacon, the stairs, the barricade and the emplacement were all built as procedural box assemblies and all passed the verdict as built. The live question is no longer which of them qualified but which of them is worth authoring at all, and it now has a default: leave them as assemblies until one is judged wanting.
4. Clip debt: the tracker records that every clip except idle and walk reads wrong on the current bake; does that re-authoring fold into this plan or stay its own supervised pass?
5. Pipeline home: where does model loading live? The spike loaded a glTF copied into its own folder, and the graduation plan moves the asset into content and the loader into the presentation layer alongside the runtime — so the shape is settled and what is open is only whether this plan's roster needs anything that arrangement does not already give it.

## Non-Goals

1. No new enemy kinds and no behaviour or balance changes — this is a re-clothing of what exists.
2. No renderer work: the runtime that consumes these models is the graduation plan's subject (`three_scene_graduation.plan.md`), not this one's. That plan additionally records the soft bodies as a knowing regression pointed at this one, so the slime roster is the first thing here anybody will ask for.

## Acceptance Criteria

To be written with the requirements once the open questions are closed. The known fixed point: judged per body and per structure in the entity workbench and in play, by a person, with no new tests.
