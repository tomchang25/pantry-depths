/**
 * Enemy behaviour, as two systems that never run in the same frame.
 *
 * **Pursuit** is what a body does when it is not attacking, and it reads two things: the distance band
 * its archetype wants to hold, and how far it is willing to care at all. Beyond a few cells it
 * navigates the grid toward the player's cell, inside that it drops the path and runs straight at
 * them, and it stops when it is in the band.
 *
 * A body that declares a leash has a third state past all of that: **wandering**. Out past the leash
 * the player is not a destination any more, so it draws a reachable cell of its own and walks the
 * grid to it, then draws another. That is what stops a floor being a set of arrows all pointing at
 * the player from wherever they were standing when the floor was built, and it is why running into
 * a slime is now something you did rather than something that was aimed at you.
 *
 * **Attacking** runs only for a body that has an attack and reads only its own timers. The wind-up
 * and the strike are the committed half: while either is live the body cannot move, cannot turn, and
 * shows which of the two it is in. The cooldown afterwards is not — a body between attacks walks and
 * chases as usual, it simply cannot start another one, so what a cooldown costs it is the attack and
 * not the fight.
 *
 * The split is what makes both ends honest. A slime has no attack, therefore no committed state,
 * therefore nothing that can ever stop it advancing. A skeleton has both, so the seconds either side
 * of a swing are the ones worth walking around it in.
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
  attackCooldown,
  attackDamage,
  attackReach,
  attackWindup,
  MELEE_CUT_HALF_ANGLE,
  STRIKE_SECONDS,
} from "@/demo/enemy-archetypes";
import { hasBless } from "@/demo/bless";
import { checkHazards } from "@/demo/impacts";
import { breadthFirstStep, randomReachableCell, type DemoCell } from "@/demo/maze";
import { burst } from "@/demo/particles";
import { FLUNG, slideMove, unstick, WALKING } from "@/demo/movement";
import {
  announce,
  endRun,
  ENEMY_RADIUS,
  hasLineOfSight,
  markDamageFrom,
  nextId,
  randomAmmo,
  stunEnemy,
  type DemoEnemy,
  type DemoWorld,
} from "@/demo/world";

const REPATH_SECONDS = 0.4;
const SEPARATION = 0.62;

/**
 * How far inside its leash a wandering body has to be caught before it takes an interest again.
 *
 * The hysteresis, and the reason there are two distances rather than one: a player standing exactly
 * on the leash would otherwise flip the body between chasing and wandering every frame, and those two
 * want opposite directions — so it reads as a body vibrating rather than as one making its mind up.
 * Giving up happens at the leash and taking up again happens inside it, so neither edge is a coin.
 */
const REACQUIRE_SHARE = 0.85;

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

/**
 * A step's worth of heading along the grid route to a cell, or nothing when there is no route.
 *
 * The two zero answers a caller can get back are deliberately different things. `undefined` means no
 * way there is known — the search failed, and it will not be retried until the cooldown lapses — and
 * a wanderer treats that as its destination being gone. A zero *vector* means the route is fine and
 * this particular waypoint has just been reached, which is a normal frame and not a reason to give up
 * on anything.
 */
function pathHeading(
  world: DemoWorld,
  enemy: DemoEnemy,
  goal: DemoCell,
): Readonly<{ x: number; y: number }> | undefined {
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
  enemy.windupSeconds = attackWindup(enemy.archetype);
  enemy.windupTotal = attackWindup(enemy.archetype);
  enemy.aimX = world.player.x;
  enemy.aimY = world.player.y;
  // Snapped to the aim, and then held there for the whole telegraph. The drawn body has to agree
  // with the line on the floor: a shooter that opened fire while facing the way it last walked was
  // pointing one direction and shooting another, which makes the telegraph unreadable.
  enemy.facingAngle = Math.atan2(enemy.aimY - enemy.y, enemy.aimX - enemy.x);
}

