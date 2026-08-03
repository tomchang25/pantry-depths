# Enemy And Structure Block Models

> **Draft — not queued.** This plan is deliberately incomplete: its open questions are answered by the three-scene spike (`three_scene.plan.md`), and it is filled out and reviewed only after that verdict lands. It authorizes nothing in this state.

## Goal

Give every enemy and every structure the game draws an authored low-poly block model with table-driven animation clips, replacing the two things bodies are drawn from today: baked sprite atlases, whose cost is roughly 50 MB of PNG per authored enemy and does not amortise, and procedural box stacks, which are code rather than content and cannot be authored without editing the renderer.

## Requirements

Provisional; renumber and complete after the spike.

1. Every boned enemy type is one block model with one clip set, built by the same script-driven Blender pipeline the block skeleton already uses, so authoring stays a numeric-table edit rather than a hand-animation task.
2. Every structure — the two altars, the hot spring, the extraction beacon, the stairs, the plinth, the barricade — becomes an authored model or a declared procedural assembly, decided per structure, so a structure can be changed without editing renderer code.
3. Model scale and display numbers stay authored content, extending the existing entity-display table rather than inventing a second authoring surface.
4. The entity workbench remains the judging surface: every model and clip is viewable there at game distance, at simulation-given clip lengths.

## Open Questions

Answered by the three-scene spike; each blocks queueing until answered.

1. Soft bodies: do slimes become deforming block models, or keep a shader-side treatment the spike found better?
2. Texturing: do models sample the same procedural texture generators as the walls, or carry baked/vertex colors — what did the spike's look verdict prefer?
3. Structure split: which structures earned authored models and which stayed procedural assemblies in the spike?
4. Clip debt: the tracker records that every clip except idle and walk reads wrong on the current bake; does that re-authoring fold into this plan or stay its own supervised pass?
5. Pipeline home: what does the spike's copied asset/loader code imply about where model loading lives after graduation?

## Non-Goals

1. No new enemy kinds and no behaviour or balance changes — this is a re-clothing of what exists.
2. No renderer work: the runtime that consumes these models is the graduation plan's subject, not this one's.

## Acceptance Criteria

To be written with the requirements once the open questions are closed. The known fixed point: judged per body and per structure in the entity workbench and in play, by a person, with no new tests.
