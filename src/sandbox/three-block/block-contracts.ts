/**
 * The names shared with the Blender build script.
 *
 * These strings are a contract across a file boundary that no compiler checks: `blocky_build.py`
 * names its NLA tracks and its weapon meshes, and this module selects by those names. A rename on
 * either side has to be a rename on both, and the failure mode if it is not is a clip that silently
 * does not exist rather than an error anybody sees.
 */

export const BLOCK_WEAPONS = ["sword", "hammer", "javelin", "crossbow"] as const;
export type BlockWeapon = (typeof BLOCK_WEAPONS)[number];

export const BLOCK_CLIPS = ["idle", "walk", "windup", "strike", "recovery", "crossbowAim", "crossbowReload"] as const;
export type BlockClip = (typeof BLOCK_CLIPS)[number];

/**
 * Which clips each weapon plays.
 *
 * Sword, hammer and javelin share one set, which is the experiment's own claim: a javelin throw is
 * the same overhead arc as a chop, because what leaves the hand is the simulation's projectile and
 * not something the sprite has to draw. The crossbow is the exception, and its reload is a pose the
 * game's design notes already want a visible window for.
 */
export const WEAPON_CLIPS: Readonly<Record<BlockWeapon, readonly BlockClip[]>> = {
  sword: ["idle", "walk", "windup", "strike", "recovery"],
  hammer: ["idle", "walk", "windup", "strike", "recovery"],
  javelin: ["idle", "walk", "windup", "strike", "recovery"],
  crossbow: ["idle", "walk", "crossbowAim", "crossbowReload"],
};

/** Clips that hold their last frame rather than looping, because the simulation owns their length. */
export const HOLDING_CLIPS: ReadonlySet<BlockClip> = new Set<BlockClip>([
  "windup",
  "strike",
  "recovery",
  "crossbowAim",
  "crossbowReload",
]);

/** The one clip the swing arc is drawn over. */
export const ARC_CLIP: BlockClip = "strike";

/**
 * Weapons that leave the hand when they are used.
 *
 * A javelin's strike is a throw, so the sprite has to stop holding it — what flies is the
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
