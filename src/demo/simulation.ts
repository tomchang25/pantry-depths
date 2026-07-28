/**
 * One tick of the demo world: player, enemies, projectiles, hazards, timers, and the floor change.
 *
 * Fixed-order and mutating. There is no rollback and no determinism guarantee — the demo is played,
 * not replayed.
 */

import { AXE_CAPACITY, damageWall, heldWeight, JAVELIN_CAPACITY, thrownWallDamage } from "@/demo/actions";
import { hurtPlayer, stepEnemies } from "@/demo/enemy-ai";
import { bargeInto, bodyLanding, checkHazards, detonate, rockImpact, stepDrowning } from "@/demo/impacts";
import { blocksProjectile, blocksProjectileAt, generateDemoMaze, isBarricadeCell } from "@/demo/maze";
import { FLUNG, slideMove, unstick, WALKING } from "@/demo/movement";
import { stepParticles } from "@/demo/particles";
import {
  announce,
  awardBless,
  killEnemy,
  MAX_ENEMIES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  populateFloor,
  projectileHeight,
  SPAWN_INTERVAL_SECONDS,
  spawnReinforcement,
  stainFloor,
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
/** The slowest a throw is allowed to get, however heavy it is. See where drag is applied. */
const MIN_FLIGHT_SPEED = 4.5;
/**
 * How fast the weight jolt leaves the view, in units of `world.shake` per second.
 *
 * Fast on purpose: a jolt that fades over a fifth of a second is a thump, and one that lingers is a
 * wobble the player has to look through.
 */
const SHAKE_DECAY = 5;

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
    // Carrying something heavy costs pace. It is the one thing that makes picking a body up a
    // decision rather than a free upgrade to the next throw.
    const carried = heldWeight(world.held)?.carrySlow ?? 1;
    const step = (PLAYER_SPEED * carried * deltaSeconds) / length;
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
  // Where it came down gets first claim on it, before what the fall cost it.
  //
  // The other order killed bodies thrown into a pool with the landing damage, so a slime went into
  // the water and played the ordinary deflating-corpse death on the surface of it — the throw won a
  // race it should never have been in. Resolving the hazard first puts the body under, and a body on
  // its way down is immune to damage, so the fall silently does nothing to it. The spikes settle the
  // same way: whatever the cell does to a body arriving in it, it does first and it does all of it.
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

  // A shaft flying above head height runs nobody through on the way past.
  if (projectileHeight(projectile) > 0.6) {
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
    announce(world, `Skewered ${projectile.skewered.length}!`, 1.2);

    if (projectile.skewered.length >= JAVELIN_CAPACITY) {
      return;
    }
  }
}

/** The axe cleaving through: outright kills, and it is spent on the third one. */
function cleaveWithAxe(world: DemoWorld, projectile: DemoProjectile): boolean {
  // Same head-height rule as everything else in flight: too high, and it passes clean over.
  if (projectileHeight(projectile) > 0.6) {
    return false;
  }

  for (const enemy of world.enemies.slice()) {
    if (projectile.struck.has(enemy.id) || enemy.drowningSeconds > 0) {
      continue;
    }

    if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > PROJECTILE_HIT_RADIUS) {
      continue;
    }

    projectile.struck.add(enemy.id);
    projectile.cleaved += 1;
    killEnemy(world, enemy, "cleaved");
    announce(world, `Axe cleaves ${projectile.cleaved}!`, 1.2);

    if (projectile.cleaved >= AXE_CAPACITY) {
      return true;
    }
  }

  return false;
}

/** How far apart bodies are spread across the face they hit, so three marks are not one mark. */
const WALL_MARK_SPREAD = 0.24;

/**
 * Nails everything the javelin was carrying to whatever stopped it, and leaves them there dead.
 *
 * The bodies are spread sideways across the face rather than strung out back along the shaft. They
 * used to be a row of corpses slumped around it, which was the best a standing body could do — and a
 * body driven into masonry at that speed is not standing. What is left of each is a mark on the wall,
 * and three of those in a line into the wall would be three in the same place. The scene puts each
 * one onto the plane itself; what is decided here is only which part of the face it took.
 */
function pinToWall(world: DemoWorld, projectile: DemoProjectile): void {
  if (projectile.skewered.length === 0) {
    return;
  }

  projectile.skewered.forEach((enemy, index) => {
    // Alternating either side of where the shaft went in: the middle, then one across, then one back.
    const across = (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) * WALL_MARK_SPREAD;
    const markX = projectile.x - projectile.directionY * across;
    const markY = projectile.y + projectile.directionX * across;
    // A corner can put the spread into the wall beside it, where a mark would hang off nothing. The
    // middle of the face is always sound, so that is where a crowded one goes.
    const clear = !blocksProjectile(world.maze, Math.floor(markX), Math.floor(markY));
    enemy.x = clear ? markX : projectile.x;
    enemy.y = clear ? markY : projectile.y;
    world.enemies.push(enemy);
    killEnemy(world, enemy, "splattered", { x: projectile.directionX, y: projectile.directionY });
  });
  announce(world, `${projectile.skewered.length} pinned to the wall!`);
}

