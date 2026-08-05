/**
 * The run's whole mutable state, and the operations every rule reaches it through. Real time,
 * continuous coordinates, mutable, random — the declared deviation from the platform's determinism
 * expectation, recorded in the structure addendum. The world carries the catalog it was created with,
 * so every authored number the rules read arrives by injection rather than by import.
 */

import type { EnemyAppearanceId } from "@/core/combat/enemy-contract";
import { MELEE_SWING_SECONDS, type MeleeAttackId } from "@/core/combat/melee-contract";
import { blessMaxHpGain, createBlessState, grantBless, type BlessState } from "@/core/progression/bless";
import { coreBonus, type SealedReward } from "@/core/progression/sealed";
import type { GameCatalog } from "@/core/catalog";
import { attackCooldown, type EnemyArchetype } from "@/core/combat/enemy-contract";
import type { MapCastKind } from "@/core/floor/room-contract";
import { announce, raiseSfx, type DamageMark, type SfxEvent, type Vfx } from "@/core/feedback/run-feedback";
import {
  blocksProjectile,
  blocksWalk,
  buildFloor,
  gridArea,
  roll,
  standingRoom,
  tileIndex,
  type Crowd,
  type Maze,
} from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import type { ResolvedMap } from "@/core/floor/map-contract";
import { createParticleField, type ParticleField } from "@/core/combat/particles";
import type { ThrowKind } from "@/core/prop-contract";
import type { PropKind } from "@/core/prop-kinds";
import type { Enemy } from "@/core/enemy/enemy-state";
import { nextId } from "@/core/world/ids";

/** The enemy record and its vocabularies live beside the behaviour that reads them, and are state here. */
export type { Enemy, EnemyMind, Intent } from "@/core/enemy/enemy-state";

/** A pickup lying on the floor. A stack is taken in one grab and spent one throw at a time. */
export type Prop = {
  id: string;
  kind: PropKind;
  count: number;
  x: number;
  y: number;
};

export type Projectile = {
  id: string;
  kind: ThrowKind;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  travelled: number;
  range: number;
  /** Current forward speed in cells per second, and the floor it decays towards. */
  speed: number;
  drag: number;
  /** How much steeper the drop is than the rise; one is a symmetric arc. See `projectileHeight`. */
  plunge: number;
  /** What the arrival is worth: dust, camera, and how hard it barges through a crowd on the way. */
  thud: number;
  /** Total unbent rise over the flight, in cells: the aim slope times the range, negative when aimed down. */
  arc: number;
  /** How much of that rise gravity takes back. The javelin and the hammer leave it at zero and fly straight. */
  fall: number;
  /** A thrown enemy, so it can land and keep fighting if it survives the flight. */
  payload: Enemy | undefined;
  struck: Set<string>;
  /** Recent positions, newest last. Presentation only — the trail is drawn from it. */
  trail: { x: number; y: number; z: number }[];
  /** Enemies a piercing throw carries. Each leaves the world when run through and returns as a corpse. */
  skewered: Enemy[];
  /** Victims a cleaving throw has already taken, which is what limits a blade to three. */
  cleaved: number;
  /** Walls a reaping throw has opened. Its own counter: the hammer counts both, and only this ends its flight. */
  broke: number;
};

/** Incoming fire. A bolt is flat and stops at the first obstacle; a shell is airborne until it lands. */
export type HazardKind = "bolt" | "shell";

export type Hazard = {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  speed: number;
  travelled: number;
  range: number;
  damage: number;
  /** How hard the arrival shoves the player along its heading. A javelin has one, a bolt does not. */
  knockback: number;
  /** Flight curve, for a shell. A bolt leaves these flat and never consults them. */
  arc: number;
  fall: number;
  plunge: number;
  /** Radius the arrival covers. Zero for a bolt, which hurts only what it touches. */
  blastRadius: number;
};

/** What an emplacement is doing: holding a locked mark while the fuse burns, or waiting between shots. */
export type MortarPhase = "idle" | "locked";

