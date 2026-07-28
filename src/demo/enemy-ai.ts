/**
 * Enemy behaviour.
 *
 * The shared spine is unchanged: beyond a few cells an enemy navigates the grid toward the player's
 * cell, and inside that it drops the path and runs straight at them. What each archetype adds is a
 * committed attack with a visible wind-up — a window where it has stopped, is telling you what it
 * is about to do, and cannot change its mind. Everything that makes these fights readable lives in
 * that window.
 */

import {
  CHARGE_DAMAGE,
  CHARGE_DISTANCE,
  CHARGE_KNOCKBACK,
  CHARGE_SPEED,
  CHARGE_TRIGGER_DISTANCE,
  CHARGE_WALL_STUN,
  RANGED_SHOT_DAMAGE,
  RANGED_SHOT_RANGE,
  RANGED_SHOT_SPEED,
  RANGED_STANDOFF,
} from "@/demo/enemy-archetypes";
import { hasBless } from "@/demo/bless";
import { checkHazards } from "@/demo/impacts";
import { breadthFirstStep } from "@/demo/maze";
import { FLUNG, slideMove, unstick, WALKING } from "@/demo/movement";
import {
  announce,
  ENEMY_RADIUS,
  hasLineOfSight,
  nextId,
  randomAmmo,
  type DemoEnemy,
  type DemoWorld,
} from "@/demo/world";

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

  // Knocked bodies use the flung predicate, so a pool is somewhere they can end up.
  const moved = slideMove(
    world.maze,
    { x: enemy.x, y: enemy.y },
    enemy.pushX * deltaSeconds,
    enemy.pushY * deltaSeconds,
    ENEMY_RADIUS,
    FLUNG,
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

  checkHazards(world, enemy);
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

function pathHeading(world: DemoWorld, enemy: DemoEnemy): Readonly<{ x: number; y: number }> {
  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
  const goal = { x: Math.floor(world.player.x), y: Math.floor(world.player.y) };

  // The cooldown alone gates the search. Retrying on an empty waypoint as well meant a player
  // nothing could reach — sealed behind water or barricades — put every enemy into a full-map
  // search every frame, because a failed search is precisely the one that leaves no waypoint.
  // Consuming a waypoint zeroes the cooldown instead, so successful pathing stays as responsive
  // as it was.
  if (enemy.repathSeconds <= 0) {
    enemy.waypoint = breadthFirstStep(world.maze, cell, goal);
    enemy.repathSeconds = REPATH_SECONDS;
  }

  const waypoint = enemy.waypoint;

  if (!waypoint) {
    return { x: 0, y: 0 };
  }

  const toX = waypoint.x + 0.5 - enemy.x;
  const toY = waypoint.y + 0.5 - enemy.y;
  const length = Math.hypot(toX, toY);

  if (length < 0.12) {
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
    return { x: 0, y: 0 };
  }

  return { x: toX / length, y: toY / length };
}

function walk(
  world: DemoWorld,
  enemy: DemoEnemy,
  headingX: number,
  headingY: number,
  speed: number,
  deltaSeconds: number,
): void {
  const avoid = separate(world, enemy);
  const moved = slideMove(
    world.maze,
    { x: enemy.x, y: enemy.y },
    (headingX * speed + avoid.x * 1.4) * deltaSeconds,
    (headingY * speed + avoid.y * 1.4) * deltaSeconds,
    ENEMY_RADIUS,
    WALKING,
  );
  enemy.x = moved.x;
  enemy.y = moved.y;
}

function beginWindup(enemy: DemoEnemy, intent: DemoEnemy["intent"]): void {
  enemy.intent = intent;
  enemy.windupSeconds = enemy.archetype.windup;
  enemy.windupTotal = enemy.archetype.windup;
  enemy.attackPoseSeconds = enemy.archetype.windup + 0.2;
}

function fireShot(world: DemoWorld, enemy: DemoEnemy): void {
  const dx = world.player.x - enemy.x;
  const dy = world.player.y - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  world.hazards.push({
    id: nextId(world, "hazard"),
    x: enemy.x,
    y: enemy.y,
    directionX: dx / length,
    directionY: dy / length,
    speed: RANGED_SHOT_SPEED,
    travelled: 0,
    range: RANGED_SHOT_RANGE,
    damage: RANGED_SHOT_DAMAGE,
  });
  enemy.attackCooldown = enemy.archetype.attackCooldown;
}

function launchCharge(world: DemoWorld, enemy: DemoEnemy): void {
  const dx = world.player.x - enemy.x;
  const dy = world.player.y - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  enemy.chargeX = dx / length;
  enemy.chargeY = dy / length;
  enemy.chargeSeconds = CHARGE_DISTANCE / CHARGE_SPEED;
  enemy.attackCooldown = enemy.archetype.attackCooldown;
}

/** Runs a charge already in flight. Missing costs the charger the stun that makes it punishable. */
function stepCharge(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
  enemy.chargeSeconds -= deltaSeconds;
  const before = { x: enemy.x, y: enemy.y };
  const moved = slideMove(
    world.maze,
    before,
    enemy.chargeX * CHARGE_SPEED * deltaSeconds,
    enemy.chargeY * CHARGE_SPEED * deltaSeconds,
    ENEMY_RADIUS,
    FLUNG,
  );
  enemy.x = moved.x;
  enemy.y = moved.y;
  checkHazards(world, enemy);

  if (Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y) <= 0.95) {
    hurtPlayer(world, CHARGE_DAMAGE, enemy.x, enemy.y);
    // The shove is most of what a connected charge costs you: it puts you somewhere you did not
    // choose, which in a room with a pool in it is the actual threat.
    world.player.pushX += enemy.chargeX * CHARGE_KNOCKBACK;
    world.player.pushY += enemy.chargeY * CHARGE_KNOCKBACK;
    enemy.chargeSeconds = 0;
    enemy.intent = "none";
    return;
  }

  const stalled = Math.hypot(enemy.x - before.x, enemy.y - before.y) < CHARGE_SPEED * deltaSeconds * 0.5;

  if (stalled) {
    enemy.chargeSeconds = 0;
    enemy.intent = "none";
    enemy.stunSeconds = CHARGE_WALL_STUN;
    return;
  }

  if (enemy.chargeSeconds <= 0) {
    enemy.intent = "none";
  }
}

