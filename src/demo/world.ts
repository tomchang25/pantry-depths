/**
 * Demo world state.
 *
 * Real time, continuous coordinates, mutable. Nothing in here is the shipped game's turn model —
 * this module deliberately owns its own truth so `src/core/` stays untouched.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { MELEE_SWING_SECONDS, type MeleeAttackId } from "@/content/viewmodel/melee-viewmodel";
import { blessMaxHpGain, createBlessState, grantBless, hasBless, type BlessState } from "@/demo/bless";
import { coreBonus, type SealedReward } from "@/demo/sealed";
import {
  attackCooldown,
  ENEMY_ARCHETYPES,
  isBoned,
  type DemoArchetypeId,
  type DemoEnemyArchetype,
  type DemoWindupIntent,
} from "@/demo/enemy-archetypes";
import {
  blocksProjectile,
  blocksWalk,
  DEMO_GRID_SIZE,
  generateDemoMaze,
  holdsStains,
  isWaterCell,
  sinkBody,
  tileIndex,
  type DemoCell,
  type DemoMaze,
} from "@/demo/maze";
import { burst, createParticleField, shatterBones, type DemoParticleField } from "@/demo/particles";
import type { DemoPropKind, DemoThrowKind } from "@/demo/throw-weight";

/** A grid coordinate as the demo passes it around; structurally the same as the maze's own cell. */
export type DemoCellLike = Readonly<{ x: number; y: number }>;

/**
 * What an enemy is currently committed to. A wind-up is visible to the player before it resolves.
 *
 * Built from the archetype's own declaration rather than listed again here, so an archetype that gains
 * a new kind of wind-up cannot end up with an intent no telegraph knows how to draw.
 */
export type DemoIntent = "none" | DemoWindupIntent;

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
  /**
   * Where a body that has lost interest in the player is walking, or nothing when it is chasing.
   *
   * Both halves of one state: holding a cell is what makes a wander a walk to somewhere rather than
   * a heading re-rolled every frame, and holding it *at all* is the flag that says this body is
   * currently wandering — which is what the re-acquire distance is measured against. Two fields
   * saying that would be two fields that can disagree.
   */
  wanderCell: DemoCell | undefined;
  /** Counts down through the telegraph; while above zero the enemy is committed and visibly winding up. */
  windupSeconds: number;
  windupTotal: number;
  intent: DemoIntent;
  /**
   * Where the current wind-up is aimed, taken when it began and never revised.
   *
   * The whole reason a telegraph can be trusted. Both committed attacks used to read the player's
   * live position at the moment they resolved, so a wind-up was a pause before an unavoidable hit and
   * anything drawn during it described where the player happened to be, not where the attack was
   * going. Written only by the wind-up entry point; every resolution and every drawn warning reads it.
   */
  aimX: number;
  aimY: number;
  chargeSeconds: number;
  chargeX: number;
  chargeY: number;
  /** Above zero while the body is sinking into a pool; it stops acting and dies when this expires. */
  drowningSeconds: number;
  /** World-space direction the authored eight-way sprite faces. */
  facingAngle: number;
  /** Recomputed by enemy movement each simulation step; presentation reads it for walk animation. */
  moving: boolean;
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
   * Current forward speed in cells per second, and the floor it decays towards.
   *
   * Speed used to be a constant read off the kind. Carrying it lets a throw shed it as it flies,
   * which is most of what tells a body apart from a stone; the floor is what guarantees a heavy
   * throw still reaches the end of its range instead of creeping towards it forever.
   */
  speed: number;
  drag: number;
  /** How much steeper the drop is than the rise; one is a symmetric arc. See `projectileHeight`. */
  plunge: number;
  /** What the arrival is worth: dust, camera, and how hard it barges through a crowd on the way. */
  thud: number;
  /**
   * Total unbent rise over the whole flight, in cells: the throw departs along the aim line, so
   * this is the aim slope times the range, negative when aimed down. The flight itself is still
   * two-dimensional; the height it implies is what collision consults.
   */
  arc: number;
  /**
   * How much of that rise gravity takes back, quadratically. Lobbed throws set it so the curve
   * lands exactly at the end of the range; line-flying weapons — the javelin and the hammer — leave
   * it at zero and simply fly where they were pointed.
   */
  fall: number;
  /** The body of a thrown enemy, so it can land and keep fighting if it survives the flight. */
  payload: DemoEnemy | undefined;
  struck: Set<string>;
  /** Recent positions, newest last. Presentation only — the trail is drawn from it. */
  trail: { x: number; y: number; z: number }[];
  /**
   * The bodies a piercing throw is carrying, up to that prop's own capacity — one for a stake, three
   * for a javelin. Each leaves the world the moment it is run through and comes back only as a corpse,
   * at the wall: being skewered is not a state anything is expected to survive. The shaft is drawn
   * from this list, which is why it is a list even when only one thing can be on it.
   */
  skewered: DemoEnemy[];
  /** Victims a cleaving throw has already taken, which is what limits a blade to three. */
  cleaved: number;
  /**
   * Walls a reaping throw has already opened, which is what limits the hammer to three.
   *
   * Its own counter rather than a second use of `cleaved`: the hammer counts both, and only one of
   * them is what ends its flight.
   */
  broke: number;
};

