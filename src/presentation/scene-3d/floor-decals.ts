/**
 * What a fight paints onto the ground.
 *
 * Every warning this floor gives a player about where not to be standing: the lane a charger has
 * claimed, the wedge a sword is about to sweep, the ring a shell will land inside, and the pad the
 * way out is counting down on. The experiment drew all of it in the air before this — bead strings at
 * chest height — which reads as decoration around a body rather than as ground you are standing on.
 *
 * This module is a projection and owns no geometry. It answers what marks exist this frame, already
 * flattened into the form the ground's shader tests: squared radii, a cosine in place of a half-angle,
 * and one slot doing different work per kind. That flattening is the renderer's, and doing it here
 * rather than per pixel is the whole reason the channel is affordable at all.
 *
 * Order within a mark is load-bearing. The fill goes down and the edge over it, and a later mark
 * overwrites an earlier one where they overlap, so a circle keeps a hard rim right up to the moment
 * it is full.
 */

import { attackReach, CHARGE_DISTANCE, MELEE_CUT_HALF_ANGLE } from "@/core/enemy-contract";
import { blocksFlung } from "@/core/maze";
import { MORTAR_LOCK_SECONDS, SHELL_BLAST_RADIUS, type World } from "@/core/world";

import { SCENE_DECAL_LANE, SCENE_DECAL_RADIAL, SCENE_DECAL_SECTOR, type SceneDecal } from "./scene-lighting";

/** Taken from the interim projection before it was deleted; these are the only copies now. */
const LANE_HALF_WIDTH = 0.34;
const RING_THICKNESS = 0.16;

const LANE_DIM: readonly [number, number, number] = [128, 30, 34];
const LANE_HOT: readonly [number, number, number] = [255, 118, 84];
const CIRCLE_EDGE: readonly [number, number, number] = [255, 74, 58];
const CIRCLE_FILL: readonly [number, number, number] = [220, 96, 62];
/** Hotter than the aim fill, so a committed shell is told apart from a lock in peripheral vision. */
const SHELL_INCOMING: readonly [number, number, number] = [255, 146, 78];
const CUT_DIM: readonly [number, number, number] = [136, 36, 40];
const CUT_HOT: readonly [number, number, number] = [255, 128, 96];

/**
 * How the mark blinks once the shell is committed: flashes at launch, accelerates through the flight,
 * and holds solid over the closing share of it.
 */
const INCOMING_FLASH_START = 3;
const INCOMING_FLASH_END = 9;
const INCOMING_SOLID_SHARE = 0.15;
const INCOMING_DIM = 0.32;
const INCOMING_HOT = 0.95;

/**
 * How far a charge can run before something stops it.
 *
 * The flung predicate rather than the projectile one, because that is what the charge moves under —
 * and the two disagree in the case worth drawing: a barricade stops a thrown rock but not a charging
 * body, which sails onto the spikes and dies there.
 */
function chargeRun(
  world: World,
  fromX: number,
  fromY: number,
  directionX: number,
  directionY: number,
  limit: number,
): number {
  const step = 0.15;

  for (let travelled = step; travelled <= limit; travelled += step) {
    if (
      blocksFlung(world.maze, Math.floor(fromX + directionX * travelled), Math.floor(fromY + directionY * travelled))
    ) {
      return travelled - step;
    }
  }

  return limit;
}

function disc(
  x: number,
  y: number,
  radius: number,
  color: readonly [number, number, number],
  strength: number,
): SceneDecal {
  return {
    kind: SCENE_DECAL_RADIAL,
    x,
    y,
    outer: radius * radius,
    inner: 0,
    directionX: 0,
    directionY: 0,
    color,
    strength,
  };
}

function ring(
  x: number,
  y: number,
  radius: number,
  thickness: number,
  color: readonly [number, number, number],
  strength: number,
): SceneDecal {
  const hole = Math.max(0, radius - thickness);
  return {
    kind: SCENE_DECAL_RADIAL,
    x,
    y,
    outer: radius * radius,
    inner: hole * hole,
    directionX: 0,
    directionY: 0,
    color,
    strength,
  };
}

function lane(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  length: number,
  halfWidth: number,
  color: readonly [number, number, number],
  strength: number,
): SceneDecal {
  return {
    kind: SCENE_DECAL_LANE,
    x,
    y,
    outer: length,
    inner: halfWidth,
    directionX,
    directionY,
    color,
    strength,
  };
}

function sector(
  x: number,
  y: number,
  radius: number,
  directionX: number,
  directionY: number,
  halfAngle: number,
  color: readonly [number, number, number],
  strength: number,
): SceneDecal {
  return {
    kind: SCENE_DECAL_SECTOR,
    x,
    y,
    outer: radius * radius,
    inner: Math.cos(halfAngle),
    directionX,
    directionY,
    color,
    strength,
  };
}

/** The blast's true edge, at its true width, drawn identically for both phases of a shot. */
function blastRim(built: SceneDecal[], x: number, y: number, radius: number): void {
  built.push(ring(x, y, radius, RING_THICKNESS, CIRCLE_EDGE, 0.9));
}

