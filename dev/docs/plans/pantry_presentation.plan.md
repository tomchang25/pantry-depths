# Pantry Depths Presentation Port

## Goal

Preserve the original prototype's distinctive first-person dungeon rendering and procedural audio while moving presentation behind a read-only snapshot and semantic-event boundary. Then add the fixed-image enemy pipeline needed by V1 without allowing the port to become a renderer rewrite or a gameplay owner.

## Requirements

1. Port the retained raycasting, floor and ceiling projection, procedural environment textures, atmosphere, hands, minimap drawing, and synthesized audio with visual and auditory behavior equivalent to the reference prototype.
2. Keep presentation downstream of gameplay: it may interpolate snapshots and realize semantic events, but it never validates commands, changes health, removes entities, opens doors, or decides when an Action completes.
3. Separate the faithful port from all improvements, because mixing movement with redesign would make reference comparison impossible and recreate the earlier presentation-refactor failure mode.
4. Load fixed 512 x 512 enemy images asynchronously, block play behind a clear loading state until required assets are ready, and offer a readable retry state when a required asset fails.
5. Apply runtime distance darkening and warm torch tint to enemy images, and use pre-baked hit-flash variants so sliced sprite drawing does not rebuild filters hundreds of times per frame.
6. Preserve a stable reduced-motion rendering mode and a silent degraded mode when browser audio is unavailable; neither capability may change gameplay state.

## Design

### Presentation boundary

Presentation consumes a camera pose, visible world snapshot, authored visual configuration, and semantic events. It returns pixels and sound only. Gameplay state is already settled when an animation begins, and a dropped frame, hidden tab, missing audio capability, or interrupted animation cannot alter the run.

The retained port deliberately excludes the prototype's AI, continuous movement, free camera, pointer lock, mouse attack, running, chests, coins, potions, inventory, old HUD, combat rules, win conditions, and world data. Deleting these owners is part of the port; recreating them inside presentation is forbidden.

### Faithful-port parity envelope

Parity means the retained presentation capabilities can be compared from equivalent camera and world snapshots, not that the complete prototype remains visible or playable.

The faithful port preserves:

- Canvas 2D column-based DDA raycasting and depth-buffer occlusion.
- Scanline floor and ceiling perspective sampling.
- Procedurally drawn stone, old masonry, door, grate, floor, and ceiling surfaces.
- The existing field of view, horizon placement, wall orientation shading, purple distance fog, near-camera warm torch contribution, and render-depth behavior.
- An internal render scale of 0.55 with an approximate maximum internal resolution of 1050 x 650.
- Procedural atmosphere including glow, fog, vignette, embers, subtle grain, and torch flicker.
- The torch-and-knife first-person hands and the existing sinusoidal attack swing shape.
- Billboard projection, far-to-near sprite ordering, per-column depth rejection, minimap drawing primitives, ambient hum, procedural noise, and synthesized impact sounds.

Random flicker, grain, embers, and audio noise remain presentation-only variation. They are not seeded gameplay inputs and never enter deterministic state.

A retained scene viewed at matching pose should preserve geometry, scale, occlusion, palette, material character, atmosphere, and hand composition closely enough for side-by-side review. Pixel identity is not required where presentation-only noise intentionally varies.

### Fixed enemy image pipeline

Each enemy type uses one transparent 512 x 512 idle image. The princess additionally has one defeated image. Image frames are flat-lit and neutral so runtime lighting remains the only light-direction owner.

| Enemy    | Display scale | Vertical anchor |
| -------- | ------------: | --------------: |
| Bat      |          0.40 |           -0.25 |
| Goblin   |          0.70 |               0 |
| Skeleton |          0.85 |               0 |
| Guard    |          1.05 |               0 |
| Princess |          1.30 |               0 |

Display size is authored data; changing size never requires regenerating the image. Character art is produced by the separate sprite-art deliverable. Until that deliverable lands, the pipeline accepts consistent procedural placeholders without changing its loading, projection, lighting, or hit-feedback contracts.

Required images load before ordinary play becomes interactive. A failed required image keeps the game in a clear error state with retry rather than starting with missing enemies. Successful loading prepares an additional white hit-flash image once per source image by compositing white over its alpha. Hit events switch to this prepared image and never apply a per-slice filter.

Enemy images receive the same distance attenuation family as walls plus the near-camera warm torch contribution. Their alpha may still fade at long range, but alpha alone is insufficient because a normally lit image would otherwise glow against the dark corridor.

### Motion and audio capability

Reduced-motion mode removes non-essential bob, shake, grain motion, ember drift, and decorative oscillation while preserving readable state transitions and required combat cues. Essential event feedback may use a brief opacity, outline, or pose change without large camera motion.

When Web Audio is unavailable or cannot start, play remains fully usable in silence and the presentation exposes a degraded capability state for the interface to describe. Muting is a presentation preference only and has no effect on event generation.

### Child overview

| Child                    | Focus                                                                                                                                | Current document form |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `pantry_presentation_01` | Faithful port of retained raycasting, projection, procedural environment, atmosphere, hands, minimap drawing, and audio capabilities | Not started           |
| `pantry_presentation_02` | Asynchronous fixed-image loading, loading and retry states, image sizing, distance and torch tint, and pre-baked hit flash           | Not started           |

Recommended landing order: `pantry_presentation_01` -> `pantry_presentation_02`.

The faithful port has no gameplay dependency and may proceed in parallel with early rules work. The fixed-image pipeline depends on the faithful sprite projection path but not on final enemy artwork.

## Non-Goals

1. Do not implement gameplay rules, input interpretation, HUD state, debug viewers, death, victory, or the ending sequence.
2. Do not improve rendering behavior during the faithful port, even when the reference implementation is awkward; record any desired improvement for the second child or future work.
3. Do not add WebGL, a scene graph, animated sprite frames, sprite sheets, an atlas packer, wall-image assets, dynamic shadows, variable wall heights, free look, or higher render resolution.
4. Do not produce the final enemy artwork inside this plan; the separate sprite-art deliverable owns visual style and source generation.
5. Do not make animation lifetime or asset state authoritative for entity existence or gameplay progression.

## Acceptance Criteria

1. Equivalent reference snapshots produce recognizably equivalent geometry, occlusion, materials, palette, fog, torch warmth, atmosphere, hands, minimap drawing, and procedural sound character within the retained parity envelope.
2. The faithful port contains none of the prototype's removed gameplay, AI, inventory, pointer-lock, mouse-look, or HUD behavior and introduces no presentation redesign.
3. Presentation can render settled gameplay snapshots and semantic events without importing or mutating gameplay truth.
4. Required enemy images load before play, failed loads show a retryable error, and successful images use authored scale and anchor values with correct depth occlusion.
5. Enemy images darken with distance, gain compatible near-torch warmth, and flash on hit through prepared variants without per-slice filtering.
6. Reduced-motion and silent-audio modes preserve all information and leave gameplay outcomes unchanged.