/**
 * Incoming fire, and what kind of thing is arriving.
 *
 * A bolt is a shooter's flat spit: it stops at the first thing in its way and hurts whoever it hits
 * on the way past. A shell is the emplacement's, and behaves like nothing else in the demo — it is
 * genuinely airborne, so it passes over walls and over heads and concerns nobody until it lands.
 */
export type DemoHazardKind = "bolt" | "shell";

export type DemoHazard = {
  id: string;
  kind: DemoHazardKind;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  speed: number;
  travelled: number;
  range: number;
  damage: number;
  /**
   * How hard the arrival shoves the player, in the direction it was travelling.
   *
   * A javelin has one and a bolt does not. It is a small push — enough to cost the player the ground
   * they were standing on and nowhere near enough to take control away — and it is what makes a
   * three-second telegraph worth respecting rather than merely surviving.
   */
  knockback: number;
  /** Flight curve, for a shell. A bolt leaves these flat and never consults them. */
  arc: number;
  fall: number;
  plunge: number;
  /** Radius the arrival covers. Zero for a bolt, which hurts only what it touches. */
  blastRadius: number;
};

/**
 * What an emplacement is doing right now.
 *
 * Two beats and nothing else: holding a locked mark while the fuse burns, or standing between shots.
 * Which one it is decides everything drawn on the floor around it.
 */
export type DemoMortarPhase = "idle" | "locked";

/**
 * The floor's own artillery, as a behaviour.
 *
 * Deliberately not the same object as the block it stands on. The maze tile owns whether an
 * emplacement exists, how solid it is, and how much breaking it has left in it; this owns only what
 * it is doing about it. Merging the two would put a firing timer on every tile in the dungeon.
 */
