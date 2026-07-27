# Complete 2.5D Gameplay Renderer

Parent Plan: `pantry_presentation.plan.md`

## Goal

Deliver one coherent 2.5D gameplay-rendering surface that ports the retained prototype presentation and immediately completes it with fixed enemy images and authored environment features. The result must render settled gameplay truth without owning rules, input, HUD state, or action completion.

## Summary

The ordinary product surface will replace its placeholder with a full-canvas first-person view of the authored floor. It will preserve the reference raycasting geometry, projected floor and ceiling, procedural materials, purple fog, warm torch light, atmosphere, the approved left-hand torch and right-hand long-sword viewmodel, and synthesized sound character while adapting the camera to discrete gameplay snapshots.

The same delivery will load fifteen separately baked 512 x 512 enemy images: normal, attack, and hurt states for green, yellow, blue, red, and purple slimes. It will add a blocking loading state, retryable failure state, authored enemy scale and anchor data, distance and torch lighting, dynamic white hit VFX, and a death effect that splits the hurt image into two pieces. Runtime performs no color baking or per-slice filtering.

Authored wall decorations, tile decorations, lights, and emitters will render through presentation-owned presets. The loaded sprite manifest also includes three colored keys, one stair, hot-spring, bones, wall-torch, wall-spike, player-viewmodel, and sword-slash image. Active gameplay entities will be visible through presentation forms appropriate to their contracts, while doors and hidden walls remain raycast surfaces and inactive blockers disappear according to the settled snapshot. No HUD, crosshair, health bar, combat text, or 2D minimap is included.

The implementation keeps the faithful raycaster and the new image/effect layers internally separable for reference comparison, but lands them as one usable renderer. Reduced motion suppresses non-essential motion, and unavailable or blocked Web Audio produces a usable silent mode. The presentation loop and asset lifecycle never mutate `GameSession`, `RunSnapshot`, authored floor content, or semantic events.

## Relational Context

- `src/app/` composes `GameSession`, canonical content, and presentation. Presentation imports read-only contracts from `src/core/` and `src/content/`; it never imports `src/runtime/` or dispatches commands.
- `RunWorld` and `RunSnapshot` remain gameplay truth. `FloorSetSource.environmentFeatures` remains presentation-only authored input and must not be copied into `RunWorld` or entity state.
- The renderer receives a camera pose plus settled world/snapshot data. The ordinary surface derives an initial centered pose from the snapshot; the later Feel stream may supply interpolated poses and semantic events without changing renderer ownership.
- Active doors and breakable walls participate in ray occlusion as presentation surfaces over passable base tiles. Their disappearance is read from entity snapshots; animation or asset state cannot decide whether a cell is traversable.
- Enemy identity comes from `WorldEntity.appearanceId`; color, scale, vertical anchor, and the three independently loaded state URLs remain authored content. Runtime must not derive one color from another.
- Enemy hit feedback consumes `entityDamaged` events, switches to the baked hurt image, and draws a short event-time white silhouette through the same depth slices. It must not apply Canvas filters inside the per-column sprite loop.
- Enemy retaliation consumes `entityRetaliated` events and briefly selects the baked attack image. Enemy defeat consumes `entityDefeated`, retains the hurt image as presentation-only event material, and splits it into two falling pieces without keeping the entity active.
- Environment feature identifiers select presentation-owned visual, light, and emitter presets. Unsupported optional presets omit only their effect and never change collision or deterministic outcomes.
- Web Audio starts only after browser capability and activation permit it. Audio failure changes only the reported presentation capability and never blocks rendering or play.
- The loading/error shell is application status UI, not gameplay HUD. The rendered scene contains no minimap, crosshair, health display, damage text, or enemy health bars.

## Scope

### Included

- Canvas 2D floor/ceiling projection, DDA walls, depth-buffered billboards, procedural materials, atmosphere, hands, and resize/render lifecycle.
- Snapshot-to-scene projection for terrain, active gameplay entities, and authored environment features.
- Fifteen separately baked 512 x 512 slime state images plus the approved player, attack-VFX, pickup, floor-decoration, and wall-decoration sprite manifest.
- Asynchronous loading and retry, sprite lighting, dynamic hit/death effects, presentation-owned environment presets, reduced-motion behavior, procedural ambient/impact audio, and silent degradation.
- Ordinary-route canvas composition and loading/error state without gameplay controls or HUD.

### Excluded

- Input interpretation, command dispatch, action locking, HUD, crosshair, minimap, combat text, death/victory UI, and ending sequences.
- Themed or archetype-specific enemy artwork, frame-by-frame animation, WebGL, scene graphs, dynamic shadows, variable wall heights, or rendering redesign.
- Gameplay, content topology, balance, or semantic-event changes.

## Files to Change

