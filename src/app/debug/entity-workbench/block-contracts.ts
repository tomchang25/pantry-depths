/**
 * What the workbench knows about the rig that the renderer does not need to.
 *
 * The weapon and clip names live in `@/presentation/scene-3d/block-clips`, which is the single owner
 * of the rig's vocabulary and the contract with the Blender build script. What stays here is the
 * bake's camera and lights, the bone names this tool reaches for by hand, and the rules about a
 * thrown weapon and a swing arc — none of which the shipped renderer asks about, because it draws a
 * body the simulation is driving rather than a body somebody is scrubbing.
 */

import type { BlockClip, BlockWeapon } from "@/presentation/scene-3d/block-clips";

/** The one clip the swing arc is drawn over. */
export const ARC_CLIP: BlockClip = "strike";

/**
 * Weapons that leave the hand when they are used.
 *
 * A javelin's strike is a throw, so the figure has to stop holding it — what flies is the
 * simulation's projectile, not something the animation carries. Hiding it is the presentation's job
 * for the same reason the swing arc is: the clip describes a body, and one shared melee clip serves
 * all three melee weapons precisely because it does not know which one is in the hand.
 */
export const THROWN_WEAPONS: ReadonlySet<BlockWeapon> = new Set<BlockWeapon>(["javelin"]);

/** How far into the strike the throw releases — roughly where the arm passes vertical. */
export const THROW_RELEASE = 0.45;

/** Clips during which a thrown weapon is already gone. */
export const AFTER_THROW_CLIPS: ReadonlySet<BlockClip> = new Set<BlockClip>(["recovery"]);

/**
 * Bone names as three.js reports them after loading.
 *
 * Underscores, not Blender's `.L`/`.R`, because three.js strips dots out of node names on import:
 * a bone authored `arm.R` arrives as `armR`, and a lookup for the dotted name silently finds
 * nothing. The build script names them this way for the same reason.
 */
export const WEAPON_BONE = "weapon";
export const HAND_BONE = "arm_R";

export const BLOCK_CELL_SIZES = [32, 48, 64] as const;
export type BlockCellSize = (typeof BLOCK_CELL_SIZES)[number];

/**
 * The sprite bake's own camera, restated for a Y-up world.
 *
 * Taken from `aim_camera` in the skeleton build script: orthographic, a frame 2.5 units wide, the
 * camera at radius 5.8 and height 1.15 looking at height 1.08, and the heading wheel stepped
 * clockwise. The clockwise step is the mirrored one the bake deliberately uses — its reasoning is
 * written out above that function and is not re-derived here. What matters is that the strip and
 * the bake stand in the same place, so that judging the strip is judging the sprite.
 */
export const BAKE_CAMERA = {
  directions: 8,
  frameWidth: 2.5,
  height: 1.15,
  lookAt: 1.08,
  radius: 5.8,
} as const;

/**
 * The bake's lights, which travel with its camera.
 *
 * `aim_camera` repositions the key and fill for every heading, so each of the eight sprites is lit
 * from the same side of its own camera. A strip lit by fixed lights instead shows four headings
 * correctly and four as flat silhouettes — which is a property of the strip, not of the body, and
 * exactly the kind of thing that gets mistaken for a modelling fault.
 *
 * Offsets are in the heading's own frame: outward from the figure, sideways across it, and up.
 */
export const BAKE_LIGHTS = {
  fill: { outward: -2.2, sideways: 1.5, up: 2.7, lookAt: 1.0 },
  key: { outward: 3.2, sideways: -2.2, up: 4.4, lookAt: 1.1 },
} as const;

export function bakeHeadingAngle(direction: number): number {
  return Math.PI / 2 - (direction / BAKE_CAMERA.directions) * Math.PI * 2;
}
