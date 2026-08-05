/**
 * Enemy behaviour, as one state machine with five states and nothing outside it deciding where an
 * enemy goes. Idle counts down; wander draws a reachable cell and walks the grid to it; chase closes
 * to the archetype's attack range and holds; attack is the committed half, during which the enemy
 * neither moves nor turns; retreat backs a crowded shooter out to its minimum.
 *
 * Two distances govern all five and are the same for every enemy: notice at `SIGHT_RANGE`, forget at
 * `DISENGAGE_RANGE`, both measured as straight lines through walls. Sight decides only how an enemy
 * closes — seen, it runs the straight line; unseen, it walks the grid route to the player's cell —
 * so cover buys time rather than concealment, and nothing grinds into a wall while beelining.
 *
 * A cooldown is not a state: an enemy between attacks is an ordinary chasing one that cannot start
 * another. Stun, hurt, drowning, and being carried are not states either; each interrupts and hands
 * back. An archetype with no attack reaches only three of the five.
 */

import { damageWall } from "@/core/damage/structure-damage";
import { DISENGAGE_RANGE, SIGHT_RANGE } from "@/core/combat/enemy-contract";
import { ENEMY_RADIUS, stunEnemy, type Enemy } from "@/core/enemy/enemy-state";
import { ENEMY_BEHAVIORS } from "@/core/enemy/behaviors/registry";
import type { EnemyEffect, EnemyView } from "@/core/enemy/behaviors/contract";
import { hurtPlayer } from "@/core/damage/player-damage";
import { checkHazards } from "@/core/damage/area";
import { breadthFirstStep, randomReachableCell } from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import { burst } from "@/core/combat/particles";

import { FLUNG, shortestTurn, slideMove, unstick, WALKING } from "@/core/floor/movement";
import { nextId } from "@/core/world/ids";
import { hasLineOfSight } from "@/core/floor/maze";
import { rollIdleSeconds, type World } from "@/core/world/world";

const REPATH_SECONDS = 0.4;
const SEPARATION = 0.62;

function decayTimers(enemy: Enemy, deltaSeconds: number): void {
  enemy.stunSeconds = Math.max(0, enemy.stunSeconds - deltaSeconds);
  enemy.hurtSeconds = Math.max(0, enemy.hurtSeconds - deltaSeconds);
  enemy.attackPoseSeconds = Math.max(0, enemy.attackPoseSeconds - deltaSeconds);
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaSeconds);
  enemy.repathSeconds = Math.max(0, enemy.repathSeconds - deltaSeconds);
}

