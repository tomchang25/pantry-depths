/**
 * Committing to an attack, which every family that telegraphs does the same way.
 *
 * The aim is taken here and nowhere else, and that is what makes a telegraph a promise: the attack
 * goes where the line was drawn, so stepping aside works. A point rather than a direction, because the
 * drawn warnings need the place.
 */

import { attackWindup, type WindupIntent } from "@/core/combat/enemy-contract";
import type { EnemyAttackSelf, EnemyView } from "@/core/enemy/behaviors/contract";

export function commitWindup(self: EnemyAttackSelf, view: EnemyView, intent: WindupIntent): void {
  self.intent = intent;
  self.windupSeconds = attackWindup(self.archetype);
  self.windupTotal = attackWindup(self.archetype);
  self.aimX = view.playerX;
  self.aimY = view.playerY;
  // Snapped to the aim and held there for the whole telegraph, so the drawn enemy agrees with the
  // line on the floor.
  self.facingAngle = Math.atan2(self.aimY - self.y, self.aimX - self.x);
}

/** How far through the telegraph this frame is, from nothing to all of it. */
export function windupProgress(self: EnemyAttackSelf): number {
  return 1 - self.windupSeconds / Math.max(0.0001, self.windupTotal);
}