export type DemoMortar = {
  cellX: number;
  cellY: number;
  phase: DemoMortarPhase;
  /** Seconds left of the current phase. */
  seconds: number;
  /** The spot the current lock is on. Meaningless while idle. */
  aimX: number;
  aimY: number;
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
 * body, a blast leaves pieces of it across the floor, and the spikes empty it where it fell.
 * Everything without a signature of its own — rocks, falls, lightning — deflates as "slain".
 *
 * `splattered` is the wall: a javelin that nailed it there and a throw that slammed it in are the
 * same statement about the body, and it is not a statement about a corpse — what is left is a mark
 * on the masonry, so both come through one cause rather than two that render alike.
 */
export type DemoDeathCause = "slain" | "cleaved" | "drowned" | "splattered" | "blasted" | "impaled";

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
  archetypeId: DemoArchetypeId;
  facingAngle: number;
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

/** Which arm animation a press started: one of the eight cuts, or the throw, which is not a cut. */
export type DemoSwingKind = MeleeAttackId | "throw";

/**
 * How long one swing holds the arm.
 *
 * Owned by the drawing, not by this file, and that direction is the point. The eight cuts are a
 * three-pose illusion tuned at this pace; playing them faster does not make a fast attack, it makes
 * an unreadable one. So the world takes the animation's number rather than the animation being
 * squeezed into the world's.
 *
 * The bill is real and worth writing down: a swing was 0.32s and could be mashed as fast as a mouse
 * allows, so the same damage now lands at a little over half the old rate. Melee damage itself is
 * untouched — one knob, `BASE_MELEE_DAMAGE` in `actions.ts`, closes that gap whenever it is judged to
 * matter.
 */
export const SWING_SECONDS = MELEE_SWING_SECONDS;

/**
 * A throw is shorter, because a throw is the other hand's.
 *
 * The sword arm has no cut to play for it — it only dips out of the way — and holding the player for
 * three quarters of a second to watch that would be charging swing money for a shrug.
 */
export const THROW_SWING_SECONDS = 0.26;

/** Where in the world a swing was aimed, so the arc can be drawn through it. */
export type DemoSwingTarget = { x: number; y: number; z: number; connected: boolean } | undefined;

/**
 * A hit the player took, remembered long enough to point at where it came from.
 *
 * The world position is the whole design. Storing the screen angle instead would nail the mark to the
 * frame, so turning to face the attacker would drag the warning around with the view and leave it
 * pointing somewhere the threat is not — which is worse than drawing nothing, because it answers the
 * question wrongly rather than leaving it open.
 *
 * Severity scales how loud the mark is and never how long it lasts. A heavy hit should be louder, not
 * still on screen after the thing that landed it has been dealt with.
 */
export type DemoDamageMark = {
  x: number;
  y: number;
  age: number;
  life: number;
  severity: number;
};

/** How long a direction mark stays up, and how many can be on screen before the oldest is dropped. */
export const DAMAGE_MARK_SECONDS = 1.3;
export const MAX_DAMAGE_MARKS = 8;
/** The hit size that fills a mark out completely; anything heavier is already at full strength. */
const DAMAGE_MARK_FULL = 20;

/** `extracted` is the only ending that keeps anything; `dead` is the only one that loses it. */
export type DemoStatus = "playing" | "dead" | "extracted";

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
  /** One per standing emplacement, rebuilt from the floor whenever the floor is. */
  mortars: DemoMortar[];
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
  /**
   * Debug: the player still takes every hit and shows it, and simply does not lose the points.
   *
   * The flash, the shove, and the announcement all fire, because a run spent invulnerable has to
   * still tell you what would have killed you. Toggled by the G key.
   */
  godMode: boolean;
  status: DemoStatus;
  elapsedSeconds: number;
  /**
   * Where the run's clock stopped, or unset while it is still running.
   *
   * `elapsedSeconds` cannot be that clock on its own: it drives the torch's flicker, the walk bob, and
   * every drifting plume, so freezing it would freeze the picture behind the end screen. It keeps
   * running and this records the moment the run stopped counting — which is what the level, the
   * readout, and the ending's own Time stat are actually asking for.
   */
  finishedSeconds: number | undefined;
  /**
   * Seconds left of the animation, counting down from `swingTotal`. Presentation reads these two.
   *
   * Also the whole of the input gate: a press while this is above zero is ignored outright. There is
   * no queue and no buffer, because there is no chain to be early for — eight cuts, each its own
   * press, and the one thing a player can do wrong is press during a swing, which costs them nothing.
   */
  swing: number;
  swingTotal: number;
  swingKind: DemoSwingKind;
  /**
   * Whether this swing has already reached the thing it was aimed at.
   *
   * A cut lands at `MELEE_CUT_START` through the animation rather than on the press. Without that the
   * enemy dies while the sword is still going up, and the three quarters of a second that follows is
   * a picture drawn over something already settled.
   */
  swingResolved: boolean;
  swingTarget: DemoSwingTarget;
  /** Rises when a swing connects, decays fast. Drives the impact hitch on the arm and the camera. */
  impact: number;
  /**
   * A jolt of the view left by weight: a heavy throw leaving the hand, or a body arriving.
   *
   * Separate from `impact`, which the arm reads — this one is the camera's, and like the blast kick
   * it is applied to pitch only, so shaking it can never cost the player a shot.
   */
  shake: number;
  spawnSeconds: number;
  hitFlash: number;
  /** Recent hits with a known origin, newest last. Presentation points at them; nothing else reads them. */
  damageMarks: DemoDamageMark[];
  walkBob: number;
  /**
   * Unbroken seconds the player has stood on the hot spring's pad.
   *
   * Presentation reads it and nothing else does: the healing is applied per step from the step's own
   * length, so this is here to drive the green edge the screen answers a soak with — the counterpart
   * of the red arcs a hit leaves. Zeroed the moment the pad is left.
   */
  soakSeconds: number;
  /**
   * The difficulty level the run has already told the player about.
   *
   * The level itself is derived from the clock and the depth and is never stored; this is only the
   * last value that was announced, so a rise can be noticed exactly once.
   */
  announcedLevel: number;
  message: string;
  messageSeconds: number;
  /** Set when a blessing is awarded; the surface turns it into the card and then clears it. */
  pendingCard: string | undefined;
  nextId: number;
  kills: number;
  wallsBroken: number;
  /**
   * Sealed rewards this run is holding.
   *
   * Run state, not floor state: `populateFloor` deliberately leaves it alone, so it survives every
   * descent and is lost only with the run itself.
   */
  carried: SealedReward[];
};