/** What one emplacement is doing. Kept off the tile, which would put a firing timer on every tile. */
export type Mortar = {
  cellX: number;
  cellY: number;
  phase: MortarPhase;
  /** Seconds left of the current phase. */
  seconds: number;
  /** The spot the current lock is on. Meaningless while idle. */
  aimX: number;
  aimY: number;
};

/**
 * How an enemy died, which picks the corpse animation. Causes with no signature arrive as `slain`,
 * and `splattered` covers both ways of ending against a wall. `swallowed` and `drowned` animate
 * alike but stay separate, because a record naming the wrong one would be false.
 */
export type DeathCause = "slain" | "cleaved" | "drowned" | "swallowed" | "splattered" | "blasted" | "impaled";

export type Death = {
  id: string;
  appearance: EnemyAppearanceId;
  x: number;
  y: number;
  progress: number;
  cause: DeathCause;
  /** Direction the killing blow travelled, for deaths with an axis — currently only pinning. */
  directionX: number;
  directionY: number;
  archetypeId: MapCastKind;
  facingAngle: number;
};

export type Held =
  Readonly<{ kind: "prop"; prop: PropKind; count: number }> | Readonly<{ kind: "enemy"; enemy: Enemy }> | undefined;

export type Player = {
  x: number;
  y: number;
  angle: number;
  /** Vertical look, in radians above the horizontal. */
  pitch: number;
  /** Momentum the player is not in control of — currently only what a charger leaves behind. */
  pushX: number;
  pushY: number;
  hp: number;
  maxHp: number;
};

/** Which arm animation a press started: one of the eight cuts, or the throw, which is not a cut. */
export type SwingKind = MeleeAttackId | "throw";

/** How long one swing holds the arm. Owned by the drawing: the cuts are unreadable played faster. */
export const SWING_SECONDS = MELEE_SWING_SECONDS;

/** A throw is shorter, because the sword arm only dips out of the way rather than playing a cut. */
export const THROW_SWING_SECONDS = 0.26;

/** Where in the world a swing was aimed, so the arc can be drawn through it. */
export type SwingTarget = { x: number; y: number; z: number; connected: boolean } | undefined;

/** `extracted` is the only ending that keeps anything; `dead` is the only one that loses it. */
export type RunStatus = "playing" | "dead" | "extracted";

export type Altar = {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
};

/** The feedback channels declare their own shapes; the record below carries them, so they arrive here. */
export type { DamageMark, SfxEvent, Vfx, VfxSpec } from "@/core/feedback/run-feedback";

export type World = {
  /** The map this run plays. Descending draws a new floor from it rather than from somewhere else. */
  map: ResolvedMap;
  /** Every authored table the rules read, injected at creation. See `@/core/catalog`. */
  catalog: GameCatalog;
  maze: Maze;
  depth: number;
  player: Player;
  altar: Altar;
  bless: BlessState;
  enemies: Enemy[];
  props: Prop[];
  projectiles: Projectile[];
  hazards: Hazard[];
  /** What this tick sounded like. The rules push; the surface drains once per frame and plays. */
  sfxCues: SfxEvent[];
  /** One per standing emplacement, rebuilt from the floor whenever the floor is. */
  mortars: Mortar[];
  vfx: Vfx[];
  particles: ParticleField;
  /** How bloodied each cell is, indexed like the maze. Accumulates over a floor and is wiped with it. */
  stains: Float32Array;
  /** Bumped whenever `stains` changes, so the scene's overlay list can be reused between kills. */
  stainsVersion: number;
  deaths: Death[];
  /** Bumped when the terrain or altar changes; the scene's walls and structures rebuild only then. */
  terrainVersion: number;
  held: Held;
  /**
   * Debug: stops every enemy decision, reinforcements, and artillery, but not the consequences of
   * what the player did — timers run, knockback carries, deaths play through. Toggled by the P key.
   */
  mindsFrozen: boolean;
  /** Debug: stops the whole enemy pass, timers included. A hit flash stuck lit is correct. Toggled by O. */
  worldFrozen: boolean;
  /** Debug: the player takes every hit and shows it, and does not lose the points. Toggled by G. */
  godMode: boolean;
  status: RunStatus;
  elapsedSeconds: number;
  /** Where the run's clock stopped. `elapsedSeconds` keeps running, since the picture depends on it. */
  finishedSeconds: number | undefined;
  /** Seconds left of the animation. Also the whole input gate: a press above zero is ignored, unqueued. */
  swing: number;
  swingTotal: number;
  swingKind: SwingKind;
  /** Whether the swing has landed. A cut resolves at `MELEE_CUT_START`, not on the press. */
  swingResolved: boolean;
  swingTarget: SwingTarget;
  /** Rises when a swing connects, decays fast. Drives the impact hitch on the arm and the camera. */
  impact: number;
  /** A jolt of the view left by weight. The camera's, applied to pitch only, so it cannot cost a shot. */
  shake: number;
  spawnSeconds: number;
  hitFlash: number;
  /** Recent hits with a known origin, newest last. Presentation points at them; nothing else reads them. */
  damageMarks: DamageMark[];
  walkBob: number;
  /** Unbroken seconds on the hot spring's pad. Presentation only; healing is applied per step. */
  soakSeconds: number;
  /** The last difficulty level announced. The level is derived, so this is what makes a rise noticeable once. */
  announcedLevel: number;
  message: string;
  messageSeconds: number;
  /** Set when a blessing is awarded; the surface turns it into the card and then clears it. */
  pendingCard: string | undefined;
  nextId: number;
  kills: number;
  wallsBroken: number;
  /** Sealed rewards this run holds. Run state: `populateFloor` leaves it alone, so it survives a descent. */
  carried: SealedReward[];
};

