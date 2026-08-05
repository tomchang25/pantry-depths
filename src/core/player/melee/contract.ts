/**
 * What a swing is decided from, and what it may decide.
 *
 * These two types are the whole reading surface of the attack slice. A reviewer changing the arc, the
 * target priority, the cleave rule or the reach reads this file and the resolver beside it; the fence
 * around this folder is what makes that a guarantee rather than a hope.
 */

import type { Cell } from "@/core/grid";

/** Half the arc a swing covers, either side of where the player is pointed. */
export const MELEE_HALF_ANGLE = 0.85;

/** The same arc as a dot-product threshold, which is how the sweep tests it. */
export const MELEE_ARC = Math.cos(MELEE_HALF_ANGLE);

/** Where the player is standing and what they are pointed at. */
export type MeleePose = Readonly<{ x: number; y: number; angle: number }>;

/**
 * The attack's numbers, already resolved.
 *
 * Plain values rather than a route to the modifier layer, so nothing downstream of here has to know
 * that blessings or carried rewards exist.
 */
export type MeleeStats = Readonly<{
  reach: number;
  damage: number;
  knockback: number;
  structureDamage: number;
}>;

/**
 * One enemy the swing might reach.
 *
 * `drowning` travels rather than being filtered out during assembly: whether something on its way
 * under is still a target is a rule, and rules live in the resolver.
 */
export type MeleeCandidate = Readonly<{
  id: string;
  x: number;
  y: number;
  drowning: boolean;
  /** Which material the hit sounds like. Carried so the resolver never reaches an archetype. */
  boned: boolean;
}>;

/** The altar, while it still stands. */
export type MeleeAltar = Readonly<{ x: number; y: number; hp: number }>;

/**
 * The floor, as one question.
 *
 * A predicate rather than the maze: the resolver needs to know where a swing stops, and handing it the
 * grid would hand it the mutating entries on the same module. This is the read-only view rule at its
 * strongest — there is nothing here to write through.
 */
export type MeleeFloorView = Readonly<{ blocksProjectile: (x: number, y: number) => boolean }>;

export type MeleeSnapshot = Readonly<{
  actor: MeleePose;
  stats: MeleeStats;
  /** Everything within reach, unfiltered by arc. The radius cut is mechanical; the arc is the decision. */
  candidates: readonly MeleeCandidate[];
  altar: MeleeAltar | undefined;
  floor: MeleeFloorView;
}>;

/**
 * What a swing can do, in the order it is applied.
 *
 * Every consumer of every one of these lives in one dispatch in the executor, which is what makes the
 * reading claim checkable: there is no second place a swing effect can be handled.
 */
export type MeleeEffect =
  | Readonly<{
      kind: "enemyHit";
      targetId: string;
      damage: number;
      pushX: number;
      pushY: number;
      boned: boolean;
      /** Direction the blow travelled, for the spray it throws off. */
      directionX: number;
      directionY: number;
    }>
  | Readonly<{ kind: "altarHit" }>
  | Readonly<{ kind: "structureHit"; cell: Cell }>
  | Readonly<{ kind: "cleave"; count: number }>
  /** Where the arc is drawn through, and whether it met anything. */
  | Readonly<{ kind: "landing"; x: number; y: number; z: number; connected: boolean }>;
