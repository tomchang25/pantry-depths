/**
 * The swing applied: assembly, one dispatch, and the altar's own transition.
 *
 * This is the executor half of the attack slice and the only module in the folder that holds the run
 * state. It builds the snapshot, hands it to the resolver, and applies what comes back. The dispatch
 * below is deliberately one exhaustive branch: every consumer of every swing effect is in it, so
 * knowing what a swing can cause is one read rather than a search.
 */

import { isBoned } from "@/core/combat/enemy-contract";
import { burst } from "@/core/combat/particles";
import { damageEnemy } from "@/core/damage/enemy-damage";
import { MELEE_WALL_DAMAGE, damageWall } from "@/core/damage/structure-damage";
import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import type { Enemy } from "@/core/enemy/enemy-state";
import { blocksProjectile, tileAt } from "@/core/floor/maze";
import { meleeDamage, meleeKnockback, meleeReach } from "@/core/player/stats";
import { resolveMelee } from "@/core/player/melee/resolve-melee";
import type { MeleeCandidate, MeleeEffect, MeleeSnapshot } from "@/core/player/melee/contract";
import { takeSealed } from "@/core/world/extraction";
import type { World } from "@/core/world/world";

/**
 * The candidates and a way back to the enemies they stand for.
 *
 * The references are captured here rather than looked up while effects are applied, because a fatal
 * hit removes an enemy from the run's list and the effects after it still have to land.
 */
function gatherCandidates(world: World, reach: number): { candidates: MeleeCandidate[]; byId: Map<string, Enemy> } {
  const candidates: MeleeCandidate[] = [];
  const byId = new Map<string, Enemy>();

  for (const enemy of world.enemies) {
    // A radius cut only, and at exactly the reach the arc test would accept, so the mechanical half of
    // assembly cannot quietly narrow what the resolver gets to decide about.
    if (Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y) > reach) {
      continue;
    }

    candidates.push({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      drowning: enemy.drowningSeconds > 0,
      boned: isBoned(enemy.archetype),
    });
    byId.set(enemy.id, enemy);
  }

  return { candidates, byId };
}

function snapshotOf(world: World, candidates: readonly MeleeCandidate[]): MeleeSnapshot {
  return {
    actor: { x: world.player.x, y: world.player.y, angle: world.player.angle },
    stats: {
      reach: meleeReach(world),
      damage: meleeDamage(world),
      knockback: meleeKnockback(world),
      structureDamage: MELEE_WALL_DAMAGE,
    },
    candidates,
    altar: { x: world.altar.x, y: world.altar.y, hp: world.altar.hp },
    floor: { blocksProjectile: (x, y) => blocksProjectile(world.maze, x, y) },
  };
}

/**
 * The altar taking a blow, which is a state transition rather than a decision.
 *
 * It stays with the executor for that reason: the resolver decided that the altar is what this swing
 * met, and what one hit costs the altar is this module's to apply.
 */
function strikeAltar(world: World): void {
  world.altar.hp -= 1;
  world.terrainVersion += 1;
  // Debris leaves the stone towards whoever hit it, the same way a wall sheds it: a burst thrown
  // evenly out of the middle of a solid plinth reads as the plinth exploding rather than as a blow
  // landing on the near face of it.
  const towardX = world.player.x - world.altar.x;
  const towardY = world.player.y - world.altar.y;
  const reach = Math.max(0.0001, Math.hypot(towardX, towardY));
  const faceX = world.altar.x + (towardX / reach) * 0.34;
  const faceY = world.altar.y + (towardY / reach) * 0.34;

  if (world.altar.hp > 0) {
    burst(world.particles, "stoneChip", faceX, faceY, 0.62, 11, {
      speed: 2.8,
      spreadZ: 1.8,
      directionX: towardX / reach,
      directionY: towardY / reach,
      focus: 0.5,
      size: 0.06,
      life: 1,
    });
    // Gold with the grey: what is being broken open is the light in it, not only the masonry.
    burst(world.particles, "ember", faceX, faceY, 0.66, 7, { speed: 2.2, spreadZ: 2, size: 0.045, life: 0.7 });
    announce(world, `The altar cracks — ${world.altar.hp} more`, 1.4);
  } else {
    // The last blow: the whole structure's worth of stone rather than a face's worth, and the light
    // leaving it all at once.
    raiseSfx(world, "wallBreakStone", { x: world.altar.x, y: world.altar.y });
    burst(world.particles, "stoneChip", world.altar.x, world.altar.y, 0.6, 26, {
      speed: 3.4,
      spreadZ: 3,
      size: 0.085,
      life: 1.5,
    });
    burst(world.particles, "ember", world.altar.x, world.altar.y, 0.62, 20, {
      speed: 3.2,
      spreadZ: 3.4,
      size: 0.05,
      life: 1.1,
    });
    burst(world.particles, "dust", world.altar.x, world.altar.y, 0.5, 8, {
      speed: 0.9,
      spreadZ: 1,
      gravity: 1.4,
      drag: 2.4,
      size: 0.16,
      life: 0.9,
    });
    takeSealed(world, "cursed");
  }

  raiseSfx(world, "meleeHitAltar", { x: world.altar.x, y: world.altar.y });
}

function applyEffect(world: World, effect: MeleeEffect, byId: Map<string, Enemy>): void {
  if (effect.kind === "enemyHit") {
    const enemy = byId.get(effect.targetId);

    if (!enemy) {
      return;
    }

    enemy.pushX += effect.pushX;
    enemy.pushY += effect.pushY;
    raiseSfx(world, effect.boned ? "meleeHitBone" : "meleeHitFlesh", { x: enemy.x, y: enemy.y });
    damageEnemy(world, enemy, effect.damage, "cleaved");
    burst(world.particles, "blood", enemy.x, enemy.y, 0.36, 6, {
      speed: 2,
      spreadZ: 2.2,
      size: 0.055,
      life: 0.9,
      directionX: effect.directionX,
      directionY: effect.directionY,
      focus: 0.4,
    });
    return;
  }

  if (effect.kind === "altarHit") {
    strikeAltar(world);
    return;
  }

  if (effect.kind === "structureHit") {
    // Timber and stone answer a blade differently, and the barricade is timber by construction.
    const kind = tileAt(world.maze, effect.cell.x, effect.cell.y)?.kind;
    const wooden = kind === "wood" || kind === "barricade";
    raiseSfx(world, wooden ? "meleeHitWallWood" : "meleeHitWallStone", {
      x: effect.cell.x + 0.5,
      y: effect.cell.y + 0.5,
    });
    damageWall(world, effect.cell, MELEE_WALL_DAMAGE);
    return;
  }

  if (effect.kind === "cleave") {
    announce(world, `Cleaves ${effect.count}!`, 1.2);
    return;
  }

  if (effect.kind === "landing") {
    world.swingTarget = { x: effect.x, y: effect.y, z: effect.z, connected: effect.connected };

    if (effect.connected) {
      world.impact = 1;
    }

    return;
  }

  effect satisfies never;
  throw new Error("unknown melee effect");
}

/**
 * The blade arrives.
 *
 * Called by the tick partway through the animation rather than by the press, which is the only reason
 * the arm's three quarters of a second is not a lie.
 */
export function executeMelee(world: World): void {
  const { candidates, byId } = gatherCandidates(world, meleeReach(world));

  for (const effect of resolveMelee(snapshotOf(world, candidates))) {
    applyEffect(world, effect, byId);
  }
}
