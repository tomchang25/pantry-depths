/**
 * One tick of the demo world: player, enemies, projectiles, hazards, timers, and the floor change.
 *
 * Fixed-order and mutating. There is no rollback and no determinism guarantee — the demo is played,
 * not replayed.
 */

import { MELEE_CUT_START } from "@/content/viewmodel/melee-viewmodel";
import {
  damageWall,
  heldWeight,
  playerSpeed,
  resolveSwing,
  thrownImpactDamage,
  thrownWallDamage,
} from "@/demo/actions";
import { hurtPlayer, stepEnemies } from "@/demo/enemy-ai";
import { stepExtraction } from "@/demo/extraction";
import {
  bargeInto,
  bodyLanding,
  checkHazards,
  detonate,
  knockBack,
  rockImpact,
  shellImpact,
  stepDrowning,
} from "@/demo/impacts";
import { blocksProjectile, blocksProjectileAt, generateDemoMaze, isBarricadeCell, tileAt } from "@/demo/maze";
import { FLUNG, slideMove, unstick, WALKING } from "@/demo/movement";
import { stepParticles } from "@/demo/particles";
import { stepRooms } from "@/demo/rooms";
import { LEVEL_CARD_PREFIX, runLevel } from "@/demo/run-level";
import { stepTasks } from "@/demo/tasks";
import {
  breaksThroughWalls,
  propBehaviour,
  throwCapacity,
  type DemoPropFlightHit,
  type DemoPropLanding,
} from "@/demo/throw-weight";
import {
  announce,
  bodyFootprint,
  damageEnemy,
  dropProp,
  killEnemy,
  MAX_ENEMIES,
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
  SPAWN_INTERVAL_SECONDS,
  spawnReinforcement,
  stainFloor,
  type DemoCellLike,
  type DemoEnemy,
  type DemoMortar,
  type DemoProjectile,
  type DemoWorld,
} from "@/demo/world";

export type DemoInput = Readonly<{
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
}>;

/** How long a corpse animation runs. Exported so a workbench replays a death at its real length. */
export const DEATH_SECONDS = 0.75;
/**
 * A thrown object's own reach. The target's footprint is added to it, so a large body is a large
 * thing to hit and a small one has to be aimed at.
 */
const PROJECTILE_HIT_RADIUS = 0.45;
/** What a point weapon adds for landing all of itself in one place, and the shove that comes with it. */
const STRIKE_DAMAGE_SCALE = 1.6;
const STRIKE_KNOCKBACK = 6;
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

/**
 * The slowest a crowd may leave the player, however many of them there are.
 *
 * Well above a standstill on purpose. A body in the way is meant to cost time, never control: a
 * player who decides to walk through five slimes gets to, and pays for it.
 */
const MIN_CROWD_PACE = 0.35;

/**
 * What wading through bodies costs the player, as a fraction of their pace.
 *
 * This is the slime's whole job, and it is a slowdown rather than a shove. Shoving produced a force
 * pulling against the player's own input every frame, and two forces arguing at sixty frames a
 * second is a body twitching in place — not a crowd being in the way. A slowdown fights nothing:
 * the player goes exactly where they pointed, it just takes the time it should take.
 *
 * It only bites while the player is genuinely inside the drawn body, and a slime holds station short
 * of that on its own, so standing among a crowd is free. Pushing into one is not, and the deeper in
 * they are the more it costs — which is what makes threading a gap different from barging a line.
 */
