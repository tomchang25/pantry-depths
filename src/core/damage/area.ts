/**
 * What happens where a thrown thing lands, and what an area of effect covers.
 *
 * The executor above the three damage owners and the only module that composes all of them. It decides
 * who a radius reaches and what each arrival is worth; the owners apply it.
 *
 * The two collaborators used to arrive as parameters, because reaching player damage and structure
 * damage from here would have made an import cycle back when both lived inside the modules that call
 * this one. Both are owners of their own now, below this module in the stack, so the injection is gone
 * and the call direction is plain.
 */

import { thrownImpactDamage } from "@/core/combat/actions";
import { damageEnemy, killEnemy } from "@/core/damage/enemy-damage";
import { hurtPlayer } from "@/core/damage/player-damage";
import { BLAST_WALL_DAMAGE, damageWall } from "@/core/damage/structure-damage";
import { addVfx, raiseSfx } from "@/core/feedback/run-feedback";
import { stunEnemy, type Enemy } from "@/core/enemy/enemy-state";
import { hasBless } from "@/core/progression/bless";
import { isBarricadeCell, isTrenchCell, isWaterCell, tileIndex } from "@/core/floor/maze";
import { burst } from "@/core/combat/particles";

import type { World } from "@/core/world/world";

/** How wide "near the impact" is for a rock or a thrown enemy. */
export const IMPACT_RADIUS = 1.2;
export const EXPLOSIVE_BODY_RADIUS = 2.4;
export const ROCK_KNOCKBACK = 8;
export const BODY_STUN_SECONDS = 1.6;
/** How hard a flying enemy barges someone out of its lane. */
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

/** How hard a shell scatters what it does not kill. Well under a bomb's, which is enough near a pool. */
export const SHELL_PUSH = 7;

/** How far a landing still shakes the view, in cells. Beyond it the floor has taken the whole impact. */
const LANDING_HEARD_WITHIN = 9;

/** Sends an enemy outward from a point. Knockback ignores water, which is what makes water lethal. */
export function knockBack(enemy: Enemy, fromX: number, fromY: number, force: number): void {
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
 * Resolves an enemy arriving somewhere it did not choose to be.
 *
 * Three hazards, one check, because they are reached the same way: nothing walks into any of them, so
 * anything standing in one was put there by a knockback, a throw, or a charge that overshot.
 *
 * Two of the three take it down rather than killing it where it stands, and they take the same time to
 * do it — the difference between a pool and a trench is what is on the way in and what the ground is
 * worth afterwards, not how long it takes to disappear.
 */
export function checkHazards(world: World, enemy: Enemy): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);

  if (isBarricadeCell(world.maze, cellX, cellY)) {
    impale(world, enemy);
    return;
  }

  if (isTrenchCell(world.maze, cellX, cellY)) {
    swallow(world, enemy);
    return;
  }

  if (!isWaterCell(world.maze, cellX, cellY)) {
    return;
  }

  goUnder(enemy);
  raiseSfx(world, "waterEntry", { x: enemy.x, y: enemy.y });
  // The moment of going in, wherever it was reached from — thrown, shoved, or a charge that overran.
  // Everything else about drowning is slow and quiet, so the entry is the only chance to show that
  // something just hit the water.
  burst(world.particles, "splash", enemy.x, enemy.y, 0.12, 16, {
    speed: 2.4,
    spreadZ: 2.8,
    gravity: 9,
    drag: 0.7,
    size: 0.055,
    life: 0.7,
  });
}

/**
 * Starts the fall an enemy does not come back from.
 *
 * Everything it was committed to goes with it: the push that put it there, the errand it was on, the
 * attack it was halfway through. One on its way under is also immune to damage, so this is the whole
 * of what taking it out of the fight amounts to.
 */
function goUnder(enemy: Enemy): void {
  enemy.drowningSeconds = DROWN_SECONDS;
  enemy.pushX = 0;
  enemy.pushY = 0;
  enemy.intent = "none";
  enemy.windupSeconds = 0;
  enemy.chargeSeconds = 0;
}