/**
 * How close the player can get to anything solid. Also the cheap answer to near-field distortion: a
 * wall's projected top climbs with the square of how close the camera is.
 */
export const PLAYER_RADIUS = 0.32;
/** Wall clearance for every enemy. One number, so each fits the doorway it must stand in. See `footprint`. */
export const ENEMY_RADIUS = 0.3;
export const PLAYER_SPEED = 3.4;
export const REACH = 1.45;
export const ALTAR_HITS = 3;
/** What a run starts with before any core it carried out of an earlier one. */
export const PLAYER_BASE_MAX_HP = 150;

/** How far from the player a reinforcement must appear, so nothing pops into an occupied corridor. */
const SPAWN_CLEARANCE = 7;

/** How long the spawn clock waits before asking again. Not infinity: the crowd belongs to a room. */
export const IDLE_SPAWN_RECHECK_SECONDS = 1;

/** The crowd numbers where the player stands. The room's rather than the floor's, since enemies walk. */
export function crowdHere(world: World): Crowd {
  return standingRoom(world.maze, Math.floor(world.player.x), Math.floor(world.player.y)).crowd;
}

export const AMMO_KINDS: readonly PropKind[] = ["stick", "rock", "bomb"];

export function randomAmmo(): PropKind {
  return AMMO_KINDS[Math.floor(Math.random() * AMMO_KINDS.length)] ?? "rock";
}

/** How long an enemy waits before choosing where to go. A range, so a room does not move in phase. */
export function rollIdleSeconds(): number {
  return 2 + Math.random() * 2;
}

function walkableCells(maze: Maze): Cell[] {
  const cells: Cell[] = [];

  for (let y = 1; y < maze.height - 1; y += 1) {
    for (let x = 1; x < maze.width - 1; x += 1) {
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

/** How much floor an enemy takes up, against the player and against anything thrown at it. */
export function bodyFootprint(archetype: EnemyArchetype): number {
  return archetype.footprint ?? ENEMY_RADIUS;
}

/** Share of a floor that is obstacle rather than attacker. */
const SLIME_SHARE = 0.4;

const SLIME_KINDS: readonly MapCastKind[] = ["slimeGreen", "slimeBlue", "slimeRed"];

/** Everything with an attack, in even shares. */
const HUNTER_KINDS: readonly MapCastKind[] = ["swordsman", "hammerman", "javelineer", "crossbowman"];

/** Two rolls rather than one ladder, so adding to either list does not take floor space from the other. */
function pickArchetype(catalog: GameCatalog): EnemyArchetype {
  const pool = Math.random() < SLIME_SHARE ? SLIME_KINDS : HUNTER_KINDS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return catalog.archetypes[picked ?? "slimeGreen"];
}

/** How long an emplacement holds a mark before firing, and how long it stands between shots. */
export const MORTAR_LOCK_SECONDS = 5;
export const MORTAR_IDLE_SECONDS = 3;
/** How close to an emplacement something has to be for it to be unable to fire. This is the counter. */
export const MORTAR_DEAD_ZONE = 2;
export const SHELL_DAMAGE = 24;
/** Three tiles across: the radius is half of that. */
export const SHELL_BLAST_RADIUS = 1.5;

/** Gives every emplacement tile a cycle to run, with the opening idle staggered across the floor. */
export function collectMortars(maze: Maze): Mortar[] {
  const built: Mortar[] = [];

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.tiles[tileIndex(maze, x, y)]?.kind !== "mortar") {
        continue;
      }

      built.push({
        cellX: x,
        cellY: y,
        phase: "idle",
        seconds: Math.random() * MORTAR_IDLE_SECONDS,
        aimX: x + 0.5,
        aimY: y + 0.5,
      });
    }
  }

  return built;
}

