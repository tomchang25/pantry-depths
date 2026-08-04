/**
 * One tick of the world: player, enemies, projectiles, hazards, timers, and the floor change. Fixed
 * order and mutating, with no rollback and no determinism guarantee.
 */

import { MELEE_CUT_START } from "@/core/combat/melee-contract";
import type { SfxCueId } from "@/core/sfx-cues";
import {
  damageWall,
  heldWeight,
  playerSpeed,
  resolveSwing,
  thrownImpactDamage,
  thrownWallDamage,
} from "@/core/combat/actions";
import { isBoned } from "@/core/combat/enemy-contract";
import { hurtPlayer, stepEnemies } from "@/core/combat/enemy-ai";
import { stepExtraction } from "@/core/world/extraction";
import {
  bargeInto,
  bodyLanding,
  checkHazards,
  detonate,
  knockBack,
  rockImpact,
  shellImpact,
  stepDrowning,
} from "@/core/combat/impacts";
import {
  blocksProjectile,
  blocksProjectileAt,
  DEMO_WALL_HEIGHT,
  buildFloor,
  isBarricadeCell,
  roll,
  tileAt,
} from "@/core/floor/maze";
import { FLUNG, slideMove, unstick, WALKING } from "@/core/floor/movement";
import { stepParticles } from "@/core/combat/particles";
import { stepRooms } from "@/core/floor/rooms";
import { LEVEL_CARD_PREFIX, runLevel } from "@/core/world/run-level";

import { stepTasks } from "@/core/world/tasks";
import {
  breaksThroughWalls,
  propBehaviour,
  throwCapacity,
  type PropFlightHit,
  type PropLanding,
} from "@/core/prop-contract";
import { damageEnemy, killEnemy } from "@/core/combat/death";
import {
  announce,
  bodyFootprint,
  crowdHere,
  dropProp,
  IDLE_SPAWN_RECHECK_SECONDS,
  MORTAR_DEAD_ZONE,
  MORTAR_IDLE_SECONDS,
  MORTAR_LOCK_SECONDS,
  nextId,
  PLAYER_RADIUS,
  populateFloor,
  projectileGrounded,
  projectileHeight,
  SHELL_BLAST_RADIUS,
  SHELL_DAMAGE,
  spawnReinforcement,
  stainFloor,
  type Enemy,
  type Mortar,
  type Projectile,
  type World,
  raiseSfx,
} from "@/core/world/world";
import type { Cell } from "@/core/grid";

export type PlayerInput = Readonly<{
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
}>;

/** How long a corpse animation runs. Exported so a workbench replays a death at its real length. */
export const DEATH_SECONDS = 0.75;
/** A thrown object's own reach. The target's footprint is added, so size decides how easy it is to hit. */
const PROJECTILE_HIT_RADIUS = 0.45;
/** What a point weapon adds for landing all of itself in one place, and the shove that comes with it. */
const STRIKE_DAMAGE_SCALE = 1.6;
const STRIKE_KNOCKBACK = 6;
const EXIT_RADIUS = 0.55;
/** The slowest a throw is allowed to get, however heavy it is. See where drag is applied. */
const MIN_FLIGHT_SPEED = 4.5;
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
    detonate(world, projectile.x, projectile.y, (cell, damage) => damageWall(world, cell, damage, true));
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