/**
 * How close the player can get to anything solid.
 *
 * Also the only cheap answer to the near-field distortion at a wall. A wall column is projected as
 * its height over the depth, so its top climbs with the *square* of how close you are: at 0.26 cells
 * the top of a one-storey wall sweeps about seven screen-heights per cell of approach, which is what
 * reads as the wall suddenly growing as you walk into it. Standing a little further off cuts that
 * rate by a third for a sixth of a cell of clearance, and a one-cell corridor still has room to spare.
 */
export const PLAYER_RADIUS = 0.32;
/**
 * Wall clearance for every body on the floor, and nothing else.
 *
 * One number on purpose. A body sized for the corridor is a body that fits through the doorway it is
 * meant to be standing in; giving the large slime a large clearance would wedge it in corners and
 * leave it unable to block the thing it exists to block. How much floor a body takes up against the
 * player and against a thrown weapon is its `footprint`, which is a different circle.
 */
export const ENEMY_RADIUS = 0.3;
export const PLAYER_SPEED = 3.4;
export const REACH = 1.45;
export const ALTAR_HITS = 3;
/** What a run starts with before any core it carried out of an earlier one. */
export const PLAYER_BASE_MAX_HP = 150;

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

/** How much floor a body takes up, against the player and against anything thrown at it. */
export function bodyFootprint(archetype: DemoEnemyArchetype): number {
  return archetype.footprint ?? ENEMY_RADIUS;
}

/** Two thirds of a floor comes after you; the rest of it is simply in the way. */
const SLIME_SHARE = 0.4;

const SLIMES: readonly DemoEnemyArchetype[] = [
  ENEMY_ARCHETYPES.slimeGreen,
  ENEMY_ARCHETYPES.slimeBlue,
  ENEMY_ARCHETYPES.slimeRed,
];

/** Everything with an attack, in even shares: four bodies that stop, commit, and can be read. */
const HUNTERS: readonly DemoEnemyArchetype[] = [
  ENEMY_ARCHETYPES.swordsman,
  ENEMY_ARCHETYPES.hammerman,
  ENEMY_ARCHETYPES.javelineer,
  ENEMY_ARCHETYPES.crossbowman,
];

/**
 * Two rolls rather than one ladder: what kind of thing this is, then which of them.
 *
 * The colours split their share evenly because they are three sizes of one entity and no one of them
 * is the ordinary case. Keeping the two rolls apart is what lets a type be added to either list
 * without silently taking floor space away from the other.
 */
function pickArchetype(): DemoEnemyArchetype {
  const pool = Math.random() < SLIME_SHARE ? SLIMES : HUNTERS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked ?? ENEMY_ARCHETYPES.slimeGreen;
}

/** How long an emplacement holds a mark before firing, and how long it stands between shots. */
export const MORTAR_LOCK_SECONDS = 5;
export const MORTAR_IDLE_SECONDS = 3;
/**
 * How close to an emplacement a body has to be for it to be unable to fire at it.
 *
 * The counter to the whole thing, and the reason it can afford to range across the entire floor:
 * walking up to one is always safe, so smashing it is always available.
 */
export const MORTAR_DEAD_ZONE = 2;
export const SHELL_DAMAGE = 24;
/** Two tiles across: the radius is half of that. */
export const SHELL_BLAST_RADIUS = 1;

/**
 * Finds every emplacement standing on a floor and gives each one a cycle to run.
 *
 * The tiles are the authority on which exist; this list only carries what they are doing. Staggering
 * the opening idle means a fresh floor does not fire every mortar it has on the same beat.
 */
