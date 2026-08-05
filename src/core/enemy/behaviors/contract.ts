/**
 * What an attack family may see, may touch, and may ask for.
 *
 * Three types and a registry, and between them they are the whole reading surface of enemy attacks. A
 * reviewer changing what one family does reads its module and this file; the fence around the folder
 * is what makes that a guarantee rather than an intention.
 */

import type { EnemyArchetype, WindupIntent } from "@/core/combat/enemy-contract";
import type { Cell } from "@/core/grid";
import type { Maze } from "@/core/floor/maze";

/**
 * The enemy, as much of it as an attack is allowed to touch.
 *
 * Deliberately not the whole record. A family commits, aims, faces, counts down and travels along a
 * lane it chose; it has no business with health, the decision state, the errand it was on, or the
 * flinch timers, and with those absent from the type it cannot reach them by accident.
 */
export type EnemyAttackSelf = {
  x: number;
  y: number;
  facingAngle: number;
  intent: "none" | WindupIntent;
  windupSeconds: number;
  windupTotal: number;
  aimX: number;
  aimY: number;
  attackPoseSeconds: number;
  attackCooldown: number;
  chargeX: number;
  chargeY: number;
  chargeSeconds: number;
  readonly archetype: EnemyArchetype;
};

/**
 * The rest of the world, read-only.
 *
 * The floor arrives as the grid rather than a predicate because a charge moves through it and needs
 * the movement helpers, and those take the grid. The type is read-only so a mutating floor entry does
 * not typecheck against it.
 */
export type EnemyView = Readonly<{
  playerX: number;
  playerY: number;
  maze: Maze;
}>;

/**
 * What a family may ask the world for.
 *
 * Everything beyond the enemy's own attack fields is here, which is the point: a family cannot hurt
 * the player, spawn anything, break anything or stun itself by writing — only by returning. The
 * chassis applies these in the order they arrive, so the list a seam returns reads as its script.
 */
export type EnemyEffect =
  | Readonly<{ kind: "playerHit"; amount: number; fromX: number; fromY: number }>
  | Readonly<{ kind: "playerShove"; x: number; y: number }>
  | Readonly<{
      kind: "spawnShot";
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      speed: number;
      damage: number;
      range: number;
      knockback: number;
    }>
  | Readonly<{ kind: "structureHit"; cell: Cell; damage: number }>
  /** Ask whether the ground just reached is a pool, a trench, or spikes. */
  | Readonly<{ kind: "hazardProbe" }>
  | Readonly<{ kind: "stunSelf"; seconds: number }>
  /**
   * A named look rather than a particle spec.
   *
   * The family decides where sparks go and how hard; what they look like belongs to the chassis. That
   * keeps the particle vocabulary out of the fenced tree, which the boundary rules require anyway, and
   * keeps a presentation tweak from being an edit to a decision module.
   */
  | Readonly<{
      kind: "sparks";
      preset: SparkPreset;
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      /** How far through the wind-up, or how hard the impact. Each preset scales its own numbers by it. */
      intensity: number;
    }>;

export type SparkPreset = "bladeHone" | "bladeRelease" | "chargeStoke" | "chargeStall";

/**
 * The four moments the chassis hands an attack.
 *
 * A family that does not use one returns an empty list, so the chassis calls all four unconditionally
 * and no seam is conditional on which family is answering.
 */
export type EnemyBehavior = Readonly<{
  /** The chassis has already checked range, sight and cooldown; commit to the attack. */
  open: (self: EnemyAttackSelf, view: EnemyView) => readonly EnemyEffect[];
  /** One frame of a committed, not-yet-released attack. */
  telegraphStep: (self: EnemyAttackSelf, view: EnemyView, deltaSeconds: number) => readonly EnemyEffect[];
  /** The wind-up has expired. */
  release: (self: EnemyAttackSelf, view: EnemyView) => readonly EnemyEffect[];
  /** One frame of an attack that continues after release. Only a charge has one. */
  liveStep: (self: EnemyAttackSelf, view: EnemyView, deltaSeconds: number) => readonly EnemyEffect[];
}>;

/** A seam a family does not use. Named so a registry row reads as a deliberate absence. */
export const NO_EFFECTS: readonly EnemyEffect[] = [];
