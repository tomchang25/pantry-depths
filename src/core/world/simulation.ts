/**
 * One tick of the world: player, enemies, projectiles, hazards, timers, and the floor change. Fixed
 * order and mutating, with no rollback and no determinism guarantee.
 */

import { MELEE_CUT_START } from "@/core/combat/melee-contract";
import { resolveSwing } from "@/core/combat/actions";
import { heldWeight, playerSpeed } from "@/core/player/stats";
import { stepEnemies } from "@/core/combat/enemy-ai";
import { announce, stainFloor } from "@/core/feedback/run-feedback";
import { stepExtraction } from "@/core/world/extraction";
import { stepDrowning } from "@/core/damage/area";
import { stepProjectiles } from "@/core/projectile/step-projectiles";
import { stepHazards } from "@/core/hazard/step-hazards";
import { stepMortars } from "@/core/hazard/mortars";
import { blocksProjectile, buildFloor, roll } from "@/core/floor/maze";
import { slideMove, unstick, WALKING } from "@/core/floor/movement";
import { stepParticles } from "@/core/combat/particles";
import { stepRooms } from "@/core/floor/rooms";
import { LEVEL_CARD_PREFIX, runLevel } from "@/core/world/run-level";
import { stepTasks } from "@/core/world/tasks";
import {
  bodyFootprint,
  crowdHere,
  IDLE_SPAWN_RECHECK_SECONDS,
  PLAYER_RADIUS,
  populateFloor,
  spawnReinforcement,
  type World,
} from "@/core/world/world";

export type PlayerInput = Readonly<{
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
}>;

/** How long a corpse animation runs. Exported so a workbench replays a death at its real length. */
export const DEATH_SECONDS = 0.75;
const EXIT_RADIUS = 0.55;
/** How fast the weight jolt leaves the view. Fast, so it reads as a thump rather than a wobble. */
const SHAKE_DECAY = 5;

/**
 * The slowest a crowd may leave the player. A crowd costs time, never control. Set below the hardest
 * single enemy rather than at it, so an authored value is never silently clipped to this one.
 */
const MIN_CROWD_PACE = 0.25;

/**
 * What wading through enemies costs the player, as a fraction of pace. A slowdown rather than a
 * shove: two forces arguing every frame produce twitching in place rather than a crowd in the way.
 * It bites only inside the drawn footprint, and enemies hold station short of that, so standing among
 * a crowd is free and pushing into one is not.
 */
function crowdPace(world: World): number {
  let drag = 0;

  for (const enemy of world.enemies) {
    const bodyDrag = enemy.archetype.drag;

    if (bodyDrag === undefined || enemy.drowningSeconds > 0) {
      continue;
    }

    const distance = Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y);
    const contact = PLAYER_RADIUS + bodyFootprint(enemy.archetype);

    if (distance >= contact) {
      continue;
    }

    drag += bodyDrag * (1 - distance / contact);
  }

  return Math.max(MIN_CROWD_PACE, 1 - drag);
}