/**
 * Anything that goes into a trench is gone, and the trench is exactly as it was.
 *
 * The difference from a pool, and the reason the trench exists: one thrown into water buys a third of
 * a cell of ground, and one thrown into a trench buys nothing. Dust rather than a splash, because what
 * a cut in the rock throws up is what was lying on its rim.
 *
 * It goes down over the same second a drowning takes rather than dying where it landed. Killing it on
 * contact left a corpse on the lip of a hole nine tenths of a cell deep and called that a death in a
 * trench. What it is worth downstream is unchanged: it counts, and the trench keeps what it carried.
 */
function swallow(world: World, enemy: Enemy): void {
  goUnder(enemy);
  burst(world.particles, "dust", enemy.x, enemy.y, 0.3, 12, {
    speed: 1.6,
    spreadZ: 1.2,
    gravity: 4,
    size: 0.05,
    life: 0.8,
  });
}

/** Anything shoved onto the spikes dies there and then, run through where it landed. */
function impale(world: World, enemy: Enemy): void {
  burst(world.particles, "blood", enemy.x, enemy.y, 0.4, 16, {
    speed: 2.4,
    spreadZ: 2.6,
    size: 0.06,
    life: 1.2,
  });
  burst(world.particles, "ember", enemy.x, enemy.y, 0.45, 6, { speed: 2, spreadZ: 1.8, size: 0.04, life: 0.5 });
  killEnemy(world, enemy, "impaled");
}

function enemiesWithin(world: World, x: number, y: number, radius: number): Enemy[] {
  return world.enemies.filter((enemy) => enemy.drowningSeconds <= 0 && Math.hypot(enemy.x - x, enemy.y - y) <= radius);
}

/**
 * Chain lightning: every enemy struck rolls to pass it on, and whoever it passes to rolls again.
 *
 * Written as a queue rather than recursion so the hop limit bounds the whole cascade rather than one
 * branch of it.
 */
export function chainLightning(world: World, seeds: readonly Enemy[]): void {
  const visited = new Set(seeds.map((enemy) => enemy.id));
  let frontier = [...seeds];

  for (let hop = 0; hop < CHAIN_MAX_HOPS && frontier.length > 0; hop += 1) {
    const next: Enemy[] = [];

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

/**
 * Damages every breakable wall whose cell centre falls inside a blast.
 *
 * `sparesEmplacements` is for a blast that came out of one. An emplacement that can be wrecked by
 * another emplacement's shell means a floor full of them quietly dismantles itself while the player is
 * elsewhere, and smashing one is supposed to be something the player goes and does.
 */
function shatterWalls(world: World, x: number, y: number, radius: number, sparesEmplacements = false): void {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);

  for (let cellY = minY; cellY <= maxY; cellY += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      const tile = world.maze.tiles[tileIndex(world.maze, cellX, cellY)];

      // Barricades included: a blast that flattens a stone wall but leaves the iron spikes in front of
      // it standing would read as the spikes being scenery. An emplacement is the same argument and
      // takes it too, unless the blast is one of its own.
      const breakable =
        tile?.kind === "wood" ||
        tile?.kind === "stone" ||
        tile?.kind === "barricade" ||
        (tile?.kind === "mortar" && !sparesEmplacements);

      if (!breakable) {
        continue;
      }

      if (Math.hypot(cellX + 0.5 - x, cellY + 0.5 - y) <= radius) {
        damageWall(world, { x: cellX, y: cellY }, BLAST_WALL_DAMAGE, true);
      }
    }
  }
}

export function detonate(world: World, x: number, y: number): void {
  raiseSfx(world, "detonation", { x, y });
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

  shatterWalls(world, x, y, BOMB_CORE_RADIUS);
}

