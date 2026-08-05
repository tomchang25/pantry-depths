/**
 * A throw in flight, and everything it can do on the way.
 *
 * One module because the family is one subject: how far a throw gets each frame, what it passes
 * through, what it runs through or cleaves, what stops it, and what its landing is worth. Splitting
 * it by concern would put the hit tests in one place and the reason they exist in another.
 *
 * An executor: it holds the run state and applies outcomes through the damage owners. Giving the
 * flight path a snapshot-and-effect contract is future work the plan deliberately excludes.
 */

import { dropProp } from "@/core/world/props";
import type { SfxCueId } from "@/core/sfx-cues";
import { isBoned } from "@/core/combat/enemy-contract";
import { damageEnemy, killEnemy } from "@/core/damage/enemy-damage";
import { damageWall } from "@/core/damage/structure-damage";
import { bargeInto, bodyLanding, checkHazards, detonate, knockBack, rockImpact } from "@/core/damage/area";
import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import type { Enemy } from "@/core/enemy/enemy-state";
import { blocksProjectileAt, isBarricadeCell, tileAt } from "@/core/floor/maze";
import { FLUNG, unstick } from "@/core/floor/movement";
import { projectileGrounded, projectileHeight } from "@/core/projectile/flight";
import { thrownImpactDamage, thrownWallDamage } from "@/core/player/stats";
import {
  breaksThroughWalls,
  propBehaviour,
  throwCapacity,
  type PropFlightHit,
  type PropLanding,
} from "@/core/prop-contract";
import { bodyFootprint, type Projectile, type World } from "@/core/world/world";
import type { Cell } from "@/core/grid";

/** A thrown object's own reach. The target's footprint is added, so size decides how easy it is to hit. */
const PROJECTILE_HIT_RADIUS = 0.45;
/** What a point weapon adds for landing all of itself in one place, and the shove that comes with it. */
const STRIKE_DAMAGE_SCALE = 1.6;
const STRIKE_KNOCKBACK = 6;
/** The slowest a throw is allowed to get, however heavy it is. See where drag is applied. */
const MIN_FLIGHT_SPEED = 4.5;
/**
 * Puts a thrown enemy back in the world where it came down, then charges it for the landing. It
 * rejoins the list before the damage lands, so a fatal landing runs the one ordinary death path.
 */
function landThrownEnemy(world: World, projectile: Projectile, hitWall: boolean): void {
  const enemy = projectile.payload;

  if (!enemy) {
    return;
  }

  const settled = unstick(world.maze, { x: projectile.x, y: projectile.y }, 0.3, FLUNG);
  enemy.x = settled.x;
  enemy.y = settled.y;
  world.enemies.push(enemy);
  // The cell gets first claim, before the fall does. The other order let landing damage kill a body
  // thrown into water, which played the wrong death on the surface of it.
  checkHazards(world, enemy);

  if (world.enemies.includes(enemy)) {
    bodyLanding(world, enemy, {
      hitWall,
      thud: projectile.thud,
      directionX: projectile.directionX,
      directionY: projectile.directionY,
    });
  }
}

/**
 * A point weapon arriving: one enemy takes all of it. A rock's area impact reads as a grenade for a
 * blade, so this finds the one the flight stopped on and shoves it along the line of travel.
 */
function strikeWithProp(world: World, projectile: Projectile): void {
  let struck: Enemy | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0) {
      continue;
    }

    const distance = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y);

    if (distance > PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype) || distance > bestDistance) {
      continue;
    }

    struck = enemy;
    bestDistance = distance;
  }

  if (!struck) {
    return;
  }

  // The same material cue a swing gets: a thrown hit is still a hit on that material.
  raiseSfx(world, isBoned(struck.archetype) ? "meleeHitBone" : "meleeHitFlesh", { x: struck.x, y: struck.y });
  knockBack(
    struck,
    projectile.x - projectile.directionX * 0.6,
    projectile.y - projectile.directionY * 0.6,
    STRIKE_KNOCKBACK,
  );
  damageEnemy(world, struck, thrownImpactDamage(world) * STRIKE_DAMAGE_SCALE, "cleaved", {
    x: projectile.directionX,
    y: projectile.directionY,
  });
}

/** What a throw does where it stops, dispatched from the prop's own row rather than its name. */
function resolveLanding(world: World, projectile: Projectile, landing: PropLanding): void {
  // Nothing happens where it stops, because a blade spends itself on the way. Survival is `leaves`.
  if (landing === "spend") {
    return;
  }

  if (landing === "pin") {
    pinToWall(world, projectile);
    return;
  }

  if (landing === "burst") {
    rockImpact(world, projectile.x, projectile.y);
    return;
  }

  if (landing === "detonate") {
    detonate(world, projectile.x, projectile.y);
    return;
  }

  if (landing === "strike") {
    strikeWithProp(world, projectile);
    return;
  }

  landing satisfies never;
  throw new Error("unknown prop landing");
}

