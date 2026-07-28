/**
 * Demo world state.
 *
 * Real time, continuous coordinates, mutable. Nothing in here is the shipped game's turn model —
 * this module deliberately owns its own truth so `src/core/` stays untouched.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { DEMO_GRID_SIZE, generateDemoMaze, isSolidCell, type DemoCell, type DemoMaze } from "@/demo/maze";

export type DemoPropKind = "stick" | "smallRock" | "bigRock";
export type DemoPileKind = "woodSpikes" | "rocks";
export type DemoThrowKind = DemoPropKind | "enemy";

export type DemoEnemy = {
  id: string;
  appearance: EnemyAppearanceId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stunSeconds: number;
  hurtSeconds: number;
  attackPoseSeconds: number;
  attackCooldown: number;
  pushX: number;
  pushY: number;
  repathSeconds: number;
  waypoint: DemoCell | undefined;
};

export type DemoProp = {
  id: string;
  kind: DemoPropKind;
  x: number;
  y: number;
};

export type DemoPile = {
  id: string;
  kind: DemoPileKind;
  x: number;
  y: number;
  remaining: number;
};

export type DemoProjectile = {
  id: string;
  kind: DemoThrowKind;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  travelled: number;
  range: number;
  /** The body of a thrown enemy, so it can land and keep fighting if it survives the flight. */
  payload: DemoEnemy | undefined;
  struck: Set<string>;
  /** True for a projectile that is pure spectacle because its effect already resolved at the throw. */
  inert: boolean;
};

export type DemoDeath = {
  id: string;
  appearance: EnemyAppearanceId;
  x: number;
  y: number;
  progress: number;
};

export type DemoHeld =
  Readonly<{ kind: "prop"; prop: DemoPropKind }> | Readonly<{ kind: "enemy"; enemy: DemoEnemy }> | undefined;

export type DemoPlayer = {
  x: number;
  y: number;
  angle: number;
  /** Vertical look as a fraction of screen height; the renderer shears the horizon by it. */
  pitch: number;
  hp: number;
  maxHp: number;
};

/** Which arm animation a press started. A throw never plays the slash. */
export type DemoSwingKind = "melee" | "throw";

export type DemoStatus = "playing" | "escaped" | "dead";

export type DemoWorld = {
  maze: DemoMaze;
  player: DemoPlayer;
  enemies: DemoEnemy[];
  props: DemoProp[];
  piles: DemoPile[];
  projectiles: DemoProjectile[];
  deaths: DemoDeath[];
  held: DemoHeld;
  status: DemoStatus;
  elapsedSeconds: number;
  swing: number;
  swingKind: DemoSwingKind;
  spawnSeconds: number;
  hitFlash: number;
  walkBob: number;
  message: string;
  messageSeconds: number;
  nextId: number;
  kills: number;
  wallsBroken: number;
};

export const PLAYER_RADIUS = 0.26;
export const ENEMY_RADIUS = 0.3;
export const PLAYER_SPEED = 3.4;
export const ENEMY_SPEED = 1.9;
export const ENEMY_CHARGE_SPEED = 2.6;
/** Grid distance at which an enemy abandons pathing and simply runs at the player. */
export const CHARGE_DISTANCE = 5;
export const REACH = 1.45;
/** How long one swing of the viewmodel takes; `world.swing` counts this down to zero. */
export const SWING_SECONDS = 0.32;

const ENEMY_COUNT = 14;
/** The dungeon keeps producing: one every five seconds until twenty are walking around. */
export const SPAWN_INTERVAL_SECONDS = 5;
export const MAX_ENEMIES = 20;
/** How far from the player a reinforcement must appear, so nothing pops into an occupied corridor. */
const SPAWN_CLEARANCE = 7;
const APPEARANCES: readonly EnemyAppearanceId[] = ["greenSlime", "yellowSlime", "blueSlime", "redSlime", "purpleSlime"];
const LOOSE_PROPS: readonly Readonly<{ kind: DemoPropKind; count: number }>[] = [
  { kind: "stick", count: 6 },
  { kind: "smallRock", count: 7 },
  { kind: "bigRock", count: 4 },
];

export function nextId(world: DemoWorld, prefix: string): string {
  world.nextId += 1;
  return `${prefix}-${world.nextId}`;
}

