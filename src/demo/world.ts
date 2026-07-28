/**
 * Demo world state.
 *
 * Real time, continuous coordinates, mutable. Nothing in here is the shipped game's turn model —
 * this module deliberately owns its own truth so `src/core/` stays untouched.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { createBlessState, grantBless, hasBless, OVERFLOW_MAX_HP, type BlessState } from "@/demo/bless";
import { ENEMY_ARCHETYPES, type DemoEnemyArchetype } from "@/demo/enemy-archetypes";
import {
  blocksProjectile,
  blocksWalk,
  DEMO_GRID_SIZE,
  generateDemoMaze,
  tileIndex,
  type DemoCell,
  type DemoMaze,
} from "@/demo/maze";
import { burst, createParticleField, type DemoParticleField } from "@/demo/particles";

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

/**
 * A pickup lying on the floor, carrying however many uses it holds.
 *
 * Replaces the rubble piles, which were a thing you stood next to and pulled three times. A stack is
 * taken in one grab and spent one throw at a time, so the decision is at the moment you pick it up
 * rather than repeated three times at the same spot.
 */
export type DemoProp = {
  id: string;
  kind: DemoPropKind;
  count: number;
  x: number;
  y: number;
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
  /**
   * Total unbent rise over the whole flight, in cells: the throw departs along the aim line, so
   * this is the aim slope times the range, negative when aimed down. The flight itself is still
   * two-dimensional; the height it implies is what collision consults.
   */
  arc: number;
  /**
   * How much of that rise gravity takes back, quadratically. Lobbed throws set it so the curve
   * lands exactly at the end of the range; line-flying weapons — the javelin and the axe — leave
   * it at zero and simply fly where they were pointed.
   */
  fall: number;
  /** The body of a thrown enemy, so it can land and keep fighting if it survives the flight. */
  payload: DemoEnemy | undefined;
  struck: Set<string>;
  /** Recent positions, newest last. Presentation only — the trail is drawn from it. */
  trail: { x: number; y: number; z: number }[];
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

/**
 * How an enemy died, which is what its body does next.
 *
 * The corpse animation is picked by cause, not by damage source bookkeeping: a cleave splits the
 * body, a pinning leaves it slumped on the shaft, a blast leaves nothing at all. Everything without
 * a signature of its own — rocks, falls, spikes, lightning — deflates as "slain".
 */
export type DemoDeathCause = "slain" | "cleaved" | "drowned" | "pinned" | "blasted";

export type DemoDeath = {
  id: string;
  appearance: EnemyAppearanceId;
  x: number;
  y: number;
  progress: number;
  cause: DemoDeathCause;
  /** Direction the killing blow travelled, for deaths with an axis — currently only pinning. */
  directionX: number;
  directionY: number;
};

export type DemoHeld =
  | Readonly<{ kind: "prop"; prop: DemoPropKind; count: number }>
  | Readonly<{ kind: "enemy"; enemy: DemoEnemy }>
  | undefined;

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

/**
 * Which arm animation a press started.
 *
 * The three melee forms cycle, so holding down the attack never plays the same animation twice in a
 * row and the third of every three lands as the heavy one.
 */
export type DemoSwingKind = "slash" | "backhand" | "chop" | "thrust" | "throw";

export const MELEE_CYCLE: readonly DemoSwingKind[] = ["slash", "backhand", "chop", "thrust"];

/** Where in the world a swing was aimed, so the arc can be drawn through it. */
export type DemoSwingTarget = { x: number; y: number; z: number; connected: boolean } | undefined;

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
  projectiles: DemoProjectile[];
  hazards: DemoHazard[];
  vfx: DemoVfx[];
  particles: DemoParticleField;
  /**
   * How bloodied each cell's floor is, indexed like the maze. Accumulates over a floor and is wiped
   * when a new one is generated, so a hard-fought room stays visibly hard-fought.
   */
  stains: Float32Array;
  /** Bumped whenever `stains` changes, so the scene's overlay list can be reused between kills. */
  stainsVersion: number;
  deaths: DemoDeath[];
  /** Room height in cells for this floor. Presentation only; nothing collides vertically. */
  wallHeight: number;
  /**
   * Bumped whenever the terrain or the altar changes.
   *
   * The scene's walls, floor materials and structures are derived from those and nothing else, so
   * they only need rebuilding when this moves — which is a few times a minute rather than sixty
   * times a second.
   */
  terrainVersion: number;
  held: DemoHeld;
  /** Debug: freezes enemy thinking, movement, and reinforcement while true. Toggled by the P key. */
  enemiesPaused: boolean;
  status: DemoStatus;
  elapsedSeconds: number;
  swing: number;
  swingKind: DemoSwingKind;
  /** Index into `MELEE_CYCLE`; advanced on every bare-handed press. */
  swingStep: number;
  swingTarget: DemoSwingTarget;
  /** Rises when a swing connects, decays fast. Drives the impact hitch on the arm and the camera. */
  impact: number;
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

const LOOSE_PROPS: readonly Readonly<{ kind: DemoPropKind; scatter: number }>[] = [
  { kind: "stick", scatter: 4 },
  { kind: "rock", scatter: 5 },
  { kind: "bomb", scatter: 2 },
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
  world.projectiles = [];
  world.hazards = [];
  world.vfx = [];
  world.particles = createParticleField();
  world.stains = new Float32Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE);
  world.stainsVersion += 1;
  world.deaths = [];
  // A whole number of storeys, never a fraction. The wall texture is tiled once per cell of height,
  // so a room 1.7 cells tall stretched the last course and made the masonry read as low-resolution
  // rather than as high — which is exactly the distortion a fractional height causes. Deeper floors
  // are likelier to be the tall kind.
  world.wallHeight = Math.random() < Math.min(0.75, 0.25 + world.depth * 0.12) ? 2 : 1;
  world.terrainVersion += 1;
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
    for (let index = 0; index < group.scatter; index += 1) {
      const cell = takeRandom(propPool);

      if (!cell) {
        break;
      }

      world.props.push({ id: nextId(world, "prop"), kind: group.kind, count: 3, x: cell.x + 0.5, y: cell.y + 0.5 });
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
    projectiles: [],
    hazards: [],
    vfx: [],
    particles: createParticleField(),
    stains: new Float32Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE),
    stainsVersion: 0,
    deaths: [],
    wallHeight: 1.6,
    terrainVersion: 0,
    held: undefined,
    enemiesPaused: false,
    status: "playing",
    elapsedSeconds: 0,
    swing: 0,
    swingKind: "slash",
    swingStep: 0,
    swingTarget: undefined,
    impact: 0,
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
 * Knocks every wall out of the current floor, for the T key on the demo surface.
 *
 * Walls only: pools and barricades stay, deliberately — they are what `blocksWalk` still refuses to
 * cross, so the pathfinding worst case (a player nothing can reach) stays reproducible on the
 * flattened floor. Enemy count is topped up to the cap so every sprite is on screen at once.
 */
export function flattenFloorForTesting(world: DemoWorld): void {
  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      if (tile && (tile.kind === "stone" || tile.kind === "wood")) {
        tile.kind = "open";
        tile.hp = 0;
        tile.maxHp = 0;
      }
    }
  }

  world.terrainVersion += 1;

  while (world.enemies.length < MAX_ENEMIES) {
    if (!spawnReinforcement(world)) {
      break;
    }
  }

  announce(world, "測試場：牆已拆除（水池、拒馬保留），敵人補滿", 3);
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

