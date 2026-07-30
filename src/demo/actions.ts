/**
 * Player actions: the left button and the right button, and everything they can land on.
 *
 * Left is attack-or-throw, right is grab-or-drop. Which of those two a press resolves to depends
 * only on whether the hands are full, so neither button ever needs a modifier.
 */

import { chooseMeleeAttack } from "@/content/viewmodel/melee-viewmodel";
import { blessBonus, hasBless } from "@/demo/bless";
import { canCarry } from "@/demo/enemy-archetypes";
import { blocksProjectile, tileAt, type DemoCell, type DemoTile } from "@/demo/maze";
import { burst } from "@/demo/particles";
import {
  propBehaviour,
  propWeight,
  throwWeight,
  type DemoPropKind,
  type DemoThrowKind,
  type DemoThrowWeight,
} from "@/demo/throw-weight";
import {
  announce,
  awardBless,
  damageEnemy,
  nextId,
  PLAYER_SPEED,
  REACH,
  SWING_SECONDS,
  THROW_SWING_SECONDS,
  type DemoEnemy,
  type DemoHeld,
  type DemoProp,
  type DemoWorld,
} from "@/demo/world";

const BASE_MELEE_DAMAGE = 25;
const HEAVY_MELEE_DAMAGE = 45;
const HEAVY_MELEE_REACH = 2.1;
const HEAVY_MELEE_KNOCKBACK = 9;
/** Half-angle of the player's melee sweep, shared with the attack authoring preview. */
export const MELEE_HALF_ANGLE = 0.85;
const MELEE_ARC = Math.cos(MELEE_HALF_ANGLE);
const GRAB_ARC = Math.cos(1);

/**
 * What each way of hitting a wall costs it, against the hit points in `@/demo/maze`.
 *
 * A bare swing is the unit, so the swing counts are unchanged: two for wood, four for stone. What a
 * thrown prop is worth is its own row in `propBehaviour`; a thrown body is the one throw with no prop
 * row to read, so its number is here.
 */
export const MELEE_WALL_DAMAGE = 1;
const THROWN_WALL_DAMAGE = 2;
export const BLAST_WALL_DAMAGE = 4;
/** How often a broken wall drops a stack of its own material as ammunition. */
const WALL_DROP_CHANCE = 0.2;

/** How far ahead a projectile leaves the hand; the aim cap subtracts it so the landing matches. */
const THROW_SPAWN_AHEAD = 0.4;

/**
 * What one point of recoil is worth, in cells per second of backward shove and in view jolt.
 *
 * Both are deliberately tiny. The first version of these moved the player the better part of half a
 * cell backwards on every throw, which does not read as effort — it reads as being shoved by
 * something you cannot see. Recoil says a weight left the hands; it must never take a step for you.
 */
const RECOIL_SHOVE = 0.8;
const RECOIL_SHAKE = 0.22;

/** Every throw aimed at the floor stops where the crosshair meets it, lobbed or straight. */
function throwRange(world: DemoWorld, base: number): number {
  if (world.player.pitch > 0) {
    return base;
  }

  // Where the crosshair ray meets the floor: the horizon sits at `0.49 + pitch` of the screen and
  // the eye half a cell up, so the centre of the view lands `0.5 / (0.01 - pitch)` cells out.
  // Level looks resolve far beyond any base range and change nothing.
  const aimDistance = 0.5 / (0.01 - world.player.pitch);
  return Math.min(base, Math.max(THROW_SPAWN_AHEAD, aimDistance - THROW_SPAWN_AHEAD));
}

export const PROP_LABELS: Readonly<Record<DemoPropKind, string>> = {
  stick: "Stakes",
  rock: "Rocks",
  bomb: "Bombs",
  axe: "Axe",
  skeletonSword: "Skeleton Sword",
  skeletonSkull: "Skull",
  skeletonFemur: "Femur",
  skeletonFemurCracked: "Cracked Femur",
  skeletonJavelin: "Skeleton Javelin",
  skeletonJavelinCracked: "Bent Javelin",
  crossbow: "Bone Crossbow",
  crossbowSpent: "Spent Crossbow",
  crossbowBolt: "Bolt",
};

const THROW_CALLS: Readonly<Record<DemoPropKind, string>> = {
  stick: "Stake away!",
  rock: "Rock away!",
  bomb: "Bomb away!",
  axe: "Axe away!",
  skeletonSword: "Sword away!",
  skeletonSkull: "Skull away!",
  skeletonFemur: "Bone away!",
  skeletonFemurCracked: "Last of the bone!",
  skeletonJavelin: "Javelin away!",
  skeletonJavelinCracked: "Last of the shaft!",
  crossbow: "Bolt away!",
  crossbowSpent: "Threw the stock!",
  crossbowBolt: "Bolt away!",
};

