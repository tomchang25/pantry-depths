/**
 * Player actions: the left button and the right button, and everything they can land on.
 *
 * Left is attack-or-throw, right is grab-or-drop. Which of those two a press resolves to depends
 * only on whether the hands are full, so neither button ever needs a modifier.
 */

import { isSolidCell, tileAt, type DemoCell } from "@/demo/maze";
import {
  announce,
  damageEnemy,
  nextId,
  REACH,
  SWING_SECONDS,
  type DemoEnemy,
  type DemoPile,
  type DemoProp,
  type DemoPropKind,
  type DemoWorld,
} from "@/demo/world";

const MELEE_DAMAGE = 25;

/**
 * What each way of hitting a wall costs it, against the hit points in `@/demo/maze`.
 *
 * A bare swing is the unit, so the swing counts are unchanged: two for wood, four for stone. Any
 * thrown object hits for two, which is one throw through wood and two through stone. A thrown
 * boulder hits for four, which is one throw through either.
 */
export const MELEE_WALL_DAMAGE = 1;
const THROWN_WALL_DAMAGE = 2;
const BOULDER_WALL_DAMAGE = 4;
const MELEE_ARC = Math.cos(0.85);
const GRAB_ARC = Math.cos(1.0);

const THROW_RANGE: Readonly<Record<"enemy" | DemoPropKind, number>> = {
  enemy: 9,
  stick: 6,
  smallRock: 4,
  bigRock: 8,
};

const THROW_SPEED: Readonly<Record<"enemy" | DemoPropKind, number>> = {
  enemy: 11,
  stick: 18,
  smallRock: 15,
  bigRock: 12,
};

const SMALL_ROCK_CONE = Math.cos(0.55);
const SMALL_ROCK_DAMAGE = 12;
const SMALL_ROCK_KNOCKBACK = 7.5;

export const PROP_LABELS: Readonly<Record<DemoPropKind, string>> = {
  stick: "木棍",
  smallRock: "小石塊",
  bigRock: "大石塊",
};

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
export function wallAhead(world: DemoWorld): DemoCell | undefined {
  const direction = facing(world);

  for (const step of [0.5, 0.75, 1.0, 1.25]) {
    const x = Math.floor(world.player.x + direction.x * step);
    const y = Math.floor(world.player.y + direction.y * step);

    if (isSolidCell(world.maze, x, y)) {
      return { x, y };
    }
  }

  return undefined;
}

/** What a thrown object of this kind costs a wall. A thrown enemy counts as an ordinary object. */
export function thrownWallDamage(kind: "enemy" | DemoPropKind): number {
  return kind === "bigRock" ? BOULDER_WALL_DAMAGE : THROWN_WALL_DAMAGE;
}

export function damageWall(world: DemoWorld, cell: DemoCell, damage: number): void {
  const tile = tileAt(world.maze, cell.x, cell.y);

  if (!tile || tile.kind === "open") {
    return;
  }

  if (tile.kind === "border") {
    announce(world, "最外圈磚牆打不破");
    return;
  }

  const wasWood = tile.kind === "wood";
  tile.hp = Math.max(0, tile.hp - damage);

  if (tile.hp > 0) {
    announce(world, `${wasWood ? "木牆" : "石牆"} HP ${tile.hp}/${tile.maxHp}`, 1.1);
    return;
  }

  tile.kind = "open";
  tile.hp = 0;
  world.wallsBroken += 1;
  world.piles.push({
    id: nextId(world, "pile"),
    kind: wasWood ? "woodSpikes" : "rocks",
    x: cell.x + 0.5,
    y: cell.y + 0.5,
    remaining: 3,
  });
  announce(world, wasWood ? "木牆碎了，留下木刺堆" : "石牆碎了，留下大石頭堆");
}

function spawnProjectile(world: DemoWorld, kind: "enemy" | DemoPropKind, payload: DemoEnemy | undefined): void {
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
    inert: kind === "smallRock",
  });
}

export function projectileSpeed(kind: "enemy" | DemoPropKind): number {
  return THROW_SPEED[kind];
}

function burstSmallRock(world: DemoWorld): void {
  const direction = facing(world);
  let struck = 0;

  // Snapshot: a lethal burst splices the live array out from under the loop.
  for (const enemy of world.enemies.slice()) {
    const toX = enemy.x - world.player.x;
    const toY = enemy.y - world.player.y;
    const distance = Math.hypot(toX, toY);

    if (distance > THROW_RANGE.smallRock || distance < 0.0001) {
      continue;
    }

    if ((toX / distance) * direction.x + (toY / distance) * direction.y < SMALL_ROCK_CONE) {
      continue;
    }

    enemy.pushX += (toX / distance) * SMALL_ROCK_KNOCKBACK;
    enemy.pushY += (toY / distance) * SMALL_ROCK_KNOCKBACK;
    damageEnemy(world, enemy, SMALL_ROCK_DAMAGE);
    struck += 1;
  }

  announce(world, struck > 0 ? `碎石扇形擊退 ${struck} 隻` : "碎石打空了");
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

  if (held.prop === "smallRock") {
    burstSmallRock(world);
    spawnProjectile(world, "smallRock", undefined);
    return;
  }

  spawnProjectile(world, held.prop, undefined);
  announce(world, held.prop === "stick" ? "木棍飛出去了" : "大石塊砸出去了");
}

function melee(world: DemoWorld): void {
  const enemy = nearestEnemyAhead(world, REACH, MELEE_ARC);

  if (enemy) {
    const direction = facing(world);
    enemy.pushX += direction.x * 3;
    enemy.pushY += direction.y * 3;
    damageEnemy(world, enemy, MELEE_DAMAGE);
    return;
  }

  const pile = nearestPileAhead(world);

  if (pile) {
    world.piles.splice(world.piles.indexOf(pile), 1);
    announce(world, pile.kind === "woodSpikes" ? "木刺堆被打散了" : "石頭堆被打散了");
    return;
  }

  const cell = wallAhead(world);

  if (cell) {
    damageWall(world, cell, MELEE_WALL_DAMAGE);
  }
}

/** Left button: throw what is held, otherwise swing. */
export function primaryAction(world: DemoWorld): void {
  if (world.status !== "playing") {
    return;
  }

  world.swing = SWING_SECONDS;
  world.swingKind = world.held ? "throw" : "melee";

  if (world.held) {
    throwHeld(world);
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
    announce(world, "放下敵人");
    return;
  }

  world.props.push({ id: nextId(world, "prop"), kind: held.prop, x, y });
  announce(world, `放下${PROP_LABELS[held.prop]}`);
}

function takeFromPile(world: DemoWorld, pile: DemoPile): void {
  const kind: DemoPropKind = pile.kind === "woodSpikes" ? "stick" : pile.remaining === 3 ? "bigRock" : "smallRock";
  pile.remaining -= 1;
  world.held = { kind: "prop", prop: kind };

  if (pile.remaining <= 0) {
    world.piles.splice(world.piles.indexOf(pile), 1);
    announce(world, `撿走最後一塊，堆消失了（${PROP_LABELS[kind]}）`);
    return;
  }

  announce(world, `從堆裡撿起${PROP_LABELS[kind]}（還剩 ${pile.remaining} 次）`);
}

/** Right button: grab an enemy, a loose prop, or one piece of a rubble pile — or drop what is held. */
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