/**
 * Applies damage to the player, letting a held enemy eat a frontal hit when that blessing is held.
 *
 * Exported because the hazard step needs the same rule: a shot arriving from the front is exactly
 * the case the hostage is for.
 */
export function hurtPlayer(world: DemoWorld, amount: number, fromX?: number, fromY?: number): void {
  world.hitFlash = 1;
  const hostage = world.held?.kind === "enemy" ? world.held.enemy : undefined;
  const frontal =
    fromX === undefined || fromY === undefined
      ? true
      : (fromX - world.player.x) * Math.cos(world.player.angle) +
          (fromY - world.player.y) * Math.sin(world.player.angle) >
        0;

  if (hostage && frontal && hasBless(world.bless, "hostageGuard")) {
    hostage.hp -= amount;
    hostage.hurtSeconds = 0.3;

    if (hostage.hp <= 0) {
      const salvage = randomAmmo();
      world.held = { kind: "prop", prop: salvage, count: 1 };
      world.deaths.push({
        id: hostage.id,
        appearance: hostage.appearance,
        x: world.player.x,
        y: world.player.y,
        progress: 0,
      });
      world.kills += 1;
      announce(world, `人質碎了，手上變成${salvage === "stick" ? "木棍" : salvage === "rock" ? "石塊" : "炸彈"}`);
    }

    return;
  }

  world.player.hp -= amount;

  if (world.player.hp <= 0) {
    world.player.hp = 0;
    world.status = "dead";
  }
}