/**
 * The blink under a committed shell, as a strength.
 *
 * Flashes are counted rather than a rate sampled: the phase is the integral of a rate rising across
 * the flight, which is what lets the blink speed up and stay smooth doing it. It never goes dark — a
 * mark that blinks to nothing is missing for exactly the frames somebody is sprinting out of it.
 */
function incomingFlash(flown: number, seconds: number): number {
  if (flown >= 1 - INCOMING_SOLID_SHARE) {
    return INCOMING_HOT;
  }

  const averageRate = INCOMING_FLASH_START + ((INCOMING_FLASH_END - INCOMING_FLASH_START) * flown) / 2;
  const wave = (Math.sin(seconds * flown * averageRate * Math.PI * 2) + 1) / 2;
  return INCOMING_DIM + (INCOMING_HOT - INCOMING_DIM) * wave;
}

export function collectFloorDecals(world: World): SceneDecal[] {
  const built: SceneDecal[] = [];

  for (const enemy of world.enemies) {
    if (enemy.windupSeconds <= 0 || enemy.intent !== "charge") {
      continue;
    }

    const dx = enemy.aimX - enemy.x;
    const dy = enemy.aimY - enemy.y;
    const aim = Math.hypot(dx, dy);

    if (aim < 0.0001) {
      continue;
    }

    // The lane runs the charge's own distance, not the distance to the locked point: the charge does
    // not stop where it was aimed, it runs its full length past it.
    const directionX = dx / aim;
    const directionY = dy / aim;
    const length = chargeRun(world, enemy.x, enemy.y, directionX, directionY, CHARGE_DISTANCE);
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    built.push(lane(enemy.x, enemy.y, directionX, directionY, length, LANE_HALF_WIDTH, LANE_DIM, 0.55));
    // The same strip again, shorter, sweeping out from the charger as the wind-up runs down. One
    // object says both where the charge is going and how long there is to not be standing in it.
    built.push(lane(enemy.x, enemy.y, directionX, directionY, length * progress, LANE_HALF_WIDTH, LANE_HOT, 0.82));
  }

  for (const enemy of world.enemies) {
    if (enemy.windupSeconds <= 0 || enemy.intent !== "melee") {
      continue;
    }

    // Secondary by design: at this reach the wedge sits at the very bottom of the frame, so what a
    // player reads in the moment is the mark over the body and the arc at blade height. What the
    // floor is for is the half-second after stepping back, when the question is whether you got out.
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    const reach = attackReach(enemy.archetype);
    built.push(
      sector(
        enemy.x,
        enemy.y,
        reach,
        Math.cos(enemy.facingAngle),
        Math.sin(enemy.facingAngle),
        MELEE_CUT_HALF_ANGLE,
        CUT_DIM,
        0.5,
      ),
    );
    // The same wedge sweeping open from one edge to the other, so the fill runs the way the blade
    // will. Widening about a bisector that walks across is how one shape says both.
    const swept = MELEE_CUT_HALF_ANGLE * progress;
    const bisector = enemy.facingAngle - MELEE_CUT_HALF_ANGLE + swept;
    built.push(
      sector(enemy.x, enemy.y, reach, Math.cos(bisector), Math.sin(bisector), Math.max(0.02, swept), CUT_HOT, 0.8),
    );
  }

  for (const mortar of world.mortars) {
    if (mortar.phase !== "locked") {
      continue;
    }

    // A disc closing on the blast's true edge as the lock runs down. It is a countdown with an out at
    // the end of it: smashing the emplacement inside the fuse cancels the shot entirely.
    const closing = 1 - mortar.seconds / MORTAR_LOCK_SECONDS;
    built.push(disc(mortar.aimX, mortar.aimY, SHELL_BLAST_RADIUS * Math.max(0.06, closing), CIRCLE_FILL, 0.5));
    blastRim(built, mortar.aimX, mortar.aimY, SHELL_BLAST_RADIUS);
  }

  // The extraction pad used to be painted here, on the reasoning the shipped game had for painting
  // it: its canister stood on bare stone. This runtime rebuilds that fixture as a raised pad which
  // covers the whole three cells, so the mark was drawn underneath something opaque and nobody ever
  // saw it. Both holds now put their readout on top of the fixture, in `world-structures.ts`.

  for (const hazard of world.hazards) {
    if (hazard.kind !== "shell") {
      continue;
    }

    // Once the shell is in the air the mark stays where it was painted, at the width it was painted
    // at, so it runs unbroken from the lock through to the landing. What changes is only how it is
    // drawn: the shot has left the emplacement and can no longer be called off, and that is a
    // different fact about the floor than an emplacement taking aim. So the fill stops counting down
    // and starts insisting — full width, blinking faster as it comes in.
    const left = hazard.range - hazard.travelled;
    const landingX = hazard.x + hazard.directionX * left;
    const landingY = hazard.y + hazard.directionY * left;
    const flown = Math.min(1, hazard.travelled / Math.max(0.0001, hazard.range));
    const seconds = hazard.range / Math.max(0.0001, hazard.speed);
    built.push(disc(landingX, landingY, hazard.blastRadius, SHELL_INCOMING, incomingFlash(flown, seconds)));
    blastRim(built, landingX, landingY, hazard.blastRadius);
  }

  return built;
}
