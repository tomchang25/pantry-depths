# Pantry Depths Presentation Port

> **Status**: Shipped and archived. `pantry_presentation_01` delivered the complete 2.5D gameplay renderer.
>
> Three acceptance gaps were explicitly accepted at closeout rather than met. Criterion 1 (side-by-side parity against the retained prototype) and criterion 7 (reduced-motion and silent-audio behaviour) were never exercised in a browser; the project has no automated coverage for either and both need a manual session. The event half of criteria 3 and 5 — hurt and attack poses, the white hit flash, the two-piece death, and impact audio — is implemented but has never executed, because command input is a Non-Goal of this plan and no caller yet delivers semantic events. That gap is structural and cannot be closed inside this plan; `pantry_feel` is the first work that can exercise it, and it inherits the obligation.

## Goal

Preserve the original prototype's distinctive first-person dungeon rendering and procedural audio while moving presentation behind a read-only snapshot and semantic-event boundary. Deliver the faithful renderer, fixed-image enemy pipeline, and authored environment features together as one complete 2.5D gameplay-rendering slice without allowing the port to become a renderer rewrite or a gameplay owner.

## Requirements

1. Port the retained raycasting, floor and ceiling projection, procedural environment textures, atmosphere, hands, and synthesized audio with visual and auditory behavior equivalent to the reference prototype.
2. Keep presentation downstream of gameplay: it may interpolate snapshots and realize semantic events, but it never validates commands, changes health, removes entities, opens doors, or decides when an Action completes.
3. Keep faithful-port code and evidence internally separable from the fixed-image and authored-feature additions, because a single complete delivery still needs a trustworthy reference-comparison baseline and must not become a renderer redesign.
4. Load separately baked 512 x 512 normal, attack, and hurt images for each of the five enemy colors asynchronously, block play behind a clear loading state until required assets are ready, and offer a readable retry state when a required asset fails.
5. Apply runtime distance darkening and warm torch tint to enemy images, use a depth-aware dynamic white-flash effect without per-slice filters, and realize death by splitting the hurt image into two presentation-only pieces.
6. Render authored wall-face decorations, ambient lights, emitters, and effect presets from the presentation-only floor contract rather than turning them into gameplay entities.
7. Preserve a stable reduced-motion rendering mode and a silent degraded mode when browser audio is unavailable; neither capability may change gameplay state.

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
- The left-hand torch and right-hand long-sword first-person viewmodel plus the existing sinusoidal attack swing shape.
- Billboard projection, far-to-near sprite ordering, per-column depth rejection, ambient hum, procedural noise, and synthesized impact sounds.

Random flicker, grain, embers, and audio noise remain presentation-only variation. They are not seeded gameplay inputs and never enter deterministic state.

A retained scene viewed at matching pose should preserve geometry, scale, occlusion, palette, material character, atmosphere, and hand composition closely enough for side-by-side review. Pixel identity is not required where presentation-only noise intentionally varies.

### Fixed enemy image pipeline

Each enemy type is represented by a separately baked colored slime with transparent 512 x 512 normal, attack, and hurt images. Runtime never recolors a shared source. Image frames are flat-lit and neutral so runtime lighting remains the only light-direction owner.

| Enemy    | Display scale | Vertical anchor |
| -------- | ------------: | --------------: |
| Bat      |          0.40 |           -0.25 |
| Goblin   |          0.70 |               0 |
| Skeleton |          0.85 |               0 |
| Guard    |          1.05 |               0 |
| Princess |          1.30 |               0 |

The color mapping is green Bat, yellow Goblin, blue Skeleton, red Guard, and purple Princess. Display size is authored data; changing size never requires regenerating the image. The five colors share one slime design language and are baked offline into independent runtime assets for every state.

Required images load before ordinary play becomes interactive. A failed required image keeps the game in a clear error state with retry rather than starting with missing enemies. Hit events switch to the baked hurt pose and apply a short depth-aware white silhouette as dynamic VFX; the effect does not use `ctx.filter` inside the sliced draw loop. Defeat events split the hurt image into two falling, fading pieces after gameplay has already marked the entity inactive.

