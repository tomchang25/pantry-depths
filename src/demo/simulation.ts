/**
 * One tick of the demo world: player, enemies, projectiles, hazards, timers, and the floor change.
 *
 * Fixed-order and mutating. There is no rollback and no determinism guarantee — the demo is played,
 * not replayed.
 */

import { AXE_CAPACITY, damageWall, JAVELIN_CAPACITY, projectileSpeed, thrownWallDamage } from "@/demo/actions";
import { hurtPlayer, stepEnemies } from "@/demo/enemy-ai";
import { bargeInto, bodyLanding, checkDrowning, detonate, rockImpact, stepDrowning } from "@/demo/impacts";
import { blocksSight, generateDemoMaze } from "@/demo/maze";
import { FLUNG, slideMove, unstick, WALKING } from "@/demo/movement";
import {
  announce,
  awardBless,
  killEnemy,
  MAX_ENEMIES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  populateFloor,
  SPAWN_INTERVAL_SECONDS,
  spawnReinforcement,
  type DemoCellLike,
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
const EXIT_RADIUS = 0.55;

function stepPlayer(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const forwardX = Math.cos(world.player.angle);
  const forwardY = Math.sin(world.player.angle);
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
    moveX += -forwardY;
    moveY += forwardX;
  }

  if (input.strafeLeft) {
    moveX -= -forwardY;
    moveY -= forwardX;
  }

  const length = Math.hypot(moveX, moveY);

  if (length > 0.0001) {
    const step = (PLAYER_SPEED * deltaSeconds) / length;
    const moved = slideMove(world.maze, world.player, moveX * step, moveY * step, PLAYER_RADIUS, WALKING);
    world.player.x = moved.x;
    world.player.y = moved.y;
    world.walkBob = Math.min(1, world.walkBob + deltaSeconds * 5);
  } else {
    world.walkBob = Math.max(0, world.walkBob - deltaSeconds * 4);
  }

  if (world.player.pushX !== 0 || world.player.pushY !== 0) {
    const shoved = slideMove(
      world.maze,
      world.player,
      world.player.pushX * deltaSeconds,
      world.player.pushY * deltaSeconds,
      PLAYER_RADIUS,
      WALKING,
    );
    world.player.x = shoved.x;
    world.player.y = shoved.y;
    const decay = Math.exp(-7 * deltaSeconds);
    world.player.pushX *= decay;
    world.player.pushY *= decay;

    if (Math.hypot(world.player.pushX, world.player.pushY) < 0.05) {
      world.player.pushX = 0;
      world.player.pushY = 0;
    }
  }

  const settled = unstick(world.maze, world.player, PLAYER_RADIUS, WALKING);
  world.player.x = settled.x;
  world.player.y = settled.y;
}

/**
 * Puts a thrown body back in the world where it came down, then charges it for the landing.
 *
 * It rejoins the enemy list *before* the damage is applied, so a fatal landing goes through the one
 * ordinary death path — corpse animation in the right place, drop roll, blessing payout — instead of
 * being a second, quieter way to die.
 */
function landThrownEnemy(world: DemoWorld, projectile: DemoProjectile, hitWall: boolean): void {
  const enemy = projectile.payload;

  if (!enemy) {
    return;
  }

  const settled = unstick(world.maze, { x: projectile.x, y: projectile.y }, 0.3, FLUNG);
  enemy.x = settled.x;
  enemy.y = settled.y;
  world.enemies.push(enemy);
  bodyLanding(world, enemy, hitWall);

  if (world.enemies.includes(enemy)) {
    checkDrowning(world, enemy);
  }
}

/**
 * Resolves where a throw stopped.
 *
 * Sticks are the exception in every direction: they alone pierce, they alone kill outright, and
 * they alone leave nothing at the end of the flight. Everything else spends itself here.
 */
function finishProjectile(world: DemoWorld, projectile: DemoProjectile, hitWall: boolean): void {
  if (projectile.kind === "stick") {
    pinToWall(world, projectile);
    return;
  }

  // The axe is spent wherever it stops — buried in a wall, out of range, or out of victims.
  if (projectile.kind === "axe") {
    return;
  }

  if (projectile.kind === "rock") {
    rockImpact(world, projectile.x, projectile.y);
    return;
  }

  if (projectile.kind === "bomb") {
    detonate(world, projectile.x, projectile.y, (cell, damage) => damageWall(world, cell, damage));
    return;
  }

  landThrownEnemy(world, projectile, hitWall);
}

/**
 * The javelin running someone through.
 *
 * Nobody dies here. Up to three bodies are lifted out of the world and carried on the shaft, and the
 * kill is resolved against whatever the javelin finally buries itself in — which is the point of the
 * weapon: the wall is what does it, not the throw.
 */
function skewerWithJavelin(world: DemoWorld, projectile: DemoProjectile): void {
  if (projectile.skewered.length >= JAVELIN_CAPACITY) {
    return;
  }

  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > PROJECTILE_HIT_RADIUS) {
      continue;
    }

    projectile.struck.add(enemy.id);
    world.enemies.splice(world.enemies.indexOf(enemy), 1);
    projectile.skewered.push(enemy);
    announce(world, `串上第 ${projectile.skewered.length} 個`, 1.2);

    if (projectile.skewered.length >= JAVELIN_CAPACITY) {
      return;
    }
  }
}