/**
 * A shell coming down, and the one damage call that does not care whose side anyone is on.
 *
 * Deliberately no test for which side this is. The emplacement picked its mark from everything on the
 * floor without a preference, and the blast has to honour that or the point of it — a hazard the player
 * can position themselves against and bait a crowd onto — quietly becomes another enemy.
 *
 * Anything it kills counts as the player's kill, because it goes out through the same exit every other
 * death does. Lining a crowd up under a mark is a way of playing this, not a way around it.
 *
 * It takes the floor down with it too. A shot that kills a crowd but leaves the wall they were standing
 * against untouched makes the emplacement a thing that only produces corpses, and the point of a hazard
 * ranging over the whole floor is that standing in the open near a wall has a cost. What it will not
 * break is another emplacement.
 */
export function shellImpact(world: World, x: number, y: number, damage: number, radius: number): void {
  raiseSfx(world, "shellLand", { x, y });
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

  shatterWalls(world, x, y, radius, true);
}

/** A rock landing: everyone in a small radius takes a swing's worth and gets scattered. */
export function rockImpact(world: World, x: number, y: number): void {
  raiseSfx(world, "rockLand", { x, y });
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
 * Runs someone down with a flying enemy: hurt, stunned, and knocked to one side.
 *
 * The shove is perpendicular to the flight rather than along it. Pushing them the way the throw is
 * already going would herd them ahead of it, which is the opposite of clearing a path.
 */
export function bargeInto(
  world: World,
  enemy: Enemy,
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
  raiseSfx(world, "bodyBarge", { x: enemy.x, y: enemy.y });
  stunEnemy(enemy, BODY_STUN_SECONDS);
  damageEnemy(world, enemy, thrownImpactDamage(world));
}

/**
 * The arrival itself, as distinct from what it costs whoever arrived.
 *
 * Dust off the floor and a jolt of the view, both scaled by what landed. The jolt falls away with
 * distance because it is the floor carrying it: something dropped across the room is an impact you
 * hear about, and one dropped at your feet is one you feel.
 */
function arrival(world: World, x: number, y: number, thud: number): void {
  if (thud <= 0) {
    return;
  }

  // Nothing kicks dust off a pool. Something that came down in one has already thrown its splash on
  // the way in, and the jolt below is still owed either way — the floor carries it just the same.
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

  raiseSfx(world, "bodyLand", { x, y });
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
 * What a thrown enemy suffers on arrival.
 *
 * The thrown one is what gets hurt here, not what it landed among: it takes a bare swing's worth for
 * the fall, doubled if a wall stopped it. Throwing an enemy is therefore a way to spend that enemy —
 * hardest into a wall — rather than a way to damage the ones it flew past.
 *
 * A wall is also the one landing that decides how it ends: at that speed there is nothing left to fall
 * over, so the death is the mark it leaves rather than a corpse on the floor. That is the same end a
 * javelin gives, through the same cause.
 *
 * The blessed version keeps its detonation, which is the whole reason that blessing exists.
 */
export function bodyLanding(world: World, thrown: Enemy, landing: BodyLanding): void {
  const explosive = hasBless(world.bless, "explosiveBody");
  const hitWall = landing.hitWall;
  stunEnemy(thrown, BODY_STUN_SECONDS);
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

/**
 * Sinks anything already going under, and finishes it when the ground closes over.
 *
 * The cell decides which death it was rather than whatever put it there, because by now that is the
 * only thing still true: it sinks where it landed, so the cell it went into is the cell it dies in.
 */
export function stepDrowning(world: World, deltaSeconds: number): void {
  for (const enemy of world.enemies.slice()) {
    if (enemy.drowningSeconds <= 0) {
      continue;
    }

    enemy.drowningSeconds -= deltaSeconds;

    if (enemy.drowningSeconds <= 0) {
      const swallowed = isTrenchCell(world.maze, Math.floor(enemy.x), Math.floor(enemy.y));
      killEnemy(world, enemy, swallowed ? "swallowed" : "drowned");
    }
  }
}