export function collectMortars(maze: DemoMaze): DemoMortar[] {
  const built: DemoMortar[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      if (maze.tiles[tileIndex(x, y)]?.kind !== "mortar") {
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
    attackCooldown: Math.random() * attackCooldown(archetype),
    pushX: 0,
    pushY: 0,
    repathSeconds: 0,
    waypoint: undefined,
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
  world.mortars = collectMortars(maze);
  // Pointing at a body on the floor above is worse than pointing nowhere.
  world.damageMarks = [];
  world.particles = createParticleField();
  world.stains = new Float32Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE);
  world.stainsVersion += 1;
  world.deaths = [];
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
  // A cursed core can roll health downward, so the floor of one is what a run starts with rather than
  // the base: a bad roll makes a run harder, never unplayable before it begins.
  const startingMaxHp = Math.max(50, PLAYER_BASE_MAX_HP + coreBonus("maxHp"));
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
      hp: startingMaxHp,
      // A core carried out of an earlier run changes what this one starts with. It is the one axis a
      // core moves that is stored rather than read, so it is applied where the run is built.
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
    stains: new Float32Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE),
    stainsVersion: 0,
    deaths: [],
    terrainVersion: 0,
    held: undefined,
    enemiesPaused: false,
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
    spawnSeconds: SPAWN_INTERVAL_SECONDS,
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

  announce(world, "Test arena: walls cleared, pools and barricades kept, enemies topped up", 3);
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
 * Both sources — smashing an altar and taking the stairs down — come through here, so the card and
 * the bar can never drift apart between them.
 */
export function awardBless(world: DemoWorld): void {
  const granted = grantBless(world.bless);
  const healthGain = blessMaxHpGain(granted);

  world.player.maxHp += healthGain;
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + healthGain);
  world.pendingCard = granted.id;
  announce(world, `Blessing gained: ${granted.name}`, 3);
}

/**
 * Ends the run, whichever way it ended.
 *
 * One door out of `playing`, so the things that have to happen on the way through it cannot be done by
 * one exit and forgotten by the other: the clock stops, and any pad the player was standing on stops
 * paying into the screen.
 */
export function endRun(world: DemoWorld, status: "dead" | "extracted"): void {
  world.status = status;
  world.finishedSeconds = world.elapsedSeconds;
  world.soakSeconds = 0;
}

/** How long the run has been going, which stops counting when the run does. */
export function runClockSeconds(world: DemoWorld): number {
  return world.finishedSeconds ?? world.elapsedSeconds;
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

  // Nothing settles on a pool, filled or not. Recorded here as well as skipped at draw time, so a
  // cell that some future change opens up does not reveal blood that was never visible on it.
  if (!holdsStains(world.maze, cellX, cellY)) {
    return;
  }

  const index = cellY * DEMO_GRID_SIZE + cellX;
  world.stains[index] = Math.min(MAX_STAIN, (world.stains[index] ?? 0) + amount);
  world.stainsVersion += 1;
}

export function addVfx(world: DemoWorld, effect: DemoVfxSpec): void {
  world.vfx.push({ ...effect, id: nextId(world, "vfx") });
}

/** Records where a hit came from, so the frame can point at it until it fades. */
export function markDamageFrom(world: DemoWorld, amount: number, fromX: number, fromY: number): void {
  world.damageMarks.push({
    x: fromX,
    y: fromY,
    age: 0,
    life: DAMAGE_MARK_SECONDS,
    severity: Math.max(0.25, Math.min(1, amount / DAMAGE_MARK_FULL)),
  });

  if (world.damageMarks.length > MAX_DAMAGE_MARKS) {
    world.damageMarks.shift();
  }
}

/**
 * Puts one loose prop on the floor, at the point asked for or the nearest side of it that is not
 * masonry.
 *
 * A throw that ends against a wall ends *in* the cell it struck, so a prop that survives its landing
 * has to be walked back out of the stonework before it can be picked up again — otherwise the thing
 * you were promised you could retrieve is embedded in a wall a step out of reach.
 *
 * `count` is how many uses the stack holds, which for everything a throw leaves behind is one. It is
 * a parameter because a pile put down deliberately — a crossbow with shots still in it — is the same
 * placement problem and should not need a second function to get the wall nudge right.
 */