export function meleeReach(world: DemoWorld): number {
  return (hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_REACH : REACH) + blessBonus(world.bless, "meleeReach");
}

export function meleeDamage(world: DemoWorld): number {
  return (
    (hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_DAMAGE : BASE_MELEE_DAMAGE) +
    blessBonus(world.bless, "meleeDamage")
  );
}

/**
 * How fast the player walks, before whatever they are carrying slows them down.
 *
 * An accessor rather than the constant, for the same reason the two above are: the modifier layer has
 * to be consulted somewhere, and one place per axis is the only arrangement where a new source of
 * modifiers reaches every axis at once.
 */
export function playerSpeed(world: DemoWorld): number {
  return PLAYER_SPEED + blessBonus(world.bless, "moveSpeed");
}

/** The damage a thrown object does on contact — the same as a bare swing, blessings aside. */
export function thrownImpactDamage(world: DemoWorld): number {
  return meleeDamage(world);
}

export function thrownWallDamage(kind: DemoThrowKind): number {
  return kind === "enemy" ? THROWN_WALL_DAMAGE : propBehaviour(kind).wallDamage;
}

/** What the hands are currently carrying weighs, for whatever wants to charge the player for it. */
export function heldWeight(held: DemoHeld): DemoThrowWeight | undefined {
  if (!held) {
    return undefined;
  }

  return held.kind === "enemy" ? held.enemy.archetype.weight : propWeight(held.prop);
}

function facing(world: DemoWorld): Readonly<{ x: number; y: number }> {
  return { x: Math.cos(world.player.angle), y: Math.sin(world.player.angle) };
}

/** Whether a point is inside the given reach and roughly ahead of the player. */
function inFront(world: DemoWorld, x: number, y: number, reach: number, arc: number): number | undefined {
  const toX = x - world.player.x;
  const toY = y - world.player.y;
  const distance = Math.hypot(toX, toY);

  if (distance > reach || distance < 0.0001) {
    return undefined;
  }

  const direction = facing(world);

  return (toX / distance) * direction.x + (toY / distance) * direction.y >= arc ? distance : undefined;
}

function nearestEnemyAhead(
  world: DemoWorld,
  reach: number,
  arc: number,
  accepts: (enemy: DemoEnemy) => boolean = () => true,
): DemoEnemy | undefined {
  let best: DemoEnemy | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0 || !accepts(enemy)) {
      continue;
    }

    const distance = inFront(world, enemy.x, enemy.y, reach, arc);

    if (distance !== undefined && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Everything one swing sweeps through, nearest first.
 *
 * The blade does not stop at the first body it meets. A sword swung through a doorway full of slimes
 * that killed exactly one of them was the demo's most reliable disappointment: the arc visibly passes
 * through all of them, so hitting one is the drawing calling the rules a liar.
 *
 * Nearest ends up at the front without a sort — each strictly closer find is moved there — because
 * that one is what the arc is drawn through. The order of the rest is arbitrary and nothing reads it.
 */
function sweepAhead(world: DemoWorld, reach: number, arc: number): readonly DemoEnemy[] {
  const struck: DemoEnemy[] = [];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0) {
      continue;
    }

    const distance = inFront(world, enemy.x, enemy.y, reach, arc);

    if (distance === undefined) {
      continue;
    }

    if (distance < nearestDistance) {
      nearestDistance = distance;
      struck.unshift(enemy);
    } else {
      struck.push(enemy);
    }
  }

  return struck;
}

