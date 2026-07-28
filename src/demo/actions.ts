/**
 * Player actions: the left button and the right button, and everything they can land on.
 *
 * Left is attack-or-throw, right is grab-or-drop. Which of those two a press resolves to depends
 * only on whether the hands are full, so neither button ever needs a modifier.
 */

import { hasBless } from "@/demo/bless";
import { blocksProjectile, tileAt, type DemoCell, type DemoTile } from "@/demo/maze";
import { burst } from "@/demo/particles";
import {
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
  MELEE_CYCLE,
  REACH,
  SWING_SECONDS,
  type DemoEnemy,
  type DemoHeld,
  type DemoProp,
  type DemoWorld,
} from "@/demo/world";

const BASE_MELEE_DAMAGE = 25;
const HEAVY_MELEE_DAMAGE = 45;
const HEAVY_MELEE_REACH = 2.1;
const HEAVY_MELEE_KNOCKBACK = 9;
const MELEE_ARC = Math.cos(0.85);
const GRAB_ARC = Math.cos(1);

/**
 * What each way of hitting a wall costs it, against the hit points in `@/demo/maze`.
 *
 * A bare swing is the unit, so the swing counts are unchanged: two for wood, four for stone. A
 * thrown stick hits for two; a thrown rock hits for four, which opens either wall in one throw.
 */
export const MELEE_WALL_DAMAGE = 1;
const THROWN_WALL_DAMAGE = 2;
const ROCK_WALL_DAMAGE = 4;
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

/** How many victims each of the two piercing throws is allowed. */
export const JAVELIN_CAPACITY = 3;
export const AXE_CAPACITY = 3;

export const PROP_LABELS: Readonly<Record<DemoPropKind, string>> = {
  stick: "Stakes",
  rock: "Rocks",
  bomb: "Bombs",
  axe: "Axe",
};

const THROW_CALLS: Readonly<Record<DemoPropKind, string>> = {
  stick: "Stake away!",
  rock: "Rock away!",
  bomb: "Bomb away!",
  axe: "Axe away!",
};

export function meleeReach(world: DemoWorld): number {
  return hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_REACH : REACH;
}

export function meleeDamage(world: DemoWorld): number {
  return hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_DAMAGE : BASE_MELEE_DAMAGE;
}

/** The damage a thrown object does on contact — the same as a bare swing, blessings aside. */
export function thrownImpactDamage(world: DemoWorld): number {
  return meleeDamage(world);
}

export function thrownWallDamage(kind: DemoThrowKind): number {
  return kind === "rock" ? ROCK_WALL_DAMAGE : THROWN_WALL_DAMAGE;
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

function nearestEnemyAhead(world: DemoWorld, reach: number, arc: number): DemoEnemy | undefined {
  let best: DemoEnemy | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0) {
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
 * One swing.
 *
 * Also records where it landed. The arm animation and the arc are drawn through that point, so a
 * swing at something on your left visibly goes left — which is the difference between an attack
 * animation and a canned one.
 */
function melee(world: DemoWorld): void {
  const reach = meleeReach(world);
  const enemy = nearestEnemyAhead(world, reach, MELEE_ARC);

  if (enemy) {
    const direction = facing(world);
    const knockback = hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_KNOCKBACK : 3;
    enemy.pushX += direction.x * knockback;
    enemy.pushY += direction.y * knockback;
    damageEnemy(world, enemy, meleeDamage(world), "cleaved");
    world.swingTarget = { x: enemy.x, y: enemy.y, z: 0.34, connected: true };
    world.impact = 1;
    burst(world.particles, "blood", enemy.x, enemy.y, 0.36, 6, {
      speed: 2,
      spreadZ: 2.2,
      size: 0.055,
      life: 0.9,
      directionX: direction.x,
      directionY: direction.y,
      focus: 0.4,
    });
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

/** Left button: throw what is held, otherwise swing. */
export function primaryAction(world: DemoWorld): void {
  if (world.status !== "playing") {
    return;
  }

  world.swing = SWING_SECONDS;
  world.swingTarget = undefined;

  if (world.held) {
    world.swingKind = "throw";
    throwHeld(world);
    return;
  }

  world.swingKind = MELEE_CYCLE[world.swingStep % MELEE_CYCLE.length] ?? "slash";
  world.swingStep += 1;
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

  const enemy = nearestEnemyAhead(world, REACH, GRAB_ARC);

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