/**
 * A thrown body running down whoever it meets. Nobody stops it: each is hit once, then it carries
 * on to the end of its two tiles.
 */
function bargeThrough(world: DemoWorld, projectile: DemoProjectile): void {
  // A body lobbed high overhead runs nobody down on the way; it hits whatever it lands on.
  if (projectileHeight(projectile) > 0.6) {
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
    bargeInto(world, enemy, projectile.x, projectile.y, projectile.directionX, projectile.directionY, projectile.thud);
  }
}

/** Whether anything solid enough to stop a throw sits at the projectile's position. */
function hitsSomeone(world: DemoWorld, projectile: DemoProjectile): boolean {
  // A lob sailing over someone's head is not a hit: the display arc is fake height, but letting a
  // high bomb detonate on a scalp it visibly cleared reads as a bug, so the arc gates the test.
  if (projectileHeight(projectile) > 0.6) {
    return false;
  }

  return world.enemies.some(
    (enemy) =>
      enemy.drowningSeconds <= 0 && Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <= PROJECTILE_HIT_RADIUS,
  );
}

function stepProjectiles(world: DemoWorld, deltaSeconds: number): void {
  for (const projectile of world.projectiles.slice()) {
    recordTrail(projectile);
    const distance = projectile.speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));

    // Shed forward speed, floored so a heavy throw still arrives: a flight that decayed towards zero
    // would asymptote short of its range and never resolve.
    if (projectile.drag > 0) {
      projectile.speed = Math.max(MIN_FLIGHT_SPEED, projectile.speed * Math.exp(-projectile.drag * deltaSeconds));
    }

    let finished = false;
    let struckCell: DemoCellLike | undefined;
    let stoppedByWall = false;

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      projectile.x += projectile.directionX * advance;
      projectile.y += projectile.directionY * advance;
      projectile.travelled += advance;

      // Height-aware: the arc is simulation truth, so a lob sailing above a wall's top crosses it
      // and comes down on the far side. Flat weapons fly at hand height and stop as they always did.
      if (
        blocksProjectileAt(world.maze, Math.floor(projectile.x), Math.floor(projectile.y), projectileHeight(projectile))
      ) {
        struckCell = { x: Math.floor(projectile.x), y: Math.floor(projectile.y) };
        // A barricade is not a wall to a body. It is the thing bodies are meant to be shoved onto,
        // and stepping this one back out of the cell put it on the floor in front of the iron — so
        // a slime thrown at the spikes died of the fall, never touched them, and never once played
        // the death the hazard exists for. A thrown body is left standing in the cell instead, and
        // the landing finds the spikes it came down on.
        const spikes = projectile.kind === "enemy" && isBarricadeCell(world.maze, struckCell.x, struckCell.y);
        stoppedByWall = !spikes;

        if (stoppedByWall) {
          projectile.x -= projectile.directionX * advance;
          projectile.y -= projectile.directionY * advance;
        }

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

    // Only masonry counts as a wall here: what it decides is whether the landing is doubled and
    // whether the body ends as a mark on it, and the spikes answer both of those themselves.
    finishProjectile(world, projectile, stoppedByWall);
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

      // Enemy fire stops at a barricade but does not wear it down. Letting it would mean the
      // shooters clear the map's hazards for the player, for free, without being asked.
      if (blocksProjectile(world.maze, Math.floor(hazard.x), Math.floor(hazard.y))) {
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

/** How many past positions a projectile keeps for its trail. */
const TRAIL_LENGTH = 9;

function recordTrail(projectile: DemoProjectile): void {
  projectile.trail.push({ x: projectile.x, y: projectile.y, z: projectileHeight(projectile) });

  if (projectile.trail.length > TRAIL_LENGTH) {
    projectile.trail.shift();
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
  announce(world, `Down to floor B${world.depth}`, 3);
}

export function stepDemoWorld(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const step = Math.min(deltaSeconds, 0.05);
  world.elapsedSeconds += step;
  world.swing = Math.max(0, world.swing - step);
  world.impact = Math.max(0, world.impact - step * 6);
  world.shake = Math.max(0, world.shake - step * SHAKE_DECAY);
  world.hitFlash = Math.max(0, world.hitFlash - step * 2.4);
  world.messageSeconds = Math.max(0, world.messageSeconds - step);
  stepDeaths(world, step);
  stepVfx(world, step);

  // Blood marks the floor where it actually falls, so a spray scatters and a body pools.
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

  stepPlayer(world, input, step);

  // The debug pause freezes thinking, movement, and reinforcement together, so what remains on
  // screen while it is held is exactly the frame's non-enemy cost.
  if (!world.enemiesPaused) {
    stepEnemies(world, step);
    world.spawnSeconds -= step;

    if (world.spawnSeconds <= 0) {
      world.spawnSeconds += SPAWN_INTERVAL_SECONDS;

      if (spawnReinforcement(world)) {
        announce(world, `Another one crawls out (${world.enemies.length}/${MAX_ENEMIES})`, 1.4);
      }
    }
  }

  const toExit = Math.hypot(world.player.x - (world.maze.exit.x + 0.5), world.player.y - (world.maze.exit.y + 0.5));

  if (toExit < EXIT_RADIUS) {
    descend(world);
  }
}
