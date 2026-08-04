/**
 * Enemy behaviour, as one mind with five states and nothing outside it deciding where a body goes.
 *
 * **Idle** stands about and counts down. **Wander** draws a cell it can reach and walks the grid to
 * it, then goes back to idling. Those two are the floor's resting condition, and between them they
 * are why a room is somewhere creatures live rather than a set of arrows pointed at wherever the
 * player was standing when the floor was built: what you run into, you ran into.
 *
 * **Chase** closes on the player until it is inside the distance its archetype attacks from, then
 * stops and holds. **Attack** is that arrival paid off, and it is the committed half — while a wind-up
 * or a strike is live the body cannot move, cannot turn, and shows which of the two it is in.
 * **Retreat** is the same rule read from the other side: a shooter crowded inside its minimum walks
 * backwards until it has its distance again.
 *
 * Two distances govern all five, and both are the same for every body on the floor: notice at
 * `SIGHT_RANGE`, forget at `DISENGAGE_RANGE`. Both are straight lines measured through walls. Losing
 * sight of a body sheds nothing — it only decides *how* the body closes, which is the one thing sight
 * is read for: seen, it runs straight at the player; unseen, it walks the grid route to their cell.
 * That is what makes cover a way of buying time rather than a way of disappearing, and it is what
 * stopped bodies from grinding into the wall between themselves and a player they were beelining at.
 *
 * A cooldown is not a state. A body between attacks is an ordinary chasing body that happens to be
 * unable to start another one, so what a cooldown costs it is the attack and not the fight. Nor is
 * being stunned, hurt, drowning or carried: each of those interrupts whatever the body was doing and
 * hands it back afterwards, which is a condition layered over a mind rather than a mind of its own.
 *
 * A slime has no attack at all, so two of the five are unreachable for it: it closes to `hold` and
 * stops, and nothing exists that could ever stop it advancing before then.
 */

import { damageWall } from "@/core/combat/actions";
import {
  CHARGE_DAMAGE,
  CHARGE_DISTANCE,
  CHARGE_KNOCKBACK,
  CHARGE_SPEED,
  CHARGE_WALL_DAMAGE,
  CHARGE_WALL_STUN,
  DISENGAGE_RANGE,
  SIGHT_RANGE,
  attackCooldown,
  attackDamage,
  attackReach,
  attackWindup,
  MELEE_CUT_HALF_ANGLE,
  STRIKE_SECONDS,
  type WindupIntent,
} from "@/core/combat/enemy-contract";
import { hasBless } from "@/core/progression/bless";
import { checkHazards } from "@/core/combat/impacts";
import { breadthFirstStep, randomReachableCell } from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import { burst } from "@/core/combat/particles";

import { FLUNG, slideMove, unstick, WALKING } from "@/core/floor/movement";
import {
  announce,
  endRun,
  ENEMY_RADIUS,
  hasLineOfSight,
  markDamageFrom,
  nextId,
  randomAmmo,
  stunEnemy,
  type Enemy,
  type World,
  raiseSfx,
  rollIdleSeconds,
} from "@/core/world/world";

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
 * A step's worth of heading along the grid route to a cell, or nothing when there is no route.
 *
 * The two zero answers a caller can get back are deliberately different things. `undefined` means no
 * way there is known — the search failed, and it will not be retried until the cooldown lapses — and
 * a wanderer treats that as its destination being gone. A zero *vector* means the route is fine and
 * this particular waypoint has just been reached, which is a normal frame and not a reason to give up
 * on anything.
 */
