/**
 * The four things that come after you, and how each one announces itself.
 *
 * Every attack in this demo is telegraphed before it lands, because every attack is avoidable if you
 * read it: the shooter can be broken line-of-sight on, and the charger commits to a straight lane
 * you can step out of — and beats itself against the wall if you do. The wind-up numbers below are
 * the whole difficulty knob; the damage numbers barely matter next to them.
 *
 * The swordsman is the first of them with a front. That costs it the freedom the slimes have — it
 * must turn before it can go, and it swings at what it is looking at — and buys the only thing that
 * makes an authored eight-way body readable: where it is pointed is where it is about to be.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { DEFAULT_BODY_WEIGHT, type DemoThrowWeight } from "@/demo/throw-weight";

export type DemoArchetypeId = "walker" | "ranged" | "charger" | "swordsman";

export type DemoEnemyArchetype = Readonly<{
  id: DemoArchetypeId;
  name: string;
  appearance: EnemyAppearanceId;
  health: number;
  /**
   * What this body weighs in the hand and in the air.
   *
   * Its own property rather than something read off `health`: how heavy a slime is and how much of
   * it there is to kill are two different statements about it, and tying them together would mean
   * never being able to move one without moving the other.
   */
  weight: DemoThrowWeight;
  /** Ordinary movement, used while pathing toward the player. */
  speed: number;
  /** Speed while beelining inside the charge distance; the charger's dash is separate. */
  rushSpeed: number;
  /** Grid distance at which pathing is abandoned for a straight line at the player. */
  rushDistance: number;
  attackCooldown: number;
  /** Seconds of visible wind-up before the attack resolves. */
  windup: number;
  contactDamage: number;
  contactRange: number;
  /** Whether the living body can be carried whole in the player's left hand. */
  canGrab: boolean;
  /** Whether a contact attack commits through a visible wind-up instead of landing on touch. */
  meleeWindup: boolean;
  /**
   * Radians per second the body may swing its facing, for a body that has a front.
   *
   * Omitted means the body has no front and moves freely in any direction, which is what a blob does
   * — it is drawn identically from every angle, so a turn would cost it pace and show nothing for it.
   * Set it and the archetype steers instead: `walk` turns toward its heading at this rate and travels
   * along its facing, which is what keeps an eight-way sprite's feet pointed at where it is going.
   */
  turnRate?: number;
}>;

const WALKER: DemoEnemyArchetype = {
  id: "walker",
  name: "Slime",
  appearance: "greenSlime",
  health: 30,
  // The ordinary body, and the one every other weight is read against.
  weight: DEFAULT_BODY_WEIGHT,
  speed: 1.9,
  rushSpeed: 2.6,
  rushDistance: 5,
  attackCooldown: 1.35,
  windup: 0,
  contactDamage: 6,
  contactRange: 0.86,
  canGrab: true,
  meleeWindup: false,
};

const RANGED: DemoEnemyArchetype = {
  id: "ranged",
  name: "Spitter Slime",
  appearance: "blueSlime",
  health: 22,
  // The small one: it goes further out of the hand and lands lighter than the other two.
  weight: {
    speed: 10,
    range: 5.2,
    lobbed: true,
    drag: 0.42,
    plunge: 0.88,
    recoil: 0.68,
    thud: 0.8,
    carrySlow: 0.88,
  },
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  attackCooldown: 2.6,
  windup: 1,
  contactDamage: 4,
  contactRange: 0.8,
  canGrab: true,
  meleeWindup: false,
};

const CHARGER: DemoEnemyArchetype = {
  id: "charger",
  name: "Charger Slime",
  appearance: "redSlime",
  health: 38,
  // A slab of a thing. Picking one up is a commitment, throwing it barely clears the room in front
  // of you, and every part of doing it is felt.
  weight: {
    speed: 7.5,
    range: 3.6,
    lobbed: true,
    drag: 0.7,
    plunge: 0.74,
    recoil: 1.15,
    thud: 1.25,
    carrySlow: 0.74,
  },
  speed: 1.8,
  rushSpeed: 2.2,
  rushDistance: 5,
  attackCooldown: 3.5,
  // Three seconds is long enough that a charger is no longer a thing that hits you — you can walk
  // away, come back, and land several swings before it launches. That is the intent: what it becomes
  // instead is a battering ram you position, which is what the wall damage and the long stall stun
  // below are for. Without those two this number would only be a nerf.
  windup: 3,
  contactDamage: 6,
  contactRange: 0.86,
  canGrab: true,
  meleeWindup: false,
};

const SWORDSMAN: DemoEnemyArchetype = {
  id: "swordsman",
  name: "Skeleton Swordsman",
  appearance: "skeletonSwordsman",
  health: 46,
  weight: {
    speed: 7.2,
    range: 3.4,
    lobbed: true,
    drag: 0.72,
    plunge: 0.76,
    recoil: 1.2,
    thud: 1.3,
    carrySlow: 0.7,
  },
  speed: 1.65,
  rushSpeed: 2.35,
  rushDistance: 4.5,
  attackCooldown: 1.8,
  windup: 0.55,
  contactDamage: 11,
  contactRange: 0.95,
  canGrab: false,
  meleeWindup: true,
  turnRate: 4.4,
};

export const ENEMY_ARCHETYPES = { walker: WALKER, ranged: RANGED, charger: CHARGER, swordsman: SWORDSMAN } as const;

/** The band a shooter tries to hold: it backs off inside the near edge and closes outside the far one. */
export const RANGED_STANDOFF = { near: 4, far: 7 } as const;
export const RANGED_SHOT_SPEED = 8;
export const RANGED_SHOT_DAMAGE = 12;
export const RANGED_SHOT_RANGE = 12;

export const CHARGE_TRIGGER_DISTANCE = 5;
export const CHARGE_SPEED = 9;
export const CHARGE_DISTANCE = 6;
export const CHARGE_DAMAGE = 18;
export const CHARGE_KNOCKBACK = 11;
/** What a charger costs itself for missing: the window the whole attack is balanced around. */
export const CHARGE_WALL_STUN = 5;
/**
 * What a charge does to the masonry it fails against.
 *
 * Stone takes four and wood two, so one charge is half a stone wall and a whole wooden one — worth
 * baiting, and still well short of a bomb, which flattens stone in a single throw. This is the half
 * of the charger's rework that makes the three-second wind-up a gift rather than a subtraction: the
 * player lines it up on a wall they want gone and steps aside.
 */
export const CHARGE_WALL_DAMAGE = 2;