export function stepEnemies(world: DemoWorld, deltaSeconds: number): void {
  for (const enemy of world.enemies) {
    decayTimers(enemy, deltaSeconds);
    applyPush(world, enemy, deltaSeconds);

    if (enemy.drowningSeconds > 0) {
      continue;
    }

    const settled = unstick(world.maze, { x: enemy.x, y: enemy.y }, ENEMY_RADIUS, FLUNG);
    enemy.x = settled.x;
    enemy.y = settled.y;

    if (enemy.chargeSeconds > 0) {
      stepCharge(world, enemy, deltaSeconds);
      continue;
    }

    if (enemy.stunSeconds > 0 || world.status !== "playing") {
      continue;
    }

    if (enemy.windupSeconds > 0) {
      enemy.windupSeconds -= deltaSeconds;

      if (enemy.windupSeconds <= 0) {
        if (enemy.intent === "shoot") {
          fireShot(world, enemy);
          enemy.intent = "none";
        } else if (enemy.intent === "charge") {
          launchCharge(world, enemy);
        }
      }

      continue;
    }

    const distance = Math.max(0.0001, Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y));
    const sighted = hasLineOfSight(world.maze, enemy.x, enemy.y, world.player.x, world.player.y);

    if (enemy.archetype.id === "ranged") {
      stepRanged(world, enemy, distance, sighted, deltaSeconds);
      continue;
    }

    if (
      enemy.archetype.id === "charger" &&
      distance <= CHARGE_TRIGGER_DISTANCE &&
      sighted &&
      enemy.attackCooldown <= 0
    ) {
      beginWindup(enemy, "charge");
      continue;
    }

    stepMelee(world, enemy, distance, deltaSeconds);
  }
}

function stepMelee(world: DemoWorld, enemy: DemoEnemy, distance: number, deltaSeconds: number): void {
  if (distance <= enemy.archetype.contactRange) {
    if (enemy.attackCooldown <= 0) {
      enemy.attackCooldown = enemy.archetype.attackCooldown;
      enemy.attackPoseSeconds = 0.3;
      hurtPlayer(world, enemy.archetype.contactDamage, enemy.x, enemy.y);
    }

    return;
  }

  const close = distance <= enemy.archetype.rushDistance;
  const heading = close
    ? { x: (world.player.x - enemy.x) / distance, y: (world.player.y - enemy.y) / distance }
    : pathHeading(world, enemy);

  if (close) {
    // Dropping the waypoint alone would leave the rusher stalled for a whole cooldown when the
    // player breaks back out of rush range; zeroing it makes the next path request immediate.
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
  }

  walk(world, enemy, heading.x, heading.y, close ? enemy.archetype.rushSpeed : enemy.archetype.speed, deltaSeconds);
}

/** Holds a standoff band: backs away when crowded, closes when out of range, shoots when it can. */
function stepRanged(
  world: DemoWorld,
  enemy: DemoEnemy,
  distance: number,
  sighted: boolean,
  deltaSeconds: number,
): void {
  if (sighted && enemy.attackCooldown <= 0 && distance <= RANGED_STANDOFF.far) {
    beginWindup(enemy, "shoot");
    return;
  }

  if (distance <= enemy.archetype.contactRange && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = enemy.archetype.attackCooldown;
    hurtPlayer(world, enemy.archetype.contactDamage, enemy.x, enemy.y);
    return;
  }

  const towardX = (world.player.x - enemy.x) / distance;
  const towardY = (world.player.y - enemy.y) / distance;

  if (sighted && distance < RANGED_STANDOFF.near) {
    walk(world, enemy, -towardX, -towardY, enemy.archetype.speed, deltaSeconds);
    return;
  }

  if (sighted && distance <= RANGED_STANDOFF.far) {
    // In the band with a shot on cooldown: sidestep rather than stand still, so it is never a target
    // painted onto the floor.
    walk(world, enemy, -towardY, towardX, enemy.archetype.speed * 0.6, deltaSeconds);
    return;
  }

  const heading = pathHeading(world, enemy);
  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}