export function dropProp(world: DemoWorld, kind: DemoPropKind, x: number, y: number, count = 1): void {
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

/**
 * The one flight curve in the demo, shared by everything that leaves the ground.
 *
 * Split out of the throw so the emplacement's shell can use it rather than growing a second version
 * that starts identical and drifts. The mortar case is exactly what the `fall` term was written for:
 * given a range, choose a fall that brings the curve back to the floor precisely at the end of it.
 */
export function flightHeight(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  return Math.max(0, flightDepth(travelled, range, arc, fall, plunge));
}

/**
 * The same curve without the floor under it, which is the only way to notice a throw aimed into it.
 *
 * `flightHeight` clamps at zero, so a throw pointed down flattens against the ground and carries on
 * to the end of its range as though nothing happened — there is no landing event anywhere in the
 * flight because height can never go negative. The clamp stays exactly as it is, because every
 * lobbed throw in the demo depends on it; a weapon that is meant to stop where it touches down reads
 * this instead and watches for the crossing.
 */
export function flightDepth(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  const s = Math.min(1, Math.max(0, travelled / Math.max(0.0001, range)));
  return 0.5 + arc * s - fall * s ** (2 * plunge);
}

/**
 * Height of a projectile above the floor, in cells — simulation truth, not decoration.
 *
 * Every throw leaves the hand *along the aim line*, which is what makes an upward throw read as
 * flying up rather than shrinking away. Lobbed things then bend down under `fall` to touch the
 * ground exactly where the range runs out; line-flying weapons keep the launch slope the whole
 * way. An earlier version fixed the peak instead of the launch direction, and a skyward throw
 * departed almost level, crawling off under the crosshair.
 *
 * `plunge` bends that curve without moving either end of it. The fall term is raised to a power, and
 * since the flown fraction is one at the landing point the throw still touches down exactly where it
 * always did — what changes is where it spends the flight. Below one it tops out early and is on its
 * way down for most of the throw, which is a body; above one it carries flat and drops at the end,
 * which is a stone.
 */
export function projectileHeight(projectile: DemoProjectile): number {
  return flightHeight(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge);
}

/** Whether this throw has reached the floor. Only a weapon that stops where it lands asks. */
export function projectileGrounded(projectile: DemoProjectile): boolean {
  return flightDepth(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge) <= 0;
}

/** Height of a shell above the floor. A bolt's curve is flat, so this answers its fixed carry height. */
export function hazardHeight(hazard: DemoHazard): number {
  return flightHeight(hazard.travelled, hazard.range, hazard.arc, hazard.fall, hazard.plunge);
}

/**
 * What a boned body leaves besides its own bones.
 *
 * The bones themselves are guaranteed and picked by how it died; this is the roll on top of that, and
 * it is what makes crossing a room for a skeleton worth the trip. It is also the only such table
 * left. A slime carries no armoury and now drops nothing at all, which leaves two sources of weapons
 * on a floor: the things that were holding them, and the walls.
 */
const BONE_DROPS: readonly Readonly<{ kind: DemoPropKind; count: number; upTo: number }>[] = [
  { kind: "skeletonSkull", count: 1, upTo: 0.3 },
  { kind: "skeletonFemur", count: 1, upTo: 0.5 },
];

/**
 * The armoury half of the same roll: what this body was carrying, on the tenth of the table above it.
 *
 * Per appearance rather than per behaviour, because what a body drops is what it is holding and the
 * artwork is the only place that is true. A crossbow arrives with three shots in it and then the
 * stock itself is throwable, which is the behaviour it already has at a different count.
 */
const SKELETON_ARMOURY: Readonly<Partial<Record<EnemyAppearanceId, Readonly<{ kind: DemoPropKind; count: number }>>>> =
  {
    skeletonSwordsman: { kind: "skeletonSword", count: 1 },
    skeletonHammerman: { kind: "hammer", count: 1 },
    skeletonJavelineer: { kind: "skeletonJavelin", count: 1 },
    skeletonCrossbowman: { kind: "crossbow", count: 3 },
  };

/** Above this the roll leaves nothing, which is what four in every ten corpses do. */
const ARMOURY_UP_TO = 0.6;
export const LIFESTEAL_HEAL = 12;

/**
 * A body ending its flight in open water, and what the pool does with it.
 *
 * Hung off the single kill exit rather than off drowning, because how the body got into the water is
 * not the pool's business: one shoved in and left to sink, one that died of the landing, and one a
 * bomb dropped in are all the same body in the same water. Every one of them shows on the surface,
 * and the third fills the cell in.
 */
function swallowIntoPool(world: DemoWorld, enemy: DemoEnemy): void {
  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);

  if (!isWaterCell(world.maze, cellX, cellY)) {
    return;
  }

  const closed = sinkBody(world.maze, cellX, cellY);
  // Every body changes the surface, not only the one that fills it, so the terrain the scene is
  // built from is stale after each of them.
  world.terrainVersion += 1;

  if (closed) {
    announce(world, "The bodies close the pool over - it can be crossed now", 2.6);
  }
}