function crowdPace(world: DemoWorld): number {
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
    // decision rather than a free upgrade to the next throw. Wading through a crowd costs pace the
    // same way, and the two multiply: an armful of slime carried through a room of them is slow
    // twice over, which is exactly what it should feel like.
    const carried = heldWeight(world.held)?.carrySlow ?? 1;
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
 * A point weapon arriving: one body takes all of it.
 *
 * The area impact a rock makes is wrong for a blade or a bone — a thrown sword that shoves everything
 * within a cell and a bit of where it landed reads as a grenade. So this finds the one body the flight
 * actually stopped on, hits it harder than a glancing throw for the concentration, and shoves it
 * along the line the throw was travelling rather than away from a point it is standing on top of.
 */
function strikeWithProp(world: DemoWorld, projectile: DemoProjectile): void {
  let struck: DemoEnemy | undefined;
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
function resolveLanding(world: DemoWorld, projectile: DemoProjectile, landing: DemoPropLanding): void {
  // Nothing happens where it stops, because everything it does it did on the way: the blades spend
  // themselves through the bodies they cut. Whether the weapon itself survives is `leaves`, not this.
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
    detonate(world, projectile.x, projectile.y, (cell, damage) => damageWall(world, cell, damage));
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
 * Resolves where a throw stopped: what it did there, and whether it still exists afterwards.
 *
 * A thrown body is the one throw with no prop row, because what happens to it is decided by whose
 * body it is and what it landed on. Everything else reads its row.
 */
function finishProjectile(world: DemoWorld, projectile: DemoProjectile, hitWall: boolean): void {
  if (projectile.kind === "enemy") {
    landThrownEnemy(world, projectile, hitWall);
    return;
  }

  const behaviour = propBehaviour(projectile.kind);
  resolveLanding(world, projectile, behaviour.landing);

  if (behaviour.leaves) {
    dropProp(world, behaviour.leaves, projectile.x, projectile.y);
  }
}

/**
 * The javelin running someone through.
 *
 * Nobody dies here. The body is lifted out of the world and carried on the shaft, and the kill is
 * resolved against whatever the javelin finally buries itself in — which is the point of the weapon:
 * the wall is what does it, not the throw.
 */
function skewerWithJavelin(world: DemoWorld, projectile: DemoProjectile): void {
  if (projectile.skewered.length >= throwCapacity(projectile.kind)) {
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

    if (
      Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) >
      PROJECTILE_HIT_RADIUS + bodyFootprint(enemy.archetype)
    ) {
      continue;
    }

    projectile.struck.add(enemy.id);
    world.enemies.splice(world.enemies.indexOf(enemy), 1);
    projectile.skewered.push(enemy);
    announce(world, "Skewered!", 1.2);

    if (projectile.skewered.length >= throwCapacity(projectile.kind)) {
      return;
    }
  }
}

/**
 * Cutting through bodies: outright kills whatever it touches, whatever that body had left.
 *
 * A blade stops on the third one. A reaping throw stops on none of them — it announces each and
 * carries on, because what it is spending is the masonry behind them.
 */
function cleaveThrough(world: DemoWorld, projectile: DemoProjectile, stopsWhenFull: boolean): boolean {
  // Same head-height rule as everything else in flight: too high, and it passes clean over.
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

    if (stopsWhenFull && projectile.cleaved >= throwCapacity(projectile.kind)) {
      return true;
    }
  }

  return false;
}

/**
 * Nails what the javelin was carrying to whatever stopped it, and leaves it there dead.
 *
 * It goes in where the shaft did. The body used to be a corpse slumped around the shaft, which was
 * the best a standing body could do — and a body driven into masonry at that speed is not standing.
 * What is left of it is a mark on the wall; the scene puts that onto the plane itself.
 */
function pinToWall(world: DemoWorld, projectile: DemoProjectile): void {
  for (const enemy of projectile.skewered) {
    enemy.x = projectile.x;
    enemy.y = projectile.y;
    world.enemies.push(enemy);
    killEnemy(world, enemy, "splattered", { x: projectile.directionX, y: projectile.directionY });
    announce(world, "Pinned to the wall!");
  }
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
function hitsSomeone(world: DemoWorld, projectile: DemoProjectile): boolean {
  // A lob sailing over someone's head is not a hit: the display arc is fake height, but letting a
  // high bomb detonate on a scalp it visibly cleared reads as a bug, so the arc gates the test.
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
 * What a prop does to a body it reaches while still in the air, and whether that ends the flight.
 *
 * The piercing throws are the reason this is not simply a hit test: a javelin collects bodies and
 * carries them on, a blade kills through them until it is full, and the hammer never fills up at all,
 * so all three keep flying after they have done something. Everything else stops on the first thing
 * it touches.
 */
function stoppedInFlight(world: DemoWorld, projectile: DemoProjectile, flightHit: DemoPropFlightHit): boolean {
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
 * Whether this cell is masonry a breaking throw opens and carries on through.
 *
 * Stone and timber only. A barricade, an emplacement, and the outer boundary are all things a throw
 * ends against, and each of them already answers a blow in its own way — the boundary by refusing it
 * out loud.
 */
function spendsWall(world: DemoWorld, cell: DemoCellLike): boolean {
  const tile = tileAt(world.maze, cell.x, cell.y);
  return tile?.kind === "stone" || tile?.kind === "wood";
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
    const breaksThrough = breaksThroughWalls(projectile.kind);

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      projectile.x += projectile.directionX * advance;
      projectile.y += projectile.directionY * advance;
      projectile.travelled += advance;

      // A throw that stops where it touches down. Every other weapon flattens against the floor and
      // carries on to the end of its range, because the height curve is clamped there and produces
      // no event at all; this is the crossing that clamp hides, and only a weapon aimed downward as
      // a deliberate act consults it.
      if (breaksThrough && projectileGrounded(projectile)) {
        finished = true;
        break;
      }

      // Height-aware: the arc is simulation truth, so a lob sailing above a wall's top crosses it
      // and comes down on the far side. Flat weapons fly at hand height and stop as they always did.
      if (
        blocksProjectileAt(world.maze, Math.floor(projectile.x), Math.floor(projectile.y), projectileHeight(projectile))
      ) {
        const cell = { x: Math.floor(projectile.x), y: Math.floor(projectile.y) };

        // Masonry a reaping throw spends rather than stops against. The wall is opened where it
        // stands and the flight goes straight on through the hole, so a corridor costs three walls
        // and one throw. Anything that is not ordinary masonry takes the whole budget: it is
        // damaged for whatever it is worth, and the throw ends there.
        if (breaksThrough && spendsWall(world, cell)) {
          damageWall(world, cell, thrownWallDamage(projectile.kind));
          projectile.broke += 1;

          if (projectile.broke < throwCapacity(projectile.kind)) {
            continue;
          }

          finished = true;
          break;
        }

        struckCell = cell;
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

      if (projectile.kind === "enemy") {
        bargeThrough(world, projectile);
      } else if (stoppedInFlight(world, projectile, propBehaviour(projectile.kind).flightHit)) {
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

    // A shell is genuinely in the air: it clears the walls it passes over and the heads it passes
    // above, and concerns nobody at all until it comes down. Running it through the checks below
    // would stop it in the first wall between the emplacement and its mark, which is the one thing
    // an arcing shot is for getting past.
    if (hazard.kind === "shell") {
      hazard.x += hazard.directionX * distance;
      hazard.y += hazard.directionY * distance;
      hazard.travelled += distance;

      if (hazard.travelled >= hazard.range) {
        shellImpact(world, hazard.x, hazard.y, hazard.damage, hazard.blastRadius, hurtPlayer);
        world.hazards.splice(world.hazards.indexOf(hazard), 1);
      }

      continue;
    }

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
        // Along the line the shot was travelling, not away from where it happened to stop. A heavy
        // shaft moves the player off the ground they were holding; a bolt carries none of this.
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

/** How high a shell rises, per cell of range, and how fast it travels. */
const SHELL_ARC_PER_CELL = 0.34;
const SHELL_SPEED = 6;

/**
 * Picks what an emplacement shells next, from everything on the floor that is far enough away.
 *
 * The player is one candidate among the enemies with no weighting of any kind, which is the whole
 * character of the thing: with most of a floor's population being enemies, it spends the bulk of its
 * time thinning them, and being shelled yourself is the uncommon case. It is a hazard to fight beside
 * rather than another thing hunting you.
 */
function pickMortarTarget(world: DemoWorld, centreX: number, centreY: number): DemoCellLike | undefined {
  const candidates: DemoCellLike[] = [];

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

function fireShell(world: DemoWorld, mortar: DemoMortar, centreX: number, centreY: number): void {
  const dx = mortar.aimX - centreX;
  const dy = mortar.aimY - centreY;
  const range = Math.max(0.0001, Math.hypot(dx, dy));
  const arc = SHELL_ARC_PER_CELL * range;
  world.hazards.push({
    id: nextId(world, "shell"),
    kind: "shell",
    x: centreX,
    y: centreY,
    directionX: dx / range,
    directionY: dy / range,
    speed: SHELL_SPEED,
    travelled: 0,
    range,
    damage: SHELL_DAMAGE,
    // A shell knocks the player about through its blast, not by arriving somewhere.
    knockback: 0,
    // The fall that brings the curve back to the floor exactly where the range runs out, which is
    // exactly where the circle has been painted for the last five seconds.
    arc,
    fall: arc + 0.5,
    plunge: 1,
    blastRadius: SHELL_BLAST_RADIUS,
  });
}

/**
 * Runs every emplacement's cycle: hold a mark, fire, stand a moment, pick again.
 *
 * The tiles decide which emplacements exist, so an entry whose cell has been broken open simply
 * leaves. A shell already in the air is not its emplacement's any more and completes regardless.
 */
function stepMortars(world: DemoWorld, deltaSeconds: number): void {
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

/** Ages the direction marks and drops the ones that have said what they had to say. */
function stepDamageMarks(world: DemoWorld, deltaSeconds: number): void {
  for (const mark of world.damageMarks.slice()) {
    mark.age += deltaSeconds;

    if (mark.age >= mark.life) {
      world.damageMarks.splice(world.damageMarks.indexOf(mark), 1);
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
 * Health, hands, and blessings all survive the descent — the floor is what is replaced.
 *
 * Arriving pays nothing. It used to pay a blessing, which made the cheapest run the one that touched
 * as little of each floor as possible; the floor's own tasks pay now, and the descent is only the way
 * out of a floor whose business is finished.
 */
export function descend(world: DemoWorld): void {
  world.depth += 1;
  // A swing in mid-air when the stairs are taken has nothing left to land on: the floor it was aimed
  // at no longer exists. Dropping it stops the blade arriving on the next floor and cleaving whatever
  // happened to spawn where the old target stood.
  world.swing = 0;
  world.swingResolved = true;
  world.swingTarget = undefined;
  world.maze = generateDemoMaze();
  populateFloor(world);
  announce(world, `Down to floor B${world.depth}`, 3);
}

/**
 * Says so when the floor gets harder, once per step of it.
 *
 * Deliberately not phrased as the player gaining anything. The number rises with the minutes spent
 * and the floors taken, and every one of them is a cost — a card reading "level up" would be telling
 * the player they had been rewarded for the one thing this loop charges them for. What rose is the
 * dungeon's appetite, so that is what the card says.
 */
function stepRunLevel(world: DemoWorld): void {
  const level = runLevel(world);

  if (level <= world.announcedLevel) {
    return;
  }

  world.announcedLevel = level;
  world.pendingCard = `${LEVEL_CARD_PREFIX}${level}`;
  announce(world, `The depths stir - threat ${level}`, 3);
}

export function stepDemoWorld(world: DemoWorld, input: DemoInput, deltaSeconds: number): void {
  const step = Math.min(deltaSeconds, 0.05);
  world.elapsedSeconds += step;
  world.swing = Math.max(0, world.swing - step);
  world.impact = Math.max(0, world.impact - step * 6);

  // The blade reaches the target partway through the animation, not on the press. Everything the
  // swing does to the world happens on this frame, which is the frame the arc is drawn on.
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

  stepRunLevel(world);
  stepPlayer(world, input, step);

  // The debug pause freezes thinking, movement, reinforcement, and the floor's artillery together.
  // The emplacements are terrain rather than enemies and could defensibly keep running, but a pause
  // held to look at something is not much use if a shell lands on you halfway through it.
  if (!world.enemiesPaused) {
    stepEnemies(world, step);
    stepMortars(world, step);
    world.spawnSeconds -= step;

    if (world.spawnSeconds <= 0) {
      world.spawnSeconds += SPAWN_INTERVAL_SECONDS;

      if (spawnReinforcement(world)) {
        announce(world, `Another one crawls out (${world.enemies.length}/${MAX_ENEMIES})`, 1.4);
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
