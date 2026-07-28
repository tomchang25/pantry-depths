/**
 * Player actions: the left button and the right button, and everything they can land on.
 *
 * Left is attack-or-throw, right is grab-or-drop. Which of those two a press resolves to depends
 * only on whether the hands are full, so neither button ever needs a modifier.
 */

import { hasBless } from "@/demo/bless";
import { blocksSight, tileAt, type DemoCell } from "@/demo/maze";
import { burst } from "@/demo/particles";
import {
  announce,
  awardBless,
  damageEnemy,
  nextId,
  randomAmmo,
  MELEE_CYCLE,
  REACH,
  SWING_SECONDS,
  type DemoEnemy,
  type DemoPile,
  type DemoProp,
  type DemoPropKind,
  type DemoThrowKind,
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

/**
 * A thrown body always travels the same two tiles: the throw is a placement, not a ranged attack.
 * The javelin is the opposite — it is given more range than the map has, because what stops it is
 * meant to be a wall, never the throw running out of arm.
 */
const THROW_RANGE: Readonly<Record<DemoThrowKind, number>> = { enemy: 2, stick: 40, rock: 8, bomb: 9, axe: 10 };
const THROW_SPEED: Readonly<Record<DemoThrowKind, number>> = { enemy: 11, stick: 22, rock: 14, bomb: 12, axe: 16 };

/** How many victims each of the two piercing throws is allowed. */
export const JAVELIN_CAPACITY = 3;
export const AXE_CAPACITY = 3;

export const PROP_LABELS: Readonly<Record<DemoPropKind, string>> = {
  stick: "木刺",
  rock: "石塊",
  bomb: "炸彈",
  axe: "飛斧",
};

const THROW_CALLS: Readonly<Record<DemoPropKind, string>> = {
  stick: "木刺標槍射出去了",
  rock: "石塊砸出去了",
  bomb: "炸彈扔出去了",
  axe: "飛斧旋轉飛出",
};

export const PILE_LABELS: Readonly<Record<DemoPropKind, string>> = {
  stick: "木材堆",
  rock: "石材堆",
  bomb: "炸彈堆",
  axe: "飛斧堆",
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

export function projectileSpeed(kind: DemoThrowKind): number {
  return THROW_SPEED[kind];
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

function nearestPileAhead(world: DemoWorld): DemoPile | undefined {
  let best: DemoPile | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const pile of world.piles) {
    const distance = inFront(world, pile.x, pile.y, REACH, GRAB_ARC);

    if (distance !== undefined && distance < bestDistance) {
      best = pile;
      bestDistance = distance;
    }
  }

  return best;
}

/** The wall cell the player is looking at within arm's length, if any. */
export function wallAhead(world: DemoWorld, reach = REACH): DemoCell | undefined {
  const direction = facing(world);
  const steps = Math.max(4, Math.round(reach * 4));

  for (let step = 1; step <= steps; step += 1) {
    const along = (step / steps) * reach;
    const x = Math.floor(world.player.x + direction.x * along);
    const y = Math.floor(world.player.y + direction.y * along);

    if (blocksSight(world.maze, x, y)) {
      return { x, y };
    }
  }

  return undefined;
}

export function damageWall(world: DemoWorld, cell: DemoCell, damage: number): void {
  const tile = tileAt(world.maze, cell.x, cell.y);

  if (!tile || tile.kind === "open" || tile.kind === "water") {
    return;
  }

  if (tile.kind === "border") {
    announce(world, "最外圈磚牆打不破");
    return;
  }

  const wasWood = tile.kind === "wood";
  tile.hp = Math.max(0, tile.hp - damage);
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
    announce(world, `${wasWood ? "木牆" : "石牆"} HP ${tile.hp}/${tile.maxHp}`, 1.1);
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

  tile.kind = "open";
  tile.hp = 0;
  world.wallsBroken += 1;

  // Stone is only ever a shortcut; wood is the whole supply line. Which of the three stashes a wood
  // wall was hiding is rolled here, once, so the pile that appears already says what it holds.
  if (!wasWood) {
    announce(world, "石牆碎了");
    return;
  }

  const ammo = randomAmmo();
  world.piles.push({ id: nextId(world, "pile"), ammo, x: cell.x + 0.5, y: cell.y + 0.5, remaining: 3 });
  announce(world, `木牆碎了，露出${PILE_LABELS[ammo]}`);
}

function spawnProjectile(world: DemoWorld, kind: DemoThrowKind, payload: DemoEnemy | undefined): void {
  const direction = facing(world);
  world.projectiles.push({
    id: nextId(world, "shot"),
    kind,
    x: world.player.x + direction.x * 0.4,
    y: world.player.y + direction.y * 0.4,
    directionX: direction.x,
    directionY: direction.y,
    travelled: 0,
    range: THROW_RANGE[kind],
    payload,
    struck: new Set<string>(),
    trail: [],
    skewered: [],
    cleaved: 0,
  });
}

function throwHeld(world: DemoWorld): void {
  const held = world.held;

  if (!held) {
    return;
  }

  world.held = undefined;

  if (held.kind === "enemy") {
    spawnProjectile(world, "enemy", held.enemy);
    announce(world, "把敵人扔出去了");
    return;
  }

  spawnProjectile(world, held.prop, undefined);
  announce(world, THROW_CALLS[held.prop]);
}

function strikeAltar(world: DemoWorld): boolean {
  if (world.altar.hp <= 0) {
    return false;
  }

  if (inFront(world, world.altar.x, world.altar.y, meleeReach(world), MELEE_ARC) === undefined) {
    return false;
  }

  world.altar.hp -= 1;

  if (world.altar.hp > 0) {
    announce(world, `祭壇裂了，再 ${world.altar.hp} 下`, 1.4);
    return true;
  }

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
    damageEnemy(world, enemy, meleeDamage(world));
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
    announce(world, "放下敵人");
    return;
  }

  world.props.push({ id: nextId(world, "prop"), kind: held.prop, x, y });
  announce(world, `放下${PROP_LABELS[held.prop]}`);
}

function takeFromPile(world: DemoWorld, pile: DemoPile): void {
  pile.remaining -= 1;
  world.held = { kind: "prop", prop: pile.ammo };

  if (pile.remaining <= 0) {
    world.piles.splice(world.piles.indexOf(pile), 1);
    announce(world, `撿走最後一件${PROP_LABELS[pile.ammo]}，堆空了`);
    return;
  }

  announce(world, `撿起${PROP_LABELS[pile.ammo]}（堆裡還有 ${pile.remaining} 件）`);
}

/** Right button: grab an enemy, a loose prop, or one piece of an ammunition pile — or drop. */
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
    announce(world, "抓住了一隻敵人");
    return;
  }

  const prop = nearestPropAhead(world);

  if (prop) {
    world.props.splice(world.props.indexOf(prop), 1);
    world.held = { kind: "prop", prop: prop.kind };
    announce(world, `撿起${PROP_LABELS[prop.kind]}`);
    return;
  }

  const pile = nearestPileAhead(world);

  if (pile) {
    takeFromPile(world, pile);
    return;
  }

  announce(world, "前面沒有東西可以抓", 1.1);
}