function fireShot(world: DemoWorld, enemy: DemoEnemy): void {
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
function launchCharge(enemy: DemoEnemy): void {
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
function honeBlade(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
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
function releaseBlade(world: DemoWorld, enemy: DemoEnemy): void {
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
export function hurtPlayer(world: DemoWorld, amount: number, fromX?: number, fromY?: number): void {
  world.hitFlash = 1;

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
    pursue(world, enemy, distance, sighted, deltaSeconds);
    tryBeginAttack(world, enemy, distance, sighted);
  }
}

/** Runs a wind-up already committed to, and resolves whatever it was committed to when it expires. */
function stepWindup(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
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
 * Closes on the player, or holds off them, according to the one band the archetype declares.
 *
 * This replaces a melee routine and a shooter routine that differed in nothing but which distance
 * they wanted. Sight gates the band rather than the closing, because a body holding a standoff
 * against a wall it cannot see through is holding it against nothing — it should come round.
 *
 * The leash is checked before any of it, because a body that has lost interest is not pursuing badly
 * — it is doing something else entirely, and every number below describes a body that wants to be
 * near the player.
 */
function pursue(world: DemoWorld, enemy: DemoEnemy, distance: number, sighted: boolean, deltaSeconds: number): void {
  const leash = enemy.archetype.leash;

  if (leash !== undefined && !holdsInterest(enemy, distance, leash)) {
    wander(world, enemy, deltaSeconds);
    return;
  }

  // Dropped the moment the player is worth chasing, so a wanderer that gets caught up with does not
  // keep a stale errand to resume the next time they walk away.
  enemy.wanderCell = undefined;
  const band = enemy.archetype.band;
  const towardX = (world.player.x - enemy.x) / distance;
  const towardY = (world.player.y - enemy.y) / distance;

  if (band !== undefined && sighted) {
    if (distance < band.near) {
      walk(world, enemy, -towardX, -towardY, enemy.archetype.speed, deltaSeconds);
      return;
    }

    if (distance <= band.far) {
      // Holding station, and turning to keep the player in front while it does. Standing still used
      // to leave the facing wherever the last step of walking left it, so a shooter that had reached
      // its band and stopped was drawn facing the direction it had arrived from for as long as it
      // stood there.
      faceThePlayer(enemy, Math.atan2(towardY, towardX), deltaSeconds);
      return;
    }
  }

  const close = distance <= enemy.archetype.rushDistance;

  if (close) {
    // Dropping the waypoint alone would leave the rusher stalled for a whole cooldown when the
    // player breaks back out of rush range; zeroing it makes the next path request immediate.
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
  }

  const goal = { x: Math.floor(world.player.x), y: Math.floor(world.player.y) };
  // A body with no route to the player still walks: the separation in `walk` is what keeps a stalled
  // crowd from stacking into one point, and it was the old behaviour of a failed search too.
  const heading = close ? { x: towardX, y: towardY } : (pathHeading(world, enemy, goal) ?? { x: 0, y: 0 });
  walk(world, enemy, heading.x, heading.y, close ? enemy.archetype.rushSpeed : enemy.archetype.speed, deltaSeconds);
}

/**
 * Whether a leashed body still counts the player as its business.
 *
 * Holding a wander cell is what "currently wandering" means, so the two distances key off that rather
 * than off a second flag: a chasing body gives up at the leash, and a wandering one only takes the
 * player up again once they are well inside it.
 */
function holdsInterest(enemy: DemoEnemy, distance: number, leash: number): boolean {
  return enemy.wanderCell === undefined ? distance <= leash : distance <= leash * REACQUIRE_SHARE;
}

/**
 * Walking somewhere of its own choosing, which is what a body out past its leash does instead of
 * standing still.
 *
 * A cell rather than a heading, and drawn from everything it can actually reach rather than from the
 * eight directions around it. Both halves matter: a re-rolled heading produces a body shivering on
 * one square, and a heading held for a while produces one walking into a wall until the timer says
 * otherwise. Committing to a destination and pathing to it along the grid means a wandering slime
 * crosses rooms, goes through doorways, and ends up somewhere the player did not put it.
 *
 * Arrival is the only thing that ends a trip, and it is standing in the cell rather than being some
 * distance from its middle. A radius would have been a second number disagreeing with the grid the
 * route was drawn on: too small and a body that has plainly got there keeps shuffling toward a point,
 * too large and it gives up a cell early. There is no timer either, because the point is that this is
 * the body's own business rather than a pause in the player's — it goes where it was going.
 */
function wander(world: DemoWorld, enemy: DemoEnemy, deltaSeconds: number): void {
  const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };

  if (enemy.wanderCell === undefined) {
    enemy.wanderCell = randomReachableCell(world.maze, cell);
    // The route to the last destination says nothing about the route to this one.
    enemy.waypoint = undefined;
    enemy.repathSeconds = 0;
  }

  const goal = enemy.wanderCell;

  // Sealed in with nothing walkable next to it. Standing still is the honest answer.
  if (goal === undefined) {
    return;
  }

  if (goal.x === cell.x && goal.y === cell.y) {
    enemy.wanderCell = undefined;
    return;
  }

  const heading = pathHeading(world, enemy, goal);

  // No route left to somewhere that had one when it was drawn: the body has been knocked somewhere
  // else since. Drawing a fresh destination from where it is now is the whole recovery.
  if (heading === undefined) {
    enemy.wanderCell = undefined;
    return;
  }

  walk(world, enemy, heading.x, heading.y, enemy.archetype.speed, deltaSeconds);
}

/** Swings a standing body's facing toward the player, at its own turn rate if it has one. */
function faceThePlayer(enemy: DemoEnemy, desiredAngle: number, deltaSeconds: number): void {
  const turnRate = enemy.archetype.turnRate;

  if (turnRate === undefined) {
    enemy.facingAngle = desiredAngle;
    return;
  }

  steerToward(enemy, desiredAngle, turnRate, deltaSeconds);
}

/**
 * Opens an attack if this body has one and the conditions it declares are met.
 *
 * The cooldown is checked here rather than upstream, because a body on cooldown is now an ordinary
 * chasing body: it reaches this function every frame and this is the only thing turning it away.
 */
function tryBeginAttack(world: DemoWorld, enemy: DemoEnemy, distance: number, sighted: boolean): void {
  const intent = enemy.archetype.windupIntent;

  if (intent === undefined || enemy.attackCooldown > 0) {
    return;
  }

  if (intent === "melee") {
    if (enemy.archetype.meleeWindup === true && distance <= attackReach(enemy.archetype)) {
      beginWindup(world, enemy, "melee");
    }

    return;
  }

  if (intent === "charge") {
    if (sighted && distance <= CHARGE_TRIGGER_DISTANCE) {
      beginWindup(world, enemy, "charge");
    }

    return;
  }

  if (intent === "shoot") {
    // The band is the whole condition: its far edge is the range it will open fire at, and its near
    // edge is the distance it would rather be walking away from than shooting at. A shooter caught
    // inside that edge still finishes the shot it had started — a committed telegraph is never
    // taken back — and then leaves rather than starting another. A body with no band has no shot.
    const band = enemy.archetype.band;

    if (band !== undefined && sighted && distance >= band.near && distance <= band.far) {
      beginWindup(world, enemy, "shoot");
    }

    return;
  }

  intent satisfies never;
  throw new Error("unknown enemy windup intent");
}