/** Ceiling on how dark one cell can get, so a long fight does not end in a solid red floor. */
const MAX_STAIN = 0.72;

export function stainFloor(world: DemoWorld, x: number, y: number, amount: number): void {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);

  if (cellX < 0 || cellY < 0 || cellX >= DEMO_GRID_SIZE || cellY >= DEMO_GRID_SIZE) {
    return;
  }

  // Nothing settles on water. Recorded here as well as skipped at draw time, so a pool that is
  // later drained by some future change does not reveal blood that was never visible.
  if (world.maze.tiles[cellY * DEMO_GRID_SIZE + cellX]?.kind === "water") {
    return;
  }

  const index = cellY * DEMO_GRID_SIZE + cellX;
  world.stains[index] = Math.min(MAX_STAIN, (world.stains[index] ?? 0) + amount);
  world.stainsVersion += 1;
}

export function addVfx(world: DemoWorld, effect: DemoVfxSpec): void {
  world.vfx.push({ ...effect, id: nextId(world, "vfx") });
}

/**
 * Height of a projectile above the floor, in cells — simulation truth, not decoration.
 *
 * Every throw leaves the hand *along the aim line*, which is what makes an upward throw read as
 * flying up rather than shrinking away. Lobbed things then bend down under `fall` to touch the
 * ground exactly where the range runs out; line-flying weapons keep the launch slope the whole
 * way. An earlier version fixed the peak instead of the launch direction, and a skyward throw
 * departed almost level, crawling off under the crosshair.
 */