export function createEnemy(world: World, x: number, y: number, archetype?: EnemyArchetype): Enemy {
  archetype ??= pickArchetype(world.catalog);
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
    attackCooldown: Math.random() * attackCooldown(archetype),
    pushX: 0,
    pushY: 0,
    repathSeconds: 0,
    waypoint: undefined,
    // Idling rather than wandering, so one spawning within notice engages on its first frame.
    mind: "idle",
    idleSeconds: rollIdleSeconds(),
    wanderCell: undefined,
    windupSeconds: 0,
    windupTotal: 0,
    intent: "none",
    aimX: x,
    aimY: y,
    chargeSeconds: 0,
    chargeX: 0,
    chargeY: 0,
    drowningSeconds: 0,
    facingAngle: Math.random() * Math.PI * 2,
    moving: false,
  };
}

/**
 * Stands every room's authored cast where its file says, returning how many the player's own room
 * stood, since the cap counts those too. The override replaces every kind and leaves every cell
 * alone, for filming one creature at a time. A cast cell is in room space, first interior cell 1,1.
 * Walkability is not checked: an enemy on masonry settles out, and one in water drowns.
 */
export function standCast(world: World, override?: MapCastKind): number {
  const standing = standingRoom(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));
  let here = 0;

  for (const room of world.maze.rooms) {
    for (const member of room.cast) {
      world.enemies.push(
        createEnemy(
          world,
          room.minX + member.x - 0.5,
          room.minY + member.y - 0.5,
          world.catalog.archetypes[override ?? member.kind],
        ),
      );

      if (room === standing) {
        here += 1;
      }
    }
  }

  return here;
}

