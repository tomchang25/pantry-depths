/**
 * What happens where a thrown thing lands.
 *
 * Throwing is not a damage button. A rock stops where it lands and scatters whoever is near it; a
 * bomb does the obvious; a stick pierces, which is what pinning one enemy to a wall means.
 *
 * A thrown body is the odd one out: it does not stop for anyone. It runs down whoever is in its two
 * tiles — hurting, stunning, and shoving them aside — and then takes a swing's worth of damage
 * itself for the landing, doubled into a wall. You are spending that enemy, not shooting with it.
 */

import { BLAST_WALL_DAMAGE, thrownImpactDamage } from "@/demo/actions";
import { hasBless } from "@/demo/bless";
import { isBarricadeCell, isWaterCell } from "@/demo/maze";
import { burst } from "@/demo/particles";
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

/** How far a landing still shakes the view, in cells. Beyond it the floor has taken the whole thump. */
const LANDING_HEARD_WITHIN = 9;

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

/**
 * Resolves a body arriving somewhere it did not choose to be.
 *
 * Two hazards, one check, because they are reached the same way: nothing walks into either, so
 * anything standing in one was put there by a knockback, a throw, or a charge that overshot.
 */
export function checkHazards(world: DemoWorld, enemy: DemoEnemy): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);

  if (isBarricadeCell(world.maze, cellX, cellY)) {
    impale(world, enemy);
    return;
  }

  if (!isWaterCell(world.maze, cellX, cellY)) {
    return;
  }

  enemy.drowningSeconds = DROWN_SECONDS;
  enemy.pushX = 0;
  enemy.pushY = 0;
  enemy.intent = "none";
  enemy.windupSeconds = 0;
  enemy.chargeSeconds = 0;
  // The moment of going in, wherever it was reached from — thrown, shoved, or a charge that
  // overran. Everything else about a drowning is slow and quiet, so the entry is the only chance
  // there is to show that something just hit the water.
  burst(world.particles, "splash", enemy.x, enemy.y, 0.12, 16, {
    speed: 2.4,
    spreadZ: 2.8,
    gravity: 9,
    drag: 0.7,
    size: 0.055,
    life: 0.7,
  });
}

/** Anything shoved onto the spikes dies there and then, run through where it landed. */
function impale(world: DemoWorld, enemy: DemoEnemy): void {
  burst(world.particles, "blood", enemy.x, enemy.y, 0.4, 16, {
    speed: 2.4,
    spreadZ: 2.6,
    size: 0.06,
    life: 1.2,
  });
  burst(world.particles, "ember", enemy.x, enemy.y, 0.45, 6, { speed: 2, spreadZ: 1.8, size: 0.04, life: 0.5 });
  killEnemy(world, enemy, "impaled");
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

      // Barricades and mortars included: a blast that flattens a stone wall but leaves the iron
      // spikes in front of it standing would read as the spikes being scenery, and the same goes for
      // an emplacement that shrugs off a bomb dropped at its feet.
      if (
        !tile ||
        (tile.kind !== "wood" && tile.kind !== "stone" && tile.kind !== "barricade" && tile.kind !== "mortar")
      ) {
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
      damageEnemy(world, enemy, BOMB_CORE_DAMAGE, "blasted");
      continue;
    }

    // Outside the core the blast only moves things — which, next to a pool, is worse than damage.
    knockBack(enemy, x, y, BOMB_PUSH);
  }

  shatterWalls(world, x, y, BOMB_CORE_RADIUS, damageWall);
}

/** How hard a shell scatters what it does not kill. Well under a bomb's, which is enough near a pool. */
export const SHELL_PUSH = 7;

/**
 * A shell coming down, and the one damage call in the demo that does not care whose side anyone is on.
 *
 * Deliberately no test for which body this is. The emplacement picked its mark from everything on the
 * floor without a preference, and the blast has to honour that or the whole point of it — a hazard
 * the player can position themselves against and bait a crowd onto — quietly becomes another enemy.
 *
 * Anything it kills counts as the player's kill, because it goes out through the same exit every
 * other death does. Lining a crowd up under a mark is a way of playing this, not a way around it.
 *
 * The player's half of that arrives as a parameter rather than an import, for the same reason the
 * blast takes its wall damage that way: enemy behaviour owns what a hit does to the player and this
 * module owns what a radius does to a crowd, and having each reach into the other makes a cycle the
 * boundary check refuses.
 */
