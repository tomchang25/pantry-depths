/**
 * Demo world state.
 *
 * Real time, continuous coordinates, mutable. Nothing in here is the shipped game's turn model —
 * this module deliberately owns its own truth so `src/core/` stays untouched.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { createBlessState, grantBless, hasBless, OVERFLOW_MAX_HP, type BlessState } from "@/demo/bless";
import { ENEMY_ARCHETYPES, type DemoEnemyArchetype } from "@/demo/enemy-archetypes";
import { DEMO_GRID_SIZE, generateDemoMaze, blocksWalk, type DemoCell, type DemoMaze } from "@/demo/maze";

/** A grid coordinate as the demo passes it around; structurally the same as the maze's own cell. */
export type DemoCellLike = Readonly<{ x: number; y: number }>;

export type DemoPropKind = "stick" | "rock" | "bomb" | "axe";
export type DemoThrowKind = DemoPropKind | "enemy";

/** What an enemy is currently committed to. A wind-up is visible to the player before it resolves. */
export type DemoIntent = "none" | "shoot" | "charge";

export type DemoEnemy = {
  id: string;
  archetype: DemoEnemyArchetype;
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
  /** Counts down through the telegraph; while above zero the enemy is committed and visibly winding up. */
  windupSeconds: number;
  windupTotal: number;
  intent: DemoIntent;
  chargeSeconds: number;
  chargeX: number;
  chargeY: number;
  /** Above zero while the body is sinking into a pool; it stops acting and dies when this expires. */
  drowningSeconds: number;
};

export type DemoProp = {
  id: string;
  kind: DemoPropKind;
  x: number;
  y: number;
};

/**
 * A stash a broken wood wall leaves behind.
 *
 * The kind of ammunition is decided once, when the wall breaks, and every pickup from that pile
 * yields it — so what a pile is worth is legible from across the room by its shape, rather than
 * being a slot machine you have to stand next to and pull three times.
 *
 * Stone walls leave nothing at all.
 */
export type DemoPile = {
  id: string;
  ammo: DemoPropKind;
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
  /**
   * Bodies a javelin is carrying. They leave the world the moment they are run through and come back
   * only as corpses, at the wall — being skewered is not a state anything is expected to survive.
   */
  skewered: DemoEnemy[];
  /** Victims an axe has already cleaved, which is what limits it to three. */
  cleaved: number;
};

/** An enemy's projectile, which only ever concerns the player. */
export type DemoHazard = {
  id: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  speed: number;
  travelled: number;
  range: number;
  damage: number;
};

/**
 * A transient world-space effect, described without an identity.
 *
 * Kept separate from the identified form so `addVfx` can take a plain description: `Omit` over a
 * union distributes into something no literal satisfies, which made every call site fight the type.
 */
export type DemoVfxSpec =
  | { kind: "blast"; x: number; y: number; radius: number; age: number; life: number }
  | { kind: "arc"; fromX: number; fromY: number; toX: number; toY: number; age: number; life: number };

export type DemoVfx = DemoVfxSpec & { id: string };

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
  /** Momentum the player is not in control of — currently only what a charger leaves behind. */
  pushX: number;
  pushY: number;
  hp: number;
  maxHp: number;
};

/** Which arm animation a press started. A throw never plays the slash. */
export type DemoSwingKind = "melee" | "throw";

export type DemoStatus = "playing" | "dead";

export type DemoAltar = {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
};

export type DemoWorld = {
  maze: DemoMaze;
  depth: number;
  player: DemoPlayer;
  altar: DemoAltar;
  bless: BlessState;
  enemies: DemoEnemy[];
  props: DemoProp[];
  piles: DemoPile[];
  projectiles: DemoProjectile[];
  hazards: DemoHazard[];
  vfx: DemoVfx[];
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
  /** Set when a blessing is awarded; the surface turns it into the card and then clears it. */
  pendingCard: string | undefined;
  nextId: number;
  kills: number;
  wallsBroken: number;
};

export const PLAYER_RADIUS = 0.26;
export const ENEMY_RADIUS = 0.3;
export const PLAYER_SPEED = 3.4;
export const REACH = 1.45;
export const ALTAR_HITS = 3;
/** How long one swing of the viewmodel takes; `world.swing` counts this down to zero. */
export const SWING_SECONDS = 0.32;

const BASE_ENEMY_COUNT = 14;
/** The dungeon keeps producing: one every five seconds until twenty are walking around. */
export const SPAWN_INTERVAL_SECONDS = 5;
export const MAX_ENEMIES = 20;
/** How far from the player a reinforcement must appear, so nothing pops into an occupied corridor. */
const SPAWN_CLEARANCE = 7;