/** The axe cleaving through: outright kills, and it is spent on the third one. */
function cleaveWithAxe(world: DemoWorld, projectile: DemoProjectile): boolean {
  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > PROJECTILE_HIT_RADIUS) {
      continue;
    }

    projectile.struck.add(enemy.id);
    projectile.cleaved += 1;
    killEnemy(world, enemy);
    announce(world, `飛斧劈開第 ${projectile.cleaved} 個`, 1.2);

    if (projectile.cleaved >= AXE_CAPACITY) {
      return true;
    }
  }

  return false;
}

/** Nails everything the javelin was carrying to whatever stopped it, and leaves them there dead. */
function pinToWall(world: DemoWorld, projectile: DemoProjectile): void {
  if (projectile.skewered.length === 0) {
    return;
  }

  // Backed off the surface along the shaft, so three bodies read as a row on the wall rather than as
  // one corpse standing where the other two are.
  projectile.skewered.forEach((enemy, index) => {
    const back = 0.28 + index * 0.34;
    const settled = unstick(
      world.maze,
      { x: projectile.x - projectile.directionX * back, y: projectile.y - projectile.directionY * back },
      0.24,
      FLUNG,
    );
    enemy.x = settled.x;
    enemy.y = settled.y;
    world.enemies.push(enemy);
    killEnemy(world, enemy);
  });
  announce(world, `${projectile.skewered.length} 個被釘在牆上`);
}

/**
 * A thrown body running down whoever it meets. Nobody stops it: each is hit once, then it carries
 * on to the end of its two tiles.
 */
function bargeThrough(world: DemoWorld, projectile: DemoProjectile): void {
  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > PROJECTILE_HIT_RADIUS) {
      continue;
    }

    projectile.struck.add(enemy.id);
    bargeInto(world, enemy, projectile.x, projectile.y, projectile.directionX, projectile.directionY);
  }
}

/** Whether anything solid enough to stop a throw sits at the projectile's position. */
function hitsSomeone(world: DemoWorld, projectile: DemoProjectile): boolean {
  return world.enemies.some(
    (enemy) =>
      enemy.drowningSeconds <= 0 && Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <= PROJECTILE_HIT_RADIUS,
  );
}

function stepProjectiles(world: DemoWorld, deltaSeconds: number): void {
  for (const projectile of world.projectiles.slice()) {
    const distance = projectileSpeed(projectile.kind) * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));
    let finished = false;
    let struckCell: DemoCellLike | undefined;

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      projectile.x += projectile.directionX * advance;
      projectile.y += projectile.directionY * advance;
      projectile.travelled += advance;

      if (blocksSight(world.maze, Math.floor(projectile.x), Math.floor(projectile.y))) {
        struckCell = { x: Math.floor(projectile.x), y: Math.floor(projectile.y) };
        projectile.x -= projectile.directionX * advance;
        projectile.y -= projectile.directionY * advance;
        finished = true;
        break;
      }

      if (projectile.kind === "stick") {
        skewerWithJavelin(world, projectile);
      } else if (projectile.kind === "axe") {
        if (cleaveWithAxe(world, projectile)) {
          finished = true;
          break;
        }
      } else if (projectile.kind === "enemy") {
        bargeThrough(world, projectile);
      } else if (hitsSomeone(world, projectile)) {
        finished = true;
        break;
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

function stepHazards(world: DemoWorld, deltaSeconds: number): void {
  for (const hazard of world.hazards.slice()) {
    const distance = hazard.speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));
    let finished = false;

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      hazard.x += hazard.directionX * advance;
      hazard.y += hazard.directionY * advance;
      hazard.travelled += advance;

      if (blocksSight(world.maze, Math.floor(hazard.x), Math.floor(hazard.y))) {
        finished = true;
        break;
      }

      if (Math.hypot(world.player.x - hazard.x, world.player.y - hazard.y) <= 0.42) {
        hurtPlayer(world, hazard.damage, hazard.x, hazard.y);
        finished = true;
        break;
      }

      if (hazard.travelled >= hazard.range) {
        finished = true;
      }
    }

    if (finished) {
      world.hazards.splice(world.hazards.indexOf(hazard), 1);
    }
  }
}

function stepVfx(world: DemoWorld, deltaSeconds: number): void {
  for (const effect of world.vfx.slice()) {
    effect.age += deltaSeconds;

    if (effect.age >= effect.life) {
      world.vfx.splice(world.vfx.indexOf(effect), 1);
    }
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

/**
 * Takes the stairs.
 *
 * Health, hands, and blessings all survive the descent — the floor is what is replaced. Arriving is
 * itself worth a blessing, which is the reward for the exit being reachable at all on a map that
 * never promised it would be.
 */
export function descend(world: DemoWorld): void {
  world.depth += 1;
  world.maze = generateDemoMaze();
  populateFloor(world);
  awardBless(world);
  announce(world, `下到第 ${world.depth} 層`, 3);
}

export function stepDemoWorld(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const step = Math.min(deltaSeconds, 0.05);
  world.elapsedSeconds += step;
  world.swing = Math.max(0, world.swing - step);
  world.hitFlash = Math.max(0, world.hitFlash - step * 2.4);
  world.messageSeconds = Math.max(0, world.messageSeconds - step);
  stepDeaths(world, step);
  stepVfx(world, step);
  stepProjectiles(world, step);
  stepHazards(world, step);
  stepDrowning(world, step);

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
    descend(world);
  }
}