/** Fills a new maze with everything but the player. Descending keeps health, hands, and blessings. */
export function populateFloor(world: World): void {
  const maze = world.maze;
  world.enemies = [];
  world.props = [];
  world.projectiles = [];
  world.hazards = [];
  world.vfx = [];
  world.mortars = collectMortars(maze);
  // Pointing at something on the floor above is worse than pointing nowhere.
  world.damageMarks = [];
  world.particles = createParticleField();
  world.stains = new Float32Array(gridArea(maze));
  world.stainsVersion += 1;
  world.deaths = [];
  world.terrainVersion += 1;
  world.altar = { hp: ALTAR_HITS, maxHp: ALTAR_HITS, x: maze.altar.x + 0.5, y: maze.altar.y + 0.5 };
  world.player.x = maze.entrance.x + 0.5;
  world.player.y = maze.entrance.y + 0.5;
  world.player.pitch = 0;

  // Read after the player is placed, because the numbers come from the room they are standing in.
  const crowd = crowdHere(world);
  world.spawnSeconds = crowd.reinforcement ? roll(crowd.reinforcement.every) : IDLE_SPAWN_RECHECK_SECONDS;

  // The authored cast first, exactly where it says. It ignores the distance rule below, because
  // standing an enemy at arm's reach is the point of authoring one.
  const staged = standCast(world);

  // Far enough that a floor opens with looking around rather than a swing.
  const spawnPool = walkableCells(maze).filter(
    (cell) => Math.hypot(cell.x + 0.5 - world.player.x, cell.y + 0.5 - world.player.y) > 6.5,
  );
  // Subtracted rather than clamped afterwards: the cap is the room's promise about how many are in
  // it, and an authored enemy is one of them.
  const count = Math.min(crowd.cap - staged, roll(crowd.starting) + world.depth - 1);

  for (let index = 0; index < count; index += 1) {
    const cell = takeRandom(spawnPool);

    if (!cell) {
      break;
    }

    world.enemies.push(createEnemy(world, cell.x + 0.5, cell.y + 0.5));
  }

  // Kit is the floor's rather than any one room's, so the main slot declares it: that is the one room
  // every map has, and a share per room would move every piece on every floor a seed has drawn.
  const kit = world.map.fixed.find((placement) => placement.slot === "main")?.room.scatter?.props;

  if (!kit) {
    return;
  }

  const propPool = walkableCells(maze);

  for (const [kind, quantity] of Object.entries(kit)) {
    const wanted = roll(quantity);

    for (let index = 0; index < wanted; index += 1) {
      const cell = takeRandom(propPool);

      if (!cell) {
        break;
      }

      world.props.push({
        id: nextId(world, "prop"),
        kind: kind as PropKind,
        count: 3,
        x: cell.x + 0.5,
        y: cell.y + 0.5,
      });
    }
  }
}

export function createWorld(map: ResolvedMap, catalog: GameCatalog): World {
  const maze = buildFloor(map);
  // A cursed core can roll health downward, so a floor is applied: a bad roll makes a run harder,
  // never unplayable before it begins.
  const startingMaxHp = Math.max(50, PLAYER_BASE_MAX_HP + coreBonus("maxHp"));
  const world: World = {
    map,
    catalog,
    maze,
    depth: 1,
    player: {
      x: maze.entrance.x + 0.5,
      y: maze.entrance.y + 0.5,
      angle: Math.random() * Math.PI * 2,
      pitch: 0,
      pushX: 0,
      pushY: 0,
      hp: startingMaxHp,
      // The one axis a core moves that is stored rather than read, so it is applied where the run is built.
      maxHp: startingMaxHp,
    },
    altar: { hp: ALTAR_HITS, maxHp: ALTAR_HITS, x: maze.altar.x + 0.5, y: maze.altar.y + 0.5 },
    bless: createBlessState(),
    enemies: [],
    props: [],
    projectiles: [],
    hazards: [],
    mortars: [],
    vfx: [],
    particles: createParticleField(),
    stains: new Float32Array(gridArea(maze)),
    stainsVersion: 0,
    deaths: [],
    sfxCues: [],
    terrainVersion: 0,
    held: undefined,
    mindsFrozen: false,
    worldFrozen: false,
    godMode: false,
    status: "playing",
    elapsedSeconds: 0,
    finishedSeconds: undefined,
    swing: 0,
    swingTotal: 0,
    swingKind: "horizontal-left",
    swingResolved: true,
    swingTarget: undefined,
    impact: 0,
    shake: 0,
    // Overwritten by `populateFloor` below, which reads it from the room the player lands in.
    spawnSeconds: 0,
    hitFlash: 0,
    damageMarks: [],
    walkBob: 0,
    soakSeconds: 0,
    announcedLevel: 0,
    message: "WASD to move - mouse to look - left click attacks - right click grabs - find the four side rooms",
    messageSeconds: 6,
    pendingCard: undefined,
    nextId: 0,
    kills: 0,
    wallsBroken: 0,
    carried: [],
  };

  populateFloor(world);
  return world;
}

/**
 * Knocks every wall out of the current floor, for the T key. Pools and barricades stay, so the
 * pathfinding worst case stays reproducible; the enemy count is topped up to the cap.
 */