function pathHeading(world: World, enemy: Enemy, goal: Cell): Readonly<{ x: number; y: number }> | undefined {
  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };

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
function steerToward(enemy: Enemy, desiredAngle: number, turnRate: number, deltaSeconds: number): number {
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
function beginWindup(world: World, enemy: Enemy, intent: WindupIntent): void {
  enemy.intent = intent;
  enemy.windupSeconds = attackWindup(enemy.archetype);
  enemy.windupTotal = attackWindup(enemy.archetype);
  enemy.aimX = world.player.x;
  enemy.aimY = world.player.y;
  // Snapped to the aim, and then held there for the whole telegraph. The drawn body has to agree
  // with the line on the floor: a shooter that opened fire while facing the way it last walked was
  // pointing one direction and shooting another, which makes the telegraph unreadable.
  enemy.facingAngle = Math.atan2(enemy.aimY - enemy.y, enemy.aimX - enemy.x);
}

function fireShot(world: World, enemy: Enemy): void {
  const shot = enemy.archetype.shot;

  if (!shot) {
    return;
  }

  const dx = enemy.aimX - enemy.x;
  const dy = enemy.aimY - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  world.hazards.push({
    id: nextId(world, "hazard"),
    kind: "bolt",
    x: enemy.x,
    y: enemy.y,
    directionX: dx / length,
    directionY: dy / length,
    speed: shot.speed,
    travelled: 0,
    range: shot.range,
    damage: shot.damage,
    knockback: shot.knockback,
    // A shot flies flat and hits what it touches: no curve, and no radius beyond its own body.
    arc: 0,
    fall: 0,
    plunge: 1,
    blastRadius: 0,
  });
  enemy.attackPoseSeconds = STRIKE_SECONDS;
  enemy.attackCooldown = attackCooldown(enemy.archetype);
}

/**
 * Sends a charge down the lane it committed to.
 *
 * The locked point only sets the direction. Distance stays the charger's own, so a charge aimed at
 * something two cells away still runs its full length past it — which is what leaves the charger
 * beyond the player, facing the wrong way, when it misses.
 */
function launchCharge(enemy: Enemy): void {
  const dx = enemy.aimX - enemy.x;
  const dy = enemy.aimY - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  enemy.chargeX = dx / length;
  enemy.chargeY = dy / length;
  enemy.chargeSeconds = CHARGE_DISTANCE / CHARGE_SPEED;
  enemy.attackCooldown = attackCooldown(enemy.archetype);
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
/**
 * Sparks drawn in along a sword's edge while it is being raised, and thrown off it when it goes.
 *
 * The soft bodies say "committed" by changing shape. A skeleton is an authored sheet playing authored
 * frames, so what it has instead is what surrounds it — and gathering is the readable half: particles
 * converging on a body is a wind-up in a way that particles leaving one never is. The release throws
 * them back out along the arc, so the moment the second ends is punctuated rather than merely over.
 */
function honeBlade(world: World, enemy: Enemy, deltaSeconds: number): void {
  if (enemy.intent !== "melee") {
    return;
  }

  const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);

  if (Math.random() > (6 + progress * 22) * deltaSeconds) {
    return;
  }

  // Started out on the arc and aimed back at the body, so they close on the blade as it is raised.
  const angle = enemy.facingAngle + (Math.random() * 2 - 1) * MELEE_CUT_HALF_ANGLE;
  const reach = attackReach(enemy.archetype) * (1.1 + Math.random() * 0.35);
  burst(world.particles, "ember", enemy.x + Math.cos(angle) * reach, enemy.y + Math.sin(angle) * reach, 0.62, 1, {
    speed: 1.4 + progress * 1.8,
    spreadZ: 0.5,
    gravity: -0.4,
    drag: 2.4,
    directionX: -Math.cos(angle),
    directionY: -Math.sin(angle),
    focus: 0.85,
    size: 0.04,
    life: 0.34,
  });
}

/** The blade going, thrown outward along the arc it just swept. */
function releaseBlade(world: World, enemy: Enemy): void {
  burst(world.particles, "ember", enemy.x, enemy.y, 0.62, 12, {
    speed: 5.5,
    spreadZ: 0.7,
    gravity: 1.2,
    drag: 2.8,
    directionX: Math.cos(enemy.facingAngle),
    directionY: Math.sin(enemy.facingAngle),
    focus: 0.45,
    size: 0.05,
    life: 0.3,
  });
}

function stokeCharge(world: World, enemy: Enemy, deltaSeconds: number): void {
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
function stepCharge(world: World, enemy: Enemy, deltaSeconds: number): void {
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
    stunEnemy(enemy, CHARGE_WALL_STUN);
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
export function hurtPlayer(world: World, amount: number, fromX?: number, fromY?: number): void {
  world.hitFlash = 1;
  // Flat, not positional: this one happened to the player, so it is not somewhere across the room.
  raiseSfx(world, "playerHurt");

  // Beside the flash, and for the same reasons it is here rather than further down: this fires for a
  // hit the hostage eats and for one god mode pays for, because in both cases something out there
  // just took a shot at you and the direction is the useful half of knowing that.
  if (fromX !== undefined && fromY !== undefined) {
    markDamageFrom(world, amount, fromX, fromY);
  }

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
    endRun(world, "dead");
  }
}

/**
 * One pass over every body, in two halves the mind freeze cuts between.
 *
 * The head is what happened *to* the body: its timers count down, whatever shoved it carries it, and
 * it settles out of any geometry it ended up inside. The tail is what the body decided — a committed
 * charge, a committed wind-up, and everything downstream of choosing where to go.
 *
 * The freeze returns between the two rather than skipping the pass, and that is the whole point of
 * there being two switches. Skipping it wholesale is what the world freeze does, and it leaves a
 * struck body lit white forever, because the hit flash is a timer in the head of this loop.
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
      stepCharge(world, enemy, deltaSeconds);
      continue;
    }

    if (enemy.stunSeconds > 0 || world.status !== "playing") {
      continue;
    }

    // The committed half, and the only thing that holds a body where it stands. Neither branch
    // reaches `walk`, which is what makes a telegraph a promise about a piece of ground rather than
    // a decoration following whoever it was aimed at.
    //
    // The cooldown is deliberately not here. A body between attacks keeps chasing — losing the
    // attack is what the cooldown costs it, and standing still for it as well turned every fight
    // into a room of statues.
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

/** Runs a wind-up already committed to, and resolves whatever it was committed to when it expires. */
function stepWindup(world: World, enemy: Enemy, deltaSeconds: number): void {
  stokeCharge(world, enemy, deltaSeconds);
  honeBlade(world, enemy, deltaSeconds);
  // Committed means committed: a body winding up neither moves nor turns. It used to keep tracking
  // the player at its walking turn rate, which over a full second is most of a circle — so the cut
  // would follow whoever it was aimed at and the arc drawn on the floor would sweep around after
  // them, describing nothing. Locking the facing here is what makes that arc a claim about a piece
  // of ground rather than a decoration attached to a body.
  enemy.windupSeconds -= deltaSeconds;

  if (enemy.windupSeconds > 0) {
    return;
  }

  const intent = enemy.intent;

  if (intent === "shoot") {
    fireShot(world, enemy);
    enemy.intent = "none";
    return;
  }

  if (intent === "charge") {
    launchCharge(enemy);
    return;
  }

  if (intent === "melee") {
    const toX = world.player.x - enemy.x;
    const toY = world.player.y - enemy.y;
    const distance = Math.hypot(toX, toY);
    // Both halves of the shape the floor is showing. Distance alone made a cut a full circle, which
    // is why walking round a swordsman never used to work; with the facing locked at the start of
    // the wind-up, the cone is fixed in the world for the whole second and stepping out of it is
    // exactly as reliable as the mark says it is.
    const offBearing = Math.abs(shortestTurn(Math.atan2(toY, toX) - enemy.facingAngle));
    releaseBlade(world, enemy);

    if (distance <= attackReach(enemy.archetype) + 0.16 && offBearing <= MELEE_CUT_HALF_ANGLE) {
      hurtPlayer(world, attackDamage(enemy.archetype), enemy.x, enemy.y);
    }

    enemy.attackPoseSeconds = STRIKE_SECONDS;
    enemy.attackCooldown = attackCooldown(enemy.archetype);
    enemy.intent = "none";
    return;
  }

  if (intent === "none") {
    return;
  }

  intent satisfies never;
  throw new Error("unknown enemy intent");
}

/**
 * One frame of whatever this body is currently doing, and the only place a mind changes.
 *
 * A transition sets the field and returns rather than running the state it just entered. The frame it
 * costs is invisible at sixty of them a second, and what it buys is that no state can be entered from
 * inside another one — which is the failure this shape exists to prevent, because a chain of states
 * calling each other is a chain that can loop.
 *
 * Chase and retreat are the one exception, and they earn it by sharing a threshold. Everywhere else
 * the two states either side of a boundary want the body to do different things at distances that do
 * not overlap, so a dropped frame is a body pausing imperceptibly. Those two want opposite things at
 * the same distance: a shooter walked down by the player would spend one frame deciding to back off,
 * one backing off, one deciding to stop, and one stopped — visibly retreating at a quarter of its
 * pace. They hand off directly, which terminates because the condition that sends a body one way is
 * the exact negation of the one that sends it back.
 *
 * Attack is handled by coercion rather than by a branch. Reaching this function at all means no
 * wind-up, strike or charge is live, since every one of those is caught upstream and stops the frame
 * there; so a body still holding the attack mind here is one whose attack has just ended — or one
 * whose attack was cut short by a stun. Treating both as "back to chasing" is what keeps a stunned
 * charger from waking up in a state nothing will ever leave.
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

/** Sends a body back to standing about, with a fresh pause and no errand left over. */
function rest(enemy: Enemy): void {
  enemy.mind = "idle";
  enemy.idleSeconds = rollIdleSeconds();
  enemy.wanderCell = undefined;
}

/**
 * Standing about, until either the player turns up or the body thinks of somewhere to be.
 *
 * It still walks, at a heading of nothing. That looks like a contradiction and is the point: the crowd
 * separation lives inside `walk`, so a body that skips it is a body that can be stood inside. Bodies
 * arrive at their pauses in groups — a wave that lost the player, a doorway three of them came through
 * — and without this they would spend the whole pause occupying one square.
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
 * Walking somewhere of its own choosing.
 *
 * A cell rather than a heading, and drawn from everything it can actually reach rather than from the
 * eight directions around it. Both halves matter: a re-rolled heading produces a body shivering on one
 * square, and a heading held for a while produces one walking into a wall until the timer says
 * otherwise. Committing to a destination and pathing to it along the grid means a wandering slime
 * crosses rooms, goes through doorways, and ends up somewhere the player did not put it.
 *
 * Arrival is standing in the cell rather than being some distance from its middle. A radius would have
 * been a second number disagreeing with the grid the route was drawn on: too small and a body that has
 * plainly got there keeps shuffling toward a point, too large and it gives up a cell early.
 *
 * Every way a trip can end sends the body back to idling, including the two failures. That is not
 * tidiness — a body sealed in with nowhere to go used to hold no destination and therefore ask for a
 * new one, which is a flood of the whole open floor, every frame, forever. Resting on failure is what
 * bounds that search to once a pause.
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

  // Sealed in with nothing walkable next to it.
  if (goal === undefined) {
    rest(enemy);
    return;
  }

  if (goal.x === cell.x && goal.y === cell.y) {
    rest(enemy);
    return;
  }

  const heading = pathHeading(world, enemy, goal);

  // No route left to somewhere that had one when it was drawn: the body has been knocked elsewhere
  // since. Standing about and drawing a fresh destination from where it is now is the whole recovery.
  if (heading === undefined) {
    rest(enemy);
    return;
  }

  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}

/**
 * Closing on the player until this body is standing where it can attack from, and holding there.
 *
 * Sight decides how it closes and nothing else. Seen, it runs the straight line; unseen, it walks the
 * grid route to the player's cell — which is the same body pursuing the same target, differing only in
 * whether it has to go round. The waypoint is dropped on every sighted frame so that the first unsighted
 * one searches immediately rather than standing through the rest of a path cooldown, which is exactly
 * the frame a body rounds a corner and would otherwise be seen to hesitate on it.
 *
 * Reaching the attack range ends the closing whether or not an attack actually starts. A body on
 * cooldown holds its ground rather than walking further in: where it stops is where it strikes from,
 * and a charger that crept closer between charges would be launching from somewhere its own telegraph
 * had not described.
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
    // Crowded, and it can see what is crowding it. Backing off a player it cannot see would have it
    // pace at the edge of its own minimum while trying to walk round a wall to reach them.
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

  // What a body with no attack has instead: somewhere it stops, and nothing to do when it gets there.
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
  // A body with no route to the player still walks: the separation in `walk` is what keeps a stalled
  // crowd from stacking into one point, and it was the old behaviour of a failed search too.
  const heading = pathHeading(world, enemy, goal) ?? { x: 0, y: 0 };
  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}

/**
 * Backing away from a player who has closed inside the distance this body needs.
 *
 * A straight line rather than a route, because fleeing is the one thing a body does not need to plan:
 * it wants to be further away, and every direction that achieves that is equally good. Cornered, it
 * presses into the wall, which is the honest picture of a shooter that has been run down.
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
 * Standing where it wants to be, still being jostled, and turning to keep the player in front.
 *
 * The walk comes first and the facing second on purpose. Walking at a heading of nothing still applies
 * crowd separation and still points the body wherever that shove sent it, so a body that turned first
 * would end the frame facing whichever neighbour last pushed it — which is how a shooter ends up
 * aiming at its own flank.
 */
function holdGround(world: World, enemy: Enemy, towardX: number, towardY: number, deltaSeconds: number): void {
  walk(world, enemy, 0, 0, enemy.archetype.speed, deltaSeconds);
  faceThePlayer(enemy, Math.atan2(towardY, towardX), deltaSeconds);
}

/** Swings a standing body's facing toward the player, at its own turn rate if it has one. */
function faceThePlayer(enemy: Enemy, desiredAngle: number, deltaSeconds: number): void {
  const turnRate = enemy.archetype.turnRate;

  if (turnRate === undefined) {
    enemy.facingAngle = desiredAngle;
    return;
  }

  steerToward(enemy, desiredAngle, turnRate, deltaSeconds);
}

/**
 * Opens an attack, if this body has one and is free to start it. Answers whether one began.
 *
 * The distance and the line of sight are the caller's to check and are not rechecked here. That is the
 * whole gain from folding the standoff band and the attack trigger into one range: a body attacks from
 * exactly where it decided to stop, so there is no second opinion about the geometry that could
 * disagree with the first. What is left here is only what differs between the three kinds of attack.
 *
 * The cooldown stays here rather than upstream, because a body on cooldown is still an ordinary
 * chasing body — the false answer is what tells the caller to hold its ground instead of striking.
 */
function beginAttack(world: World, enemy: Enemy): boolean {
  const intent = enemy.archetype.windupIntent;

  if (intent === undefined || enemy.attackCooldown > 0) {
    return false;
  }

  if (intent === "melee") {
    // The one row that lands on touch instead of committing has nothing to open.
    if (enemy.archetype.meleeWindup !== true) {
      return false;
    }

    beginWindup(world, enemy, "melee");
    return true;
  }

  if (intent === "charge") {
    beginWindup(world, enemy, "charge");
    return true;
  }

  if (intent === "shoot") {
    beginWindup(world, enemy, "shoot");
    return true;
  }

  intent satisfies never;
  throw new Error("unknown enemy windup intent");
}
