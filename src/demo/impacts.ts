/**
 * What happens where a thrown thing lands.
 *
 * Throwing is not a damage button. A rock stops where it lands and scatters whoever is near it; a
 * bomb does the obvious; a stick pierces, which is what pinning a line of enemies to a wall means.
 *
 * A thrown body is the odd one out: it does not stop for anyone. It runs down whoever is in its two
 * tiles — hurting, stunning, and shoving them aside — and then takes a swing's worth of damage
 * itself for the landing, doubled into a wall. You are spending that enemy, not shooting with it.
 */

import { BLAST_WALL_DAMAGE, thrownImpactDamage } from "@/demo/actions";
import { hasBless } from "@/demo/bless";
import { isWaterCell } from "@/demo/maze";
import { addVfx, damageEnemy, killEnemy, type DemoEnemy, type DemoWorld } from "@/demo/world";

/** How wide "near the impact" is for a rock or a thrown body. */
export const IMPACT_RADIUS = 1.2;
export const EXPLOSIVE_BODY_RADIUS = 2.4;
export const ROCK_KNOCKBACK = 8;
export const BODY_STUN_SECONDS = 1.6;
/** How hard a flying body barges someone out of its lane. */
export const BODY_SHOVE = 9;

export const BOMB_CORE_RADIUS = 2.5;
export const BOMB_CORE_DAMAGE = 60;
export const BOMB_PUSH_RADIUS = 5;
export const BOMB_PUSH = 14;

export const CHAIN_RADIUS = 3.5;
export const CHAIN_CHANCE = 0.5;
export const CHAIN_DAMAGE = 20;
export const CHAIN_MAX_HOPS = 6;

export const DROWN_SECONDS = 1.1;

/** Sends a body outward from a point. Knockback ignores water, which is what makes water lethal. */
export function knockBack(enemy: DemoEnemy, fromX: number, fromY: number, force: number): void {
  const dx = enemy.x - fromX;
  const dy = enemy.y - fromY;
  const distance = Math.hypot(dx, dy);

  if (distance < 0.0001) {
    enemy.pushX += force;
    return;
  }

  enemy.pushX += (dx / distance) * force;
  enemy.pushY += (dy / distance) * force;
}

/** Starts the sink if a body has ended up over a pool. Nothing walks here by choice. */
export function checkDrowning(world: DemoWorld, enemy: DemoEnemy): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  if (!isWaterCell(world.maze, Math.floor(enemy.x), Math.floor(enemy.y))) {
    return;
  }

  enemy.drowningSeconds = DROWN_SECONDS;
  enemy.pushX = 0;
  enemy.pushY = 0;
  enemy.intent = "none";
  enemy.windupSeconds = 0;
  enemy.chargeSeconds = 0;
}

function enemiesWithin(world: DemoWorld, x: number, y: number, radius: number): DemoEnemy[] {
  return world.enemies.filter((enemy) => enemy.drowningSeconds <= 0 && Math.hypot(enemy.x - x, enemy.y - y) <= radius);
}

/**
 * Chain lightning: every enemy struck rolls to pass it on, and whoever it passes to rolls again.
 *
 * Written as a queue rather than recursion so the hop limit is a real bound on the whole cascade
 * rather than a bound on one branch of it.
 */
export function chainLightning(world: DemoWorld, seeds: readonly DemoEnemy[]): void {
  const visited = new Set(seeds.map((enemy) => enemy.id));
  let frontier = [...seeds];

  for (let hop = 0; hop < CHAIN_MAX_HOPS && frontier.length > 0; hop += 1) {
    const next: DemoEnemy[] = [];

    for (const source of frontier) {
      for (const target of enemiesWithin(world, source.x, source.y, CHAIN_RADIUS)) {
        if (visited.has(target.id) || Math.random() > CHAIN_CHANCE) {
          continue;
        }

        visited.add(target.id);
        addVfx(world, {
          kind: "arc",
          fromX: source.x,
          fromY: source.y,
          toX: target.x,
          toY: target.y,
          age: 0,
          life: 0.3,
        });
        damageEnemy(world, target, CHAIN_DAMAGE);
        next.push(target);
      }
    }

    frontier = next;
  }
}

/** Damages every breakable wall whose cell centre falls inside a blast. */
function shatterWalls(
  world: DemoWorld,
  x: number,
  y: number,
  radius: number,
  damageWall: (cell: { x: number; y: number }, damage: number) => void,
): void {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);

  for (let cellY = minY; cellY <= maxY; cellY += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      const tile = world.maze.tiles[cellY * world.maze.size + cellX];

      if (!tile || (tile.kind !== "wood" && tile.kind !== "stone")) {
        continue;
      }

      if (Math.hypot(cellX + 0.5 - x, cellY + 0.5 - y) <= radius) {
        damageWall({ x: cellX, y: cellY }, BLAST_WALL_DAMAGE);
      }
    }
  }
}

