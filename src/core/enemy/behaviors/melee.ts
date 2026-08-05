/**
 * The melee family: a committed cut through a cone fixed in the world.
 *
 * Both halves of the shape the floor is showing are tested. Distance alone would make a cut a full
 * circle; with the facing locked for the whole telegraph, the cone stays where it was drawn and
 * stepping out of it works.
 */

import {
  MELEE_CUT_HALF_ANGLE,
  STRIKE_SECONDS,
  attackCooldown,
  attackDamage,
  attackReach,
} from "@/core/combat/enemy-contract";
import {
  NO_EFFECTS,
  type EnemyAttackSelf,
  type EnemyBehavior,
  type EnemyEffect,
  type EnemyView,
} from "@/core/enemy/behaviors/contract";
import { commitWindup, windupProgress } from "@/core/enemy/behaviors/windup";
import { shortestTurn } from "@/core/floor/movement";

/** How far past its reach a cut still connects, so a hit does not turn on a hundredth of a cell. */
const CUT_REACH_MARGIN = 0.16;

/**
 * Sparks drawn in along the edge while the blade is raised.
 *
 * Converging particles read as a wind-up in a way that departing ones do not. Rate-gated rather than
 * emitted every frame, because at sixty frames a second one enemy would bury the particle field.
 */
function hone(self: EnemyAttackSelf, deltaSeconds: number): readonly EnemyEffect[] {
  const heat = windupProgress(self);

  if (Math.random() > (6 + heat * 22) * deltaSeconds) {
    return NO_EFFECTS;
  }

  // Started out on the arc and aimed inward, so they close on the blade as it is raised.
  const angle = self.facingAngle + (Math.random() * 2 - 1) * MELEE_CUT_HALF_ANGLE;
  const reach = attackReach(self.archetype) * (1.1 + Math.random() * 0.35);

  return [
    {
      kind: "sparks",
      preset: "bladeHone",
      x: self.x + Math.cos(angle) * reach,
      y: self.y + Math.sin(angle) * reach,
      directionX: -Math.cos(angle),
      directionY: -Math.sin(angle),
      intensity: heat,
    },
  ];
}

/** The cut landing: the blade thrown outward along the arc it just swept, and what stood inside it. */
function cut(self: EnemyAttackSelf, view: EnemyView): readonly EnemyEffect[] {
  const toX = view.playerX - self.x;
  const toY = view.playerY - self.y;
  const distance = Math.hypot(toX, toY);
  const offBearing = Math.abs(shortestTurn(Math.atan2(toY, toX) - self.facingAngle));

  const effects: EnemyEffect[] = [
    {
      kind: "sparks",
      preset: "bladeRelease",
      x: self.x,
      y: self.y,
      directionX: Math.cos(self.facingAngle),
      directionY: Math.sin(self.facingAngle),
      intensity: 1,
    },
  ];

  if (distance <= attackReach(self.archetype) + CUT_REACH_MARGIN && offBearing <= MELEE_CUT_HALF_ANGLE) {
    effects.push({ kind: "playerHit", amount: attackDamage(self.archetype), fromX: self.x, fromY: self.y });
  }

  self.attackPoseSeconds = STRIKE_SECONDS;
  self.attackCooldown = attackCooldown(self.archetype);
  self.intent = "none";
  return effects;
}

export const MELEE_BEHAVIOR: EnemyBehavior = {
  open: (self: EnemyAttackSelf, view: EnemyView) => {
    commitWindup(self, view, "melee");
    return NO_EFFECTS;
  },
  telegraphStep: (self: EnemyAttackSelf, _view: EnemyView, deltaSeconds: number) => hone(self, deltaSeconds),
  release: cut,
  liveStep: () => NO_EFFECTS,
};