| File                                                         | Change Size | Purpose                                                                                                 |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| `assets/enemies/*`                                           | Large       | Editable green slime state masters and offline color-variant sources.                                   |
| `assets/presentation/*`                                      | Large       | Editable player-viewmodel, attack-VFX, pickup, floor-decoration, and wall-decoration sources.           |
| `src/content/enemies/assets/*.png`                           | Large       | Fifteen transparent 512 x 512 slime state images loaded independently through Vite.                     |
| `src/content/presentation/assets/*.png`                      | Large       | Three keys plus stair, spring, bones, torch, spikes, player-viewmodel, and sword-slash runtime sprites. |
| `src/content/combat/enemies.ts`                              | Small       | Author each archetype's slime color, display scale, and vertical anchor.                                |
| `src/content/presentation/presentation-asset-definitions.ts` | Medium      | Author every independent state and world-sprite URL with no runtime color generation.                   |
| `src/presentation/render-scene.ts`                           | Large       | Project canonical floor, world, snapshot, and camera inputs into read-only render surfaces.             |
| `src/presentation/procedural-textures.ts`                    | Medium      | Port retained wall, floor, ceiling, and procedural gameplay-surface art.                                |
| `src/presentation/presentation-image-loader.ts`              | Medium      | Load and validate the complete required manifest and report retryable failures.                         |
| `src/presentation/environment-presets.ts`                    | Medium      | Realize authored decoration, light, and emitter identifiers without gameplay ownership.                 |
| `src/presentation/canvas-gameplay-renderer.ts`               | Large       | Port projection, DDA, depth-buffered sprites, atmosphere, hands, and 0.55 internal render scaling.      |
| `src/presentation/procedural-audio.ts`                       | Medium      | Realize ambient and semantic-event sounds with silent capability degradation.                           |
| `src/presentation/game-presentation.ts`                      | Large       | Own asset, resize, media-query, animation-frame, event-timeline, and cleanup lifecycle.                 |
| `src/app/game-surface.ts`                                    | Medium      | Compose the ordinary canvas with accessible loading and retry states.                                   |
| `src/app/game-surface.css`                                   | Medium      | Provide a full-viewport render surface and readable non-HUD status states.                              |
| `src/app/main.ts`                                            | Small       | Replace only the ordinary placeholder with the composed presentation surface.                           |
| `test/unit/presentation/*.test.ts`                           | Medium      | Cover pure scene projection, ray/depth behavior, asset-state transitions, and reduced-motion timelines. |

## Execution Outline

1. Produce and inspect the approved sprite manifest, offline-bake every enemy color/state combination, and add the authored asset catalog so runtime loads each PNG independently.
2. Build pure render-scene projection and focused tests for floor selection, camera conversion, active blockers, entity visuals, environment annotations, and depth calculations.
3. Port procedural textures and the faithful Canvas raycaster, preserving reference geometry, palette, internal scaling, atmosphere, and hands while omitting all HUD drawing.
4. Layer stateful enemy images, event-time white flash, hurt-image death splitting, distance/torch lighting, and authored environment presets onto the established depth and projection seams.
5. Add audio, reduced-motion, loading/retry, resize, animation-frame, and cleanup ownership; then compose the ordinary route without adding command input.
6. Run focused unit/static checks, the aggregate verification gate, and a manual browser comparison of the authored B1 scene against the retained reference envelope.

## Implementation Notes

- Camera coordinates use cell centers and cardinal-facing angles. Camera pose stays an explicit renderer input so later interpolation does not alter snapshot truth.
- Preserve `FOV = PI / 3`, `MAX_DEPTH = 18`, horizon near `0.49`, render scale `0.55`, and approximate internal bounds `1050 x 650` unless live reference evidence requires a parity correction.
- Keep expensive pixel preparation outside frame loops: cache procedural texture pixels and build the short white silhouette once per hit event rather than filtering individual sprite slices.
- The sprite loop remains far-to-near and depth-tests each drawn slice. Distance darkening must affect RGB, not only alpha.
- Resize observers, media-query listeners, activation listeners, animation frames, generated object URLs, and audio nodes require explicit teardown.
- Loading and error copy uses semantic status markup; retry is a native button. The canvas has an accessible label but does not attempt to expose visual HUD data.

## Edge Cases

| Case                                                                                          | Expected Handling                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A required enemy image fails or is not 512 x 512, or another required sprite fails validation | Keep the scene non-interactive, show the failed asset in a readable error, and retry the complete required set on request.      |
| Canvas 2D is unavailable                                                                      | Show a readable fatal presentation error without mutating gameplay state.                                                       |
| Web Audio is missing, suspended, or rejects activation                                        | Continue rendering silently and expose degraded audio capability.                                                               |
| Reduced motion changes while mounted                                                          | Immediately switch non-essential bob, shake, grain motion, ember drift, and decorative oscillation without restarting gameplay. |
| An optional environment preset is unknown                                                     | Omit that visual effect while preserving the remaining scene and gameplay snapshot.                                             |
| An enemy becomes inactive before its death effect finishes                                    | Remove it from the settled scene and render only the two hurt-image pieces owned by the decorative event timeline.              |
| The canvas is hidden or resized to zero                                                       | Avoid invalid allocations, then reconcile from current time and latest snapshot when visible again.                             |

## Acceptance Criteria

1. The ordinary route shows a continuously rendered first-person authored-floor scene after a clear loading phase, with no HUD or 2D minimap.
2. Matching camera and world inputs preserve the reference geometry, occlusion, material character, palette, fog, torch warmth, atmosphere, and hand composition within the faithful parity envelope.
3. Active doors and breakable walls occlude correctly, inactive blockers open visually, and visible gameplay entities reflect the settled snapshot without presentation-side rule decisions.
4. All fifteen enemy state images and the approved world/player sprite manifest are validated and ready before rendering starts; failures remain retryable, and authored scale and anchor values control projection.
5. Enemy images darken with distance, receive compatible near-torch warmth, remain depth-occluded, select baked attack/hurt states from semantic events, and use dynamic white hit VFX without per-slice filters.
6. Defeated enemies use the hurt image for a two-piece falling death effect without remaining active or authoritative.
7. Authored wall and tile decorations, ambient lights, and emitters render from presentation-only floor annotations without entering gameplay state.
8. Semantic damage and retaliation events can drive hands, enemy state, hit/death VFX, and synthesized impact audio after gameplay has already settled.
9. Reduced motion preserves readable feedback without non-essential motion, and unavailable audio leaves a fully usable silent renderer.
10. Presentation teardown releases every browser lifecycle resource and does not leave animation or audio work running after the surface is replaced.
11. Automated verification passes, and manual browser evidence confirms the B1 visual composition while restating the standing absence of browser E2E coverage.