/**
 * What meeting masonry sounds like, per landing kind. A total map, so a landing added later cannot
 * compile without an answer. `burst` and `detonate` report at their own sites and are silent here.
 */
const WALL_STOP_CUES: Readonly<Record<PropLanding, SfxCueId | undefined>> = {
  pin: "pinLand",
  strike: "strikeLand",
  spend: "strikeLand",
  burst: undefined,
  detonate: undefined,
};

/**
 * Resolves where a throw stopped and whether it still exists. A thrown enemy is the one throw with no
 * prop row, because what happens to it depends on what it landed on; everything else reads its row.
 */
function finishProjectile(world: World, projectile: Projectile, hitWall: boolean): void {
  if (projectile.kind === "enemy") {
    landThrownEnemy(world, projectile, hitWall);
    return;
  }

  const behaviour = propBehaviour(world.catalog, projectile.kind);
  const wallCue = hitWall ? WALL_STOP_CUES[behaviour.landing] : undefined;

  if (wallCue !== undefined) {
    raiseSfx(world, wallCue, { x: projectile.x, y: projectile.y });
  }

  resolveLanding(world, projectile, behaviour.landing);

  if (behaviour.leaves) {
    dropProp(world, behaviour.leaves, projectile.x, projectile.y);
  }
}

/**
 * The javelin running an enemy through. Nothing dies here: the enemy is lifted out of the world and
 * carried on the shaft, and the kill resolves against whatever the javelin buries itself in.
 */
function skewerWithJavelin(world: World, projectile: Projectile): void {
  if (projectile.skewered.length >= throwCapacity(world.catalog, projectile.kind)) {
    return;
  }

  // A shaft above head height runs nothing through on the way past.
  if (projectileHeight(projectile) > 0.6) {
    return;
  }

  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (
      Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) >
      PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype)
    ) {
      continue;
    }

    projectile.struck.add(enemy.id);
    world.enemies.splice(world.enemies.indexOf(enemy), 1);
    projectile.skewered.push(enemy);
    raiseSfx(world, isBoned(enemy.archetype) ? "meleeHitBone" : "meleeHitFlesh", { x: enemy.x, y: enemy.y });
    announce(world, "Skewered!", 1.2);

    if (projectile.skewered.length >= throwCapacity(world.catalog, projectile.kind)) {
      return;
    }
  }
}

/**
 * Kills whatever it touches outright, whatever health was left. A blade stops on the third; a reaping
 * throw stops on none, because what it is spending is the masonry behind them.
 */
function cleaveThrough(world: World, projectile: Projectile, stopsWhenFull: boolean): boolean {
  // Same head-height rule as everything in flight: too high, and it passes clean over.
  if (projectileHeight(projectile) > 0.6) {
    return false;
  }

  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (
      Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) >
      PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype)
    ) {
      continue;
    }

    projectile.struck.add(enemy.id);
    projectile.cleaved += 1;
    killEnemy(world, enemy, "cleaved");
    announce(world, `Cleaves ${projectile.cleaved}!`, 1.2);

    if (stopsWhenFull && projectile.cleaved >= throwCapacity(world.catalog, projectile.kind)) {
      return true;
    }
  }

  return false;
}

/**
 * Nails what the javelin was carrying to whatever stopped it, at the point the shaft went in. What is
 * left is a mark on the wall, which the scene puts onto the plane itself.
 */
function pinToWall(world: World, projectile: Projectile): void {
  for (const enemy of projectile.skewered) {
    enemy.x = projectile.x;
    enemy.y = projectile.y;
    world.enemies.push(enemy);
    killEnemy(world, enemy, "splattered", { x: projectile.directionX, y: projectile.directionY });
    announce(world, "Pinned to the wall!");
  }
}

/** A thrown enemy running down what it meets. Nothing stops it: each is hit once and it carries on. */
function bargeThrough(world: World, projectile: Projectile): void {
  // One lobbed high overhead runs nothing down on the way; it hits whatever it lands on.
  if (projectileHeight(projectile) > 0.6) {
    return;
  }

  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (
      Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) >
      PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype)
    ) {
      continue;
    }

    projectile.struck.add(enemy.id);
    bargeInto(world, enemy, projectile.x, projectile.y, projectile.directionX, projectile.directionY, projectile.thud);
  }
}

