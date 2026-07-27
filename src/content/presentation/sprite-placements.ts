export type SpritePlacement = Readonly<{
  scale: number;
  verticalAnchor: number;
}>;

/**
 * Authored display size and floor-relative anchor for every non-enemy world sprite.
 *
 * Enemy placement lives with the archetype table in `@/content/combat/enemies`. Both records are
 * content, not renderer constants: `scale` is a multiple of one cell's height and `verticalAnchor`
 * is measured from the floor line, where 0 stands on the ground and a negative value floats.
 */
export const WORLD_SPRITE_PLACEMENTS = {
  key: { scale: 0.22, verticalAnchor: -0.35 },
  stair: { scale: 1.15, verticalAnchor: 0 },
  hotSpring: { scale: 1.05, verticalAnchor: 0 },
  bones: { scale: 0.72, verticalAnchor: 0 },
  wallTorch: { scale: 0.58, verticalAnchor: -0.08 },
  wallSpikes: { scale: 0.82, verticalAnchor: 0.08 },
} as const satisfies Readonly<Record<string, SpritePlacement>>;