function nearestPropAhead(world: DemoWorld): DemoProp | undefined {
  let best: DemoProp | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const prop of world.props) {
    const distance = inFront(world, prop.x, prop.y, REACH, GRAB_ARC);

    if (distance !== undefined && distance < bestDistance) {
      best = prop;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * The breakable thing the player is looking at within arm's length.
 *
 * Barricades count even though you can see over them: the same predicate that stops a thrown rock
 * is the one that decides what a swing lands on, so the two can never disagree.
 */
export function wallAhead(world: DemoWorld, reach = REACH): DemoCell | undefined {
  const direction = facing(world);
  const steps = Math.max(4, Math.round(reach * 4));

  for (let step = 1; step <= steps; step += 1) {
    const along = (step / steps) * reach;
    const x = Math.floor(world.player.x + direction.x * along);
    const y = Math.floor(world.player.y + direction.y * along);

    if (blocksProjectile(world.maze, x, y)) {
      return { x, y };
    }
  }

  return undefined;
}

/** Iron sparks rather than splinters, and the cell opens up when the last spike goes. */
function damageBarricade(world: DemoWorld, cell: DemoCell, tile: DemoTile, damage: number): void {
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  burst(world.particles, "ember", cell.x + 0.5, cell.y + 0.5, 0.45, 7, {
    speed: 2.6,
    spreadZ: 1.8,
    size: 0.045,
    life: 0.55,
  });

  if (tile.hp > 0) {
    announce(world, `Barricade HP ${tile.hp}/${tile.maxHp}`, 1.1);
    return;
  }

  tile.kind = "open";
  tile.maxHp = 0;
  burst(world.particles, "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.5, 18, {
    speed: 3,
    spreadZ: 2.6,
    size: 0.06,
    life: 1.2,
  });
  announce(world, "The barricade is torn down!");
}

/**
 * Breaking down the floor's own artillery.
 *
 * Iron and timber rather than masonry, and it leaves nothing behind: ammunition already comes off
 * walls and bodies, and a hazard that paid out would turn "should I go and smash that" from a choice
 * into an errand. Its own branch rather than the masonry one below, which would have given it stone
 * chips, a wall's debris direction, and the wall-broken announcement.
 */
function damageMortar(world: DemoWorld, cell: DemoCell, tile: DemoTile, damage: number): void {
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  burst(world.particles, "ember", cell.x + 0.5, cell.y + 0.5, 0.5, 8, {
    speed: 2.4,
    spreadZ: 2,
    size: 0.05,
    life: 0.6,
  });

  if (tile.hp > 0) {
    announce(world, `Mortar HP ${tile.hp}/${tile.maxHp}`, 1.1);
    return;
  }

  tile.kind = "open";
  tile.maxHp = 0;
  burst(world.particles, "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.55, 20, {
    speed: 3.2,
    spreadZ: 2.8,
    size: 0.06,
    life: 1.3,
  });
  burst(world.particles, "woodChip", cell.x + 0.5, cell.y + 0.5, 0.5, 12, {
    speed: 2.6,
    spreadZ: 2.2,
    size: 0.07,
    life: 1.1,
  });
  announce(world, "The mortar is wrecked - it fires no more");
}

export function damageWall(world: DemoWorld, cell: DemoCell, damage: number): void {
  const tile = tileAt(world.maze, cell.x, cell.y);

  if (!tile || tile.kind === "open" || tile.kind === "water" || tile.kind === "filled") {
    return;
  }

  if (tile.kind === "border") {
    announce(world, "The boundary brick will not break");
    return;
  }

  if (tile.kind === "barricade") {
    damageBarricade(world, cell, tile, damage);
    return;
  }

  if (tile.kind === "mortar") {
    damageMortar(world, cell, tile, damage);
    return;
  }

  const wasWood = tile.kind === "wood";
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  // Thrown outward from the face the blow came from, so the debris leaves the wall towards whoever
  // hit it rather than spraying evenly out of the middle of a solid block.
  const towardX = world.player.x - (cell.x + 0.5);
  const towardY = world.player.y - (cell.y + 0.5);
  const reach = Math.max(0.0001, Math.hypot(towardX, towardY));
  const faceX = cell.x + 0.5 + (towardX / reach) * 0.5;
  const faceY = cell.y + 0.5 + (towardY / reach) * 0.5;

  if (tile.hp > 0) {
    burst(world.particles, wasWood ? "woodChip" : "stoneChip", faceX, faceY, 0.55, 9, {
      speed: 2.4,
      spreadZ: 1.6,
      directionX: towardX / reach,
      directionY: towardY / reach,
      focus: 0.55,
      size: wasWood ? 0.07 : 0.055,
      life: 0.9,
    });
    burst(world.particles, "dust", faceX, faceY, 0.6, 5, {
      speed: 0.8,
      spreadZ: 0.9,
      gravity: 1.4,
      drag: 2.4,
      size: 0.15,
      life: 0.8,
    });
    announce(world, `${wasWood ? "Wood wall" : "Stone wall"} HP ${tile.hp}/${tile.maxHp}`, 1.1);
    return;
  }

  // The wall coming down: the whole cell's worth of material, not a face's worth.
  burst(world.particles, wasWood ? "woodChip" : "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.6, 26, {
    speed: 3.4,
    spreadZ: 3,
    size: wasWood ? 0.1 : 0.085,
    life: 1.5,
  });
  burst(world.particles, "dust", cell.x + 0.5, cell.y + 0.5, 0.7, 16, {
    speed: 1.7,
    spreadZ: 1.5,
    gravity: 1.1,
    drag: 2,
    size: 0.28,
    life: 1.6,
  });

  world.wallsBroken += 1;
  tile.kind = "open";
  tile.hp = 0;
  tile.maxHp = 0;

  // A broken wall sometimes yields its own material as ammunition — sticks are timber, rocks are
  // masonry. This is the only source of either now, so demolition is what keeps the throwing arm
  // supplied while corpses supply the special tools.
  if (Math.random() < WALL_DROP_CHANCE) {
    world.props.push({
      id: nextId(world, "prop"),
      kind: wasWood ? "stick" : "rock",
      count: 3,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
    });
  }

  announce(world, wasWood ? "The wood wall splinters!" : "The stone wall shatters!");
}