/** Whether anything solid enough to stop a throw sits at the projectile's position. */
function hitsSomeone(world: World, projectile: Projectile): boolean {
  // A lob sailing overhead is not a hit: the arc gates the test, so a bomb cannot detonate on a head it cleared.
  if (projectileHeight(projectile) > 0.6) {
    return false;
  }

  return world.enemies.some(
    (enemy) =>
      enemy.drowningSeconds <= 0 &&
      Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <=
        PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype),
  );
}

/**
 * What a prop does to what it reaches in the air, and whether that ends the flight. Not a plain hit
 * test, because the piercing throws keep flying after doing something; everything else stops.
 */
function stoppedInFlight(world: World, projectile: Projectile, flightHit: PropFlightHit): boolean {
  if (flightHit === "skewer") {
    skewerWithJavelin(world, projectile);
    return false;
  }

  if (flightHit === "cleave") {
    return cleaveThrough(world, projectile, true);
  }

  if (flightHit === "reap") {
    return cleaveThrough(world, projectile, false);
  }

  if (flightHit === "stop") {
    return hitsSomeone(world, projectile);
  }

  flightHit satisfies never;
  throw new Error("unknown prop flight hit");
}

/**
 * Whether this cell is masonry a breaking throw opens and carries on through. Stone and timber only:
 * a barricade, an emplacement, and the boundary are things a throw ends against.
 */
function spendsWall(world: World, cell: Cell): boolean {
  const tile = tileAt(world.maze, cell.x, cell.y);
  return tile?.kind === "stone" || tile?.kind === "wood";
}

export function stepProjectiles(world: World, deltaSeconds: number): void {
  for (const projectile of world.projectiles.slice()) {
    recordTrail(projectile);
    const distance = projectile.speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));

    // Floored, so a flight decaying towards zero cannot asymptote short of its range and never resolve.
    if (projectile.drag > 0) {
      projectile.speed = Math.max(MIN_FLIGHT_SPEED, projectile.speed * Math.exp(-projectile.drag * deltaSeconds));
    }

    let finished = false;
    let struckCell: Cell | undefined;
    let stoppedByWall = false;
    const breaksThrough = breaksThroughWalls(world.catalog, projectile.kind);

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      projectile.x += projectile.directionX * advance;
      projectile.y += projectile.directionY * advance;
      projectile.travelled += advance;

      // A throw that stops where it touches down. Every other weapon flattens against the floor and
      // carries on, because the height curve is clamped; this is the crossing that clamp hides.
      if (breaksThrough && projectileGrounded(projectile)) {
        finished = true;
        break;
      }

      // Height-aware: a lob above a wall's top crosses it; flat weapons fly at hand height and stop.
      if (
        blocksProjectileAt(world.maze, Math.floor(projectile.x), Math.floor(projectile.y), projectileHeight(projectile))
      ) {
        const cell = { x: Math.floor(projectile.x), y: Math.floor(projectile.y) };

        // Masonry a reaping throw spends rather than stops against: the wall opens and the flight
        // continues through the hole. Anything else takes the whole budget and ends the throw.
        if (breaksThrough && spendsWall(world, cell)) {
          damageWall(world, cell, thrownWallDamage(world, projectile.kind));
          projectile.broke += 1;

          if (projectile.broke < throwCapacity(world.catalog, projectile.kind)) {
            continue;
          }

          finished = true;
          break;
        }

        struckCell = cell;
        // A barricade is not a wall to a thrown enemy: stepping back out of the cell would put it on
        // the floor in front of the iron rather than on it. It stays in the cell, so the landing
        // finds the spikes.
        const spikes = projectile.kind === "enemy" && isBarricadeCell(world.maze, struckCell.x, struckCell.y);
        stoppedByWall = !spikes;

        if (stoppedByWall) {
          projectile.x -= projectile.directionX * advance;
          projectile.y -= projectile.directionY * advance;
        }

        finished = true;
        break;
      }

      if (projectile.kind === "enemy") {
        bargeThrough(world, projectile);
      } else if (stoppedInFlight(world, projectile, propBehaviour(world.catalog, projectile.kind).flightHit)) {
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

    // The wall is spent first, so anything landing where it broke lands in the opening.
    if (struckCell) {
      damageWall(world, struckCell, thrownWallDamage(world, projectile.kind));
    }

    // Only masonry counts as a wall here; the spikes answer the landing themselves.
    finishProjectile(world, projectile, stoppedByWall);
  }
}

/** How many past positions a projectile keeps for its trail. */
const TRAIL_LENGTH = 9;

function recordTrail(projectile: Projectile): void {
  projectile.trail.push({ x: projectile.x, y: projectile.y, z: projectileHeight(projectile) });

  if (projectile.trail.length > TRAIL_LENGTH) {
    projectile.trail.shift();
  }
}