export function shellImpact(
  world: DemoWorld,
  x: number,
  y: number,
  damage: number,
  radius: number,
  hurtPlayer: (world: DemoWorld, amount: number, fromX: number, fromY: number) => void,
): void {
  addVfx(world, { kind: "blast", x, y, radius, age: 0, life: 0.36 });
  burst(world.particles, "dust", x, y, 0.2, 14, {
    speed: 3,
    spreadZ: 2.2,
    gravity: 2.6,
    drag: 2.4,
    size: 0.15,
    life: 0.8,
  });
  burst(world.particles, "ember", x, y, 0.25, 10, { speed: 3.4, spreadZ: 2.8, size: 0.05, life: 0.6 });

  for (const enemy of enemiesWithin(world, x, y, radius)) {
    knockBack(enemy, x, y, SHELL_PUSH);
    damageEnemy(world, enemy, damage, "blasted");
  }

  if (Math.hypot(world.player.x - x, world.player.y - y) <= radius) {
    hurtPlayer(world, damage, x, y);
  }
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
  heft = 1,
): void {
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const lean = (enemy.x - atX) * perpendicularX + (enemy.y - atY) * perpendicularY;
  const side = lean >= 0 ? 1 : -1;
  enemy.pushX += perpendicularX * side * BODY_SHOVE * heft;
  enemy.pushY += perpendicularY * side * BODY_SHOVE * heft;
  enemy.stunSeconds = Math.max(enemy.stunSeconds, BODY_STUN_SECONDS);
  damageEnemy(world, enemy, thrownImpactDamage(world));
}

/**
 * The arrival itself, as distinct from what it costs whoever arrived.
 *
 * Dust off the floor and a jolt of the view, both scaled by what landed. The jolt falls away with
 * distance because it is the floor carrying it: a body dropped across the room is a thump you hear
 * about, and one dropped at your feet is one you feel.
 */
function arrival(world: DemoWorld, x: number, y: number, thud: number): void {
  if (thud <= 0) {
    return;
  }

  // Nothing kicks dust off a pool. A body that came down in one has already thrown its splash on the
  // way in, and the jolt below is still owed either way — the floor carries it just the same.
  if (!isWaterCell(world.maze, Math.floor(x), Math.floor(y))) {
    burst(world.particles, "dust", x, y, 0.16, Math.round(4 + thud * 7), {
      speed: 1.5 * thud,
      spreadZ: 0.9,
      gravity: 2.2,
      drag: 2.6,
      size: 0.13,
      life: 0.6,
    });
  }

  const nearness = Math.max(0, 1 - Math.hypot(x - world.player.x, y - world.player.y) / LANDING_HEARD_WITHIN);
  world.shake = Math.max(world.shake, thud * nearness);
}

/** How a throw ended: what stopped it, how heavy it was, and which way it was going when it did. */
export type BodyLanding = Readonly<{
  hitWall: boolean;
  thud: number;
  directionX: number;
  directionY: number;
}>;

/**
 * What a thrown body suffers on arrival.
 *
 * The body is the thing that gets hurt here, not what it landed among: it takes a bare swing's worth
 * for the fall, doubled if a wall stopped it. Throwing an enemy is therefore a way to spend that
 * enemy — hardest into a wall — rather than a way to damage the ones it flew past.
 *
 * A wall is also the one landing that decides how the body ends: at that speed there is nothing left
 * to fall over, so the death is the mark it leaves rather than a corpse on the floor. That is the
 * same end a javelin gives, and it comes through the same cause.
 *
 * The blessed version keeps its detonation, which is the whole reason that blessing exists.
 */
export function bodyLanding(world: DemoWorld, thrown: DemoEnemy, landing: BodyLanding): void {
  const explosive = hasBless(world.bless, "explosiveBody");
  const hitWall = landing.hitWall;
  thrown.stunSeconds = Math.max(thrown.stunSeconds, BODY_STUN_SECONDS);
  arrival(world, thrown.x, thrown.y, landing.thud * (hitWall ? 1.3 : 1));

  if (explosive) {
    const radius = EXPLOSIVE_BODY_RADIUS;
    addVfx(world, { kind: "blast", x: thrown.x, y: thrown.y, radius, age: 0, life: 0.34 });

    for (const enemy of enemiesWithin(world, thrown.x, thrown.y, radius)) {
      if (enemy === thrown) {
        continue;
      }

      knockBack(enemy, thrown.x, thrown.y, ROCK_KNOCKBACK);
      damageEnemy(world, enemy, thrownImpactDamage(world) * 2, "blasted");
    }
  }

  damageEnemy(world, thrown, thrownImpactDamage(world) * (hitWall ? 2 : 1), hitWall ? "splattered" : "slain", {
    x: landing.directionX,
    y: landing.directionY,
  });
}

/** Sinks anything already drowning, and finishes it when the water closes over. */
export function stepDrowning(world: DemoWorld, deltaSeconds: number): void {
  for (const enemy of world.enemies.slice()) {
    if (enemy.drowningSeconds <= 0) {
      continue;
    }

    enemy.drowningSeconds -= deltaSeconds;

    if (enemy.drowningSeconds <= 0) {
      killEnemy(world, enemy, "drowned");
    }
  }
}
