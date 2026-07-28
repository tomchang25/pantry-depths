/**
 * The three things that come after you, and how each one announces itself.
 *
 * Every attack in this demo is telegraphed before it lands, because every attack is avoidable if you
 * read it: the shooter can be broken line-of-sight on, and the charger commits to a straight lane
 * you can step out of — and beats itself against the wall if you do. The wind-up numbers below are
 * the whole difficulty knob; the damage numbers barely matter next to them.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";

export type DemoArchetypeId = "walker" | "ranged" | "charger";

export type DemoEnemyArchetype = Readonly<{
  id: DemoArchetypeId;
  name: string;
  appearance: EnemyAppearanceId;
  health: number;
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
}>;

const WALKER: DemoEnemyArchetype = {
  id: "walker",
  name: "史萊姆",
  appearance: "greenSlime",
  health: 30,
  speed: 1.9,
  rushSpeed: 2.6,
  rushDistance: 5,
  attackCooldown: 1.35,
  windup: 0,
  contactDamage: 6,
  contactRange: 0.86,
};

const RANGED: DemoEnemyArchetype = {
  id: "ranged",
  name: "投射史萊姆",
  appearance: "blueSlime",
  health: 22,
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  attackCooldown: 2.6,
  windup: 1,
  contactDamage: 4,
  contactRange: 0.8,
};

const CHARGER: DemoEnemyArchetype = {
  id: "charger",
  name: "衝撞史萊姆",
  appearance: "redSlime",
  health: 38,
  speed: 1.8,
  rushSpeed: 2.2,
  rushDistance: 5,
  attackCooldown: 3.5,
  windup: 0.8,
  contactDamage: 6,
  contactRange: 0.86,
};

export const ENEMY_ARCHETYPES = { walker: WALKER, ranged: RANGED, charger: CHARGER } as const;

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
export const CHARGE_WALL_STUN = 1.6;