export function projectileHeight(projectile: DemoProjectile): number {
  const s = Math.min(1, Math.max(0, projectile.travelled / Math.max(0.0001, projectile.range)));
  return Math.max(0, 0.5 + projectile.arc * s - projectile.fall * s * s);
}

/**
 * What a corpse leaves behind.
 *
 * Weapons only. Ammunition now comes off the walls it is made of — sticks from wood, rocks from
 * stone — so killing restocks the special tools and demolition restocks the throwing arm. Each
 * entry is cumulative against one roll, so the last number is the total chance of any drop at all.
 */
const DROP_TABLE: readonly Readonly<{ kind: DemoPropKind; count: number; upTo: number }>[] = [
  { kind: "axe", count: 1, upTo: 0.1 },
  { kind: "bomb", count: 3, upTo: 0.3 },
];
export const LIFESTEAL_HEAL = 12;

/**
 * The single exit every enemy leaves the world through.
 *
 * Drowning, a stick through the chest, a bomb — all of them come here, so the drop chance and the
 * blessing payout cannot end up applying to some kill routes and not others.
 */
export function killEnemy(
  world: DemoWorld,
  enemy: DemoEnemy,
  cause: DemoDeathCause = "slain",
  direction?: DemoCellLike,
): void {
  const index = world.enemies.indexOf(enemy);

  if (index >= 0) {
    world.enemies.splice(index, 1);
  }

  world.deaths.push({
    id: enemy.id,
    appearance: enemy.appearance,
    x: enemy.x,
    y: enemy.y,
    progress: 0,
    cause,
    directionX: direction?.x ?? 0,
    directionY: direction?.y ?? 0,
  });
  world.kills += 1;
  burst(world.particles, "blood", enemy.x, enemy.y, 0.34, 18, {
    speed: 2.6,
    spreadZ: 2.9,
    gravity: 11,
    drag: 1.1,
    size: 0.07,
    life: 1.4,
  });
  // A pool directly under the body as well as the spray, so a kill always marks the spot even when
  // every droplet happens to fly off somewhere else.
  stainFloor(world, enemy.x, enemy.y, 0.5);

  if (hasBless(world.bless, "lifesteal")) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + LIFESTEAL_HEAL);
  }

  if (blocksWalk(world.maze, Math.floor(enemy.x), Math.floor(enemy.y))) {
    return;
  }

  const roll = Math.random();
  const drop = DROP_TABLE.find((entry) => roll < entry.upTo);

  if (drop) {
    world.props.push({ id: nextId(world, "prop"), kind: drop.kind, count: drop.count, x: enemy.x, y: enemy.y });
  }
}

export function damageEnemy(world: DemoWorld, enemy: DemoEnemy, amount: number, cause: DemoDeathCause = "slain"): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  enemy.hp -= amount;
  enemy.hurtSeconds = 0.28;

  if (enemy.hp <= 0) {
    killEnemy(world, enemy, cause);
  }
}

/** True when the straight segment between two points crosses no wall. Water does not block. */
/**
 * Whether an attack can be made along this line.
 *
 * Asks the projectile question, not the vision one, and the difference matters: a shooter that can
 * *see* you over a barricade but cannot *shoot* through it would happily line up, fire, and bury
 * every shot in the timbers forever. Using the same predicate the shot itself uses means it simply
 * does not take the shot, and walks until it has an angle — which is what cover is supposed to do.
 */
export function hasLineOfSight(maze: DemoMaze, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.ceil(distance * 8);

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;

    if (blocksProjectile(maze, Math.floor(x), Math.floor(y))) {
      return false;
    }
  }

  return true;
}