function spawnProjectile(world: DemoWorld, kind: DemoThrowKind, payload: DemoEnemy | undefined): void {
  const direction = facing(world);
  const weight = throwWeight(kind, payload?.archetype.weight);
  const range = throwRange(world, weight.range);
  // Every throw departs along the aim line: the unbent rise is the aim slope times the distance.
  // Lobbed kinds hand that rise back to gravity so they land at the end of the range; straight kinds
  // keep the slope the whole way. Weight is not allowed in this line — a heavy thing leaves the hand
  // exactly where it was pointed, and only what happens to it afterwards is its own.
  const arc = (world.player.pitch - 0.01) * range;
  world.projectiles.push({
    id: nextId(world, "shot"),
    kind,
    x: world.player.x + direction.x * THROW_SPAWN_AHEAD,
    y: world.player.y + direction.y * THROW_SPAWN_AHEAD,
    directionX: direction.x,
    directionY: direction.y,
    travelled: 0,
    range,
    speed: weight.speed,
    drag: weight.drag,
    plunge: weight.plunge,
    thud: weight.thud,
    arc,
    fall: weight.lobbed ? 0.5 + arc : 0,
    payload,
    struck: new Set<string>(),
    trail: [],
    skewered: [],
    cleaved: 0,
  });

  // What it cost to get rid of: a shove backwards along the throw and a jolt of the view. Nothing
  // else in the demo moves the player without an enemy doing it, which is exactly why heaving a
  // body registers.
  world.player.pushX -= direction.x * weight.recoil * RECOIL_SHOVE;
  world.player.pushY -= direction.y * weight.recoil * RECOIL_SHOVE;
  world.shake = Math.max(world.shake, weight.recoil * RECOIL_SHAKE);
}

function throwHeld(world: DemoWorld): void {
  const held = world.held;

  if (!held) {
    return;
  }

  if (held.kind === "enemy") {
    world.held = undefined;
    spawnProjectile(world, "enemy", held.enemy);
    announce(world, "Threw the enemy!");
    return;
  }

  // One use off the stack, not the whole hand. The hand only empties on the last one.
  const left = held.count - 1;
  world.held = left > 0 ? { kind: "prop", prop: held.prop, count: left } : undefined;
  spawnProjectile(world, held.prop, undefined);
  announce(world, left > 0 ? `${THROW_CALLS[held.prop]} (${left} left)` : THROW_CALLS[held.prop]);
}

/**
 * Pulling a trigger rather than opening a hand.
 *
 * What leaves is a bolt; what stays is the crossbow, one use lighter. When the last use goes the stock
 * remains in the hand as its own throwable, so the weapon ends by being flung at somebody rather than
 * by quietly disappearing — the same "spend the last of it" shape the femur has, arrived at from the
 * other direction.
 *
 * A shot is not a throw and must not read as one: it keeps the arm's dip so the press has weight, but
 * the object stays put, so nothing is handed to the viewmodel to animate leaving.
 */
function shootHeld(world: DemoWorld): void {
  const held = world.held;

  if (!held || held.kind !== "prop") {
    return;
  }

  const behaviour = propBehaviour(held.prop);
  const left = held.count - 1;
  world.held =
    left > 0
      ? { kind: "prop", prop: held.prop, count: left }
      : behaviour.spends
        ? { kind: "prop", prop: behaviour.spends, count: 1 }
        : undefined;
  spawnProjectile(world, "crossbowBolt", undefined);
  burst(world.particles, "ember", world.player.x, world.player.y, 0.5, 4, {
    speed: 2.2,
    spreadZ: 1.2,
    size: 0.035,
    life: 0.22,
  });
  announce(world, left > 0 ? `Bolt away! (${left} left)` : "Last bolt — only the stock now");
}

