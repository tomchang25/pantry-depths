/**
 * One tick of the demo world: player, enemies, projectiles, timers, and the two end conditions.
 *
 * Fixed-order and mutating. There is no rollback and no determinism guarantee — the demo is played,
 * not replayed.
 */

import { damageWall, projectileSpeed, thrownWallDamage } from "@/demo/actions";
import { stepEnemies } from "@/demo/enemy-ai";
import { isSolidCell, type DemoCell } from "@/demo/maze";
import { slideMove, unstick } from "@/demo/movement";
import {
  announce,
  damageEnemy,
  killEnemy,
  MAX_ENEMIES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_INTERVAL_SECONDS,
  spawnReinforcement,
  type DemoProjectile,
  type DemoWorld,
} from "@/demo/world";

export type DemoInput = Readonly<{
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
}>;

const DEATH_SECONDS = 0.75;
const PROJECTILE_HIT_RADIUS = 0.45;
const THROWN_ENEMY_IMPACT_DAMAGE = 18;
const THROWN_ENEMY_SELF_DAMAGE = 8;
const THROWN_ENEMY_STUN = 1.6;
const EXIT_RADIUS = 0.55;

function stepPlayer(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const forwardX = Math.cos(world.player.angle);
  const forwardY = Math.sin(world.player.angle);
  const strafeX = -forwardY;
  const strafeY = forwardX;
  let moveX = 0;
  let moveY = 0;

  if (input.forward) {
    moveX += forwardX;
    moveY += forwardY;
  }

  if (input.backward) {
    moveX -= forwardX;
    moveY -= forwardY;
  }

  if (input.strafeRight) {
    moveX += strafeX;
    moveY += strafeY;
  }

  if (input.strafeLeft) {
    moveX -= strafeX;
    moveY -= strafeY;
  }

  const length = Math.hypot(moveX, moveY);

  if (length > 0.0001) {
    const step = (PLAYER_SPEED * deltaSeconds) / length;
    const moved = slideMove(world.maze, world.player, moveX * step, moveY * step, PLAYER_RADIUS);
    world.player.x = moved.x;
    world.player.y = moved.y;
    world.walkBob = Math.min(1, world.walkBob + deltaSeconds * 5);
  } else {
    world.walkBob = Math.max(0, world.walkBob - deltaSeconds * 4);
  }

  const settled = unstick(world.maze, world.player, PLAYER_RADIUS);
  world.player.x = settled.x;
  world.player.y = settled.y;
}

function landThrownEnemy(world: DemoWorld, projectile: DemoProjectile, hitWall: boolean): void {
  const enemy = projectile.payload;

  if (!enemy) {
    return;
  }

  enemy.x = projectile.x;
  enemy.y = projectile.y;
  enemy.stunSeconds = THROWN_ENEMY_STUN;
  enemy.hp -= hitWall ? THROWN_ENEMY_SELF_DAMAGE : Math.round(THROWN_ENEMY_SELF_DAMAGE / 2);
  enemy.hurtSeconds = 0.3;

  if (enemy.hp <= 0) {
    world.deaths.push({ id: enemy.id, appearance: enemy.appearance, x: enemy.x, y: enemy.y, progress: 0 });
    world.kills += 1;
    return;
  }

  const settled = unstick(world.maze, { x: enemy.x, y: enemy.y }, 0.3);
  enemy.x = settled.x;
  enemy.y = settled.y;
  world.enemies.push(enemy);
}

/**
 * A thrown object is spent.
 *
 * Only a thrown enemy has anything left to resolve — it is a body, and it lands. Sticks and stones
 * are gone the moment they leave the hand, which is what makes deciding to throw one cost something.
 * Putting a held object back down is the separate right-button action and still returns it.
 */
function finishProjectile(world: DemoWorld, projectile: DemoProjectile, hitWall: boolean): void {
  if (projectile.kind === "enemy") {
    landThrownEnemy(world, projectile, hitWall);
  }
}

function strikeWith(world: DemoWorld, projectile: DemoProjectile): void {
  // Snapshot: killing an enemy splices the live array out from under the loop.
  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id)) {
      continue;
    }

    if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > PROJECTILE_HIT_RADIUS) {
      continue;
    }

    projectile.struck.add(enemy.id);

    if (projectile.kind === "stick") {
      killEnemy(world, enemy);
      announce(world, "木棍把敵人釘在牆上");
      continue;
    }

    if (projectile.kind === "bigRock") {
      killEnemy(world, enemy);
      announce(world, "大石塊直接輾過去");
      continue;
    }

    if (projectile.kind === "enemy") {
      enemy.stunSeconds = Math.max(enemy.stunSeconds, THROWN_ENEMY_STUN);
      damageEnemy(world, enemy, THROWN_ENEMY_IMPACT_DAMAGE);
      announce(world, "撞飛路線上的敵人");
    }
  }
}

function stepProjectiles(world: DemoWorld, deltaSeconds: number): void {
  for (const projectile of world.projectiles.slice()) {
    const speed = projectileSpeed(projectile.kind);
    const distance = speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));
    let finished = false;
    let struckCell: DemoCell | undefined;

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      projectile.x += projectile.directionX * advance;
      projectile.y += projectile.directionY * advance;
      projectile.travelled += advance;

      if (isSolidCell(world.maze, Math.floor(projectile.x), Math.floor(projectile.y))) {
        struckCell = { x: Math.floor(projectile.x), y: Math.floor(projectile.y) };
        projectile.x -= projectile.directionX * advance;
        projectile.y -= projectile.directionY * advance;
        finished = true;
        break;
      }

      if (!projectile.inert) {
        strikeWith(world, projectile);
      }

      if (projectile.travelled >= projectile.range) {
        finished = true;
      }
    }

    if (!finished) {
      continue;
    }

    world.projectiles.splice(world.projectiles.indexOf(projectile), 1);

    // The wall is spent before the projectile is: a body that lands where a wall just broke should
    // land in the opening, not against the wall that is no longer there.
    if (struckCell) {
      damageWall(world, struckCell, thrownWallDamage(projectile.kind));
    }

    finishProjectile(world, projectile, struckCell !== undefined);
  }
}

function stepDeaths(world: DemoWorld, deltaSeconds: number): void {
  for (const death of world.deaths.slice()) {
    death.progress += deltaSeconds / DEATH_SECONDS;

    if (death.progress >= 1) {
      world.deaths.splice(world.deaths.indexOf(death), 1);
    }
  }
}

export function stepDemoWorld(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const step = Math.min(deltaSeconds, 0.05);
  world.elapsedSeconds += step;
  world.swing = Math.max(0, world.swing - step);
  world.hitFlash = Math.max(0, world.hitFlash - step * 2.4);
  world.messageSeconds = Math.max(0, world.messageSeconds - step);
  stepDeaths(world, step);
  stepProjectiles(world, step);

  if (world.status !== "playing") {
    return;
  }

  stepPlayer(world, input, step);
  stepEnemies(world, step);
  world.spawnSeconds -= step;

  if (world.spawnSeconds <= 0) {
    world.spawnSeconds += SPAWN_INTERVAL_SECONDS;

    if (spawnReinforcement(world)) {
      announce(world, `又爬出來一隻（${world.enemies.length}/${MAX_ENEMIES}）`, 1.4);
    }
  }

  const toExit = Math.hypot(world.player.x - (world.maze.exit.x + 0.5), world.player.y - (world.maze.exit.y + 0.5));

  if (toExit < EXIT_RADIUS) {
    world.status = "escaped";
    announce(world, "找到出口了", 999);
  }
}