function applyPush(world: World, enemy: Enemy, deltaSeconds: number): void {
  if (enemy.pushX === 0 && enemy.pushY === 0) {
    return;
  }

  // Knocked enemies use the flung predicate, so a pool is somewhere they can end up.
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

function separate(world: World, enemy: Enemy): Readonly<{ x: number; y: number }> {
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

/**
 * A step's worth of heading along the grid route to a cell, or nothing when there is no route. The
 * two zero answers differ: `undefined` means the search failed and will not retry until the cooldown
 * lapses, while a zero vector means the current waypoint has just been reached.
 */
function pathHeading(world: World, enemy: Enemy, goal: Cell): Readonly<{ x: number; y: number }> | undefined {
  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };

  // The cooldown alone gates the search. Retrying on an empty waypoint as well put every enemy into
  // a full-map search every frame when the player was unreachable, because a failed search is the
  // one that leaves no waypoint. Consuming a waypoint zeroes the cooldown instead.
  if (enemy.repathSeconds <= 0) {
    enemy.waypoint = breadthFirstStep(world.maze, cell, goal);
    enemy.repathSeconds = REPATH_SECONDS;
  }

  const waypoint = enemy.waypoint;

  if (!waypoint) {
    return undefined;
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

/**
 * Swings a facing toward where an enemy wants to go, returning how much of its pace it keeps. The
 * cosine makes this turn-then-move: one facing across its heading keeps almost none, and one facing
 * backwards pivots on the spot, so a steered enemy never travels sideways.
 */
function steerToward(enemy: Enemy, desiredAngle: number, turnRate: number, deltaSeconds: number): number {
  const error = shortestTurn(desiredAngle - enemy.facingAngle);
  const step = turnRate * deltaSeconds;
  enemy.facingAngle = shortestTurn(enemy.facingAngle + Math.max(-step, Math.min(step, error)));
  return Math.max(0, Math.cos(shortestTurn(desiredAngle - enemy.facingAngle)));
}

/**
 * One step of walking, and the seam between an archetype with a front and one without. An archetype
 * that declares a `turnRate` turns toward its heading at a bounded rate and travels along its facing,
 * because its walk cycle only depicts travel along its own nose; anything else moves freely.
 */
function walk(
  world: World,
  enemy: Enemy,
  headingX: number,
  headingY: number,
  speed: number,
  deltaSeconds: number,
): void {
  const avoid = separate(world, enemy);
  let moveX = headingX * speed + avoid.x * 1.4;
  let moveY = headingY * speed + avoid.y * 1.4;
  const pace = Math.hypot(moveX, moveY);
  // Wanting to advance is what the walk cycle depicts, not succeeding: one shoved into a wall keeps
  // walking on the spot.
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
 * What each named look actually is.
 *
 * The families ask for a preset and say where and how hard; the numbers behind it live here, so a
 * presentation tweak is not an edit to a decision module.
 */
function throwSparks(world: World, effect: Extract<EnemyEffect, { kind: "sparks" }>): void {
  const { intensity: heat, x, y, directionX, directionY } = effect;

  if (effect.preset === "bladeHone") {
    // Started out on the arc and aimed inward, so they close on the blade as it is raised.
    burst(world.particles, "ember", x, y, 0.62, 1, {
      speed: 1.4 + heat * 1.8,
      spreadZ: 0.5,
      gravity: -0.4,
      drag: 2.4,
      directionX,
      directionY,
      focus: 0.85,
      size: 0.04,
      life: 0.34,
    });
    return;
  }

  if (effect.preset === "bladeRelease") {
    burst(world.particles, "ember", x, y, 0.62, 12, {
      speed: 5.5,
      spreadZ: 0.7,
      gravity: 1.2,
      drag: 2.8,
      directionX,
      directionY,
      focus: 0.45,
      size: 0.05,
      life: 0.3,
    });
    return;
  }

  if (effect.preset === "chargeStoke") {
    burst(world.particles, "ember", x, y, 0.3, 1 + Math.round(heat * 2), {
      speed: 0.7 + heat * 1.4,
      spreadZ: 1.6 + heat * 1.8,
      gravity: -1.4,
      drag: 1.6,
      size: 0.045,
      life: 0.55,
    });
    return;
  }

  if (effect.preset === "chargeStall") {
    burst(world.particles, "dust", x, y, 0.4, 10, {
      speed: 2.6,
      spreadZ: 1.6,
      directionX,
      directionY,
      focus: 0.5,
      gravity: 2.4,
      drag: 2.2,
      size: 0.14,
      life: 0.7,
    });
    return;
  }

  effect.preset satisfies never;
  throw new Error("unknown spark preset");
}

/**
 * One pass over every enemy, in two halves the decision freeze cuts between. The head is what
 * happened to the enemy: timers, knockback, settling out of geometry. The tail is what it decided.
 * The freeze returns between the two rather than skipping the pass, which is what the world freeze
 * does instead — and why a struck enemy under that one stays lit.
 */
export function stepEnemies(world: World, deltaSeconds: number): void {
  const frozen = world.mindsFrozen;

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

    if (frozen) {
      continue;
    }

    if (enemy.chargeSeconds > 0) {
      applyEnemyEffects(world, enemy, ENEMY_BEHAVIORS.charge.liveStep(enemy, viewOf(world), deltaSeconds));
      continue;
    }

    if (enemy.stunSeconds > 0 || world.status !== "playing") {
      continue;
    }

    // The committed half. Neither branch reaches `walk`, which is what makes a telegraph a promise
    // about a piece of ground. The cooldown is deliberately not here: an enemy between attacks keeps
    // chasing, because standing still for it as well turns a fight into a room of statues.
    if (enemy.windupSeconds > 0) {
      stepWindup(world, enemy, deltaSeconds);
      continue;
    }

    if (enemy.attackPoseSeconds > 0) {
      continue;
    }

    const distance = Math.max(0.0001, Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y));
    const sighted = hasLineOfSight(world.maze, enemy.x, enemy.y, world.player.x, world.player.y);
    stepMind(world, enemy, distance, sighted, deltaSeconds);
  }
}

/** What one enemy can see of the world, handed to whichever family is answering. */
function viewOf(world: World): EnemyView {
  return { playerX: world.player.x, playerY: world.player.y, maze: world.maze };
}

/**
 * The chassis's half of the behaviour contract: what each effect a family returns actually does.
 *
 * One branch, applied in the order the family returned them, so the whole of what an attack can cause
 * is readable here rather than spread through the families that ask for it.
 */
function applyEnemyEffect(world: World, enemy: Enemy, effect: EnemyEffect): void {
  if (effect.kind === "playerHit") {
    hurtPlayer(world, effect.amount, effect.fromX, effect.fromY);
    return;
  }

  if (effect.kind === "playerShove") {
    world.player.pushX += effect.x;
    world.player.pushY += effect.y;
    return;
  }

  if (effect.kind === "spawnShot") {
    world.hazards.push({
      id: nextId(world, "hazard"),
      kind: "bolt",
      x: effect.x,
      y: effect.y,
      directionX: effect.directionX,
      directionY: effect.directionY,
      speed: effect.speed,
      travelled: 0,
      range: effect.range,
      damage: effect.damage,
      knockback: effect.knockback,
      // A shot flies flat and hits what it touches: no curve, no radius.
      arc: 0,
      fall: 0,
      plunge: 1,
      blastRadius: 0,
    });
    return;
  }

  if (effect.kind === "structureHit") {
    damageWall(world, effect.cell, effect.damage);
    return;
  }

  if (effect.kind === "hazardProbe") {
    checkHazards(world, enemy);
    return;
  }

  if (effect.kind === "stunSelf") {
    stunEnemy(enemy, effect.seconds);
    return;
  }

  if (effect.kind === "sparks") {
    throwSparks(world, effect);
    return;
  }

  effect satisfies never;
  throw new Error("unknown enemy effect");
}

function applyEnemyEffects(world: World, enemy: Enemy, effects: readonly EnemyEffect[]): void {
  for (const effect of effects) {
    applyEnemyEffect(world, enemy, effect);
  }
}

/**
 * Runs a wind-up already committed to, and resolves whatever it was committed to when it expires.
 *
 * No per-intent branch: the registry answers for every intent, so which family runs is a lookup. The
 * one intent handled here is the absence of one, which is not a family's business.
 */
function stepWindup(world: World, enemy: Enemy, deltaSeconds: number): void {
  if (enemy.intent === "none") {
    return;
  }

  const behavior = ENEMY_BEHAVIORS[enemy.intent];
  applyEnemyEffects(world, enemy, behavior.telegraphStep(enemy, viewOf(world), deltaSeconds));
  // An enemy winding up neither moves nor turns, so the arc drawn on the floor stays a claim about a
  // piece of ground rather than sweeping after whoever it was aimed at.
  enemy.windupSeconds -= deltaSeconds;

  if (enemy.windupSeconds > 0) {
    return;
  }

  // A shot has nothing left to run once it is away, so the chassis clears the commitment for it. A
  // charge keeps its own, because what it is committed to outlives the wind-up.
  const releasing = enemy.intent;
  applyEnemyEffects(world, enemy, behavior.release(enemy, viewOf(world)));

  if (releasing === "shoot") {
    enemy.intent = "none";
  }
}

/**
 * One frame of whatever this enemy is doing, and the only place its state changes. A transition sets
 * the field and returns rather than running the state it entered, so no state is entered from inside
 * another and no chain of states can loop.
 *
 * Chase and retreat are the exception, because they share a threshold and want opposite things at the
 * same distance: handing off through a dropped frame each way would visibly quarter a shooter's pace.
 * The hand-off terminates because each condition is the negation of the other.
 *
 * Attack is coerced rather than branched on. Reaching here means no wind-up, strike, or charge is
 * live, so an enemy still holding it has just finished or been stunned out of one; treating both as
 * chasing keeps a stunned charger from waking in a state nothing leaves.
 */
function stepMind(world: World, enemy: Enemy, distance: number, sighted: boolean, deltaSeconds: number): void {
  const mind = enemy.mind === "attack" ? "chase" : enemy.mind;
  enemy.mind = mind;

  if (mind === "idle") {
    stepIdle(world, enemy, distance, deltaSeconds);
    return;
  }

  if (mind === "wander") {
    stepWander(world, enemy, distance, deltaSeconds);
    return;
  }

  if (mind === "retreat") {
    stepRetreat(world, enemy, distance, sighted, deltaSeconds);
    return;
  }

  if (mind === "chase") {
    stepChase(world, enemy, distance, sighted, deltaSeconds);
    return;
  }

  mind satisfies never;
  throw new Error("unknown enemy mind");
}

/** Returns an enemy to idle with a fresh pause and no destination left over. */
function rest(enemy: Enemy): void {
  enemy.mind = "idle";
  enemy.idleSeconds = rollIdleSeconds();
  enemy.wanderCell = undefined;
}

/**
 * Waiting, until the player arrives or the pause runs out. It still walks, at a heading of nothing,
 * because crowd separation lives inside `walk` and enemies reach their pauses in groups.
 */
function stepIdle(world: World, enemy: Enemy, distance: number, deltaSeconds: number): void {
  if (distance <= SIGHT_RANGE) {
    enemy.mind = "chase";
    return;
  }

  enemy.idleSeconds -= deltaSeconds;

  if (enemy.idleSeconds <= 0) {
    enemy.mind = "wander";
    return;
  }

  walk(world, enemy, 0, 0, enemy.archetype.speed, deltaSeconds);
}

/**
 * Walking to a cell of its own choosing, drawn from everything reachable rather than the eight
 * directions around it, so a wander crosses rooms and goes through doorways. Arrival is standing in
 * the cell rather than within a radius of its middle, which would disagree with the grid the route
 * was drawn on.
 *
 * Every way a trip can end returns to idle, the two failures included: an enemy sealed in with
 * nowhere to go would otherwise ask for a new destination every frame, flooding the whole open floor.
 */
function stepWander(world: World, enemy: Enemy, distance: number, deltaSeconds: number): void {
  if (distance <= SIGHT_RANGE) {
    enemy.mind = "chase";
    enemy.wanderCell = undefined;
    return;
  }

  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };

  if (enemy.wanderCell === undefined) {
    enemy.wanderCell = randomReachableCell(world.maze, cell);
    // The route to the last destination says nothing about the route to this one.
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
  }

  const goal = enemy.wanderCell;

  // Sealed in with nothing walkable adjacent.
  if (goal === undefined) {
    rest(enemy);
    return;
  }

  if (goal.x === cell.x && goal.y === cell.y) {
    rest(enemy);
    return;
  }

  const heading = pathHeading(world, enemy, goal);

  // No route left to a destination that had one when drawn, so the enemy has been moved since.
  if (heading === undefined) {
    rest(enemy);
    return;
  }

  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}

/**
 * Closing on the player to attack range and holding there. Sight decides only how it closes: seen, it
 * runs the straight line; unseen, it walks the grid route. The waypoint is dropped on every sighted
 * frame so the first unsighted one searches immediately rather than hesitating at a corner.
 *
 * Reaching attack range ends the closing whether or not an attack starts, so an enemy on cooldown
 * strikes from where it stopped rather than creeping closer than its telegraph described.
 */
function stepChase(world: World, enemy: Enemy, distance: number, sighted: boolean, deltaSeconds: number): void {
  if (distance > DISENGAGE_RANGE) {
    rest(enemy);
    return;
  }

  const attack = enemy.archetype.attack;
  const towardX = (world.player.x - enemy.x) / distance;
  const towardY = (world.player.y - enemy.y) / distance;

  if (attack !== undefined && sighted) {
    // Crowded, and it can see what is crowding it. Backing off an unseen player would pace at the
    // edge of its own minimum while trying to walk round a wall.
    if (distance < attack.min) {
      enemy.mind = "retreat";
      stepRetreat(world, enemy, distance, sighted, deltaSeconds);
      return;
    }

    if (distance <= attack.max) {
      if (beginAttack(world, enemy)) {
        enemy.mind = "attack";
        return;
      }

      holdGround(world, enemy, towardX, towardY, deltaSeconds);
      return;
    }
  }

  // What an archetype with no attack has instead: somewhere it stops.
  const hold = enemy.archetype.hold;

  if (hold !== undefined && distance <= hold) {
    holdGround(world, enemy, towardX, towardY, deltaSeconds);
    return;
  }

  if (sighted) {
    // Zeroed rather than merely dropped, so losing sight next frame costs no cooldown.
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
    walk(world, enemy, towardX, towardY, enemy.archetype.speed, deltaSeconds);
    return;
  }

  const goal = { x: Math.floor(world.player.x), y: Math.floor(world.player.y) };
  // One with no route still walks: the separation in `walk` keeps a stalled crowd from stacking.
  const heading = pathHeading(world, enemy, goal) ?? { x: 0, y: 0 };
  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}

/**
 * Backing away from a player who has closed inside this archetype's minimum. A straight line rather
 * than a route, because every direction that increases the distance is equally good.
 */
function stepRetreat(world: World, enemy: Enemy, distance: number, sighted: boolean, deltaSeconds: number): void {
  const attack = enemy.archetype.attack;

  if (attack === undefined || distance >= attack.min) {
    enemy.mind = "chase";
    stepChase(world, enemy, distance, sighted, deltaSeconds);
    return;
  }

  const awayX = (enemy.x - world.player.x) / distance;
  const awayY = (enemy.y - world.player.y) / distance;
  walk(world, enemy, awayX, awayY, enemy.archetype.speed, deltaSeconds);
}

/**
 * Holding position while still being jostled, and turning to keep the player in front. The walk comes
 * first: it applies crowd separation and points the facing wherever the shove went, so turning first
 * would end the frame facing whichever neighbour last pushed.
 */
function holdGround(world: World, enemy: Enemy, towardX: number, towardY: number, deltaSeconds: number): void {
  walk(world, enemy, 0, 0, enemy.archetype.speed, deltaSeconds);
  faceThePlayer(enemy, Math.atan2(towardY, towardX), deltaSeconds);
}

/** Swings a standing enemy's facing toward the player, at its own turn rate if it has one. */
function faceThePlayer(enemy: Enemy, desiredAngle: number, deltaSeconds: number): void {
  const turnRate = enemy.archetype.turnRate;

  if (turnRate === undefined) {
    enemy.facingAngle = desiredAngle;
    return;
  }

  steerToward(enemy, desiredAngle, turnRate, deltaSeconds);
}

/**
 * Opens an attack, if this archetype has one and is free to start it, and reports whether one began.
 * Distance and line of sight are the caller's and are not rechecked, so an enemy attacks from exactly
 * where it stopped. The cooldown stays here, because the false answer is what tells the caller to
 * hold ground instead of striking.
 */
function beginAttack(world: World, enemy: Enemy): boolean {
  const intent = enemy.archetype.windupIntent;

  if (intent === undefined || enemy.attackCooldown > 0) {
    return false;
  }

  if (intent === "melee") {
    // A row that lands on touch rather than committing has nothing to open.
    if (enemy.archetype.meleeWindup !== true) {
      return false;
    }

    applyEnemyEffects(world, enemy, ENEMY_BEHAVIORS.melee.open(enemy, viewOf(world)));
    return true;
  }

  if (intent === "charge") {
    applyEnemyEffects(world, enemy, ENEMY_BEHAVIORS.charge.open(enemy, viewOf(world)));
    return true;
  }

  if (intent === "shoot") {
    applyEnemyEffects(world, enemy, ENEMY_BEHAVIORS.shoot.open(enemy, viewOf(world)));
    return true;
  }

  intent satisfies never;
  throw new Error("unknown enemy windup intent");
}
