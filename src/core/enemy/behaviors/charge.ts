/**
 * The charging family: a committed run down a lane, and what it costs whoever it meets or misses.
 *
 * The only family with a live step. Everything else resolves at the moment its wind-up expires; a
 * charge keeps going afterwards, which is why the lane it committed to is stored rather than
 * recomputed and why missing has a consequence of its own.
 */

import {
  CHARGE_DAMAGE,
  CHARGE_DISTANCE,
  CHARGE_KNOCKBACK,
  CHARGE_SPEED,
  CHARGE_WALL_DAMAGE,
  CHARGE_WALL_STUN,
  attackCooldown,
} from "@/core/combat/enemy-contract";
import {
  NO_EFFECTS,
  type EnemyAttackSelf,
  type EnemyBehavior,
  type EnemyEffect,
  type EnemyView,
} from "@/core/enemy/behaviors/contract";
import { commitWindup, windupProgress } from "@/core/enemy/behaviors/windup";
import { ENEMY_RADIUS } from "@/core/enemy/enemy-state";
import { FLUNG, slideMove } from "@/core/floor/movement";

/** How close the charge has to come to count as having caught the player. */
const CHARGE_CATCH_RANGE = 0.95;

/** How far along the lane the stall probe looks, past the body's own width. */
const STALL_PROBE_AHEAD = 0.3;

/** Under this fraction of the distance it meant to cover, a charge has hit something. */
const STALL_FRACTION = 0.5;

/**
 * Sparks gathering while the charge is held, rate-gated rather than emitted every frame: at sixty
 * frames a second one enemy would bury the particle field.
 */
function stoke(self: EnemyAttackSelf, deltaSeconds: number): readonly EnemyEffect[] {
  const heat = windupProgress(self);

  if (Math.random() > (4 + heat * 26) * deltaSeconds) {
    return NO_EFFECTS;
  }

  return [
    {
      kind: "sparks",
      preset: "chargeStoke",
      x: self.x,
      y: self.y,
      directionX: 0,
      directionY: 0,
      intensity: heat,
    },
  ];
}

/**
 * Sends the charge down the lane it committed to.
 *
 * The locked point sets only the direction; the distance stays the charger's own, so a missed charge
 * overruns and ends facing the wrong way.
 */
function launch(self: EnemyAttackSelf): readonly EnemyEffect[] {
  const dx = self.aimX - self.x;
  const dy = self.aimY - self.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  self.chargeX = dx / length;
  self.chargeY = dy / length;
  self.chargeSeconds = CHARGE_DISTANCE / CHARGE_SPEED;
  self.attackCooldown = attackCooldown(self.archetype);
  return NO_EFFECTS;
}

/**
 * One frame of a charge in flight.
 *
 * The order of what it returns is part of the rules rather than an accident of writing. The ground it
 * reached is probed first, because a charge that overran into water is drowning before anything else
 * asks where it is. A wall is spent before the stun that punishes the miss, so a charge that breaks
 * through ends up in the opening rather than stunned against masonry it already removed — which is why
 * the stun is an effect here and not a write: an effect states the order, a write leaves it to luck.
 */
function run(self: EnemyAttackSelf, view: EnemyView, deltaSeconds: number): readonly EnemyEffect[] {
  self.chargeSeconds -= deltaSeconds;
  const beforeX = self.x;
  const beforeY = self.y;
  const moved = slideMove(
    view.maze,
    { x: self.x, y: self.y },
    self.chargeX * CHARGE_SPEED * deltaSeconds,
    self.chargeY * CHARGE_SPEED * deltaSeconds,
    ENEMY_RADIUS,
    FLUNG,
  );
  self.x = moved.x;
  self.y = moved.y;

  const effects: EnemyEffect[] = [{ kind: "hazardProbe" }];

  if (Math.hypot(view.playerX - self.x, view.playerY - self.y) <= CHARGE_CATCH_RANGE) {
    effects.push({ kind: "playerHit", amount: CHARGE_DAMAGE, fromX: self.x, fromY: self.y });
    // The shove is most of what a connected charge costs: it puts the player somewhere unchosen.
    effects.push({ kind: "playerShove", x: self.chargeX * CHARGE_KNOCKBACK, y: self.chargeY * CHARGE_KNOCKBACK });
    self.chargeSeconds = 0;
    self.intent = "none";
    return effects;
  }

  const stalled = Math.hypot(self.x - beforeX, self.y - beforeY) < CHARGE_SPEED * deltaSeconds * STALL_FRACTION;

  if (stalled) {
    // Probed a width along the lane rather than underfoot, because a stall stops just short of what
    // caused it.
    const cell = {
      x: Math.floor(self.x + self.chargeX * (ENEMY_RADIUS + STALL_PROBE_AHEAD)),
      y: Math.floor(self.y + self.chargeY * (ENEMY_RADIUS + STALL_PROBE_AHEAD)),
    };
    effects.push({ kind: "structureHit", cell, damage: CHARGE_WALL_DAMAGE });
    effects.push({
      kind: "sparks",
      preset: "chargeStall",
      x: self.x,
      y: self.y,
      directionX: self.chargeX,
      directionY: self.chargeY,
      intensity: 1,
    });
    self.chargeSeconds = 0;
    effects.push({ kind: "stunSelf", seconds: CHARGE_WALL_STUN });
    return effects;
  }

  if (self.chargeSeconds <= 0) {
    self.intent = "none";
  }

  return effects;
}

export const CHARGE_BEHAVIOR: EnemyBehavior = {
  open: (self: EnemyAttackSelf, view: EnemyView) => {
    commitWindup(self, view, "charge");
    return NO_EFFECTS;
  },
  telegraphStep: (self: EnemyAttackSelf, _view: EnemyView, deltaSeconds: number) => stoke(self, deltaSeconds),
  release: (self: EnemyAttackSelf) => launch(self),
  liveStep: run,
};