export function detonate(
  world: DemoWorld,
  x: number,
  y: number,
  damageWall: (cell: { x: number; y: number }, damage: number) => void,
): void {
  addVfx(world, { kind: "blast", x, y, radius: BOMB_CORE_RADIUS, age: 0, life: 0.42 });

  for (const enemy of enemiesWithin(world, x, y, BOMB_PUSH_RADIUS)) {
    const distance = Math.hypot(enemy.x - x, enemy.y - y);

    if (distance <= BOMB_CORE_RADIUS) {
      knockBack(enemy, x, y, BOMB_PUSH * 0.6);
      damageEnemy(world, enemy, BOMB_CORE_DAMAGE);
      continue;
    }

    // Outside the core the blast only moves things — which, next to a pool, is worse than damage.
    knockBack(enemy, x, y, BOMB_PUSH);
  }

  shatterWalls(world, x, y, BOMB_CORE_RADIUS, damageWall);
}

/** A rock landing: everyone in a small radius takes a swing's worth and gets scattered. */
export function rockImpact(world: DemoWorld, x: number, y: number): void {
  const struck = enemiesWithin(world, x, y, IMPACT_RADIUS);

  for (const enemy of struck) {
    knockBack(enemy, x, y, ROCK_KNOCKBACK);
    damageEnemy(world, enemy, thrownImpactDamage(world));
  }

  if (struck.length > 0 && hasBless(world.bless, "stormStone")) {
    chainLightning(
      world,
      struck.filter((enemy) => world.enemies.includes(enemy)),
    );
  }
}

/**
 * Runs someone down with a flying body: hurt, stunned, and knocked to one side.
 *
 * The shove is perpendicular to the flight rather than along it. Pushing them the way the body is
 * already going would just herd them ahead of the throw, which is the opposite of clearing a path.
 */
export function bargeInto(
  world: DemoWorld,
  enemy: DemoEnemy,
  atX: number,
  atY: number,
  directionX: number,
  directionY: number,
): void {
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const lean = (enemy.x - atX) * perpendicularX + (enemy.y - atY) * perpendicularY;
  const side = lean >= 0 ? 1 : -1;
  enemy.pushX += perpendicularX * side * BODY_SHOVE;
  enemy.pushY += perpendicularY * side * BODY_SHOVE;
  enemy.stunSeconds = Math.max(enemy.stunSeconds, BODY_STUN_SECONDS);
  damageEnemy(world, enemy, thrownImpactDamage(world));
}

/**
 * What a thrown body suffers on arrival.
 *
 * The body is the thing that gets hurt here, not what it landed among: it takes a bare swing's worth
 * for the fall, doubled if a wall stopped it. Throwing an enemy is therefore a way to spend that
 * enemy — hardest into a wall — rather than a way to damage the ones it flew past.
 *
 * The blessed version keeps its detonation, which is the whole reason that blessing exists.
 */
export function bodyLanding(world: DemoWorld, thrown: DemoEnemy, hitWall: boolean): void {
  const explosive = hasBless(world.bless, "explosiveBody");
  thrown.stunSeconds = Math.max(thrown.stunSeconds, BODY_STUN_SECONDS);

  if (explosive) {
    const radius = EXPLOSIVE_BODY_RADIUS;
    addVfx(world, { kind: "blast", x: thrown.x, y: thrown.y, radius, age: 0, life: 0.34 });

    for (const enemy of enemiesWithin(world, thrown.x, thrown.y, radius)) {
      if (enemy === thrown) {
        continue;
      }

      knockBack(enemy, thrown.x, thrown.y, ROCK_KNOCKBACK);
      damageEnemy(world, enemy, thrownImpactDamage(world) * 2);
    }
  }

  damageEnemy(world, thrown, thrownImpactDamage(world) * (hitWall ? 2 : 1));
}

/** Sinks anything already drowning, and finishes it when the water closes over. */
export function stepDrowning(world: DemoWorld, deltaSeconds: number): void {
  for (const enemy of world.enemies.slice()) {
    if (enemy.drowningSeconds <= 0) {
      continue;
    }

    enemy.drowningSeconds -= deltaSeconds;

    if (enemy.drowningSeconds <= 0) {
      killEnemy(world, enemy);
    }
  }
}