const LOOSE_PROPS: readonly Readonly<{ kind: DemoPropKind; count: number }>[] = [
  { kind: "stick", count: 5 },
  { kind: "rock", count: 6 },
  { kind: "bomb", count: 2 },
];

export const AMMO_KINDS: readonly DemoPropKind[] = ["stick", "rock", "bomb"];

export function randomAmmo(): DemoPropKind {
  return AMMO_KINDS[Math.floor(Math.random() * AMMO_KINDS.length)] ?? "rock";
}

export function nextId(world: DemoWorld, prefix: string): string {
  world.nextId += 1;
  return `${prefix}-${world.nextId}`;
}

function walkableCells(maze: DemoMaze): DemoCell[] {
  const cells: DemoCell[] = [];

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (!blocksWalk(maze, x, y)) {
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

/** Three in five are the plain green kind; the two specialists split the rest evenly. */
function pickArchetype(): DemoEnemyArchetype {
  const roll = Math.random();

  if (roll < 0.2) {
    return ENEMY_ARCHETYPES.ranged;
  }

  if (roll < 0.4) {
    return ENEMY_ARCHETYPES.charger;
  }

  return ENEMY_ARCHETYPES.walker;
}

export function createEnemy(world: DemoWorld, x: number, y: number, archetype = pickArchetype()): DemoEnemy {
  return {
    id: nextId(world, "enemy"),
    archetype,
    appearance: archetype.appearance,
    x,
    y,
    hp: archetype.health,
    maxHp: archetype.health,
    stunSeconds: 0,
    hurtSeconds: 0,
    attackPoseSeconds: 0,
    attackCooldown: Math.random() * archetype.attackCooldown,
    pushX: 0,
    pushY: 0,
    repathSeconds: 0,
    waypoint: undefined,
    windupSeconds: 0,
    windupTotal: 0,
    intent: "none",
    chargeSeconds: 0,
    chargeX: 0,
    chargeY: 0,
    drowningSeconds: 0,
  };
}

/**
 * Fills a freshly generated maze with everything that is not the player.
 *
 * Used both for a new run and for arriving on the next floor down, which is why it takes the world
 * rather than building one: descending keeps health, hands, and blessings and replaces only this.
 */
export function populateFloor(world: DemoWorld): void {
  const maze = world.maze;
  world.enemies = [];
  world.props = [];
  world.piles = [];
  world.projectiles = [];
  world.hazards = [];
  world.vfx = [];
  world.deaths = [];
  world.altar = { hp: ALTAR_HITS, maxHp: ALTAR_HITS, x: maze.altar.x + 0.5, y: maze.altar.y + 0.5 };
  world.spawnSeconds = SPAWN_INTERVAL_SECONDS;
  world.player.x = maze.entrance.x + 0.5;
  world.player.y = maze.entrance.y + 0.5;
  world.player.pitch = 0;

  // Far enough that the first thing a floor does is look around rather than swing.
  const spawnPool = walkableCells(maze).filter(
    (cell) => Math.hypot(cell.x + 0.5 - world.player.x, cell.y + 0.5 - world.player.y) > 6.5,
  );
  const count = Math.min(MAX_ENEMIES, BASE_ENEMY_COUNT + world.depth - 1);

  for (let index = 0; index < count; index += 1) {
    const cell = takeRandom(spawnPool);

    if (!cell) {
      break;
    }

    world.enemies.push(createEnemy(world, cell.x + 0.5, cell.y + 0.5));
  }

  const propPool = walkableCells(maze);

  for (const group of LOOSE_PROPS) {
    for (let index = 0; index < group.count; index += 1) {
      const cell = takeRandom(propPool);

      if (!cell) {
        break;
      }

      world.props.push({ id: nextId(world, "prop"), kind: group.kind, x: cell.x + 0.5, y: cell.y + 0.5 });
    }
  }
}

export function createDemoWorld(): DemoWorld {
  const maze = generateDemoMaze();
  const world: DemoWorld = {
    maze,
    depth: 1,
    player: {
      x: maze.entrance.x + 0.5,
      y: maze.entrance.y + 0.5,
      angle: Math.random() * Math.PI * 2,
      pitch: 0,
      pushX: 0,
      pushY: 0,
      hp: 150,
      maxHp: 150,
    },
    altar: { hp: ALTAR_HITS, maxHp: ALTAR_HITS, x: maze.altar.x + 0.5, y: maze.altar.y + 0.5 },
    bless: createBlessState(),
    enemies: [],
    props: [],
    piles: [],
    projectiles: [],
    hazards: [],
    vfx: [],
    deaths: [],
    held: undefined,
    status: "playing",
    elapsedSeconds: 0,
    swing: 0,
    swingKind: "melee",
    spawnSeconds: SPAWN_INTERVAL_SECONDS,
    hitFlash: 0,
    walkBob: 0,
    message: "WASD 移動 · 滑鼠轉向 · 左鍵攻擊 · 右鍵抓取 · 找祭壇與樓梯",
    messageSeconds: 6,
    pendingCard: undefined,
    nextId: 0,
    kills: 0,
    wallsBroken: 0,
  };

  populateFloor(world);
  return world;
}

/**
 * Adds one enemy somewhere the player is not looking at from close range, if the floor is not
 * already full. Returns whether one arrived, so the caller can say so.
 */
export function spawnReinforcement(world: DemoWorld): boolean {
  if (world.enemies.length >= MAX_ENEMIES) {
    return false;
  }

  const candidates = walkableCells(world.maze).filter(
    (cell) => Math.hypot(cell.x + 0.5 - world.player.x, cell.y + 0.5 - world.player.y) > SPAWN_CLEARANCE,
  );
  const cell = takeRandom(candidates);

  if (!cell) {
    return false;
  }

  world.enemies.push(createEnemy(world, cell.x + 0.5, cell.y + 0.5));
  return true;
}

/**
 * Awards one blessing and queues its card.
 *
 * Both sources — smashing an altar and taking the stairs down — come through here, so the card, the
 * bar, and the overflow rule can never drift apart between them.
 */
export function awardBless(world: DemoWorld): void {
  const granted = grantBless(world.bless);

  if (!granted) {
    world.player.maxHp += OVERFLOW_MAX_HP;
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + OVERFLOW_MAX_HP);
    world.pendingCard = "overflow";
    announce(world, `祝福已滿：最大生命 +${OVERFLOW_MAX_HP}`, 3);
    return;
  }

  world.pendingCard = granted.id;
  announce(world, `獲得祝福：${granted.name}`, 3);
}

export function announce(world: DemoWorld, message: string, seconds = 2.2): void {
  world.message = message;
  world.messageSeconds = seconds;
}

export function addVfx(world: DemoWorld, effect: DemoVfxSpec): void {
  world.vfx.push({ ...effect, id: nextId(world, "vfx") });
}

/**
 * What a corpse leaves behind.
 *
 * Wood walls supply the ordinary ammunition; these two only ever come off something you killed, so
 * fighting and mining stay separate ways of restocking. The axe in particular never appears in a
 * pile — the only way to get one is to earn it.
 */
const BOMB_DROP_CHANCE = 0.16;
const AXE_DROP_CHANCE = 0.14;
export const LIFESTEAL_HEAL = 12;

/**
 * The single exit every enemy leaves the world through.
 *
 * Drowning, a stick through the chest, a bomb — all of them come here, so the drop chance and the
 * blessing payout cannot end up applying to some kill routes and not others.
 */
export function killEnemy(world: DemoWorld, enemy: DemoEnemy): void {
  const index = world.enemies.indexOf(enemy);

  if (index >= 0) {
    world.enemies.splice(index, 1);
  }

  world.deaths.push({ id: enemy.id, appearance: enemy.appearance, x: enemy.x, y: enemy.y, progress: 0 });
  world.kills += 1;

  if (hasBless(world.bless, "lifesteal")) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + LIFESTEAL_HEAL);
  }

  if (blocksWalk(world.maze, Math.floor(enemy.x), Math.floor(enemy.y))) {
    return;
  }

  const roll = Math.random();

  if (roll < BOMB_DROP_CHANCE) {
    world.props.push({ id: nextId(world, "prop"), kind: "bomb", x: enemy.x, y: enemy.y });
    return;
  }

  if (roll < BOMB_DROP_CHANCE + AXE_DROP_CHANCE) {
    world.props.push({ id: nextId(world, "prop"), kind: "axe", x: enemy.x, y: enemy.y });
  }
}

export function damageEnemy(world: DemoWorld, enemy: DemoEnemy, amount: number): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  enemy.hp -= amount;
  enemy.hurtSeconds = 0.28;

  if (enemy.hp <= 0) {
    killEnemy(world, enemy);
  }
}

/** True when the straight segment between two points crosses no wall. Water does not block. */
export function hasLineOfSight(maze: DemoMaze, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.ceil(distance * 8);

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;

    if (blocksWalk(maze, Math.floor(x), Math.floor(y)) && !isWater(maze, x, y)) {
      return false;
    }
  }

  return true;
}

function isWater(maze: DemoMaze, x: number, y: number): boolean {
  return maze.tiles[Math.floor(y) * DEMO_GRID_SIZE + Math.floor(x)]?.kind === "water";
}