function openCells(maze: DemoMaze): DemoCell[] {
  const cells: DemoCell[] = [];

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (!isSolidCell(maze, x, y)) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function takeRandom<T>(pool: T[]): T | undefined {
  if (pool.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool.splice(index, 1)[0];
}

export function createDemoWorld(): DemoWorld {
  const maze = generateDemoMaze();
  const world: DemoWorld = {
    maze,
    player: {
      x: maze.entrance.x + 0.5,
      y: maze.entrance.y + 0.5,
      angle: Math.random() * Math.PI * 2,
      pitch: 0,
      hp: 150,
      maxHp: 150,
    },
    enemies: [],
    props: [],
    piles: [],
    projectiles: [],
    deaths: [],
    held: undefined,
    status: "playing",
    elapsedSeconds: 0,
    swing: 0,
    swingKind: "melee",
    spawnSeconds: SPAWN_INTERVAL_SECONDS,
    hitFlash: 0,
    walkBob: 0,
    message: "WASD 移動 · 滑鼠轉向 · 左鍵攻擊/投擲 · 右鍵抓取",
    messageSeconds: 6,
    nextId: 0,
    kills: 0,
    wallsBroken: 0,
  };

  // Far enough that the first thing a run does is look around rather than swing.
  const spawnPool = openCells(maze).filter(
    (cell) => Math.hypot(cell.x + 0.5 - world.player.x, cell.y + 0.5 - world.player.y) > 6.5,
  );

  for (let index = 0; index < ENEMY_COUNT; index += 1) {
    const cell = takeRandom(spawnPool);

    if (!cell) {
      break;
    }

    world.enemies.push(createEnemy(world, cell.x + 0.5, cell.y + 0.5, APPEARANCES[index % APPEARANCES.length]));
  }

  const propPool = openCells(maze);

  for (const group of LOOSE_PROPS) {
    for (let index = 0; index < group.count; index += 1) {
      const cell = takeRandom(propPool);

      if (!cell) {
        break;
      }

      world.props.push({ id: nextId(world, "prop"), kind: group.kind, x: cell.x + 0.5, y: cell.y + 0.5 });
    }
  }

  return world;
}

export function createEnemy(world: DemoWorld, x: number, y: number, appearance?: EnemyAppearanceId): DemoEnemy {
  return {
    id: nextId(world, "enemy"),
    appearance: appearance ?? APPEARANCES[Math.floor(Math.random() * APPEARANCES.length)] ?? "greenSlime",
    x,
    y,
    hp: 30,
    maxHp: 30,
    stunSeconds: 0,
    hurtSeconds: 0,
    attackPoseSeconds: 0,
    attackCooldown: 0,
    pushX: 0,
    pushY: 0,
    repathSeconds: 0,
    waypoint: undefined,
  };
}

/**
 * Adds one enemy somewhere the player is not looking at from close range, if the floor is not
 * already full. Returns whether one arrived, so the caller can say so.
 */
export function spawnReinforcement(world: DemoWorld): boolean {
  if (world.enemies.length >= MAX_ENEMIES) {
    return false;
  }

  const candidates = openCells(world.maze).filter(
    (cell) => Math.hypot(cell.x + 0.5 - world.player.x, cell.y + 0.5 - world.player.y) > SPAWN_CLEARANCE,
  );
  const cell = takeRandom(candidates);

  if (!cell) {
    return false;
  }

  world.enemies.push(createEnemy(world, cell.x + 0.5, cell.y + 0.5));
  return true;
}

export function announce(world: DemoWorld, message: string, seconds = 2.2): void {
  world.message = message;
  world.messageSeconds = seconds;
}

export function killEnemy(world: DemoWorld, enemy: DemoEnemy): void {
  const index = world.enemies.indexOf(enemy);

  if (index >= 0) {
    world.enemies.splice(index, 1);
  }

  world.deaths.push({ id: enemy.id, appearance: enemy.appearance, x: enemy.x, y: enemy.y, progress: 0 });
  world.kills += 1;
}

export function damageEnemy(world: DemoWorld, enemy: DemoEnemy, amount: number): void {
  enemy.hp -= amount;
  enemy.hurtSeconds = 0.28;

  if (enemy.hp <= 0) {
    killEnemy(world, enemy);
  }
}

/** True when the straight segment between two points crosses no solid cell. */
export function hasLineOfSight(maze: DemoMaze, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.ceil(distance * 8);

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;

    if (isSolidCell(maze, Math.floor(x), Math.floor(y))) {
      return false;
    }
  }

  return true;
}