function strikeAltar(world: DemoWorld): boolean {
  if (world.altar.hp <= 0) {
    return false;
  }

  if (inFront(world, world.altar.x, world.altar.y, meleeReach(world), MELEE_ARC) === undefined) {
    return false;
  }

  world.altar.hp -= 1;
  world.terrainVersion += 1;
  // Debris leaves the stone towards whoever hit it, the same way a wall sheds it: a burst thrown
  // evenly out of the middle of a solid plinth reads as the plinth exploding rather than as a blow
  // landing on the near face of it.
  const towardX = world.player.x - world.altar.x;
  const towardY = world.player.y - world.altar.y;
  const reach = Math.max(0.0001, Math.hypot(towardX, towardY));
  const faceX = world.altar.x + (towardX / reach) * 0.34;
  const faceY = world.altar.y + (towardY / reach) * 0.34;

  if (world.altar.hp > 0) {
    burst(world.particles, "stoneChip", faceX, faceY, 0.62, 11, {
      speed: 2.8,
      spreadZ: 1.8,
      directionX: towardX / reach,
      directionY: towardY / reach,
      focus: 0.5,
      size: 0.06,
      life: 1,
    });
    // Gold with the grey: what is being broken open is the light in it, not only the masonry.
    burst(world.particles, "ember", faceX, faceY, 0.66, 7, { speed: 2.2, spreadZ: 2, size: 0.045, life: 0.7 });
    announce(world, `The altar cracks — ${world.altar.hp} more`, 1.4);
    return true;
  }

  // The last blow: the whole structure's worth of stone rather than a face's worth, and the light
  // leaving it all at once.
  burst(world.particles, "stoneChip", world.altar.x, world.altar.y, 0.6, 26, {
    speed: 3.4,
    spreadZ: 3,
    size: 0.085,
    life: 1.5,
  });
  burst(world.particles, "ember", world.altar.x, world.altar.y, 0.62, 20, {
    speed: 3.2,
    spreadZ: 3.4,
    size: 0.05,
    life: 1.1,
  });
  burst(world.particles, "dust", world.altar.x, world.altar.y, 0.5, 8, {
    speed: 0.9,
    spreadZ: 1,
    gravity: 1.4,
    drag: 2.4,
    size: 0.16,
    life: 0.9,
  });
  awardBless(world);
  return true;
}

/**
 * One swing, against everything in front of it.
 *
 * Full damage and a full shove to every body in the arc, with no falloff and no cap on how many. The
 * swing already costs the player the whole of its animation whether it meets one enemy or six, so
 * charging the same time for a sixth of the result is what made a crowd the thing to back away from
 * rather than the thing to swing into.
 *
 * Also records where it landed. The arc is drawn through the nearest of them, so a swing at something
 * on the left visibly goes left — the difference between an attack animation and a canned one.
 */
function melee(world: DemoWorld): void {
  const reach = meleeReach(world);
  const struck = sweepAhead(world, reach, MELEE_ARC);
  const nearest = struck[0];

  if (nearest) {
    const direction = facing(world);
    const knockback = hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_KNOCKBACK : 3;
    const damage = meleeDamage(world);
    // Read before the loop: a body that dies in it is spliced out of the world, and the arc still
    // has to be drawn through where the swing actually went.
    const targetX = nearest.x;
    const targetY = nearest.y;

    for (const enemy of struck) {
      enemy.pushX += direction.x * knockback;
      enemy.pushY += direction.y * knockback;
      damageEnemy(world, enemy, damage, "cleaved");
      burst(world.particles, "blood", enemy.x, enemy.y, 0.36, 6, {
        speed: 2,
        spreadZ: 2.2,
        size: 0.055,
        life: 0.9,
        directionX: direction.x,
        directionY: direction.y,
        focus: 0.4,
      });
    }

    world.swingTarget = { x: targetX, y: targetY, z: 0.34, connected: true };
    world.impact = 1;

    if (struck.length > 1) {
      announce(world, `Cleaves ${struck.length}!`, 1.2);
    }

    return;
  }

  if (strikeAltar(world)) {
    world.swingTarget = { x: world.altar.x, y: world.altar.y, z: 0.6, connected: true };
    world.impact = 1;
    return;
  }

  // A rubble pile is not a target. Swinging through one reaches whatever is behind it, so the only
  // way a pile leaves the floor is by being carried away three pieces at a time.
  const cell = wallAhead(world, reach);

  if (cell) {
    world.swingTarget = { x: cell.x + 0.5, y: cell.y + 0.5, z: 0.55, connected: true };
    world.impact = 1;
    damageWall(world, cell, MELEE_WALL_DAMAGE);
    return;
  }

  // Swung at nothing: the arc still plays, aimed straight ahead at arm's length.
  const direction = facing(world);
  world.swingTarget = {
    x: world.player.x + direction.x * reach,
    y: world.player.y + direction.y * reach,
    z: 0.5,
    connected: false,
  };
}