export function flattenFloorForTesting(world: World): void {
  for (let y = 1; y < world.maze.height - 1; y += 1) {
    for (let x = 1; x < world.maze.width - 1; x += 1) {
      const tile = world.maze.tiles[tileIndex(world.maze, x, y)];

      if (tile && (tile.kind === "stone" || tile.kind === "wood")) {
        tile.kind = "open";
        tile.hp = 0;
        tile.maxHp = 0;
      }
    }
  }

  world.terrainVersion += 1;

  while (world.enemies.length < crowdHere(world).cap) {
    if (!spawnReinforcement(world)) {
      break;
    }
  }

  announce(world, "Test arena: walls cleared, pools and barricades kept, enemies topped up", 3);
}

/**
 * Adds one enemy somewhere the player is not looking at from close range, if the floor is not
 * already full. Returns whether one arrived, so the caller can say so.
 */
export function spawnReinforcement(world: World): boolean {
  if (world.enemies.length >= crowdHere(world).cap) {
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

export function awardBless(world: World): void {
  const granted = grantBless(world.catalog, world.bless);
  const healthGain = blessMaxHpGain(world.catalog, granted);

  world.player.maxHp += healthGain;
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + healthGain);
  world.pendingCard = granted.id;
  raiseSfx(world, "rewardGain");
  announce(world, `Blessing gained: ${granted.name}`, 3);
}

/** Ends the run. One door out of `playing`, so the clock and any pad cannot be released by only one exit. */
export function endRun(world: World, status: "dead" | "extracted"): void {
  if (status === "dead") {
    raiseSfx(world, "playerDeath");
  }

  world.status = status;
  world.finishedSeconds = world.elapsedSeconds;
  world.soakSeconds = 0;
}

/** How long the run has been going, which stops counting when the run does. */
export function runClockSeconds(world: World): number {
  return world.finishedSeconds ?? world.elapsedSeconds;
}

/**
 * Puts one loose prop on the floor, at the point asked for or the nearest side that is not masonry.
 * A throw ends inside the cell it struck, so a surviving prop is nudged back out to stay retrievable.
 */
export function dropProp(world: World, kind: PropKind, x: number, y: number, count = 1): void {
  let placedX = x;
  let placedY = y;

  if (blocksWalk(world.maze, Math.floor(x), Math.floor(y))) {
    for (const offset of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const candidateX = x + Math.cos(offset) * 0.55;
      const candidateY = y + Math.sin(offset) * 0.55;

      if (!blocksWalk(world.maze, Math.floor(candidateX), Math.floor(candidateY))) {
        placedX = candidateX;
        placedY = candidateY;
        break;
      }
    }
  }

  world.props.push({ id: nextId(world, "prop"), kind, count, x: placedX, y: placedY });
}

/** The one flight curve, shared by everything airborne. `fall` returns it to the floor at the range's end. */
export function flightHeight(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  return Math.max(0, flightDepth(travelled, range, arc, fall, plunge));
}

/**
 * The same curve unclamped, which is the only way to notice a throw aimed into the ground:
 * `flightHeight` clamps at zero, so a downward throw would flatten and carry on with no landing.
 */
export function flightDepth(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  const s = Math.min(1, Math.max(0, travelled / Math.max(0.0001, range)));
  return 0.5 + arc * s - fall * s ** (2 * plunge);
}

/**
 * Height of a projectile above the floor, in cells; collision reads it. Every throw leaves the hand
 * along the aim line. `plunge` bends the curve without moving either end, because the flown fraction
 * is one at the landing point: below one it descends for most of the flight, above one it drops late.
 */
export function projectileHeight(projectile: Projectile): number {
  return flightHeight(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge);
}

/** Whether this throw has reached the floor. Only a weapon that stops where it lands asks. */
export function projectileGrounded(projectile: Projectile): boolean {
  return flightDepth(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge) <= 0;
}

/** Height of a shell above the floor. A bolt's curve is flat, so this answers its fixed carry height. */
export function hazardHeight(hazard: Hazard): number {
  return flightHeight(hazard.travelled, hazard.range, hazard.arc, hazard.fall, hazard.plunge);
}

/**
 * Whether an attack can be made along this line. Asks the projectile question rather than the vision
 * one, so a shooter behind a barricade holds fire and walks until it has an angle.
 */
export function hasLineOfSight(maze: Maze, fromX: number, fromY: number, toX: number, toY: number): boolean {
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
