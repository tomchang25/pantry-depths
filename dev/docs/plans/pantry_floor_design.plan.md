# Pantry Depths Final Floor Design and Balance

## Goal

Turn the provisional five-floor set into the final V1 world after the playable presentation is available, so layout readability, encounter pacing, environmental composition, and challenge can be judged together through actual play. This plan owns the integrated content-tuning pass rather than treating final floors as a rules implementation detail.

## Requirements

1. Begin final floor work only after the Presentation Port can render and play authored floors, because the debug viewers prove topology and numbers but cannot prove first-person readability, sightlines, atmosphere, or pacing.
2. Hand-adjust all five layouts, gameplay entity placements, presentation-only environment annotations, and required-route annotations while preserving the established floor sizes, themes, landmarks, and progression order.
3. Revalidate every content revision through structural validation, deterministic route replay, and generated balance evidence, because a visually improved floor may not break key order, connectivity, solvability, or deterministic outcomes.
4. Tune the required route and optional encounters through repeated manual play until navigation, pressure, recovery, and pacing feel coherent; no route cost, remaining-health target, enemy cost, or other numeric balance threshold is prescribed.
5. Keep the final world as committed fixed content and keep offline generation outside runtime, so presentation-informed iteration never introduces runtime generation or procedural recovery behavior.
6. Place the B5 exit so that the final encounter is unavoidable by geometry alone. The exit carries no unlock condition, so nothing but layout prevents a player from walking past the hardest enemy, and structural validation proves only that some route exists — not that every route passes through one.

## Design

### Entry gate and ownership

This plan starts after the Presentation Port is complete enough to render the authored geometry, entities, lighting, effects, and wall-mounted details used for evaluation. The Rules and Content plan supplies the deterministic runtime, provisional floors, environment-feature contract, validators, replay, and report; this plan consumes those capabilities without adding a new gameplay rule or presentation system.

It also needs the standalone Run Exit change to have landed, because B5's final shape depends on where the exit sits and on the final encounter blocking the way to it.

The final content pass owns:

- The exact walkable geometry and dead-end structure of all five floors.
- Final stairs, keys, doors, enemies, breakable wall, hot spring, exit, and landmark placement.
- Final required-route annotations and optional-encounter placement.
- Final placement and preset selection for presentation-only environment features.
- The resulting play experience and regenerated descriptive balance evidence.

### Integrated iteration loop

Each revision follows one loop:

1. Adjust authored floor content.
2. Revalidate topology, entity placement, stairs, key order, door order, and structural solvability.
3. Replay the required route and regenerate descriptive balance evidence from current rules and content.
4. Play the revised floors through the presentation and judge navigation clarity, sightlines, landmarks, encounter pacing, challenge, recovery, and environmental composition.
5. Repeat until structural evidence is sound and manual play confirms the intended experience without applying a numeric balance gate.

This iteration is the work itself, not preparation for another final-content slice. Completion means the provisional content has been replaced by the hand-reviewed V1 floors and the current report describes that final set.

### Child overview

| Child                    | Focus                                                                                          | Current document form |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------- |
| `pantry_floor_design_01` | Final five-floor layouts, entity placement, required-route annotations, and integrated balance | Not started           |

Recommended landing order: `pantry_floor_design_01`, after the Presentation Port is available.

## Non-Goals

1. Do not add or change combat, movement, interaction, progression, death, or victory rules.
2. Do not add renderer capabilities, visual-effect systems, input feel, HUD behavior, audio behavior, or ending logic.
3. Do not redesign the offline generator or authoring workbench unless a separately approved tooling plan is promoted.
4. Do not add a sixth floor, new key color, new door effect, new enemy type, runtime generation, or save behavior.

## Acceptance Criteria

1. All five final floors are hand-reviewed through the playable presentation and preserve their required themes, landmarks, progression order, and fixed sizes.
2. Final geometry and entity placement pass connectivity, placement, stair-link, key-order, door-order, and start-to-exit structural checks.
3. The final required route is represented by authored annotations, replays deterministically to a completed departure through the exit, and is manually played through the presentation until its challenge, pacing, and recovery experience are accepted without a numeric balance threshold.
4. The generated balance report describes the final floor placements, topology findings, combat matrix, and observed route outcomes without provisional labels, hand-maintained numeric copies, or pass/fail balance targets.
5. Runtime loads only the committed final floor content and contains no map generator or presentation-dependent gameplay decision.
6. Walking from the B5 stairs to the exit without meeting the final encounter is impossible in the shipped layout, and that claim was checked by play rather than inferred from the validator.
