/**
 * Enemy behaviour.
 *
 * The shared spine is unchanged: beyond a few cells an enemy navigates the grid toward the player's
 * cell, and inside that it drops the path and runs straight at them. What each archetype adds is a
 * committed attack with a visible wind-up — a window where it has stopped, is telling you what it
 * is about to do, and cannot change its mind. Everything that makes these fights readable lives in
 * that window.
 */

import { damageWall } from "@/demo/actions";
import {
  CHARGE_DAMAGE,
  CHARGE_DISTANCE,
  CHARGE_KNOCKBACK,
  CHARGE_SPEED,
  CHARGE_TRIGGER_DISTANCE,
  CHARGE_WALL_DAMAGE,
  CHARGE_WALL_STUN,
  RANGED_SHOT_DAMAGE,
  RANGED_SHOT_RANGE,
  RANGED_SHOT_SPEED,
  RANGED_STANDOFF,
} from "@/demo/enemy-archetypes";
import { hasBless } from "@/demo/bless";
import { checkHazards } from "@/demo/impacts";
import { breadthFirstStep } from "@/demo/maze";
import { burst } from "@/demo/particles";
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

/** Radians wrapped to (-π, π], which is the only form a shortest turn can be measured in. */
function shortestTurn(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Swings a body's facing toward where it wants to go, and answers how much of its pace it keeps.
 *
 * The cosine is what makes this turn-then-move rather than turn-while-moving: a body already pointed
 * the right way keeps all of its speed, one facing across its heading keeps almost none, and one
 * facing backwards pivots on the spot until it is pointed at something. That is the whole mechanism
 * that stops a steered body from ever travelling sideways.
 */
function steerToward(enemy: DemoEnemy, desiredAngle: number, turnRate: number, deltaSeconds: number): number {
  const error = shortestTurn(desiredAngle - enemy.facingAngle);
  const step = turnRate * deltaSeconds;
  enemy.facingAngle = shortestTurn(enemy.facingAngle + Math.max(-step, Math.min(step, error)));
  return Math.max(0, Math.cos(shortestTurn(desiredAngle - enemy.facingAngle)));
}

/**
 * One step of walking, and the seam where a body with a front differs from one without.
 *
 * A slime is a point that moves in whatever direction the sum of pathing and crowd pressure gives it,
 * which is free because nothing about a blob says which way it is pointed. An eight-way sprite is not
 * free: its walk cycle only depicts travel along its own nose, so the moment the simulation moves it
 * in a direction its facing does not agree with, the picture and the position disagree and it reads
 * as a crab scuttling. Wall sliding, crowd separation and a re-path all produce exactly that.
 *
 * So an archetype that declares a `turnRate` does not get to move freely. It turns toward where it
 * wants to go at a bounded rate and travels along its facing, which is the same constraint a thing
 * with legs has. Everything else keeps the old behaviour.
 */
function walk(
  world: DemoWorld,
  enemy: DemoEnemy,
  headingX: number,
  headingY: number,
  speed: number,
  deltaSeconds: number,
): void {
  const avoid = separate(world, enemy);
  let moveX = headingX * speed + avoid.x * 1.4;
  let moveY = headingY * speed + avoid.y * 1.4;
  const pace = Math.hypot(moveX, moveY);
  // Wanting to advance is what the walk cycle depicts, not succeeding at it. A body shoved into a
  // wall keeps walking on the spot, which is what a body does; one standing still does not.
  enemy.moving = pace > 0.0001;

  if (enemy.moving) {
    const desired = Math.atan2(moveY, moveX);
    const turnRate = enemy.archetype.turnRate;

    if (turnRate === undefined) {
      enemy.facingAngle = desired;
    } else {
      const advance = steerToward(enemy, desired, turnRate, deltaSeconds);
      moveX = Math.cos(enemy.facingAngle) * pace * advance;
      moveY = Math.sin(enemy.facingAngle) * pace * advance;
    }
  }

  const moved = slideMove(
    world.maze,
    { x: enemy.x, y: enemy.y },
    moveX * deltaSeconds,
    moveY * deltaSeconds,
    ENEMY_RADIUS,
    WALKING,
  );
  enemy.x = moved.x;
  enemy.y = moved.y;
}

/**
 * Commits an enemy to an attack, and to the spot it is aimed at.
 *
 * The aim is taken here and nowhere else. Both attacks used to derive their direction at the moment
 * they resolved, from wherever the player was standing by then, which made them perfectly homing and
 * made every marker drawn during the wind-up a description of the present rather than of what was
 * about to happen. Recording the point up front is what turns the telegraph into a promise: the shot
 * goes where the line was drawn, the charge runs the lane it painted, and stepping aside works.
 *
 * A point rather than a direction, because the drawn warnings need the place — the lane strip and the
 * landing circle are both statements about a spot on the floor — and keeping two representations of
 * one lock is how they come apart.
 */
function beginWindup(world: DemoWorld, enemy: DemoEnemy, intent: DemoEnemy["intent"]): void {
  enemy.intent = intent;
  enemy.windupSeconds = enemy.archetype.windup;
  enemy.windupTotal = enemy.archetype.windup;
  enemy.attackPoseSeconds = enemy.archetype.windup + 0.2;
  enemy.aimX = world.player.x;
  enemy.aimY = world.player.y;
}

function fireShot(world: DemoWorld, enemy: DemoEnemy): void {
  const dx = enemy.aimX - enemy.x;
  const dy = enemy.aimY - enemy.y;
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

/**
 * Sends a charge down the lane it committed to.
 *
 * The locked point only sets the direction. Distance stays the charger's own, so a charge aimed at
 * something two cells away still runs its full length past it — which is what leaves the charger
 * beyond the player, facing the wrong way, when it misses.
 */
function launchCharge(enemy: DemoEnemy): void {
  const dx = enemy.aimX - enemy.x;
  const dy = enemy.aimY - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  enemy.chargeX = dx / length;
  enemy.chargeY = dy / length;
  enemy.chargeSeconds = CHARGE_DISTANCE / CHARGE_SPEED;
  enemy.attackCooldown = enemy.archetype.attackCooldown;
}

/**
 * Embers off a charger while it winds itself up, at a rate that climbs as it nears launch.
 *
 * Three seconds is a long time to stand still, and a body that only crouches for it reads as one that
 * has lost interest. The embers are what say it is stoking rather than stalling — and they carry to
 * the edge of the screen, so a charge being prepared behind you is something you can notice.
 *
 * Rate-gated rather than burst every frame: at sixty frames a second a per-frame burst would bury the
 * particle field under one enemy.
 */
function stokeCharge(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
  if (enemy.intent !== "charge") {
    return;
  }

  const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);

  if (Math.random() > (4 + progress * 26) * deltaSeconds) {
    return;
  }

  burst(world.particles, "ember", enemy.x, enemy.y, 0.3, 1 + Math.round(progress * 2), {
    speed: 0.7 + progress * 1.4,
    spreadZ: 1.6 + progress * 1.8,
    gravity: -1.4,
    drag: 1.6,
    size: 0.045,
    life: 0.55,
  });
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
    // Whatever it just failed to get through, at full speed. The cell is probed a body's width along
    // the lane rather than under the charger, because a stalled body is stopped just short of what
    // stopped it. Spending the wall before the stun matters: a charge that breaks through should
    // leave the charger lying in the opening, not against masonry that is no longer there.
    const cell = {
      x: Math.floor(enemy.x + enemy.chargeX * (ENEMY_RADIUS + 0.3)),
      y: Math.floor(enemy.y + enemy.chargeY * (ENEMY_RADIUS + 0.3)),
    };
    damageWall(world, cell, CHARGE_WALL_DAMAGE);
    burst(world.particles, "dust", enemy.x, enemy.y, 0.4, 10, {
      speed: 2.6,
      spreadZ: 1.6,
      directionX: enemy.chargeX,
      directionY: enemy.chargeY,
      focus: 0.5,
      gravity: 2.4,
      drag: 2.2,
      size: 0.14,
      life: 0.7,
    });
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
        cause: "slain",
        directionX: 0,
        directionY: 0,
        archetypeId: hostage.archetype.id,
        facingAngle: hostage.facingAngle,
      });
      world.kills += 1;
      announce(
        world,
        `The hostage burst — left holding ${salvage === "stick" ? "a stake" : salvage === "rock" ? "a rock" : "a bomb"}`,
      );
    }

    return;
  }

  // The only place the player loses points, which is why one gate is the whole cheat. Everything
  // above this line has already happened: the hit reads exactly as it would without it.
  if (world.godMode) {
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
    enemy.moving = false;
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
      stokeCharge(world, enemy, deltaSeconds);
      const turnRate = enemy.archetype.turnRate;

      if (turnRate !== undefined) {
        // Committed to the attack, but not blind through it. A body with a front keeps tracking the
        // player at the same bounded rate it walks at, so the swing lands from a pose that is looking
        // at what it hits. It cannot spin, which is what leaves stepping around it as an answer.
        steerToward(enemy, Math.atan2(world.player.y - enemy.y, world.player.x - enemy.x), turnRate, deltaSeconds);
      }

      enemy.windupSeconds -= deltaSeconds;

      if (enemy.windupSeconds <= 0) {
        const intent = enemy.intent;

        if (intent === "shoot") {
          fireShot(world, enemy);
          enemy.intent = "none";
          continue;
        }

        if (intent === "charge") {
          launchCharge(enemy);
          continue;
        }

        if (intent === "melee") {
          const distance = Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y);

          if (distance <= enemy.archetype.contactRange + 0.16) {
            hurtPlayer(world, enemy.archetype.contactDamage, enemy.x, enemy.y);
          }

          enemy.attackCooldown = enemy.archetype.attackCooldown;
          enemy.intent = "none";
          continue;
        }

        if (intent === "none") {
          continue;
        }

        intent satisfies never;
        throw new Error("unknown enemy intent");
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
      beginWindup(world, enemy, "charge");
      continue;
    }

    stepMelee(world, enemy, distance, deltaSeconds);
  }
}

function stepMelee(world: DemoWorld, enemy: DemoEnemy, distance: number, deltaSeconds: number): void {
  if (distance <= enemy.archetype.contactRange) {
    if (enemy.attackCooldown <= 0) {
      if (enemy.archetype.meleeWindup) {
        beginWindup(world, enemy, "melee");
        return;
      }

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
    beginWindup(world, enemy, "shoot");
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