function stepProjectiles(world: World, deltaSeconds: number): void {
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

function stepHazards(world: World, deltaSeconds: number): void {
  for (const hazard of world.hazards.slice()) {
    const distance = hazard.speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));
    let finished = false;

    // A shell is airborne and matters only where it lands. The checks below would stop it in the
    // first wall between the emplacement and its mark, which is what an arc exists to clear.
    if (hazard.kind === "shell") {
      hazard.x += hazard.directionX * distance;
      hazard.y += hazard.directionY * distance;
      hazard.travelled += distance;

      if (hazard.travelled >= hazard.range) {
        shellImpact(world, hazard.x, hazard.y, hazard.damage, hazard.blastRadius, hurtPlayer, (cell, damage) =>
          damageWall(world, cell, damage, true),
        );
        world.hazards.splice(world.hazards.indexOf(hazard), 1);
      }

      continue;
    }

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      hazard.x += hazard.directionX * advance;
      hazard.y += hazard.directionY * advance;
      hazard.travelled += advance;

      // Enemy fire stops at a barricade without wearing it down, so shooters cannot clear the floor's
      // hazards for the player.
      if (blocksProjectile(world.maze, Math.floor(hazard.x), Math.floor(hazard.y))) {
        finished = true;
        break;
      }

      if (Math.hypot(world.player.x - hazard.x, world.player.y - hazard.y) <= 0.42) {
        hurtPlayer(world, hazard.damage, hazard.x, hazard.y);
        // Along the line of travel, not away from where it stopped. A bolt carries none of this.
        world.player.pushX += hazard.directionX * hazard.knockback;
        world.player.pushY += hazard.directionY * hazard.knockback;
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

/** How many past positions a projectile keeps for its trail. */
const TRAIL_LENGTH = 9;

function recordTrail(projectile: Projectile): void {
  projectile.trail.push({ x: projectile.x, y: projectile.y, z: projectileHeight(projectile) });

  if (projectile.trail.length > TRAIL_LENGTH) {
    projectile.trail.shift();
  }
}

function stepVfx(world: World, deltaSeconds: number): void {
  for (const effect of world.vfx.slice()) {
    effect.age += deltaSeconds;

    if (effect.age >= effect.life) {
      world.vfx.splice(world.vfx.indexOf(effect), 1);
    }
  }
}

/**
 * How high a shell rises, stated as the height it reaches rather than as a launch slope, because
 * `flightHeight`'s launch term is not the peak. The launch term is solved for it below, and the floor
 * makes wall clearance a guarantee at every range. The ceiling is held by the frame: a shell at the
 * top of its curve is about half its range away, so a steeper one leaves the top of the screen.
 */
const SHELL_PEAK_PER_CELL = 0.24;
const SHELL_MIN_PEAK = DEMO_WALL_HEIGHT * 1.9;
const SHELL_MAX_PEAK = DEMO_WALL_HEIGHT * 3.4;

/**
 * How long a shell hangs in the air per cell of range, with bounds for short and long shots. The hang
 * is what the mark on the floor is for: there has to be time to look down and walk out of the circle.
 */
const SHELL_SECONDS_PER_CELL = 0.31;
const SHELL_MIN_FLIGHT_SECONDS = 1.6;
const SHELL_MAX_FLIGHT_SECONDS = 3.2;

/**
 * The launch term that puts the shared flight curve's peak at this height. The curve is
 * `0.5 + arc * s - (arc + 0.5) * s²`, whose maximum is `0.5 + arc² / (2 * (2 * arc + 1))`; setting
 * that equal to the wanted peak and solving for `arc` gives the quadratic below.
 */
function shellArc(peak: number): number {
  const rise = Math.max(0.0001, peak - 0.5);
  return 2 * rise + Math.sqrt(4 * rise * rise + 2 * rise);
}

/**
 * Picks what an emplacement shells next, from everything far enough away. The player is one candidate
 * among the enemies with no weighting, so it spends most of its time thinning them.
 */
function pickMortarTarget(world: World, centreX: number, centreY: number): Cell | undefined {
  const candidates: Cell[] = [];

  if (Math.hypot(world.player.x - centreX, world.player.y - centreY) > MORTAR_DEAD_ZONE) {
    candidates.push({ x: world.player.x, y: world.player.y });
  }

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0 || Math.hypot(enemy.x - centreX, enemy.y - centreY) <= MORTAR_DEAD_ZONE) {
      continue;
    }

    candidates.push({ x: enemy.x, y: enemy.y });
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function fireShell(world: World, mortar: Mortar, centreX: number, centreY: number): void {
  const dx = mortar.aimX - centreX;
  const dy = mortar.aimY - centreY;
  const range = Math.max(0.0001, Math.hypot(dx, dy));
  const peak = Math.min(SHELL_MAX_PEAK, Math.max(SHELL_MIN_PEAK, SHELL_PEAK_PER_CELL * range));
  const arc = shellArc(peak);
  const seconds = Math.min(
    SHELL_MAX_FLIGHT_SECONDS,
    Math.max(SHELL_MIN_FLIGHT_SECONDS, SHELL_SECONDS_PER_CELL * range),
  );
  world.hazards.push({
    id: nextId(world, "shell"),
    kind: "shell",
    x: centreX,
    y: centreY,
    directionX: dx / range,
    directionY: dy / range,
    // Ground speed derived from the hang, so a short shot is a slow high one rather than a quick flat one.
    speed: range / seconds,
    travelled: 0,
    range,
    damage: SHELL_DAMAGE,
    // A shell knocks the player about through its blast, not by arriving somewhere.
    knockback: 0,
    // Brings the curve back to the floor where the range runs out, which is where the circle is painted.
    arc,
    fall: arc + 0.5,
    plunge: 1,
    blastRadius: SHELL_BLAST_RADIUS,
  });
}

/**
 * Runs every emplacement's cycle: hold a mark, fire, wait, pick again. The tiles decide which exist,
 * so an entry whose cell was broken open leaves; a shell already in the air completes regardless.
 */
function stepMortars(world: World, deltaSeconds: number): void {
  for (const mortar of world.mortars.slice()) {
    if (tileAt(world.maze, mortar.cellX, mortar.cellY)?.kind !== "mortar") {
      world.mortars.splice(world.mortars.indexOf(mortar), 1);
      continue;
    }

    if (world.status !== "playing") {
      continue;
    }

    mortar.seconds -= deltaSeconds;

    if (mortar.seconds > 0) {
      continue;
    }

    const centreX = mortar.cellX + 0.5;
    const centreY = mortar.cellY + 0.5;

    if (mortar.phase === "locked") {
      fireShell(world, mortar, centreX, centreY);
      mortar.phase = "idle";
      mortar.seconds = MORTAR_IDLE_SECONDS;
      continue;
    }

    const target = pickMortarTarget(world, centreX, centreY);

    if (!target) {
      // Nothing in range: stay idle and ask again next tick rather than locking onto nowhere.
      mortar.seconds = 0;
      continue;
    }

    mortar.phase = "locked";
    mortar.seconds = MORTAR_LOCK_SECONDS;
    mortar.aimX = target.x;
    mortar.aimY = target.y;
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
