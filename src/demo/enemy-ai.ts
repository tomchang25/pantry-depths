/**
 * Enemy behaviour.
 *
 * Two modes and one switch between them: beyond five cells an enemy navigates the grid toward the
 * player's cell, and inside five cells it drops the path entirely and runs straight at them. The
 * charge is deliberately dumb — it will hug a wall if one is in the way, which is what makes
 * breaking a wall open a real shortcut for the enemy as well as the player.
 */

import { breadthFirstStep } from "@/demo/maze";
import { slideMove, unstick } from "@/demo/movement";
import {
  CHARGE_DISTANCE,
  ENEMY_CHARGE_SPEED,
  ENEMY_RADIUS,
  ENEMY_SPEED,
  type DemoEnemy,
  type DemoWorld,
} from "@/demo/world";

const ATTACK_RANGE = 0.86;
const ATTACK_DAMAGE = 6;
const ATTACK_COOLDOWN = 1.35;
const REPATH_SECONDS = 0.4;
const SEPARATION = 0.62;

function decayTimers(enemy: DemoEnemy, deltaSeconds: number): void {
  enemy.stunSeconds = Math.max(0, enemy.stunSeconds - deltaSeconds);
  enemy.hurtSeconds = Math.max(0, enemy.hurtSeconds - deltaSeconds);
  enemy.attackPoseSeconds = Math.max(0, enemy.attackPoseSeconds - deltaSeconds);
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaSeconds);
  enemy.repathSeconds = Math.max(0, enemy.repathSeconds - deltaSeconds);
}

function applyPush(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
  if (enemy.pushX === 0 && enemy.pushY === 0) {
    return;
  }

  const moved = slideMove(
    world.maze,
    { x: enemy.x, y: enemy.y },
    enemy.pushX * deltaSeconds,
    enemy.pushY * deltaSeconds,
    ENEMY_RADIUS,
  );
  enemy.x = moved.x;
  enemy.y = moved.y;
  const decay = Math.exp(-6 * deltaSeconds);
  enemy.pushX *= decay;
  enemy.pushY *= decay;

  if (Math.hypot(enemy.pushX, enemy.pushY) < 0.05) {
    enemy.pushX = 0;
    enemy.pushY = 0;
  }
}

function separate(world: DemoWorld, enemy: DemoEnemy): Readonly<{ x: number; y: number }> {
  let offsetX = 0;
  let offsetY = 0;

  for (const other of world.enemies) {
    if (other === enemy) {
      continue;
    }

    const dx = enemy.x - other.x;
    const dy = enemy.y - other.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0.001 && distance < SEPARATION) {
      const push = (SEPARATION - distance) / SEPARATION;
      offsetX += (dx / distance) * push;
      offsetY += (dy / distance) * push;
    }
  }

  return { x: offsetX, y: offsetY };
}

function headingToward(world: DemoWorld, enemy: DemoEnemy, distance: number): Readonly<{ x: number; y: number }> {
  if (distance <= CHARGE_DISTANCE) {
    enemy.waypoint = undefined;
    return { x: (world.player.x - enemy.x) / distance, y: (world.player.y - enemy.y) / distance };
  }

  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
  const goal = { x: Math.floor(world.player.x), y: Math.floor(world.player.y) };

  if (enemy.repathSeconds <= 0 || !enemy.waypoint) {
    enemy.waypoint = breadthFirstStep(world.maze, cell, goal);
    enemy.repathSeconds = REPATH_SECONDS;
  }

  const waypoint = enemy.waypoint;

  if (!waypoint) {
    return { x: 0, y: 0 };
  }

  const targetX = waypoint.x + 0.5;
  const targetY = waypoint.y + 0.5;
  const toX = targetX - enemy.x;
  const toY = targetY - enemy.y;
  const length = Math.hypot(toX, toY);

  if (length < 0.12) {
    enemy.waypoint = undefined;
    return { x: 0, y: 0 };
  }

  return { x: toX / length, y: toY / length };
}

export function stepEnemies(world: DemoWorld, deltaSeconds: number): void {
  for (const enemy of world.enemies) {
    decayTimers(enemy, deltaSeconds);
    applyPush(world, enemy, deltaSeconds);
    const settled = unstick(world.maze, { x: enemy.x, y: enemy.y }, ENEMY_RADIUS);
    enemy.x = settled.x;
    enemy.y = settled.y;

    if (enemy.stunSeconds > 0 || world.status !== "playing") {
      continue;
    }

    const distance = Math.max(0.0001, Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y));

    if (distance <= ATTACK_RANGE) {
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = ATTACK_COOLDOWN;
        enemy.attackPoseSeconds = 0.3;
        world.player.hp -= ATTACK_DAMAGE;
        world.hitFlash = 1;

        if (world.player.hp <= 0) {
          world.player.hp = 0;
          world.status = "dead";
        }
      }

      continue;
    }

    const heading = headingToward(world, enemy, distance);
    const avoid = separate(world, enemy);
    const speed = distance <= CHARGE_DISTANCE ? ENEMY_CHARGE_SPEED : ENEMY_SPEED;
    const moved = slideMove(
      world.maze,
      { x: enemy.x, y: enemy.y },
      (heading.x * speed + avoid.x * 1.4) * deltaSeconds,
      (heading.y * speed + avoid.y * 1.4) * deltaSeconds,
      ENEMY_RADIUS,
    );
    enemy.x = moved.x;
    enemy.y = moved.y;
  }
}