/**
 * Left button: one of the eight cuts, or a throw of whatever is in the hand.
 *
 * A press during a swing is ignored outright — not queued, not buffered. That is the prototype's own
 * rule and it is the whole of the input model: there is no chain to be early for, so a dropped press
 * costs the player nothing but the swing they were already watching. What it buys is that a swing is
 * one hit. Mashing used to be a whole extra hit per click, which made the animation decoration over
 * damage that had already been dealt.
 */
export function primaryAction(world: DemoWorld): void {
  if (world.status !== "playing" || world.swing > 0) {
    return;
  }

  world.swingTarget = undefined;

  if (world.held) {
    world.swingKind = "throw";
    world.swing = THROW_SWING_SECONDS;
    world.swingTotal = THROW_SWING_SECONDS;
    // A throw is over the moment the hand opens; there is no blade travelling anywhere to wait for.
    world.swingResolved = true;

    // A shooter keeps what it is holding and sends something else. Everything else opens the hand.
    if (world.held.kind === "prop" && propBehaviour(world.held.prop).use === "shoot") {
      shootHeld(world);
      return;
    }

    throwHeld(world);
    return;
  }

  // Never the cut just played, so consecutive swings always differ — the one repetition the eye
  // catches when there is no chain to give the sequence a shape.
  world.swingKind = chooseMeleeAttack(world.swingKind === "throw" ? undefined : world.swingKind).id;
  world.swing = SWING_SECONDS;
  world.swingTotal = SWING_SECONDS;
  world.swingResolved = false;
}

/**
 * The blade arrives.
 *
 * Called by the simulation partway through the animation rather than by the press, which is the only
 * reason the arm's three quarters of a second is not a lie. Everything the hit does — the damage, the
 * shove, the blood, and the point the arc is drawn through — happens here.
 */
export function resolveSwing(world: DemoWorld): void {
  if (world.status !== "playing") {
    return;
  }

  melee(world);
}

function dropHeld(world: DemoWorld): void {
  const held = world.held;

  if (!held) {
    return;
  }

  const direction = facing(world);
  const x = world.player.x + direction.x * 0.6;
  const y = world.player.y + direction.y * 0.6;
  world.held = undefined;

  if (held.kind === "enemy") {
    held.enemy.x = x;
    held.enemy.y = y;
    held.enemy.stunSeconds = Math.max(held.enemy.stunSeconds, 0.4);
    world.enemies.push(held.enemy);
    announce(world, "Dropped the enemy");
    return;
  }

  // Whatever is left of the stack goes back on the floor as one pickup, so putting something down
  // and taking it again is never a way to lose or gain uses.
  world.props.push({ id: nextId(world, "prop"), kind: held.prop, count: held.count, x, y });
  announce(world, `Dropped ${PROP_LABELS[held.prop]} x${held.count}`);
}

/** Right button: grab an enemy or a stack of ammunition — or put down what is held. */
export function grabAction(world: DemoWorld): void {
  if (world.status !== "playing") {
    return;
  }

  if (world.held) {
    dropHeld(world);
    return;
  }

  const enemy = nearestEnemyAhead(world, REACH, GRAB_ARC, (candidate) => canCarry(candidate.archetype));

  if (enemy) {
    world.enemies.splice(world.enemies.indexOf(enemy), 1);
    world.held = { kind: "enemy", enemy };
    announce(world, "Grabbed an enemy!");
    return;
  }

  const prop = nearestPropAhead(world);

  if (prop) {
    world.props.splice(world.props.indexOf(prop), 1);
    world.held = { kind: "prop", prop: prop.kind, count: prop.count };
    announce(world, `Picked up ${PROP_LABELS[prop.kind]} x${prop.count}`);
    return;
  }

  announce(world, "Nothing here to grab", 1.1);
}