Enemy images receive the same distance attenuation family as walls plus the near-camera warm torch contribution. Their alpha may still fade at long range, but alpha alone is insufficient because a normally lit image would otherwise glow against the dark corridor.

### Authored environment features

The final presentation slice consumes the floor-content contract established by the last Rules child. Wall-mounted features use authored outward-face anchors, while ambient lights and emitters use floor-owned positions and named presets. Content chooses placement and preset identity; presentation owns rendering, animation, timing, and decorative variation.

That contract has a queued successor. `pantry_scene` replaces the current flat per-placement preset references with composite presets that carry their own components and offsets. Which of the two this plan implements first, and whether it implements both, stays this plan's decision — but the rendering path must not harden around the flat shape, because a renderer that assumes one identifier per visual layer would make the composite contract a migration rather than a substitution.

These annotations remain read-only presentation input. A missing or unsupported optional annotation may omit its visual effect, but it cannot change collision, visibility for gameplay rules, interaction, damage, progression, or deterministic replay.

### Motion and audio capability

Reduced-motion mode removes non-essential bob, shake, grain motion, ember drift, and decorative oscillation while preserving readable state transitions and required combat cues. Essential event feedback may use a brief opacity, outline, or pose change without large camera motion.

When Web Audio is unavailable or cannot start, play remains fully usable in silence and the presentation exposes a degraded capability state for the interface to describe. Muting is a presentation preference only and has no effect on event generation.

### Merged delivery boundary

The renderer lands as one complete child so the first reviewable product surface is a coherent 2.5D authored-floor scene rather than a deliberately incomplete intermediate renderer. Its implementation still establishes and verifies the faithful raycaster before layering fixed enemy state images, runtime sprite lighting, dynamic hit/death VFX, and authored environment effects onto the same projection and depth seams.

### Child overview

| Child                    | Focus                                                                                                                                                                   | Current document form                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pantry_presentation_01` | Complete 2.5D gameplay renderer: faithful raycasting and atmosphere, offline-baked state sprites, authored environment features, hands, audio, and capability fallbacks | Shipped — `pantry_presentation_01_complete_renderer.implementation_spec.md` |

The combined child depended on the authored environment-feature contract from the last Rules child. It shipped the deliberately minimal slime and gameplay sprite set and adopted the flat per-placement preset form; the composite form defined by `pantry_scene` remains a later substitution.

## Non-Goals

1. Do not implement gameplay rules, input interpretation, HUD state, debug viewers, death, victory, or the ending sequence.
2. Do not improve rendering behavior inside the faithful core, even when the reference implementation is awkward; record any desired redesign for the Feel and Endgame stream or future work.
3. Do not add WebGL, a scene graph, animated sprite frames, sprite sheets, an atlas packer, wall-image assets, dynamic shadows, variable wall heights, free look, or higher render resolution.
4. Do not add themed or archetype-specific enemy art beyond the approved five-color slime set.
5. Do not make animation lifetime or asset state authoritative for entity existence or gameplay progression.
6. Do not add a HUD, crosshair, combat text, health bars, or 2D minimap; those surfaces belong to the separate Feel and Endgame stream.

## Acceptance Criteria

1. Equivalent reference snapshots produce recognizably equivalent geometry, occlusion, materials, palette, fog, torch warmth, atmosphere, hands, and procedural sound character within the retained parity envelope.
2. The faithful port contains none of the prototype's removed gameplay, AI, inventory, pointer-lock, mouse-look, or HUD behavior and introduces no presentation redesign.
3. Presentation can render settled gameplay snapshots and semantic events without importing or mutating gameplay truth.
4. All separately baked enemy state images load before play, failed loads show a retryable error, and successful images use authored scale and anchor values with correct depth occlusion.
5. Enemy images darken with distance, gain compatible near-torch warmth, use the hurt pose plus dynamic white VFX on hit, and split the hurt pose on death without per-slice filtering.
6. Authored wall-face decorations, ambient lights, emitters, and effect presets render from presentation-only floor data — in either the flat per-placement preset form or the composite preset form defined by `pantry_scene`, whichever this plan adopts — without becoming gameplay entities or affecting deterministic outcomes.
7. Reduced-motion and silent-audio modes preserve all information and leave gameplay outcomes unchanged.
