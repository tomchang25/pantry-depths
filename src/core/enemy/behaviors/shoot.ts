/**
 * The shooting family: a javelin or a bolt, sent down the line the telegraph drew.
 *
 * What tells the two shooter types apart is entirely their rows' numbers — a javelin is slower and
 * heavier and shoves, a bolt is fast and flat and cheap — so one module serves both.
 */

import { attackCooldown, STRIKE_SECONDS } from "@/core/combat/enemy-contract";
import {
  NO_EFFECTS,
  type EnemyAttackSelf,
  type EnemyBehavior,
  type EnemyEffect,
  type EnemyView,
} from "@/core/enemy/behaviors/contract";
import { commitWindup } from "@/core/enemy/behaviors/windup";

/** The shot leaves from where the shooter stands, along the line locked in when the wind-up began. */
function fire(self: EnemyAttackSelf): readonly EnemyEffect[] {
  const shot = self.archetype.shot;

  // A row with no shot has nothing to send. The wind-up still ends; it simply produces nothing.
  if (!shot) {
    return NO_EFFECTS;
  }

  const dx = self.aimX - self.x;
  const dy = self.aimY - self.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  self.attackPoseSeconds = STRIKE_SECONDS;
  self.attackCooldown = attackCooldown(self.archetype);

  return [
    {
      kind: "spawnShot",
      x: self.x,
      y: self.y,
      directionX: dx / length,
      directionY: dy / length,
      speed: shot.speed,
      damage: shot.damage,
      range: shot.range,
      knockback: shot.knockback,
    },
  ];
}

export const SHOOT_BEHAVIOR: EnemyBehavior = {
  open: (self: EnemyAttackSelf, view: EnemyView) => {
    commitWindup(self, view, "shoot");
    return NO_EFFECTS;
  },
  telegraphStep: () => NO_EFFECTS,
  release: (self: EnemyAttackSelf) => fire(self),
  liveStep: () => NO_EFFECTS,
};
