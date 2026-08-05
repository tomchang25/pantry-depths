/**
 * What an enemy is, as state: the record, its two closed vocabularies, and the one transition that
 * touches nothing else.
 *
 * Separated from the run state module so the behavior families can be typed against the enemy alone.
 * Nothing here reads or names the run state, which is what lets a module below the owner stack import
 * it without acquiring a dependency on the world.
 */

import type { EnemyAppearanceId, EnemyArchetype, WindupIntent } from "@/core/combat/enemy-contract";
import type { Cell } from "@/core/grid";

/** What an enemy is committed to. Built from the archetype, so no intent exists that a telegraph cannot draw. */
export type Intent = "none" | WindupIntent;

/**
 * What an enemy is doing about the player, as one of five exclusive answers: each wants the enemy
 * somewhere different, so a flag set would produce one both chasing and wandering at the average of
 * the two. Stun, hurt, drowning, and being held stay out: they interrupt and hand back, so storing
 * one here would mean storing the prior state as well, which is the same field twice.
 */
export type EnemyMind = "idle" | "wander" | "chase" | "attack" | "retreat";

export type Enemy = {
  id: string;
  archetype: EnemyArchetype;
  appearance: EnemyAppearanceId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stunSeconds: number;
  hurtSeconds: number;
  attackPoseSeconds: number;
  attackCooldown: number;
  pushX: number;
  pushY: number;
  repathSeconds: number;
  waypoint: Cell | undefined;
  /** What this enemy is doing about the player. Every movement decision is dispatched on it. */
  mind: EnemyMind;
  /** How long an idling enemy has left. A range, because one pass of creation would otherwise hold phase. */
  idleSeconds: number;
  /** Where a wandering enemy is walking. A cell rather than a heading, which shivers or walks into a wall. */
  wanderCell: Cell | undefined;
  /** Counts down through the telegraph; while above zero the enemy is committed and visibly winding up. */
  windupSeconds: number;
  windupTotal: number;
  intent: Intent;
  /**
   * Where the wind-up is aimed, taken when it began and never revised. Reading the live position at
   * resolution would make a wind-up a pause before an unavoidable hit.
   */
  aimX: number;
  aimY: number;
  chargeSeconds: number;
  chargeX: number;
  chargeY: number;
  /** Above zero while drowning in a pool or a trench. The enemy stops acting, stops being a target, and dies. */
  drowningSeconds: number;
  /** World-space direction the authored eight-way sprite faces. */
  facingAngle: number;
  /** Recomputed by enemy movement each simulation step; presentation reads it for walk animation. */
  moving: boolean;
};

/**
 * Puts an enemy out for a while and drops whatever it was committed to.
 *
 * Clearing the commitment is the point. A stun that set only the timer left the wind-up frozen rather
 * than cancelled, because the step loop skips a stunned enemy before reaching the wind-up: an enemy
 * interrupted mid-attack waited out the stun and then resolved the attack at the position the player
 * had already left. Clearing the intent here is also what removes every drawn warning, since the head
 * marker, the cut arc, the sight line and the charge lane all read the wind-up directly.
 *
 * The longer stun wins, so a lesser hit does not shorten a worse one.
 */
export function stunEnemy(enemy: Enemy, seconds: number): void {
  enemy.stunSeconds = Math.max(enemy.stunSeconds, seconds);
  enemy.windupSeconds = 0;
  enemy.intent = "none";
}