function stepPlayer(world: World, input: PlayerInput, deltaSeconds: number): void {
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
    // Carrying and wading both cost pace, and the two multiply.
    const carried = heldWeight(world, world.held)?.carrySlow ?? 1;
    const step = (playerSpeed(world) * carried * crowdPace(world) * deltaSeconds) / length;
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

function stepVfx(world: World, deltaSeconds: number): void {
  for (const effect of world.vfx.slice()) {
    effect.age += deltaSeconds;

    if (effect.age >= effect.life) {
      world.vfx.splice(world.vfx.indexOf(effect), 1);
    }
  }
}

/** Ages the direction marks and drops the expired ones. */
function stepDamageMarks(world: World, deltaSeconds: number): void {
  for (const mark of world.damageMarks.slice()) {
    mark.age += deltaSeconds;

    if (mark.age >= mark.life) {
      world.damageMarks.splice(world.damageMarks.indexOf(mark), 1);
    }
  }
}

function stepDeaths(world: World, deltaSeconds: number): void {
  for (const death of world.deaths.slice()) {
    death.progress += deltaSeconds / DEATH_SECONDS;

    if (death.progress >= 1) {
      world.deaths.splice(world.deaths.indexOf(death), 1);
    }
  }
}

/**
 * Takes the stairs. Health, hands, and blessings survive; the floor is what is replaced. Arriving
 * grants nothing, because the floor's own tasks are what a run is rewarded for.
 */
export function descend(world: World): void {
  world.depth += 1;
  // A swing in mid-air has nothing left to land on, so it is dropped rather than arriving on the
  // next floor and cleaving whatever spawned where the old target stood.
  world.swing = 0;
  world.swingResolved = true;
  world.swingTarget = undefined;
  world.maze = buildFloor(world.map);
  populateFloor(world);
  announce(world, `Down to floor B${world.depth}`, 3);
}

/**
 * Reports a rise in difficulty, once per step. Phrased as a cost rather than a gain, because the
 * number rises with minutes spent and floors taken, both of which the loop charges for.
 */
function stepRunLevel(world: World): void {
  const level = runLevel(world);

  if (level <= world.announcedLevel) {
    return;
  }

  world.announcedLevel = level;
  world.pendingCard = `${LEVEL_CARD_PREFIX}${level}`;
  announce(world, `The depths stir - threat ${level}`, 3);
}

export function stepWorld(world: World, input: PlayerInput, deltaSeconds: number): void {
  const step = Math.min(deltaSeconds, 0.05);
  world.elapsedSeconds += step;
  world.swing = Math.max(0, world.swing - step);
  world.impact = Math.max(0, world.impact - step * 6);

  // The blade reaches the target partway through the animation, on the frame the arc is drawn.
  if (!world.swingResolved && 1 - world.swing / Math.max(0.0001, world.swingTotal) >= MELEE_CUT_START) {
    world.swingResolved = true;
    resolveSwing(world);
  }

  world.shake = Math.max(0, world.shake - step * SHAKE_DECAY);
  world.hitFlash = Math.max(0, world.hitFlash - step * 2.4);
  stepDamageMarks(world, step);
  world.messageSeconds = Math.max(0, world.messageSeconds - step);
  stepDeaths(world, step);
  stepVfx(world, step);

  // Blood marks the floor where it lands, so a spray scatters and a corpse pools.
  for (const landing of stepParticles(world.particles, step, (x, y) =>
    blocksProjectile(world.maze, Math.floor(x), Math.floor(y)),
  )) {
    if (landing.kind === "blood") {
      stainFloor(world, landing.x, landing.y, 0.16);
    }
  }

  stepProjectiles(world, step);
  stepHazards(world, step);
  stepDrowning(world, step);

  if (world.status !== "playing") {
    return;
  }

  stepRunLevel(world);
  stepPlayer(world, input, step);

  // The world freeze stops the enemy pass outright, timers included. The decision freeze is inside
  // that pass, so a frozen enemy still flinches and its hit flash still fades.
  if (!world.worldFrozen) {
    stepEnemies(world, step);
  }

  // Emplacements are terrain rather than enemies, but a freeze is no use if a shell lands during it.
  // The reinforcement clock stops under either switch, so nothing arrives that was not asked for.
  if (!world.worldFrozen && !world.mindsFrozen) {
    stepMortars(world, step);
    world.spawnSeconds -= step;

    if (world.spawnSeconds <= 0) {
      const crowd = crowdHere(world);
      const wave = crowd.reinforcement;

      if (!wave) {
        // Nothing returns here, but the clock still ticks: walking one room over changes the answer.
        world.spawnSeconds = IDLE_SPAWN_RECHECK_SECONDS;
      } else {
        // Added rather than assigned, so a frame that ran long does not slow the rate it was owed.
        world.spawnSeconds += roll(wave.every);
        const wanted = roll(wave.count);
        let arrived = 0;

        // Stops early when the cap is full or nowhere is far enough, so the count reported is real.
        while (arrived < wanted && spawnReinforcement(world)) {
          arrived += 1;
        }

        if (arrived === 1) {
          announce(world, `Another one crawls out (${world.enemies.length}/${crowd.cap})`, 1.4);
        } else if (arrived > 1) {
          announce(world, `${arrived} more crawl out (${world.enemies.length}/${crowd.cap})`, 1.4);
        }
      }
    }
  }

  stepRooms(world, step);
  stepTasks(world);

  const toExit = Math.hypot(world.player.x - (world.maze.exit.x + 0.5), world.player.y - (world.maze.exit.y + 0.5));

  if (toExit < EXIT_RADIUS && world.maze.progress.main.met) {
    descend(world);
    return;
  }

  stepExtraction(world, step);
}