/**
 * The single exit every enemy leaves the world through.
 *
 * Drowning, a stick through the chest, a bomb — all of them come here, so the drop chance and the
 * blessing payout cannot end up applying to some kill routes and not others.
 */
/**
 * How hard a death threw the body apart, from a quiet collapse to a bomb.
 *
 * Drowning is the one that scatters nothing: a body going under does not come apart, it sinks, and
 * bones thrown off it would arrive above the water it just disappeared into.
 */
function deathViolence(cause: DemoDeathCause): number {
  if (cause === "blasted") {
    return 1;
  }

  if (cause === "cleaved" || cause === "splattered") {
    return 0.65;
  }

  if (cause === "impaled") {
    return 0.3;
  }

  if (cause === "drowned") {
    return 0;
  }

  if (cause === "slain") {
    return 0.25;
  }

  cause satisfies never;
  throw new Error("unknown skeleton death cause");
}

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
    archetypeId: enemy.archetype.id,
    facingAngle: enemy.facingAngle,
  });
  world.kills += 1;

  if (isBoned(enemy.archetype)) {
    // Called here rather than from each cause, so every route out of the world scatters the same
    // bones and none of them can be forgotten. How hard is the cause's business; what comes off the
    // body is not.
    shatterBones(world.particles, enemy.x, enemy.y, deathViolence(cause));
    burst(world.particles, "dust", enemy.x, enemy.y, 0.55, 5, {
      speed: 1.1,
      spreadZ: 1.4,
      gravity: 2,
      drag: 2,
      size: 0.12,
      life: 0.8,
    });
  } else {
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
  }

  swallowIntoPool(world, enemy);

  if (hasBless(world.bless, "lifesteal")) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + LIFESTEAL_HEAL);
  }

  if (!isBoned(enemy.archetype) || blocksWalk(world.maze, Math.floor(enemy.x), Math.floor(enemy.y))) {
    return;
  }

  const roll = Math.random();
  const armoury = SKELETON_ARMOURY[enemy.appearance];
  const drop = BONE_DROPS.find((entry) => roll < entry.upTo) ?? (armoury && roll < ARMOURY_UP_TO ? armoury : undefined);

  if (drop) {
    world.props.push({ id: nextId(world, "prop"), kind: drop.kind, count: drop.count, x: enemy.x, y: enemy.y });
  }
}

/**
 * Puts a body out for a while, and takes whatever it was committing to away from it.
 *
 * The commitment is the point. A stun used to set the timer and nothing else, and because the step
 * loop skips a stunned body before it reaches the wind-up, the wind-up did not run down — it froze.
 * So a skeleton clubbed mid-swing kept its telegraph painted on the floor, waited out the stun, and
 * then finished the attack at the spot the player had been standing when they threw the thing. The
 * interruption cost it time and nothing else, which is the opposite of what landing a hit should
 * buy.
 *
 * Clearing the intent here is also what makes every warning disappear on its own: the head marker,
 * the cut arc, the sight line and the charge lane all read the wind-up directly, so none of them
 * needs to know what a stun is.
 *
 * Longest wins. A body already lying down from a worse hit is not stood back up by a lesser one.
 */
export function stunEnemy(enemy: DemoEnemy, seconds: number): void {
  enemy.stunSeconds = Math.max(enemy.stunSeconds, seconds);
  enemy.windupSeconds = 0;
  enemy.intent = "none";
}

export function damageEnemy(
  world: DemoWorld,
  enemy: DemoEnemy,
  amount: number,
  cause: DemoDeathCause = "slain",
  direction?: DemoCellLike,
): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  enemy.hp -= amount;
  enemy.hurtSeconds = 0.28;

  if (enemy.hp <= 0) {
    killEnemy(world, enemy, cause, direction);
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
