/**
 * Projects the demo world into the shipped renderer's scene format.
 *
 * Everything the demo added since — pools, altars, wind-up markers, blasts, lightning arcs — is
 * expressed as ordinary scene sprites rather than as new renderer features. That is deliberate: a
 * sprite gets depth sorting, lighting, and wall occlusion for free, so a lightning arc drawn as a
 * string of sparks is correctly hidden by the wall between you and it.
 */

import type { EnemyAppearanceId } from "@/core/enemy-contract";
import entityDisplayJson from "@/content/enemies/entity-display.json";
import {
  entityDisplaysByAppearance,
  parseEntityDisplays,
  type EntityDisplay,
} from "@/content/enemies/entity-display-schema";
import { skeletonActions } from "@/content/enemies/skeleton-appearance";
import {
  SKELETON_DEATH_ANIMATIONS,
  SKELETON_DIRECTIONS,
  type SkeletonClipDefinition,
  type SkeletonDeathId,
} from "@/content/enemies/skeleton-death-definitions";
import { DEMO_ASSET_IDS, WARN_BLADE_STEPS } from "@/demo/demo-sprites";
import { ENEMY_ARCHETYPES } from "@/content/enemies/enemy-archetypes";
import {
  CHARGE_DISTANCE,
  isBoned,
  attackCooldown,
  attackReach,
  MELEE_CUT_HALF_ANGLE,
  STRIKE_SECONDS,
} from "@/core/enemy-contract";
import { DROWN_SECONDS } from "@/core/impacts";
import {
  blocksFlung,
  blocksProjectile,
  blocksWalk,
  DEMO_WALL_HEIGHT,
  holdsStains,
  ROOM_PAD_HALF,
  tileIndex,
} from "@/core/maze";
import { extractionShare } from "@/core/extraction";
import type { DemoParticleKind } from "@/core/particles";
import { BLESSING_HOLD_SECONDS } from "@/core/rooms";
import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind } from "@/content/presentation/prop-display-schema";
import { GAME_CATALOG } from "@/content/catalog";
import { propBehaviour, type DemoPropKind } from "@/core/prop-contract";
import type { DemoMaze, DemoRoom, DemoTile } from "@/core/maze";
import {
  bodyFootprint,
  hazardHeight,
  MORTAR_LOCK_SECONDS,
  projectileHeight,
  SHELL_BLAST_RADIUS,
  type DemoCellLike,
  type DemoDeath,
  type DemoDeathCause,
  type DemoEnemy,
  type DemoIntent,
  type DemoProjectile,
  type DemoWorld,
} from "@/core/world";
import type { PresentationRenderEffects } from "@/presentation/canvas-gameplay-renderer";
import type {
  RenderBeam,
  RenderBlob,
  RenderBlobFace,
  RenderBox,
  RenderEmitter,
  RenderFloorMaterial,
  RenderFloorDecal,
  RenderFloorOverlay,
  RenderFloorPatch,
  RenderLight,
  RenderParticle,
  RenderScene,
  RenderSprite,
  RenderSurface,
  RenderSurfaceMaterial,
} from "@/presentation/render-scene";

/** Indexed by hit points already lost, so the wall degrades one visible step per blow. */
const STONE_DAMAGE: readonly RenderSurfaceMaterial[] = [
  "demoAshlar",
  "demoAshlarWorn",
  "demoAshlarCracked",
  "demoAshlarFailing",
];
const WOOD_DAMAGE: readonly RenderSurfaceMaterial[] = ["woodWall", "woodWallCracked", "splinteredWoodWall"];

/** Storeys the outer boundary stands above the interior. */
const BORDER_STOREYS = 2;

/**
 * The roof is gone.
 *
 * A ceiling one cell above the head is the nearest surface in the scene, so it sweeps past faster
 * than anything else while walking — and fast optical flow close to the eye is what drives the
 * feeling of being moved rather than moving. The sky replaces it with something effectively
 * infinitely far away: it barely shifts as you walk and swings cleanly as you turn, which gives the
 * eye a fixed thing to read its own rotation against.
 */
const NIGHT_SKY = {
  horizonColor: [38, 30, 58] as const,
  zenithColor: [8, 7, 20] as const,
  stars: 220,
  moonAngle: 2.1,
};

/** The only thing on a floor still drawn through a wall, and only once the descent is unlocked. */
const EXIT_XRAY = { color: [138, 255, 190] as const, alpha: 0.95 };

export type DemoEntityProjectionContext = Readonly<{
  elapsedSeconds: number;
  camera: Readonly<{ x: number; y: number; angle: number }>;
}>;

export type DemoEntityProjection = Readonly<{
  blobs: readonly RenderBlob[];
  sprites: readonly RenderSprite[];
}>;

export type DemoEntityProjectionOptions = Readonly<{
  skeletonAnimation?: Readonly<{ animation: SkeletonClipDefinition; progress: number }>;
  /**
   * Display numbers to draw with instead of the authored ones.
   *
   * The seam the entity workbench tunes through. It is how a slider can show a body at a size that is
   * not yet saved anywhere — the authored table stays the answer for everything that is not being
   * previewed, and the game itself never passes this.
   */
  display?: EntityDisplay;
}>;

function entityProjectionContext(world: DemoWorld): DemoEntityProjectionContext {
  return {
    elapsedSeconds: world.elapsedSeconds,
    camera: { x: world.player.x, y: world.player.y, angle: world.player.angle },
  };
}
/** How many spark billboards a lightning arc is drawn with. */
const ARC_SEGMENTS = 7;

/**
 * A javelin holds its line: no tumble at all, just a slow nose-down as it carries.
 *
 * The tumble was what made the old stick read as a hatchet — an object turning end over end is a
 * thrown head, and one that stays pointed where it is going is a spear. That single difference is
 * now the whole distinction between the two weapons, so it belongs to them rather than to the
 * renderer.
 */
const STAKE_LENGTH = 0.95;
const STAKE_WIDTH = 0.055;
/** The javelin is the longer, thinner shaft, so a glance at one in flight says which is coming. */
const JAVELIN_LENGTH = 1.3;
const JAVELIN_WIDTH = 0.048;

/**
 * How each long, straight thing is drawn in flight, keyed by what it is.
 *
 * About the drawing and nothing else — a bolt is in here and does not pierce anything. A table rather
 * than a chain of kind tests, because there are several of these now and there will be more: the stake
 * is short, thick and timber, the javelin long, thin and bone, the bolt shorter and thinner again, and
 * a reader should be able to see all of it side by side.
 */
const FLYING_RODS: Readonly<
  Partial<
    Record<
      DemoPropKind,
      Readonly<{
        length: number;
        width: number;
        shaft: readonly [number, number, number];
        tip: readonly [number, number, number];
      }>
    >
  >
> = {
  stick: { length: STAKE_LENGTH, width: STAKE_WIDTH, shaft: [104, 66, 36], tip: [232, 214, 176] },
  skeletonJavelin: { length: JAVELIN_LENGTH, width: JAVELIN_WIDTH, shaft: [205, 191, 162], tip: [244, 237, 220] },
  skeletonJavelinCracked: {
    length: JAVELIN_LENGTH,
    width: JAVELIN_WIDTH,
    shaft: [168, 156, 132],
    tip: [214, 206, 188],
  },
  crossbowBolt: { length: 0.56, width: 0.038, shaft: [226, 218, 196], tip: [248, 244, 230] },
};

/**
 * The weapons that turn over end for end on the way, and what each one looks like doing it.
 *
 * A table beside `FLYING_RODS` rather than a third and fourth branch in the beam loop, and the hole
 * that motivated it was a real one: a spent crossbow declares itself a rod, so the sprite pass skips
 * it, and the beam pass knew about the hammer and the sword by name and about nothing else — so a
 * thrown crossbow stock was invisible for its whole flight. Two tables cover the two ways a long
 * thing can travel, and a rod that belongs to neither is a gap somebody can find.
 *
 * `spin` is radians of tumble per cell travelled. The heavier and clumsier the object the slower it
 * turns, which is most of what separates a blade whipping over from a stock cartwheeling.
 *
 * `guard` is the second bar a sword needs for its crosspiece, held square to the blade so the whole
 * thing reads as a cross turning rather than as a stick.
 */
type TumblingRod = Readonly<{
  length: number;
  width: number;
  spin: number;
  shaft: readonly [number, number, number];
  tip: readonly [number, number, number];
  guard?: Readonly<{
    length: number;
    width: number;
    shaft: readonly [number, number, number];
    tip: readonly [number, number, number];
  }>;
}>;

const TUMBLING_RODS: Readonly<Partial<Record<DemoPropKind, TumblingRod>>> = {
  hammer: { length: 0.46, width: 0.12, spin: 7.2, shaft: [88, 58, 32], tip: [214, 222, 232] },
  skeletonSword: {
    length: 0.72,
    width: 0.055,
    spin: 8.4,
    shaft: [162, 171, 182],
    tip: [238, 242, 248],
    guard: { length: 0.2, width: 0.045, shaft: [92, 62, 28], tip: [196, 150, 70] },
  },
  // The stock, once the shots are gone: a shorter, blunter, heavier thing than the sword, and it
  // turns over more slowly than either of the others because that is what a lump of timber does.
  crossbowSpent: { length: 0.54, width: 0.09, spin: 5.6, shaft: [154, 140, 116], tip: [186, 192, 200] },
};

/** Radians of tumble per cell travelled, for a prop drawn as a picture rather than as a rod. */
const PROP_TUMBLE = 5.6;

/**
 * A barricade's iron, sized against the cell it refuses to let anyone walk into.
 *
 * The reach is the number that matters: walking is blocked across the whole cell, so anything short
 * of the edge is floor a player can see and cannot use. A twentieth is left at each end so the bar
 * reads as a thing standing in the cell rather than as a seam running into the next one.
 *
 * Nothing stands above 0.7, which is the height a lob has to clear to cross a barricade — the rule
 * lives in `@/demo/maze`, and iron poking through the line it draws would be the art contradicting it.
 */
const BARRICADE_REACH = 0.46;
const BARRICADE_RAIL_WIDTH = 0.05;
const BARRICADE_RAIL_TOP = 0.12;
const BARRICADE_SPIKE_WIDTH = 0.05;
/** Where the arms cross, and one spike out along each of them. The arm offset is the rail's own. */
const BARRICADE_SPIKES = [
  { id: "middle", alongX: 0, alongY: 0, top: 0.68 },
  { id: "west", alongX: -0.33, alongY: 0, top: 0.58 },
  { id: "east", alongX: 0.33, alongY: 0, top: 0.58 },
  { id: "north", alongX: 0, alongY: -0.33, top: 0.58 },
  { id: "south", alongX: 0, alongY: 0.33, top: 0.58 },
] as const;

/** Projects the exact iron obstacle used by hazard checks and the entity workbench. */
export function projectDemoBarricade(cell: Readonly<{ x: number; y: number }>, wearValue = 0): RenderBox[] {
  const wear = Math.min(1, Math.max(0, wearValue));
  const iron: readonly [number, number, number] = [128 - wear * 44, 132 - wear * 46, 146 - wear * 50];
  const edge: readonly [number, number, number] = [196 - wear * 70, 204 - wear * 74, 220 - wear * 80];
  const built: RenderBox[] = [
    {
      id: `rail-${cell.x}-${cell.y}-east`,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      halfX: BARRICADE_REACH,
      halfY: BARRICADE_RAIL_WIDTH,
      bottom: 0,
      top: BARRICADE_RAIL_TOP,
      color: iron,
      topColor: edge,
    },
    {
      id: `rail-${cell.x}-${cell.y}-north`,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      halfX: BARRICADE_RAIL_WIDTH,
      halfY: BARRICADE_REACH,
      bottom: 0,
      top: BARRICADE_RAIL_TOP,
      color: iron,
      topColor: edge,
    },
  ];

  for (const spike of BARRICADE_SPIKES) {
    built.push({
      id: `spike-${cell.x}-${cell.y}-${spike.id}`,
      x: cell.x + 0.5 + spike.alongX,
      y: cell.y + 0.5 + spike.alongY,
      halfX: BARRICADE_SPIKE_WIDTH,
      halfY: BARRICADE_SPIKE_WIDTH,
      bottom: BARRICADE_RAIL_TOP,
      top: spike.top - wear * 0.18,
      color: iron,
      topColor: edge,
    });
  }

  return built;
}

/** Which picture each loose object is drawn from. Exported so the prop workbench previews the same one. */
export const PROP_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stick,
  rock: DEMO_ASSET_IDS.rock,
  bomb: DEMO_ASSET_IDS.bomb,
  hammer: DEMO_ASSET_IDS.hammer,
  skeletonSword: DEMO_ASSET_IDS.skeletonSword,
  skeletonSkull: DEMO_ASSET_IDS.skeletonSkull,
  skeletonFemur: DEMO_ASSET_IDS.skeletonFemur,
  skeletonFemurCracked: DEMO_ASSET_IDS.skeletonFemurCracked,
  skeletonJavelin: DEMO_ASSET_IDS.skeletonJavelin,
  skeletonJavelinCracked: DEMO_ASSET_IDS.skeletonJavelinCracked,
  crossbow: DEMO_ASSET_IDS.crossbow,
  crossbowSpent: DEMO_ASSET_IDS.crossbowSpent,
  crossbowBolt: DEMO_ASSET_IDS.crossbowBolt,
};

/**
 * How each pickup is drawn where it lies, as authored content.
 *
 * Was a literal table beside the drawing code, and the last five rows in it were guessed by copying a
 * neighbour and nudging — nobody had looked at a javelin or a crossbow on the floor at all. Tuned in
 * the prop workbench now, on its own tab, with a camera-distance slider and a stack-size slider beside
 * it because a single pickup and a stack of three are drawn differently.
 */
const PROP_DISPLAYS = propDisplaysByKind(parsePropDisplays(propDisplayJson));

/**
 * The authored display table, and the two questions it answers.
 *
 * Both numbers used to be literals in this file and both were tuned by editing, rebuilding and
 * playing — which is why a body's height was guessed at three times running. They are authored content
 * now, kept beside the enemy table where the structure addendum says sprite scale and anchors belong,
 * tuned in the entity workbench and saved from it.
 *
 * The scene reads them and never writes them, so a display value can never be changed by playing.
 */
const ENTITY_DISPLAYS = entityDisplaysByAppearance(parseEntityDisplays(entityDisplayJson));

function entityDisplay(appearance: EnemyAppearanceId): EntityDisplay {
  return ENTITY_DISPLAYS[appearance];
}

/** How tall a body drawn from authored artwork stands, in cells. */
export function bonedDisplayScale(appearance: EnemyAppearanceId, override?: EntityDisplay): number {
  return (override ?? entityDisplay(appearance)).bodyScale;
}

/**
 * The mark over a committed enemy, as its own function so a workbench can place one without a world.
 *
 * Exported for exactly that: the offset it applies is the number being tuned, and a tuning tool that
 * recomputed the placement itself would be tuning against its own arithmetic rather than the game's.
 */
export function warnMarkerSprite(enemy: DemoEnemy, override?: EntityDisplay): RenderSprite | undefined {
  if (enemy.windupSeconds <= 0 || enemy.intent === "none") {
    return undefined;
  }

  const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
  const display = override ?? entityDisplay(enemy.appearance);
  // Swells as the wind-up completes, so how much time is left is legible at a glance. Both halves of
  // that are authored: how big the mark is, and how much bigger it gets.
  const scale = display.markerScale + progress * display.markerSwell;
  const charge =
    enemy.intent === "melee"
      ? {
          frame: {
            column: Math.min(WARN_BLADE_STEPS - 1, Math.floor(progress * WARN_BLADE_STEPS)),
            row: 0,
            columns: WARN_BLADE_STEPS,
            rows: 1,
          },
        }
      : {};
  return {
    id: `${enemy.id}-warn`,
    x: enemy.x,
    y: enemy.y,
    placement: "billboard",
    assetId: warnAsset(enemy.intent),
    scale,
    verticalAnchor: -(crownHeight(enemy, override) + display.markerOffset) / scale,
    ...charge,
  };
}

/**
 * How far through going under an authored body is at the moment the water finishes it.
 *
 * Short of all the way. The last thing visible before the kill lands is a head still above the
 * surface, which is what makes the countdown read as a body failing to get out rather than as one
 * that already sank; the corpse takes it the rest of the way down.
 *
 * The split matters because a drowning spans two kinds of thing — one point one seconds of a living
 * enemy, then a corpse — and on screen it has to be one body going under. So the clip runs once
 * across both, and this is where the handover falls in it.
 *
 * A slime does all of this with `sink` and its own body height, and the renderer has always cut a
 * blob off at the floor line. The authored body had neither until now: it stood in the water playing
 * `idle` for the whole countdown, because `skeletonAnimation` had no clause for drowning at all.
 */
const DROWN_STAGE_AT_DEATH = 0.72;

/**
 * How far through going under a body is, from either side of the handover.
 *
 * One number drives both the frame and the height, because for this animation they are the same
 * statement: how far through the clip the body is *is* how far under the surface it is.
 */
function drownStage(enemy: DemoEnemy): number {
  if (enemy.drowningSeconds <= 0) {
    return 0;
  }

  return (1 - enemy.drowningSeconds / DROWN_SECONDS) * DROWN_STAGE_AT_DEATH;
}

function drownedCorpseStage(progress: number): number {
  return DROWN_STAGE_AT_DEATH + (1 - DROWN_STAGE_AT_DEATH) * Math.min(1, Math.max(0, progress));
}

function surfaces(world: DemoWorld): RenderSurface[] {
  const built: RenderSurface[] = [];

  for (let y = 0; y < world.maze.height; y += 1) {
    for (let x = 0; x < world.maze.width; x += 1) {
      const tile = world.maze.tiles[tileIndex(world.maze, x, y)];

      // A barricade is boxes, not a wall face, and so is a mortar. Leaving either in here is what
      // made a broken wood wall render as a cracked stone one: the cell was still emitting a
      // surface, and with its hit points spent the damage ladder picked its most ruined texture.
      if (
        !tile ||
        tile.kind === "open" ||
        tile.kind === "water" ||
        tile.kind === "trench" ||
        tile.kind === "filled" ||
        tile.kind === "barricade" ||
        tile.kind === "mortar"
      ) {
        continue;
      }

      if (tile.kind === "border") {
        // The boundary stands well above everything inside it. Under an open sky the interior walls
        // are low enough to see over from anywhere, and without a taller rim the whole floor reads
        // as a hedge maze rather than as somewhere with an outside.
        built.push({ cell: { x, y }, material: "demoFoundation", height: DEMO_WALL_HEIGHT + BORDER_STOREYS });
        continue;
      }

      // One step of damage per point lost, so every swing visibly moves the wall closer to failing
      // rather than nothing happening until a single mid-point swap.
      const lost = Math.max(0, tile.maxHp - tile.hp);
      const ladder = tile.kind === "wood" ? WOOD_DAMAGE : STONE_DAMAGE;
      const material: RenderSurfaceMaterial = ladder[Math.min(lost, ladder.length - 1)] ?? ladder[0] ?? "demoAshlar";
      built.push({ cell: { x, y }, material });
    }
  }

  return built;
}

function ground(id: string, x: number, y: number, assetId: string, scale: number): RenderSprite {
  return { id, x, y, placement: "ground", assetId, scale, verticalAnchor: 0 };
}

/** The largest pile that is drawn as separate objects. Beyond it the fan stops reading as a count. */
const MAX_DRAWN_COPIES = 3;

export type DemoPickupPlacement = Readonly<{
  id: string;
  kind: DemoPropKind;
  count: number;
  x: number;
  y: number;
  /** How far the pickup is riding its float this frame. A tool inspecting one holds it still at zero. */
  bob?: number;
  /**
   * Floor numbers to draw with instead of the authored ones.
   *
   * The seam a workbench tunes through: it is how a slider can show a pickup at a size that is not
   * saved anywhere yet, while the authored table stays the answer for everything else on the floor.
   */
  display?: Readonly<{ floorScale: number; floorAnchor: number }>;
}>;

/**
 * One pickup lying on the floor: its shadow, its glow, and however many of it there are.
 *
 * A function rather than a loop body because the prop workbench needs to draw exactly one of these
 * and there was nothing to call — so it kept its own copy of the arithmetic, with a comment saying
 * the two had to be read side by side whenever either moved. They were not, and the workbench went
 * on drawing three crossbows after the game had stopped.
 *
 * A stack of throwables shows as a fan, up to three, so its worth is legible before you walk over to
 * it. A stack of charges does not: a crossbow holding three shots is one crossbow, because what
 * leaves the hand is not the thing being held, and drawing it as a pile promised two weapons that
 * were never there.
 */
export function propPickupSprites(placement: DemoPickupPlacement): RenderSprite[] {
  const { id, kind, count, x, y } = placement;
  const bob = placement.bob ?? 0;
  const display = placement.display ?? PROP_DISPLAYS[kind];
  const copies = propBehaviour(GAME_CATALOG, kind).counts === "charges" ? 1 : Math.min(count, MAX_DRAWN_COPIES);
  const built: RenderSprite[] = [
    ground(`${id}-shadow`, x, y, DEMO_ASSET_IDS.dropShadow, 0.5 + copies * 0.06),
    ground(`${id}-glow`, x, y, DEMO_ASSET_IDS.groundGlow, 0.75 + copies * 0.1),
  ];

  for (let copy = 0; copy < copies; copy += 1) {
    const spread = (copy - (copies - 1) / 2) * 0.14;
    built.push({
      id: `${id}-${copy}`,
      x: x + spread,
      y: y + spread * 0.5,
      placement: "billboard",
      assetId: PROP_ASSETS[kind],
      scale: display.floorScale,
      verticalAnchor: -display.floorAnchor - bob - copy * 0.05,
    });
  }

  return built;
}

/** An intent that is actually being wound up, which is the only kind that has a marker. */
type CommittedIntent = Exclude<DemoIntent, "none">;

/**
 * Which shape floats over a committed enemy.
 *
 * A table rather than a test, and the difference was a real defect: the marker used to be chosen by
 * asking whether the intent was a charge, so the charge took the red mark and *everything else* took
 * the other one — which meant a skeleton raising its sword wore the shooter's badge. Naming every
 * member makes the compiler refuse a future intent that forgets to bring a shape.
 */
function warnAsset(intent: CommittedIntent): string {
  if (intent === "shoot") {
    return DEMO_ASSET_IDS.warnShoot;
  }

  if (intent === "charge") {
    return DEMO_ASSET_IDS.warnCharge;
  }

  if (intent === "melee") {
    return DEMO_ASSET_IDS.warnMelee;
  }

  intent satisfies never;
  throw new Error("unknown enemy intent");
}

/** The wind-up marker floating over a committed enemy, and the lane a charger has claimed. */
function telegraph(enemy: DemoEnemy, built: RenderSprite[]): void {
  const marker = warnMarkerSprite(enemy);

  if (marker) {
    built.push(marker);
  }
}

/** Where the top of an enemy sits, so anything worn over its head is worn over *its* head. */
function crownHeight(enemy: DemoEnemy, override?: EntityDisplay): number {
  return isBoned(enemy.archetype) ? bonedDisplayScale(enemy.appearance, override) : slimeBody(enemy.appearance).height;
}

const STUN_STARS = 3;
const STUN_ORBIT_RADIUS = 0.32;
const STUN_STAR_SCALE = 0.3;

/**
 * Three stars circling a dazed head, for as long as it is dazed.
 *
 * Stun had no picture at all, which mattered little while it lasted a second and a half and matters
 * a great deal now a stalled charge costs five. In a room with twenty bodies in it, a stopped enemy
 * and an enemy that has not noticed you look identical, and only one of them is worth crossing the
 * floor for.
 *
 * Real world positions rather than an overlay, so the far star goes behind the head and the near one
 * in front. Sprites have no per-instance opacity, so the ring arrives and leaves on scale.
 */
function stunStars(enemy: DemoEnemy, elapsedSeconds: number, built: RenderSprite[]): void {
  if (enemy.stunSeconds <= 0 || enemy.drowningSeconds > 0) {
    return;
  }

  // Shrinks away over the last quarter second, so the window closing is something you watch happen
  // rather than something you discover by swinging at a body that has already woken up. It arrives at
  // full size deliberately: the stun itself is instant — a body was just slammed into something — and
  // easing that in would misreport the one frame the player most needs to be sure about.
  const scale = STUN_STAR_SCALE * Math.min(1, enemy.stunSeconds / 0.25);
  const phase = enemyPhase(enemy.id);
  const crown = crownHeight(enemy);

  for (let index = 0; index < STUN_STARS; index += 1) {
    const angle = elapsedSeconds * 3.1 + phase + (index * Math.PI * 2) / STUN_STARS;
    // The ring is tilted, so it circles the head rather than sliding across it.
    const z = crown + 0.16 + Math.sin(angle) * 0.06;
    built.push({
      id: `${enemy.id}-stun-${index}`,
      x: enemy.x + Math.cos(angle) * STUN_ORBIT_RADIUS,
      y: enemy.y + Math.sin(angle) * STUN_ORBIT_RADIUS * 0.6,
      placement: "billboard",
      assetId: DEMO_ASSET_IDS.stunStar,
      scale,
      verticalAnchor: 0.5 - z / Math.max(0.0001, scale),
    });
  }
}

function skeletonDirection(cameraAngle: number, facingAngle: number): number {
  // Every raycaster billboard is parallel to the camera plane. Using the line from this particular
  // enemy to the player instead makes off-centre enemies progressively turn towards the viewer,
  // even while their projected motion stays horizontal — the crab-walk visible at screen edges.
  // The virtual viewer is opposite the camera's forward direction for every sprite on the plane.
  const viewerAngle = cameraAngle + Math.PI;
  const turn = (viewerAngle - facingAngle) / (Math.PI * 2);
  return ((Math.round(turn * SKELETON_DIRECTIONS) % SKELETON_DIRECTIONS) + SKELETON_DIRECTIONS) % SKELETON_DIRECTIONS;
}

function animationFrame(definition: SkeletonClipDefinition, progress: number): number {
  return Math.min(definition.frames - 1, Math.max(0, Math.floor(progress * definition.frames)));
}

/** One clip and where in it the body is, which is everything a boned sprite needs to be drawn. */
type SkeletonPose = Readonly<{ definition: SkeletonClipDefinition; frame: number }>;

function poseAt(definition: SkeletonClipDefinition, progress: number): SkeletonPose {
  return { definition, frame: animationFrame(definition, progress) };
}

/**
 * How long a wind-up or a recovery takes to reach its final pose, whatever the state's own length.
 *
 * Every other clip plays linearly across the time it is given, which is wrong for exactly these two:
 * a three-second wind-up spread evenly over four frames advances one frame every three quarters of a
 * second, and a slideshow reads as a body that has stopped working rather than one that is waiting.
 * So the raise happens quickly and the rest of the telegraph is spent holding the final pose — the
 * raise reads as a raise, and the wait reads as a body committed and unable to change its mind.
 *
 * Recovery runs the same curve reversed, which is what lets a six-second reload and a 1.8-second
 * follow-through use the same four frames and still both read.
 */
export const ATTACK_EASE_SECONDS = 0.45;

/** Progress into a clip that reaches its end in a fixed time and then holds there. */
function easeThenHold(elapsedSeconds: number): number {
  return Math.min(0.999, elapsedSeconds / ATTACK_EASE_SECONDS);
}

/**
 * The white an enemy takes on being hit, from one down to zero.
 *
 * Full white first and then gone, rather than fading out across the whole recoil the way the squash
 * does. A white that leaves at the speed of the body's own wobble reads as a colour the thing turned;
 * a white that is simply there and then away reads as the moment the blade arrived. Shared by both
 * kinds of enemy so a bone body and a boneless one answer a hit identically.
 */
function enemyHitFlash(enemy: DemoEnemy): number {
  return enemy.hurtSeconds > 0 ? Math.min(1, enemy.hurtSeconds / 0.16) : 0;
}

function skeletonAnimation(context: DemoEntityProjectionContext, enemy: DemoEnemy): SkeletonPose {
  if (enemy.drowningSeconds > 0) {
    // Going under outranks everything else it was doing, the same way the simulation drops its
    // wind-up and its charge on entry. It is the shared drowning death, reached while the body is
    // still alive, so the clip that plays during the countdown is the one the corpse carries on with.
    return poseAt(SKELETON_DEATH_ANIMATIONS.drowning, drownStage(enemy));
  }

  const actions = skeletonActions(enemy.appearance);

  if (enemy.hurtSeconds > 0) {
    return poseAt(actions.hurt, 1 - enemy.hurtSeconds / 0.28);
  }

  if (enemy.stunSeconds > 0) {
    // Above the attack states rather than below them. The simulation skips a stunned body before it
    // reaches the wind-up, so its wind-up timer keeps whatever was left on it — which used to leave a
    // skeleton clubbed mid-swing showing the raised sword with stars orbiting its head. It loops, so
    // a five-second stun is a body swaying rather than one frame held until it wears off.
    return loopedPose(context, enemy, actions.stunned);
  }

  if (enemy.windupSeconds > 0) {
    return poseAt(actions.windup, easeThenHold(enemy.windupTotal - enemy.windupSeconds));
  }

  if (enemy.attackPoseSeconds > 0) {
    // The one attack clip that plays at its own rate across the whole state and does not stretch.
    return poseAt(actions.strike, 1 - enemy.attackPoseSeconds / STRIKE_SECONDS);
  }

  if (enemy.attackCooldown > 0 && !enemy.moving) {
    // Recovery, and only while the body is standing in it. A cooldown no longer holds anything
    // still, so a skeleton that is walking it off has to walk: the clip is what a body gathering
    // itself looks like, and playing it over a chase would leave the feet frozen under a body
    // crossing the room.
    // Recovery is the wind-up's curve reversed: it leaves the follow-through quickly and then holds
    // the guard for whatever is left of the cooldown, so the free window is legible at six seconds
    // and at 1.8.
    const spent = attackCooldown(enemy.archetype) - enemy.attackCooldown;
    return poseAt(actions.recovery, easeThenHold(spent));
  }

  return loopedPose(context, enemy, enemy.moving ? actions.walk : actions.idle);
}

/** A clip cycling on its own frame rate, offset per body so a crowd does not move in lockstep. */
function loopedPose(
  context: DemoEntityProjectionContext,
  enemy: DemoEnemy,
  definition: SkeletonClipDefinition,
): SkeletonPose {
  const phase = enemyPhase(enemy.id) / (Math.PI * 2);
  const frame = Math.floor((context.elapsedSeconds * definition.framesPerSecond + phase) % definition.frames);
  return { definition, frame };
}

function skeletonSprite(
  context: DemoEntityProjectionContext,
  enemy: DemoEnemy,
  selected = skeletonAnimation(context, enemy),
  override?: EntityDisplay,
): RenderSprite {
  const definition = selected.definition;
  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    placement: "billboard",
    assetId: definition.assetId,
    scale: bonedDisplayScale(enemy.appearance, override),
    verticalAnchor: 0,
    // The same white a slime takes, on the same curve. A skeleton had only its hurt frames to say it
    // had been hit, and against a crowd at speed a frame swap is not an answer to "did that land?".
    flash: enemyHitFlash(enemy),
    submerged: drownStage(enemy),
    frame: {
      column: selected.frame,
      row: skeletonDirection(context.camera.angle, enemy.facingAngle),
      columns: definition.frames,
      rows: definition.directions,
    },
  };
}

/**
 * Which clip a corpse plays, or nothing at all.
 *
 * One situation, one clip, and no situation borrowing another's artwork — which is what the old
 * injury-shaped naming produced. A blasted body has no clip by design: a bomb does not knock a
 * skeleton over, it takes it apart, so that death is entirely a burst of bones and there is nothing
 * for the corpse itself to show. Exported so the workbench can scrub each clip at its own length.
 */
export function skeletonDeathAnimation(cause: DemoDeathCause): SkeletonDeathId | undefined {
  if (cause === "cleaved") {
    return "cleaved";
  }

  if (cause === "blasted") {
    return undefined;
  }

  if (cause === "impaled") {
    return "impaled";
  }

  if (cause === "splattered") {
    // Driven into masonry, thrown or pinned there. The body is a heap at the foot of the wall and
    // leaves no mark on it: the stain that exists for a soft body bursting against stone is a fact
    // about soft bodies, and bones do not stain.
    return "slammed";
  }

  if (cause === "drowned") {
    return "drowning";
  }

  if (cause === "slain") {
    return "collapse";
  }

  cause satisfies never;
  throw new Error("unknown skeleton death cause");
}

function skeletonDeathSprite(
  context: DemoEntityProjectionContext,
  death: DemoDeath,
  override?: EntityDisplay,
): RenderSprite | undefined {
  const animation = skeletonDeathAnimation(death.cause);

  if (animation === undefined) {
    return undefined;
  }

  const definition = SKELETON_DEATH_ANIMATIONS[animation];
  // A drowned corpse picks the clip up where the countdown left it and carries on down, so the water
  // closing over the body is one continuous performance rather than the clip restarting at frame zero
  // the instant the kill lands. It is gone by the end: what records it after that is the pool's own
  // fill material, not a corpse left lying on the surface. Every other death is played from the top
  // and stays above ground where it fell.
  const drowning = death.cause === "drowned";
  const stage = drowning ? drownedCorpseStage(death.progress) : Math.min(0.999, death.progress);
  return {
    id: `${death.id}-corpse`,
    x: death.x,
    y: death.y,
    placement: "billboard",
    assetId: definition.assetId,
    scale: bonedDisplayScale(death.appearance, override),
    verticalAnchor: 0,
    submerged: drowning ? stage : 0,
    frame: {
      column: animationFrame(definition, stage),
      row: skeletonDirection(context.camera.angle, death.facingAngle),
      columns: definition.frames,
      rows: definition.directions,
    },
  };
}

/** One authored skeleton riding a javelin, replacing the slime-shaped fallback used by blobs. */
function carriedSkeletonSprite(
  context: DemoEntityProjectionContext,
  projectile: DemoProjectile,
  enemy: DemoEnemy,
  index: number,
): RenderSprite {
  // Riding the shaft is being run through, which is the pose the impaled clip holds — and it holds
  // exactly one, so there is no point in the clip to pick out any more.
  const definition = SKELETON_DEATH_ANIMATIONS.impaled;
  const back = 0.3 + index * 0.3;
  const x = projectile.x - projectile.directionX * back;
  const y = projectile.y - projectile.directionY * back;

  return {
    id: `${projectile.id}-run-${index}`,
    x,
    y,
    placement: "billboard",
    assetId: definition.assetId,
    scale: bonedDisplayScale(enemy.appearance),
    // Level flight crosses the torso at half a cell, leaving the feet at their normal screen base.
    // A pitched throw raises or lowers the complete skeleton with the same trajectory as the shaft.
    verticalAnchor: -(projectileHeight(projectile) - 0.5) / bonedDisplayScale(enemy.appearance),
    frame: {
      column: 0,
      row: skeletonDirection(context.camera.angle, enemy.facingAngle),
      columns: definition.frames,
      rows: definition.directions,
    },
  };
}

function vfxSprites(world: DemoWorld, built: RenderSprite[]): void {
  for (const effect of world.vfx) {
    const life = Math.min(1, effect.age / effect.life);

    if (effect.kind === "blast") {
      built.push({
        id: effect.id,
        x: effect.x,
        y: effect.y,
        placement: "billboard",
        assetId: DEMO_ASSET_IDS.blast,
        // Expands and thins, which is the only way a still image reads as a detonation.
        scale: effect.radius * (0.5 + life * 1.3),
        verticalAnchor: -0.4,
      });

      // A ring of embers thrown outward along the ground. The fireball alone reads as a flash on the
      // camera; debris leaving the centre is what gives the blast a size you can judge.
      for (let ember = 0; ember < 10; ember += 1) {
        const angle = (ember / 10) * Math.PI * 2 + effect.x;
        const reach = effect.radius * (0.2 + life * 1.15);
        built.push({
          id: `${effect.id}-ember-${ember}`,
          x: effect.x + Math.cos(angle) * reach,
          y: effect.y + Math.sin(angle) * reach,
          placement: "billboard",
          assetId: DEMO_ASSET_IDS.blast,
          scale: 0.34 * (1 - life),
          verticalAnchor: -0.22 - life * 0.3,
        });
      }

      continue;
    }

    for (let segment = 0; segment <= ARC_SEGMENTS; segment += 1) {
      const t = segment / ARC_SEGMENTS;
      // A small perpendicular kink per segment, so the arc forks rather than reading as a ruler line.
      const jitter = Math.sin(t * Math.PI) * Math.sin(segment * 5.3 + effect.age * 40) * 0.16;
      const dx = effect.toX - effect.fromX;
      const dy = effect.toY - effect.fromY;
      const length = Math.max(0.0001, Math.hypot(dx, dy));
      built.push({
        id: `${effect.id}-${segment}`,
        x: effect.fromX + dx * t - (dy / length) * jitter,
        y: effect.fromY + dy * t + (dx / length) * jitter,
        placement: "billboard",
        assetId: DEMO_ASSET_IDS.spark,
        scale: 0.3 * (1 - life * 0.55),
        verticalAnchor: -0.45,
      });
    }
  }
}

function sprites(world: DemoWorld): RenderSprite[] {
  const built: RenderSprite[] = [];
  const projectionContext = entityProjectionContext(world);

  // Nothing a side room holds is shown through a wall any more, and the altar's floating rune is gone
  // with the rest. A floor's business is found by walking into the room that holds it — that is what
  // the four rooms cost the player, and an outline visible from across the floor refunds it.
  //
  // The shaft over the stairs survives, gated on the same task that unlocks the descent: before that
  // the way down is not a place the player is allowed to know, and after it there is nothing left to
  // hide.
  if (world.maze.progress.main.met) {
    built.push({
      id: "demo-exit-shaft",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      placement: "billboard",
      assetId: DEMO_ASSET_IDS.shaft,
      scale: 1.4,
      verticalAnchor: -0.36,
      xray: EXIT_XRAY,
    });
  }

  for (const prop of world.props) {
    built.push(
      ...propPickupSprites({
        id: prop.id,
        kind: prop.kind,
        count: prop.count,
        x: prop.x,
        y: prop.y,
        bob: Math.sin(world.elapsedSeconds * 2.2 + prop.x * 3 + prop.y * 5) * 0.06,
      }),
    );
  }

  for (const enemy of world.enemies) {
    built.push(...projectDemoEnemy(projectionContext, enemy).sprites);

    // Slimes stay blobs; authored enemies and all telegraphs share this depth-sorted sprite pass.
    telegraph(enemy, built);
    stunStars(enemy, world.elapsedSeconds, built);

    // A short spark at the point of contact. The white flash on the sprite says something landed;
    // this says where, which is what makes a crowded melee readable.
    if (enemy.hurtSeconds > 0) {
      built.push({
        id: `${enemy.id}-spark`,
        x: enemy.x,
        y: enemy.y,
        placement: "billboard",
        assetId: DEMO_ASSET_IDS.hitSpark,
        // Snaps out and shrinks over the flash, so it punctuates the hit instead of sitting on it.
        scale: 0.16 + (0.28 - enemy.hurtSeconds) * 0.7,
        verticalAnchor: -0.34,
      });
    }
  }

  for (const hazard of world.hazards) {
    if (hazard.kind === "shell") {
      // Drawn at the height it is actually at, the way a thrown prop is. A shell pinned to a fixed
      // carry height would read as a bolt sliding through the walls it is meant to be sailing over.
      const scale = 0.44;
      built.push({
        id: hazard.id,
        x: hazard.x,
        y: hazard.y,
        placement: "billboard",
        assetId: DEMO_ASSET_IDS.hazardOrb,
        scale,
        verticalAnchor: 0.5 - hazardHeight(hazard) / scale,
      });
      continue;
    }

    built.push({
      id: hazard.id,
      x: hazard.x,
      y: hazard.y,
      placement: "billboard",
      assetId: DEMO_ASSET_IDS.hazardOrb,
      scale: 0.34,
      verticalAnchor: -0.42,
    });
  }

  for (const projectile of world.projectiles) {
    // Anything lobbed marks where it is coming down; the shadow is the aiming feedback. Keyed on
    // `fall` because a downward lob has a negative rise, which the old arc check misread as flat.
    if (projectile.fall > 0) {
      built.push(ground(`${projectile.id}-shadow`, projectile.x, projectile.y, DEMO_ASSET_IDS.dropShadow, 0.5));
    }

    if (projectile.skewered.length > 0) {
      projectile.skewered.forEach((enemy, index) => {
        built.push(...projectCarriedDemoEnemy(projectionContext, projectile, enemy, index).sprites);
      });
    }

    // Bodies riding a projectile are built beside their own presentation kind: authored skeleton
    // sprites here, soft blobs in `blobs` below.
    if (projectile.kind === "enemy") {
      continue;
    }

    const form = propBehaviour(GAME_CATALOG, projectile.kind).form;

    // Long flying weapons are beams, not pictures of one; see `beams`.
    if (form === "rod") {
      continue;
    }

    const scale = PROP_DISPLAYS[projectile.kind].floorScale * 0.8;
    built.push({
      id: projectile.id,
      x: projectile.x,
      y: projectile.y,
      placement: "billboard",
      assetId: PROP_ASSETS[projectile.kind],
      scale,
      // Centred on the display arc, so a lob rises and a slam drops with the curve.
      verticalAnchor: 0.5 - projectileHeight(projectile) / scale,
      // A bone turns end over end as it goes. A rock does not, and a picture of one sliding flat
      // through the air with its shading pinned to the wall behind it is the tell that it is a
      // picture — which is exactly what the skeleton's parts looked like before this.
      ...(form === "tumbling" ? { spin: projectile.travelled * PROP_TUMBLE } : {}),
    });
  }

  for (const death of world.deaths) {
    built.push(...projectDemoDeath(projectionContext, death).sprites);
  }

  vfxSprites(world, built);
  return built;
}

/**
 * What a body driven into a wall leaves on it.
 *
 * A decal on the face rather than a blob in front of it: the blob is a stack of horizontal rings, so
 * it can be flattened into a puddle on the floor and can never be laid against something vertical.
 * The renderer culls a wall sprite seen from behind its own face and narrows it as the view goes
 * oblique, so a mark drawn this way belongs to the wall rather than hovering near it.
 *
 * The face is read back from the throw: the mark is on the side the javelin came from, which is the
 * only side it can be seen from.
 */
function wallMark(death: DemoDeath): RenderSprite {
  const spread = Math.min(1, death.progress / 0.3);
  // Onto the plane. The body comes to rest inside the open cell in front of the wall, so the cell
  // boundary it was travelling towards is the face — pulled back a hair so the mark draws in front
  // of the masonry rather than inside it. Only the axis of travel is snapped; the other one keeps
  // the body's own position, which is what spreads a row of marks along the wall.
  const acrossX = Math.abs(death.directionX) >= Math.abs(death.directionY);
  const face = acrossX ? snapToFace(death.x, death.directionX) : snapToFace(death.y, death.directionY);
  return {
    id: `${death.id}-mark`,
    x: acrossX ? face : death.x,
    y: acrossX ? death.y : face,
    placement: "wall",
    assetId: DEMO_ASSET_IDS.wallSplat,
    wallFace: wallMarkFace(death),
    // Hits at speed and spreads, then holds. Nothing about a stain moves after the first moment.
    scale: 0.58 + spread * 0.34,
    // Hung low enough on the face that even a mark this size stays on the masonry where the walls
    // are a single storey and everything above them is sky.
    verticalAnchor: -0.12,
  };
}

/** How far off a wall a mark sits, so it draws in front of the masonry rather than inside it. */
const WALL_MARK_CLEARANCE = 0.04;

function snapToFace(along: number, direction: number): number {
  return direction > 0 ? Math.ceil(along) - WALL_MARK_CLEARANCE : Math.floor(along) + WALL_MARK_CLEARANCE;
}

/**
 * Which face of the wall the mark is on, from the direction the throw was travelling.
 *
 * Typed off the sprite rather than from the grid's own vocabulary, because the demo owns no facings
 * of its own and has no other reason to import the game's.
 */
function wallMarkFace(death: DemoDeath): NonNullable<RenderSprite["wallFace"]> {
  if (Math.abs(death.directionX) >= Math.abs(death.directionY)) {
    return death.directionX > 0 ? "west" : "east";
  }

  return death.directionY > 0 ? "north" : "south";
}

/**
 * How tall a slime stands and what colour it is, per appearance.
 *
 * How wide it is left with the archetype, as its footprint, because that number is also the shove it
 * gives the player and the target a thrown weapon has to hit. Keeping a second copy of it here is
 * how the drawn body and the bumped body drift apart, and the whole point of the three colours is
 * that a player can judge one from the other.
 */
type SlimeBody = Readonly<{ height: number; color: readonly [number, number, number] }>;

// Monotonic, so the colour tells the player the size and the size tells them the health. The set
// these replace ran green, blue, red as small, tall, squat, which taught nothing.
const SLIME_BODIES: Readonly<Partial<Record<EnemyAppearanceId, SlimeBody>>> = {
  greenSlime: { height: 0.3, color: [118, 198, 92] },
  blueSlime: { height: 0.42, color: [96, 152, 218] },
  redSlime: { height: 0.56, color: [216, 92, 86] },
};

const FALLBACK_BODY: SlimeBody = {
  height: 0.46,
  color: [160, 160, 160],
};

/** Body dimensions and colour for an appearance, shared with the viewmodel's held display. */
export function slimeBody(appearance: EnemyAppearanceId): SlimeBody {
  return SLIME_BODIES[appearance] ?? FALLBACK_BODY;
}

/** Stable per-enemy phase so a crowd does not bounce in lockstep. */
function enemyPhase(id: string): number {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }

  return hash * 0.35;
}

/**
 * A living slime, deformed by whatever it is currently doing.
 *
 * Everything is derived from simulation state the world already tracks; the body is how that state
 * looks, not new state of its own. Later clauses override earlier ones, so being hurt interrupts a
 * lunge visually the same way it reads in play.
 */
function enemyBlob(context: DemoEntityProjectionContext, enemy: DemoEnemy): RenderBlob {
  const body = SLIME_BODIES[enemy.appearance] ?? FALLBACK_BODY;
  const footprint = bodyFootprint(enemy.archetype);
  const t = context.elapsedSeconds;
  const phase = enemyPhase(enemy.id);
  const toPlayerX = context.camera.x - enemy.x;
  const toPlayerY = context.camera.y - enemy.y;
  const distance = Math.max(0.0001, Math.hypot(toPlayerX, toPlayerY));
  const towardX = toPlayerX / distance;
  const towardY = toPlayerY / distance;

  let squash = 1;
  let wobbleAmp = 0.035;
  let wobblePhase = t * 5 + phase;
  let leanX = 0;
  let leanY = 0;
  let flash = 0;
  let sink = 0;
  let face: RenderBlobFace = "normal";

  const acting = enemy.stunSeconds > 0 || enemy.windupSeconds > 0 || enemy.attackPoseSeconds > 0;

  if (!acting) {
    // Gait: a bounce in time with its own speed, landing squashed and leaving stretched.
    squash = 1 + Math.sin(t * (5.5 + enemy.archetype.speed * 2.2) + phase) * 0.08;
  }

  if (enemy.stunSeconds > 0) {
    // Dazed: flattened, swaying slowly.
    squash = 0.85;
    wobbleAmp = 0.07;
    wobblePhase = t * 3 + phase;
  }

  if (enemy.windupSeconds > 0) {
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);

    if (enemy.intent === "shoot") {
      // Filling, not gathering to leap: a shooter takes on the shot before spitting it, so it rises
      // and rounds out. The crouch below belongs to the charger, and if both bodies did the same
      // thing the marker over their heads would be the only way to tell a shot from a charge.
      squash = 1 + progress * 0.22;
      wobbleAmp = 0.03 + progress * 0.05;
      wobblePhase = t * (6 + progress * 10) + phase;
    } else {
      // Anticipation: crouched and pulled back off the target, pulsing with the telegraph.
      squash = 0.82 - progress * 0.08;
      leanX = -towardX * 0.1;
      leanY = -towardY * 0.1;
    }

    // Held well under the hit flash. Both are the same white channel, and a telegraph that pulses up
    // near full white leaves nothing for a landed blow to say.
    flash = 0.14 + 0.2 * Math.abs(Math.sin(t * (10 + 14 * (1 - enemy.windupSeconds))));
    face = "attack";
  } else if (enemy.chargeSeconds > 0) {
    // Mid-charge: stretched flat out along its committed lane.
    squash = 1.2;
    leanX = enemy.chargeX * 0.26;
    leanY = enemy.chargeY * 0.26;
    face = "attack";
  } else if (enemy.attackPoseSeconds > 0) {
    // Releasing: lunging up and into the player.
    squash = 1.18;
    leanX = towardX * 0.16;
    leanY = towardY * 0.16;
    face = "attack";
  }

  if (enemy.hurtSeconds > 0) {
    const hurt = Math.min(1, enemy.hurtSeconds / 0.28);
    squash *= 0.78 + 0.22 * (1 - hurt);
    wobbleAmp = 0.16 * hurt;
    wobblePhase = t * 40;
    flash = Math.max(flash, enemyHitFlash(enemy));
    face = "hurt";
  }

  if (enemy.drowningSeconds > 0) {
    // Sinking. The bubbles above it are emitters; the body just goes under.
    const gone = 1 - enemy.drowningSeconds / DROWN_SECONDS;
    sink = -(body.height + 0.15) * gone;
    wobbleAmp = 0.1;
    face = "hurt";
  }

  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    radius: footprint,
    height: body.height,
    color: body.color,
    squash,
    leanX,
    leanY,
    wobbleAmp,
    wobblePhase,
    sink,
    droop: 0,
    flash,
    alpha: 1,
    face,
  };
}

function easeOut(t: number): number {
  return t * (2 - t);
}

/** How many pieces a body comes apart into when a blast takes it. */
const SHATTER_PIECES = 7;

/**
 * A body blown apart: pieces thrown outward, each landing and settling where it comes down.
 *
 * The old blast death was a single flash of overinflation and then nothing at all, which left the
 * particle spray to carry the whole thing and read as the body vanishing. Pieces read as a body
 * being taken apart, and they stay where they land for as long as any other corpse does.
 *
 * Every piece is placed from the death's own id, so the same body always breaks the same way.
 */
function shatteredBlobs(
  death: DemoDeath,
  corpse: RenderBlob,
  body: SlimeBody,
  footprint: number,
  t: number,
): RenderBlob[] {
  const seed = enemyPhase(death.id);
  const flight = Math.min(1, t / 0.45);
  const settle = easeOut(flight);
  const built: RenderBlob[] = [];

  for (let piece = 0; piece < SHATTER_PIECES; piece += 1) {
    const angle = seed + (piece / SHATTER_PIECES) * Math.PI * 2;
    // Alternating near and far, so the pieces do not land on one neat ring around the crater.
    const reach = (0.4 + (piece % 3) * 0.26) * settle;
    const size = footprint * (0.24 + ((piece * 7) % 5) * 0.05);
    built.push({
      ...corpse,
      id: `${death.id}-piece-${piece}`,
      x: death.x + Math.cos(angle) * reach,
      y: death.y + Math.sin(angle) * reach,
      radius: size,
      height: body.height * 0.4,
      // Up and over: thrown clear, then flat on the floor where it stops.
      sink: Math.max(0, Math.sin(flight * Math.PI) * 0.55),
      squash: 1 - 0.55 * settle,
      wobbleAmp: 0.12 * (1 - settle),
      wobblePhase: t * 30 + piece,
      flash: 0.5 * (1 - flight),
      alpha: t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34,
    });
  }

  return built;
}

/** The corpse, one animation per way of dying. Empty once there is nothing left of it to show. */
function deathBlobs(death: DemoDeath): RenderBlob[] {
  const body = SLIME_BODIES[death.appearance] ?? FALLBACK_BODY;
  const footprint = bodyFootprint(ENEMY_ARCHETYPES[death.archetypeId]);
  const t = Math.min(1, Math.max(0, death.progress));
  const corpse: RenderBlob = {
    id: `${death.id}-corpse`,
    x: death.x,
    y: death.y,
    radius: footprint,
    height: body.height,
    color: body.color,
    squash: 1,
    leanX: 0,
    leanY: 0,
    wobbleAmp: 0,
    wobblePhase: t * 12,
    sink: 0,
    droop: 0,
    flash: 0,
    alpha: 1,
  };

  if (death.cause === "blasted") {
    return shatteredBlobs(death, corpse, body, footprint, t);
  }

  if (death.cause === "cleaved") {
    const k = easeOut(t);
    return [
      {
        ...corpse,
        squash: 0.92,
        alpha: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4,
        split: { separation: 0.06 + k * 0.3, tilt: k * 0.6, drop: k * k * 0.1 },
      },
    ];
  }

  if (death.cause === "splattered") {
    // Nothing here. What is left of a body that ended against a wall is the mark it made, which is a
    // decal drawn by `sprites` — a ring stack cannot be laid flat against anything vertical.
    return [];
  }

  if (death.cause === "impaled") {
    // Run through, and held there. The first pass at this deflated the body onto the floor, which is
    // what every other death already does — so it read as an ordinary one that happened faster.
    //
    // What makes spikes spikes is that the body never reaches the ground: it is stopped partway
    // down, punched through, and hangs on the iron with its top folded over. So this one keeps its
    // volume and its height and gives up its posture instead.
    const punch = Math.min(1, t / 0.18);
    const hang = easeOut(t);
    return [
      {
        ...corpse,
        // Dropped onto the points and stopped there, well clear of the floor.
        sink: 0.26 - 0.05 * hang,
        squash: 1 - 0.34 * punch - 0.08 * hang,
        // Folding over the tops of the spikes, which is the whole silhouette of this death.
        droop: 0.08 + hang * 0.44,
        // Sagging off to one side as it settles onto the iron rather than staying upright on it.
        // The side is taken from the body's own id: nothing about being shoved onto spikes has a
        // direction worth recording, but two bodies folding the same way reads as a copy.
        leanX: Math.cos(enemyPhase(death.id)) * hang * 0.14,
        leanY: Math.sin(enemyPhase(death.id)) * hang * 0.14,
        radius: footprint * (1 - 0.16 * hang),
        wobbleAmp: 0.22 * (1 - punch),
        wobblePhase: t * 34,
        flash: 0.6 * (1 - punch),
        alpha: t < 0.76 ? 1 : 1 - (t - 0.76) / 0.24,
      },
    ];
  }

  if (death.cause === "drowned") {
    // Already under; what remains is the water closing over it.
    return [
      {
        ...corpse,
        sink: -(body.height * (0.75 + 0.25 * t)),
        wobbleAmp: 0.14 * (1 - t),
        wobblePhase: t * 18,
        alpha: 1 - t,
      },
    ];
  }

  // Slain, no signature: deflating into a puddle, edges rippling as it settles.
  const k = easeOut(t);
  return [
    {
      ...corpse,
      squash: 1 - 0.88 * k,
      wobbleAmp: 0.1 * (1 - k),
      wobblePhase: t * 14,
      alpha: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
    },
  ];
}

/** A body carried through the air: skewered on the javelin, or thrown whole and flailing. */
function carriedBlob(
  id: string,
  appearance: EnemyAppearanceId,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  t: number,
  lift: number,
  impaled: boolean,
  footprint: number,
): RenderBlob {
  const body = SLIME_BODIES[appearance] ?? FALLBACK_BODY;
  return {
    id,
    x,
    y,
    radius: footprint * (impaled ? 0.9 : 1),
    height: body.height,
    color: body.color,
    // A skewered body is compressed on the shaft and holds still; a thrown one flails the whole way.
    squash: impaled ? 0.72 : 0.95 + Math.sin(t * 16) * 0.08,
    leanX: directionX * (impaled ? 0.16 : 0.1),
    leanY: directionY * (impaled ? 0.16 : 0.1),
    wobbleAmp: impaled ? 0.05 : 0.11,
    wobblePhase: t * 30,
    // A skewered body has the shaft through its middle, so its base hangs half a body below the line
    // the javelin flies along. A thrown one is on no shaft and rides the display arc itself, base on
    // the curve, which is how every prop in the air is placed.
    sink: impaled ? lift - body.height / 2 : lift,
    droop: impaled ? 0.1 : 0,
    flash: impaled ? 0.25 : 0,
    alpha: 1,
    face: "hurt",
  };
}

/** Projects one living body without adding combat telegraphs or hit particles around it. */
export function projectDemoEnemy(
  context: DemoEntityProjectionContext,
  enemy: DemoEnemy,
  options: DemoEntityProjectionOptions = {},
): DemoEntityProjection {
  if (isBoned(enemy.archetype)) {
    const selected = options.skeletonAnimation
      ? poseAt(options.skeletonAnimation.animation, options.skeletonAnimation.progress)
      : undefined;
    return { blobs: [], sprites: [skeletonSprite(context, enemy, selected, options.display)] };
  }

  return { blobs: [enemyBlob(context, enemy)], sprites: [] };
}

/** Projects one corpse, including the wall decal that replaces a splattered blob body. */
export function projectDemoDeath(
  context: DemoEntityProjectionContext,
  death: DemoDeath,
  options: DemoEntityProjectionOptions = {},
): DemoEntityProjection {
  if (isBoned(ENEMY_ARCHETYPES[death.archetypeId])) {
    // A death with no clip projects nothing. The bones already went everywhere when it was killed.
    const sprite = skeletonDeathSprite(context, death, options.display);
    return { blobs: [], sprites: sprite ? [sprite] : [] };
  }

  if (death.cause === "splattered") {
    return { blobs: [], sprites: [wallMark(death)] };
  }

  return { blobs: deathBlobs(death), sprites: [] };
}

/** Projects a body carried on a flying stick at the same offset used by the live demo. */
export function projectCarriedDemoEnemy(
  context: DemoEntityProjectionContext,
  projectile: DemoProjectile,
  enemy: DemoEnemy,
  index: number,
): DemoEntityProjection {
  if (isBoned(enemy.archetype)) {
    return { blobs: [], sprites: [carriedSkeletonSprite(context, projectile, enemy, index)] };
  }

  const back = 0.3 + index * 0.3;
  return {
    blobs: [
      carriedBlob(
        `${projectile.id}-run-${index}`,
        enemy.appearance,
        projectile.x - projectile.directionX * back,
        projectile.y - projectile.directionY * back,
        projectile.directionX,
        projectile.directionY,
        context.elapsedSeconds,
        // The shaft's own height, so a pitched throw carries its bodies with it. This was a flat 0.3
        // — right only for a level throw, and detached from the javelin the moment one had an arc,
        // while the authored body on the same shaft has always tracked it.
        projectileHeight(projectile),
        true,
        bodyFootprint(enemy.archetype),
      ),
    ],
    sprites: [],
  };
}

function blobs(world: DemoWorld): RenderBlob[] {
  const built: RenderBlob[] = [];
  const projectionContext = entityProjectionContext(world);

  for (const enemy of world.enemies) {
    built.push(...projectDemoEnemy(projectionContext, enemy).blobs);
  }

  for (const death of world.deaths) {
    built.push(...projectDemoDeath(projectionContext, death).blobs);
  }

  for (const projectile of world.projectiles) {
    if (projectile.skewered.length > 0) {
      projectile.skewered.forEach((enemy, index) => {
        built.push(...projectCarriedDemoEnemy(projectionContext, projectile, enemy, index).blobs);
      });
      continue;
    }

    if (projectile.kind === "enemy" && projectile.payload) {
      built.push(
        carriedBlob(
          projectile.id,
          projectile.payload.appearance,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          world.elapsedSeconds,
          // Riding the same display arc the props fly, so a thrown body slams and lobs too.
          projectileHeight(projectile),
          false,
          bodyFootprint(projectile.payload.archetype),
        ),
      );
    }
  }

  return built;
}

/**
 * How much of an altar is left, from one down to zero.
 *
 * The stone, the light it throws, the rune over it and the embers off it all read from this one
 * number, so an altar can never look half-broken and shine as though it were untouched.
 */
function altarShare(world: DemoWorld): number {
  return world.altar.maxHp > 0 ? Math.max(0, world.altar.hp) / world.altar.maxHp : 0;
}

/**
 * The cursed altar's stone: dark red, and the only red structure on a floor.
 *
 * It used to be the same grey-violet as the masonry, which made the one thing on the floor that pays a
 * curse look like part of the building. Colour is the whole of how the two altars are told apart at a
 * distance — this one is red and asks to be broken, the pale one is white and asks to be stood in —
 * because neither carries a label and nothing on the map says which room holds which.
 */
const ALTAR_STONE: readonly [number, number, number] = [92, 38, 42];
const ALTAR_RUINED_STONE: readonly [number, number, number] = [52, 21, 25];

/**
 * Where each piece knocked off an altar comes to rest, in cells from its centre.
 *
 * Fixed rather than rolled. The terrain is rebuilt whenever anything on the floor changes, so a
 * random scatter would pick new places for the same debris every time a wall came down.
 */
const ALTAR_DEBRIS: readonly Readonly<{ x: number; y: number; half: number; top: number }>[] = [
  { x: 0.54, y: -0.28, half: 0.11, top: 0.09 },
  { x: -0.42, y: 0.48, half: 0.09, top: 0.07 },
  { x: 0.08, y: 0.6, half: 0.13, top: 0.11 },
];

function weathered(wear: number): readonly [number, number, number] {
  return [
    ALTAR_STONE[0] + (ALTAR_RUINED_STONE[0] - ALTAR_STONE[0]) * wear,
    ALTAR_STONE[1] + (ALTAR_RUINED_STONE[1] - ALTAR_STONE[1]) * wear,
    ALTAR_STONE[2] + (ALTAR_RUINED_STONE[2] - ALTAR_STONE[2]) * wear,
  ];
}

/** The lit top face an overhead light would leave, so a slab never reads as flat as its sides. */
function litFace(color: readonly [number, number, number]): [number, number, number] {
  return [Math.min(255, color[0] * 1.58), Math.min(255, color[1] * 1.56), Math.min(255, color[2] * 1.5)];
}

/**
 * The altar, one shape per swing it has taken.
 *
 * A plinth that stood identical through two of its three hits and then became rubble told the player
 * nothing until it was over. This is the same ladder the walls and the caltrops already climb: the
 * capstone is knocked further off true and loses more of itself with every blow, the shaft is shorter
 * under it, the stone darkens, and each piece that comes off is still lying on the floor afterwards —
 * so how much of an altar somebody has already spent is legible from across the room and from behind.
 */
function altarBoxes(world: DemoWorld): RenderBox[] {
  const altar = world.altar;
  const damage = Math.min(altar.maxHp, Math.max(0, altar.maxHp - altar.hp));
  const wear = altar.maxHp > 0 ? damage / altar.maxHp : 0;
  const stone = weathered(wear);
  const shaftTop = 0.5 - damage * 0.05;
  const built: RenderBox[] = [
    { id: "altar-base", x: altar.x, y: altar.y, halfX: 0.34, halfY: 0.34, bottom: 0, top: 0.16, color: stone },
    {
      id: "altar-shaft",
      x: altar.x,
      y: altar.y,
      halfX: 0.24 - damage * 0.02,
      halfY: 0.24 - damage * 0.02,
      bottom: 0.16,
      top: shaftTop,
      color: stone,
    },
  ];

  if (altar.hp > 0) {
    // The capstone carries most of the damage because it is the part that reads at a distance: it
    // shifts off centre, narrows on the struck side, and settles lower against the shaft.
    const lean = damage * 0.07;
    built.push({
      id: "altar-cap",
      x: altar.x + lean,
      y: altar.y - lean * 0.6,
      halfX: 0.33 - damage * 0.07,
      halfY: 0.33 - damage * 0.03,
      bottom: shaftTop,
      top: shaftTop + 0.12 - damage * 0.02,
      color: stone,
      topColor: litFace(stone),
    });
  } else {
    // Spent: the top is gone and what is left is the snapped shaft, too low to be mistaken for one
    // still worth swinging at.
    built.push({
      id: "altar-stump",
      x: altar.x,
      y: altar.y,
      halfX: 0.27,
      halfY: 0.27,
      bottom: shaftTop,
      top: shaftTop + 0.05,
      color: stone,
      topColor: litFace(ALTAR_RUINED_STONE),
    });
  }

  for (let index = 0; index < damage; index += 1) {
    const piece = ALTAR_DEBRIS[index];

    if (!piece) {
      continue;
    }

    built.push({
      id: `altar-debris-${index}`,
      x: altar.x + piece.x,
      y: altar.y + piece.y,
      halfX: piece.half,
      halfY: piece.half * 0.78,
      bottom: 0,
      top: piece.top,
      color: stone,
      topColor: litFace(stone),
    });
  }

  return built;
}

const BLESSING_STONE: readonly [number, number, number] = [226, 224, 232];
const BLESSING_STONE_LIT: readonly [number, number, number] = [252, 251, 255];
const SPRING_STONE: readonly [number, number, number] = [138, 164, 186];
const SPRING_WATER: readonly [number, number, number] = [86, 158, 190];
const CANISTER_METAL: readonly [number, number, number] = [74, 82, 70];
const EXTRACT_LIT: readonly [number, number, number] = [150, 216, 96];
/** The sealed stair: dead cold stone and darker iron, and no light of its own at all. */
const SEAL_STONE: readonly [number, number, number] = [62, 58, 76];
const SEAL_IRON: readonly [number, number, number] = [44, 46, 56];

/**
 * How far a pad reaches from the middle of its room, in world units.
 *
 * The three cells `padRoomAt` answers for, measured to their outer edges. Every fixture below is built
 * to it, which is the whole point of taking the number from the maze rather than choosing one here: a
 * dais drawn wider than the ground it claims is a dais that lies about where to stand.
 */
const PAD_HALF = ROOM_PAD_HALF + 0.5;

/**
 * The blessing altar: a floor to stand on, not a plinth to walk around.
 *
 * The shape follows what the thing asks for. Claiming it means holding the pad for five seconds, so the
 * dais *is* the pad — three cells across, with four corner posts standing on its corners — rather than
 * the cursed altar's single column, which anyone standing on the spot would appear to be inside.
 *
 * Static on purpose. Structure geometry is cached against the floor, so making the posts rise with the
 * claim would rebuild every wall on the floor every frame; the claim's progress is a light instead.
 */
function blessingAltarBoxes(room: DemoRoom): RenderBox[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  const built: RenderBox[] = [
    {
      id: "blessing-dais",
      x,
      y,
      halfX: PAD_HALF,
      halfY: PAD_HALF,
      bottom: 0,
      top: 0.07,
      color: BLESSING_STONE,
      topColor: BLESSING_STONE_LIT,
    },
    {
      id: "blessing-inlay",
      x,
      y,
      halfX: 0.66,
      halfY: 0.66,
      bottom: 0.07,
      top: 0.1,
      color: BLESSING_STONE_LIT,
      topColor: BLESSING_STONE_LIT,
    },
  ];

  for (const cornerX of [-1, 1]) {
    for (const cornerY of [-1, 1]) {
      built.push({
        id: `blessing-post-${cornerX}-${cornerY}`,
        x: x + cornerX * (PAD_HALF - 0.12),
        y: y + cornerY * (PAD_HALF - 0.12),
        halfX: 0.12,
        halfY: 0.12,
        bottom: 0,
        top: 1.3,
        color: BLESSING_STONE,
        topColor: BLESSING_STONE_LIT,
      });
    }
  }

  return built;
}

/**
 * The hot spring: a tiered fountain standing in a pool three cells across.
 *
 * The pool is the pad, for the same reason the dais is. A single small basin would read as one more
 * thing on the floor not to walk into, which is the opposite of what this room is for — the whole of
 * it is that standing in it is good, and the water has to cover exactly the ground that pays.
 */
function hotSpringBoxes(room: DemoRoom): RenderBox[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  return [
    { id: "spring-rim", x, y, halfX: PAD_HALF + 0.1, halfY: PAD_HALF + 0.1, bottom: 0, top: 0.14, color: SPRING_STONE },
    {
      id: "spring-pool",
      x,
      y,
      halfX: PAD_HALF,
      halfY: PAD_HALF,
      bottom: 0.14,
      top: 0.17,
      color: SPRING_WATER,
      topColor: litFace(SPRING_WATER),
    },
    { id: "spring-plinth", x, y, halfX: 0.4, halfY: 0.4, bottom: 0.17, top: 0.44, color: SPRING_STONE },
    {
      id: "spring-bowl",
      x,
      y,
      halfX: 0.52,
      halfY: 0.52,
      bottom: 0.44,
      top: 0.52,
      color: SPRING_STONE,
      topColor: litFace(SPRING_STONE),
    },
    {
      id: "spring-basin",
      x,
      y,
      halfX: 0.4,
      halfY: 0.4,
      bottom: 0.52,
      top: 0.55,
      color: SPRING_WATER,
      topColor: litFace(SPRING_WATER),
    },
    { id: "spring-spout", x, y, halfX: 0.1, halfY: 0.1, bottom: 0.55, top: 1.02, color: SPRING_STONE },
    {
      id: "spring-cap",
      x,
      y,
      halfX: 0.2,
      halfY: 0.2,
      bottom: 1.02,
      top: 1.1,
      color: SPRING_STONE,
      topColor: litFace(SPRING_STONE),
    },
  ];
}

/**
 * The extraction room: a marked pad with a canister standing in the middle of it.
 *
 * It used to be one knee-high canister and nothing else, on the reasoning that a room a run is left
 * from earns no architecture. That was right about the room and wrong about the pad: what a player has
 * to be able to see, from the doorway and while being chased, is the exact ground that gets them out —
 * and a plume of green smoke says roughly there. So the pad is kerbed on all four sides and posted at
 * the corners, and everything still stops at the doorway. Finding the room is the part the floor
 * charges for; standing in the right square once inside it is not.
 */
function extractionBoxes(room: DemoRoom): RenderBox[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  const built: RenderBox[] = [
    { id: "extract-canister", x, y, halfX: 0.13, halfY: 0.13, bottom: 0, top: 0.44, color: CANISTER_METAL },
    {
      id: "extract-collar",
      x,
      y,
      halfX: 0.17,
      halfY: 0.17,
      bottom: 0.44,
      top: 0.52,
      color: [96, 108, 92],
      topColor: EXTRACT_LIT,
    },
  ];

  // A kerb along each edge of the pad, so the three cells that get you out have a drawn border rather
  // than an inferred one.
  for (const side of [-1, 1]) {
    built.push({
      id: `extract-kerb-x-${side}`,
      x,
      y: y + side * PAD_HALF,
      halfX: PAD_HALF,
      halfY: 0.09,
      bottom: 0,
      top: 0.12,
      color: CANISTER_METAL,
      topColor: EXTRACT_LIT,
    });
    built.push({
      id: `extract-kerb-y-${side}`,
      x: x + side * PAD_HALF,
      y,
      halfX: 0.09,
      halfY: PAD_HALF,
      bottom: 0,
      top: 0.12,
      color: CANISTER_METAL,
      topColor: EXTRACT_LIT,
    });
  }

  // Corner posts, tall enough to clear a slime and be seen over one.
  for (const cornerX of [-1, 1]) {
    for (const cornerY of [-1, 1]) {
      built.push({
        id: `extract-post-${cornerX}-${cornerY}`,
        x: x + cornerX * PAD_HALF,
        y: y + cornerY * PAD_HALF,
        halfX: 0.13,
        halfY: 0.13,
        bottom: 0,
        top: 1.4,
        color: CANISTER_METAL,
        topColor: EXTRACT_LIT,
      });
    }
  }

  return built;
}

/**
 * The way down, in the two states it has.
 *
 * Sealed until the floor's main task is met, and sealed as a *different object* rather than as the
 * open stair with its light turned off. The open one was always there and always lit, so a player who
 * found it early learned where the exit was and then had it refuse them; the refusal read as the game
 * being broken rather than as the floor being unfinished. A capstone with iron laid across it refuses
 * on its own, before any message line has to.
 *
 * Cached against `terrainVersion`, which `stepTasks` bumps on the frame the lock comes off.
 */
function stairBoxes(world: DemoWorld): RenderBox[] {
  const x = world.maze.exit.x + 0.5;
  const y = world.maze.exit.y + 0.5;

  if (!world.maze.progress.main.met) {
    const built: RenderBox[] = [
      { id: "exit-seal-base", x, y, halfX: 0.5, halfY: 0.5, bottom: 0, top: 0.14, color: SEAL_STONE },
      {
        id: "exit-seal-slab",
        x,
        y,
        halfX: 0.42,
        halfY: 0.42,
        bottom: 0.14,
        top: 0.28,
        color: SEAL_STONE,
        topColor: SEAL_STONE,
      },
    ];

    // Two bands of iron laid across the capstone, and a boss where they cross. Dark on purpose: the
    // sealed stair throws no light of its own, so it is found by walking into it like everything else
    // a floor keeps to itself.
    built.push({
      id: "exit-seal-band-x",
      x,
      y,
      halfX: 0.48,
      halfY: 0.08,
      bottom: 0.28,
      top: 0.34,
      color: SEAL_IRON,
      topColor: SEAL_IRON,
    });
    built.push({
      id: "exit-seal-band-y",
      x,
      y,
      halfX: 0.08,
      halfY: 0.48,
      bottom: 0.28,
      top: 0.34,
      color: SEAL_IRON,
      topColor: SEAL_IRON,
    });
    built.push({
      id: "exit-seal-boss",
      x,
      y,
      halfX: 0.14,
      halfY: 0.14,
      bottom: 0.34,
      top: 0.44,
      color: SEAL_IRON,
      topColor: [74, 78, 92],
    });
    return built;
  }

  // A dais climbing to a lit landing, rather than a pit descending into one. The depth buffer this
  // renderer keeps is one value per screen column, written only by the walls — the floor is never in
  // it — so anything drawn below floor level cannot be hidden by the floor and simply sits on top of
  // it. Geometry that stands up is the only kind this projection can honestly draw.
  const built: RenderBox[] = [];

  for (let step = 0; step < 3; step += 1) {
    const inset = 0.46 - step * 0.09;
    built.push({
      id: `exit-step-${step}`,
      x,
      y,
      halfX: inset,
      halfY: inset,
      bottom: step * 0.11,
      top: (step + 1) * 0.11,
      color: [74 + step * 6, 68 + step * 6, 92 + step * 6],
      topColor: [104 + step * 10, 98 + step * 10, 128 + step * 10],
    });
  }

  // Two posts flanking the landing, which is what makes it read as a way through rather than a step.
  for (const side of [-1, 1]) {
    built.push({
      id: `exit-post-${side}`,
      x: x + side * 0.38,
      y,
      halfX: 0.09,
      halfY: 0.09,
      bottom: 0.33,
      top: 1.05,
      color: [88, 80, 106],
      topColor: [138, 128, 158],
    });
  }

  built.push({
    id: "exit-lintel",
    x,
    y,
    halfX: 0.48,
    halfY: 0.1,
    bottom: 1.05,
    top: 1.24,
    color: [96, 88, 116],
    topColor: [146, 136, 168],
  });
  return built;
}

/**
 * The structures that stand up: the altar and the mouth of the stairs.
 *
 * Both were flat images on the ground, which is the single thing that made them read as markers
 * painted on the floor rather than as places. The altar is now a plinth you can walk around; the
 * stair is a pit sunk below the floor with four steps descending into it and a raised kerb.
 */
function boxes(world: DemoWorld): RenderBox[] {
  const built: RenderBox[] = altarBoxes(world);

  // Each side room's own fixture. The cursed altar is not here: it is the plinth above, which the floor
  // already places at that room's centre.
  for (const room of world.maze.rooms) {
    if (room.role === "blessingAltar") {
      built.push(...blessingAltarBoxes(room));
    }

    if (room.role === "hotSpring") {
      built.push(...hotSpringBoxes(room));
    }

    if (room.role === "extraction") {
      built.push(...extractionBoxes(room));
    }
  }

  built.push(...stairBoxes(world));

  // Iron caltrops: two crossed rails carrying a row of upright spikes. Deliberately sparse and open
  // — you have to be able to see through one to whatever is standing behind it.
  //
  // Sparse, but it has to reach the edges of its cell, and for a long time it did neither of the two
  // things this comment claims. The rails were built from one set of half-extents and offset sideways
  // twice, so they came out parallel rather than crossed — half the object was simply never there —
  // and the spikes ran on a shallow diagonal that put every one of them in the gap between the rails
  // instead of on top of one. What was left covered four tenths of the cell across, while walking
  // into the cell is refused across all of it, so a player was stopped two thirds of a cell short of
  // any visible iron with clear floor in between. Nothing can be done about that from the collision
  // side: every blocker in the demo is a whole cell, and a barricade is the only one whose art chose
  // not to fill one.
  for (let y = 1; y < world.maze.height - 1; y += 1) {
    for (let x = 1; x < world.maze.width - 1; x += 1) {
      const tile = world.maze.tiles[tileIndex(world.maze, x, y)];

      if (tile?.kind === "mortar") {
        const wear = tile.maxHp > 0 ? 1 - tile.hp / tile.maxHp : 0;
        built.push(...mortarBoxes(world, { x, y }, wear));
        continue;
      }

      if (tile?.kind !== "barricade") {
        continue;
      }

      // Bent and darkened as it takes damage, so how close one is to being cleared is visible.
      const wear = tile.maxHp > 0 ? 1 - tile.hp / tile.maxHp : 0;
      built.push(...projectDemoBarricade({ x, y }, wear));
    }
  }

  return built;
}

/** How many stacked rings the barrel is drawn from, widest at the muzzle. */
const MORTAR_BARREL_RINGS = 4;

/** How hot an emplacement's muzzle is running, from cold between shots to white at launch. */
function mortarGlow(world: DemoWorld, cell: DemoCellLike): number {
  const mortar = world.mortars.find((entry) => entry.cellX === cell.x && entry.cellY === cell.y);

  if (!mortar || mortar.phase !== "locked") {
    return 0;
  }

  return 1 - mortar.seconds / MORTAR_LOCK_SECONDS;
}

/**
 * A squat mortar on a timber carriage, pointing straight up.
 *
 * Vertical for two reasons that agree. Boxes in this scene are axis-aligned and cannot be turned, so
 * an angled barrel is not buildable from them at all — and a weapon that shells every direction
 * around itself has no business being angled anyway. Pointing up, it is rotationally symmetric: it
 * looks the same from every approach and tells no lie about which way it is about to fire.
 *
 * Darkens as it is broken down, so how close one is to being wrecked is readable from across a room.
 */
function mortarBoxes(world: DemoWorld, cell: DemoCellLike, wear: number): RenderBox[] {
  const centreX = cell.x + 0.5;
  const centreY = cell.y + 0.5;
  const dim = 1 - wear * 0.42;
  const built: RenderBox[] = [];

  // The carriage: a low frame with a cheek either side, in timber against the barrel's iron.
  built.push({
    id: `mortar-${cell.x}-${cell.y}-frame`,
    x: centreX,
    y: centreY,
    halfX: 0.4,
    halfY: 0.4,
    bottom: 0,
    top: 0.14,
    color: [Math.round(96 * dim), Math.round(64 * dim), Math.round(36 * dim)],
    topColor: [Math.round(132 * dim), Math.round(92 * dim), Math.round(54 * dim)],
  });

  for (const side of [-1, 1]) {
    built.push({
      id: `mortar-${cell.x}-${cell.y}-cheek-${side}`,
      x: centreX + side * 0.3,
      y: centreY,
      halfX: 0.08,
      halfY: 0.34,
      bottom: 0.14,
      top: 0.44,
      color: [Math.round(84 * dim), Math.round(56 * dim), Math.round(32 * dim)],
      topColor: [Math.round(118 * dim), Math.round(80 * dim), Math.round(46 * dim)],
    });
  }

  // The barrel, widest at the muzzle so the silhouette tapers instead of reading as a post. The
  // muzzle takes the charging glow, which is where the shell leaves from.
  const glow = mortarGlow(world, cell);

  for (let ring = 0; ring < MORTAR_BARREL_RINGS; ring += 1) {
    const up = ring / (MORTAR_BARREL_RINGS - 1);
    const half = 0.16 + up * 0.1;
    const heat = glow * up;
    built.push({
      id: `mortar-${cell.x}-${cell.y}-barrel-${ring}`,
      x: centreX,
      y: centreY,
      halfX: half,
      halfY: half,
      bottom: 0.12 + ring * 0.17,
      top: 0.12 + (ring + 1) * 0.17,
      color: [
        Math.round(Math.min(255, 62 * dim + heat * 190)),
        Math.round(Math.min(255, 66 * dim + heat * 62)),
        Math.round(Math.min(255, 74 * dim + heat * 40)),
      ],
      topColor: [
        Math.round(Math.min(255, 94 * dim + heat * 160)),
        Math.round(Math.min(255, 98 * dim + heat * 80)),
        Math.round(Math.min(255, 108 * dim + heat * 56)),
      ],
    });
  }

  return built;
}

/**
 * How much of a pool cell is taken up by what has drowned in it, one material per body.
 *
 * The bodies are in the floor texture rather than in the world as corpses: a drowned body is under
 * the surface, and a sprite under a floor is a sprite the renderer has no way to cut off at the
 * waterline for anything but the sinking animation itself.
 */
export const POOL_FILL: readonly RenderFloorMaterial[] = ["water", "waterFouled", "waterChoked"];

/**
 * Every walkable cell names its floor.
 *
 * Pools are floor, not scenery — the renderer swaps the texture rather than laying a sprite on top.
 * The dry cells are named too, which is how the demo gets its own flagstones without touching the
 * default floor the shipped game draws.
 */
function floorPatches(world: DemoWorld): RenderFloorPatch[] {
  const built: RenderFloorPatch[] = [];

  for (let y = 0; y < world.maze.height; y += 1) {
    for (let x = 0; x < world.maze.width; x += 1) {
      const tile = world.maze.tiles[tileIndex(world.maze, x, y)];
      built.push({ cell: { x, y }, material: floorMaterial(tile) });
    }
  }

  return built;
}

function floorMaterial(tile: DemoTile | undefined): RenderFloorMaterial {
  if (tile?.kind === "filled") {
    return "demoCarrion";
  }

  if (tile?.kind === "trench") {
    return "demoTrench";
  }

  if (tile?.kind !== "water") {
    return "demoFlagstone";
  }

  return POOL_FILL[Math.min(tile.bodies, POOL_FILL.length - 1)] ?? "water";
}

/** One rod in the air, given the angle its own weapon flies at. */
function rodBeam(
  id: string,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  pitch: number,
  centreZ: number,
  length: number,
  width: number,
  color: readonly [number, number, number],
  tipColor: readonly [number, number, number],
): RenderBeam {
  const along = Math.cos(pitch);
  const rise = Math.sin(pitch);
  const halfX = directionX * along * (length / 2);
  const halfY = directionY * along * (length / 2);
  const halfZ = rise * (length / 2);
  return {
    id,
    from: { x: x - halfX, y: y - halfY, z: centreZ - halfZ },
    to: { x: x + halfX, y: y + halfY, z: centreZ + halfZ },
    width,
    color,
    tipColor,
  };
}

function beams(world: DemoWorld): RenderBeam[] {
  const built: RenderBeam[] = [];

  for (const projectile of world.projectiles) {
    const rod = FLYING_RODS[projectile.kind as DemoPropKind];

    if (rod) {
      // The shaft points along its own flight line, which is the aim line it left the hand on.
      const slope = projectile.arc / Math.max(0.0001, projectile.range);
      built.push(
        rodBeam(
          projectile.id,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          Math.atan(slope),
          projectileHeight(projectile),
          rod.length,
          rod.width,
          rod.shaft,
          rod.tip,
        ),
      );
      continue;
    }

    const tumbling = TUMBLING_RODS[projectile.kind as DemoPropKind];

    if (!tumbling) {
      continue;
    }

    const spin = projectile.travelled * tumbling.spin;
    const height = projectileHeight(projectile);
    built.push(
      rodBeam(
        projectile.id,
        projectile.x,
        projectile.y,
        projectile.directionX,
        projectile.directionY,
        spin,
        height,
        tumbling.length,
        tumbling.width,
        tumbling.shaft,
        tumbling.tip,
      ),
    );

    if (tumbling.guard) {
      // Square to the blade and turning with it, which is what makes a sword read as a sword rather
      // than as one more bar in the air.
      built.push(
        rodBeam(
          `${projectile.id}-guard`,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          spin + Math.PI / 2,
          height,
          tumbling.guard.length,
          tumbling.guard.width,
          tumbling.guard.shaft,
          tumbling.guard.tip,
        ),
      );
    }
  }

  return built;
}

/** Blood already spilled, as a material mixed into the floor rather than an image laid over it. */
function floorOverlays(world: DemoWorld): RenderFloorOverlay[] {
  const built: RenderFloorOverlay[] = [];

  for (let y = 0; y < world.maze.height; y += 1) {
    for (let x = 0; x < world.maze.width; x += 1) {
      const amount = world.stains[tileIndex(world.maze, x, y)] ?? 0;

      // Water washes it away — a red pool reads as a rendering mistake rather than as carnage — and
      // a pool the bodies have filled in carries its own colour already.
      if (amount > 0.01 && holdsStains(world.maze, x, y)) {
        built.push({ cell: { x, y }, material: "demoBlood", amount });
      }
    }
  }

  return built;
}

const PARTICLE_COLORS: Readonly<Record<DemoParticleKind, readonly [number, number, number]>> = {
  blood: [146, 20, 28],
  stoneChip: [128, 118, 142],
  woodChip: [138, 92, 48],
  dust: [178, 162, 182],
  ember: [255, 172, 78],
  splash: [162, 206, 232],
  bone: [226, 218, 196],
};

/** Everything small and numerous, as flat dots rather than sprites. */
function particles(world: DemoWorld): RenderParticle[] {
  const built: RenderParticle[] = [];

  for (const particle of world.particles.items) {
    const life = Math.min(1, particle.age / particle.life);
    // Dust swells as it disperses and fades out; solid debris keeps its size and simply stops.
    const dusty = particle.kind === "dust";
    built.push({
      x: particle.x,
      y: particle.y,
      z: particle.z,
      size: particle.size * (dusty ? 1 + life * 2.2 : 1 - life * 0.25),
      color: PARTICLE_COLORS[particle.kind],
      alpha: dusty ? 0.42 * (1 - life) : particle.kind === "ember" ? 1 - life : 1 - life * life * 0.5,
      ...(particle.kind === "ember" ? { additive: true } : {}),
    });
  }

  // A fading ribbon behind anything in flight, from the positions it actually passed through.
  for (const projectile of world.projectiles) {
    const hot = projectile.kind === "bomb";

    projectile.trail.forEach((point, index) => {
      const age = (projectile.trail.length - index) / projectile.trail.length;
      built.push({
        x: point.x,
        y: point.y,
        z: point.z,
        size: (hot ? 0.22 : 0.13) * (1 - age),
        color: hot ? [255, 168, 84] : [186, 176, 190],
        alpha: (1 - age) * (1 - age) * 0.75,
        ...(hot ? { additive: true } : {}),
      });
    });
  }

  sightLines(world, built);
  landingBeacons(world, built);
  return built;
}

/** How tall the column at the centre of a landing circle stands, and how many dots it is made of. */
const BEACON_HEIGHT = 1.3;
const BEACON_BEADS = 9;

/**
 * A column of light standing in the middle of a landing circle.
 *
 * The circle alone is not enough, and the reason is the camera: it sits at eye height looking roughly
 * level, so a flat ring painted around the player's own feet is almost entirely below the frame. The
 * one place the mark absolutely has to be legible is the place the player is standing in it, so the
 * mark also has to exist above the floor.
 */
function landingBeacons(world: DemoWorld, built: RenderParticle[]): void {
  const columns: { x: number; y: number; closing: number }[] = [];

  for (const mortar of world.mortars) {
    if (mortar.phase === "locked") {
      columns.push({ x: mortar.aimX, y: mortar.aimY, closing: 1 - mortar.seconds / MORTAR_LOCK_SECONDS });
    }
  }

  for (const hazard of world.hazards) {
    if (hazard.kind !== "shell") {
      continue;
    }

    const left = hazard.range - hazard.travelled;
    columns.push({
      x: hazard.x + hazard.directionX * left,
      y: hazard.y + hazard.directionY * left,
      closing: Math.min(1, hazard.travelled / Math.max(0.0001, hazard.range)),
    });
  }

  for (const column of columns) {
    for (let bead = 0; bead < BEACON_BEADS; bead += 1) {
      const up = bead / (BEACON_BEADS - 1);
      const shimmer = 0.8 + 0.2 * Math.sin(world.elapsedSeconds * 12 - up * 6);
      built.push({
        x: column.x,
        y: column.y,
        z: up * BEACON_HEIGHT,
        size: 0.07 * (1 - up * 0.45),
        color: [255, 104, 78],
        alpha: (0.3 + column.closing * 0.6) * (1 - up * 0.55) * shimmer,
        additive: true,
      });
    }
  }
}

/** How far apart the dots of a drawn line sit, and how big each one is at rest. */
const BEAD_SPACING = 0.19;
const BEAD_SIZE = 0.05;
const BEAD_COLOR: readonly [number, number, number] = [255, 96, 88];

/**
 * Walks a straight line in world space and answers the points a drawn warning should be beaded along.
 *
 * Stops where the thing being warned about would stop, which is the whole reason this exists rather
 * than a plain interpolation: a line that carries on through a barricade tells the player cover does
 * not work, and cover is the answer the line is supposed to be teaching.
 *
 * A run of small additive dots rather than one rod, because a rod in this renderer is opaque and
 * shaded down with distance — so the further away the threat, the darker its warning, which is
 * exactly backwards. Dots are drawn through the cheap particle path, cost nothing per frame, and a
 * dotted line happens to be what a sight line looks like anyway.
 */
function beadLine(
  world: DemoWorld,
  fromX: number,
  fromY: number,
  directionX: number,
  directionY: number,
  maxDistance: number,
  spacing = BEAD_SPACING,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  for (let travelled = spacing; travelled <= maxDistance; travelled += spacing) {
    const x = fromX + directionX * travelled;
    const y = fromY + directionY * travelled;

    if (blocksProjectile(world.maze, Math.floor(x), Math.floor(y))) {
      return points;
    }

    points.push({ x, y });
  }

  return points;
}

/** Height a sword is carried at, and how many dots the arc at that height is drawn from. */
const CUT_HEIGHT = 0.62;
const CUT_BEADS = 15;

/**
 * The path a committed sword cut is about to sweep, at the height the blade travels.
 *
 * The primary read of the whole telegraph, and the reason is the range. A swordsman commits at arm's
 * reach, and the mark it paints on the floor sits at the very bottom of the frame from there — so the
 * floor is where a player confirms they got out, and this is where they see it coming at all.
 *
 * It fills from one edge to the other rather than brightening as a whole, in step with the wedge on
 * the ground, so both say the same thing about which way the blade is coming round. Built from the
 * current facing, which is now fixed for the whole wind-up: the body locks its aim when it commits,
 * so this arc is nailed to a piece of the room from the first frame.
 */
function cutArc(enemy: DemoEnemy, elapsedSeconds: number, built: RenderParticle[]): void {
  if (enemy.windupSeconds <= 0 || enemy.intent !== "melee") {
    return;
  }

  const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
  const reach = attackReach(enemy.archetype);

  for (let index = 0; index < CUT_BEADS; index += 1) {
    const across = index / (CUT_BEADS - 1);
    const angle = enemy.facingAngle + (across * 2 - 1) * MELEE_CUT_HALF_ANGLE;
    const shimmer = 0.84 + 0.16 * Math.sin(elapsedSeconds * 18 + index * 1.3);
    // How far behind the sweep's leading edge this dot is. Everything the edge has passed stays lit,
    // the edge itself is the brightest thing in the arc, and the ground ahead of it is barely there.
    const behind = progress - across;
    const lit = behind < 0 ? 0.12 : 0.5 + 0.5 * Math.max(0, 1 - behind * 5);
    built.push({
      x: enemy.x + Math.cos(angle) * reach,
      y: enemy.y + Math.sin(angle) * reach,
      z: CUT_HEIGHT,
      size: 0.05 + lit * 0.05,
      color: [255, 138, 112],
      alpha: lit * shimmer,
      additive: true,
    });
  }
}

/** Height the beads of a shooter's line sit at: where the orb itself flies, not the floor. */
const SIGHT_LINE_HEIGHT = 0.42;

/**
 * The line a shooter's bolt will take, drawn for as long as it is committed to taking it.
 *
 * Only worth anything because the aim is locked: this is a claim about the future, and before the
 * lock there was no future to draw. It brightens as the wind-up runs out, so the line says both where
 * the shot is going and how long there is to not be there.
 */
function sightLines(world: DemoWorld, built: RenderParticle[]): void {
  for (const enemy of world.enemies) {
    cutArc(enemy, world.elapsedSeconds, built);

    if (enemy.windupSeconds <= 0 || enemy.intent !== "shoot") {
      continue;
    }

    const dx = enemy.aimX - enemy.x;
    const dy = enemy.aimY - enemy.y;
    const length = Math.hypot(dx, dy);

    if (length < 0.0001) {
      continue;
    }

    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    // The line is drawn to this body's own shot range, so a javelineer's telegraph reaches as far as
    // its javelin does and a crossbowman's as far as its bolt.
    const range = enemy.archetype.shot?.range ?? 0;
    const beads = beadLine(world, enemy.x, enemy.y, dx / length, dy / length, Math.min(length, range));

    beads.forEach((bead, index) => {
      // Each dot flickers on its own phase, so the line reads as live rather than as paint.
      const shimmer = 0.82 + 0.18 * Math.sin(world.elapsedSeconds * 15 + index * 1.7);
      built.push({
        x: bead.x,
        y: bead.y,
        z: SIGHT_LINE_HEIGHT,
        size: BEAD_SIZE * (0.8 + progress * 0.5),
        color: BEAD_COLOR,
        alpha: (0.24 + progress * 0.66) * shimmer,
        additive: true,
      });
    });
  }
}

/** How wide a charger's lane is painted, and how far a landing ring's edge reaches inward. */
const LANE_HALF_WIDTH = 0.34;
const RING_THICKNESS = 0.16;
const LANE_DIM: readonly [number, number, number] = [128, 30, 34];
const LANE_HOT: readonly [number, number, number] = [255, 118, 84];
const CIRCLE_EDGE: readonly [number, number, number] = [255, 74, 58];
const CIRCLE_FILL: readonly [number, number, number] = [220, 96, 62];
/** Hotter than the aim fill, so a committed shell is told apart from a lock in peripheral vision. */
const SHELL_INCOMING: readonly [number, number, number] = [255, 146, 78];
const CUT_DIM: readonly [number, number, number] = [136, 36, 40];
const CUT_HOT: readonly [number, number, number] = [255, 128, 96];
const EXTRACT_DIM: readonly [number, number, number] = [46, 108, 40];
const EXTRACT_HOT: readonly [number, number, number] = [148, 246, 96];

/**
 * How far a charge can run before something stops it.
 *
 * Uses the flung predicate rather than the projectile one, because that is what the charge itself
 * moves under — and the two disagree in exactly the case worth drawing: a barricade stops a thrown
 * rock but not a charging body, which sails onto the spikes and dies there. A lane cut short at the
 * iron would hide the best thing a player can do with a charger after lining it up on a wall.
 *
 * Walked at a fixed step rather than solved, because the cells decide it and there is no closed form
 * for which one comes first.
 */
function chargeRun(
  world: DemoWorld,
  fromX: number,
  fromY: number,
  directionX: number,
  directionY: number,
  limit: number,
): number {
  const step = 0.15;

  for (let travelled = step; travelled <= limit; travelled += step) {
    if (
      blocksFlung(world.maze, Math.floor(fromX + directionX * travelled), Math.floor(fromY + directionY * travelled))
    ) {
      return travelled - step;
    }
  }

  return limit;
}

/**
 * Everything painted into the floor: the lane a charger has claimed, and where a shell will land.
 *
 * These were flat sprites once, and flat sprites are not on the floor. The sprite pipeline draws a
 * camera-facing quad squashed to a fraction of its height, so the mark lifted away from the ground at
 * close range and towards the edges of the view, kept its own brightness instead of taking the room's
 * light, and read as a sticker floating over the stone. A decal is tested against the floor's own
 * per-pixel world position, so a circle is round from every angle and a lane keeps square corners at
 * any heading — which is what the charger's lane wanted to be all along.
 *
 * Order matters within each mark: the fill goes down first and the edge over it, so a circle keeps a
 * hard rim right up to the moment it is full.
 */
function floorDecals(world: DemoWorld): RenderFloorDecal[] {
  const built: RenderFloorDecal[] = [];

  for (const enemy of world.enemies) {
    if (enemy.windupSeconds <= 0 || enemy.intent !== "charge") {
      continue;
    }

    const dx = enemy.aimX - enemy.x;
    const dy = enemy.aimY - enemy.y;
    const aim = Math.hypot(dx, dy);

    if (aim < 0.0001) {
      continue;
    }

    // The lane runs the charge's own distance, not the distance to the locked point: the charge does
    // not stop where it was aimed, it runs its full length past it.
    const directionX = dx / aim;
    const directionY = dy / aim;
    const length = chargeRun(world, enemy.x, enemy.y, directionX, directionY, CHARGE_DISTANCE);
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    built.push({
      x: enemy.x,
      y: enemy.y,
      shape: { kind: "lane", directionX, directionY, length, halfWidth: LANE_HALF_WIDTH },
      color: LANE_DIM,
      strength: 0.55,
    });
    // The same strip again, shorter, sweeping out from the charger as the wind-up runs down. One
    // object says both where the charge is going and how long there is to not be standing in it.
    built.push({
      x: enemy.x,
      y: enemy.y,
      shape: { kind: "lane", directionX, directionY, length: length * progress, halfWidth: LANE_HALF_WIDTH },
      color: LANE_HOT,
      strength: 0.82,
    });
  }

  for (const enemy of world.enemies) {
    if (enemy.windupSeconds <= 0 || enemy.intent !== "melee") {
      continue;
    }

    // The ground a cut is about to cross, fixed in the world because the facing is. Secondary by
    // design: at this reach the wedge sits at the very bottom of the frame, so what a player reads in
    // the moment is the mark over its head and the arc at blade height. What the floor is for is the
    // half-second after stepping back, when the question is whether you actually got out.
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    const reach = attackReach(enemy.archetype);
    built.push({
      x: enemy.x,
      y: enemy.y,
      shape: {
        kind: "sector",
        radius: reach,
        directionX: Math.cos(enemy.facingAngle),
        directionY: Math.sin(enemy.facingAngle),
        halfAngle: MELEE_CUT_HALF_ANGLE,
      },
      color: CUT_DIM,
      strength: 0.5,
    });
    // The same wedge sweeping open from one edge to the other, so the fill runs the way the blade
    // will. Widening about a bisector that walks across is how one shape says both.
    const swept = MELEE_CUT_HALF_ANGLE * progress;
    const bisector = enemy.facingAngle - MELEE_CUT_HALF_ANGLE + swept;
    built.push({
      x: enemy.x,
      y: enemy.y,
      shape: {
        kind: "sector",
        radius: reach,
        directionX: Math.cos(bisector),
        directionY: Math.sin(bisector),
        halfAngle: Math.max(0.02, swept),
      },
      color: CUT_HOT,
      strength: 0.8,
    });
  }

  for (const mortar of world.mortars) {
    if (mortar.phase !== "locked") {
      continue;
    }

    pushAimCircle(built, mortar.aimX, mortar.aimY, SHELL_BLAST_RADIUS, 1 - mortar.seconds / MORTAR_LOCK_SECONDS);
  }

  for (const room of world.maze.rooms) {
    if (room.role !== "extraction") {
      continue;
    }

    // The pad, painted rather than built, because this is the one of the three whose fixture does not
    // already cover its own ground: the dais and the pool *are* their pads, and the canister is a post
    // in the middle of bare stone. The bright square grows from the middle as the hold runs, so the
    // countdown is on the floor the player is looking at as well as on the bar they are not.
    const x = room.center.x + 0.5;
    const y = room.center.y + 0.5;
    const holding = extractionShare(world);
    pushPadSquare(built, x, y, PAD_HALF, EXTRACT_DIM, 0.5);

    if (holding > 0) {
      pushPadSquare(built, x, y, PAD_HALF * holding, EXTRACT_HOT, 0.9);
    }
  }

  for (const hazard of world.hazards) {
    if (hazard.kind !== "shell") {
      continue;
    }

    // Once the shell is in the air the mark stays exactly where it was painted, at exactly the width
    // it was painted at, so it runs unbroken from the lock through to the landing rather than blinking
    // out at launch. What changes at launch is only how it is drawn: the shot has left the emplacement
    // and can no longer be called off by smashing it, and that is a different fact about the floor
    // than an emplacement taking aim.
    const left = hazard.range - hazard.travelled;
    pushIncomingCircle(
      built,
      hazard.x + hazard.directionX * left,
      hazard.y + hazard.directionY * left,
      hazard.blastRadius,
      Math.min(1, hazard.travelled / Math.max(0.0001, hazard.range)),
      hazard.range / Math.max(0.0001, hazard.speed),
    );
  }

  return built;
}

/**
 * A square of ground, centred and axis-aligned.
 *
 * There is no square in the decal vocabulary and there does not need to be: a lane is a strip measured
 * forward from its own point, so starting one at the near edge and running it the full width at half
 * that as its half-width is exactly a square. Keeping it as a lane rather than adding a shape means the
 * renderer's decal pass is untouched by this.
 */
function pushPadSquare(
  built: RenderFloorDecal[],
  x: number,
  y: number,
  half: number,
  color: readonly [number, number, number],
  strength: number,
): void {
  built.push({
    x: x - half,
    y,
    shape: { kind: "lane", directionX: 1, directionY: 0, length: half * 2, halfWidth: half },
    color,
    strength,
  });
}

/**
 * An emplacement's aim: a fixed rim at the blast's true edge, and a disc closing on it as the lock
 * runs down.
 *
 * The closing disc is a countdown with an out at the end of it — walking over and smashing the
 * emplacement inside the five seconds cancels the shot entirely. That is what separates this from the
 * mark below, which is the same ground with no out left.
 */
function pushAimCircle(built: RenderFloorDecal[], x: number, y: number, radius: number, closing: number): void {
  built.push({
    x,
    y,
    shape: { kind: "disc", radius: radius * Math.max(0.06, closing) },
    color: CIRCLE_FILL,
    strength: 0.5,
  });
  pushBlastRim(built, x, y, radius);
}

/**
 * How the mark blinks once the shell is committed: flashes a second at launch, at landing, and the
 * closing share of the flight it stops blinking and holds.
 */
const INCOMING_FLASH_START = 3;
const INCOMING_FLASH_END = 9;
const INCOMING_SOLID_SHARE = 0.15;
const INCOMING_DIM = 0.32;
const INCOMING_HOT = 0.95;

/**
 * The mark under a shell already in the air, which is a different fact from an emplacement taking aim.
 *
 * The lock could be cancelled by crossing the floor and smashing the thing holding it. This cannot:
 * the shell lands here whatever happens to whatever fired it. So the fill stops counting down and
 * starts insisting — it sits at the blast's full width rather than closing on it, because closing is
 * the aim phase's word and reusing it here said the two situations were the same situation.
 *
 * The flash carries what the closing disc used to: a fixed blink says "danger", an accelerating one
 * says how much longer. Its phase is taken from the shell's own flight rather than from the world
 * clock, so several shells in the air blink on their own beats instead of pulsing the whole floor in
 * unison — which would look deliberate and tell the player nothing about which one is about to land.
 *
 * It never goes dark. A mark that blinks to nothing is missing for exactly the frames somebody is
 * sprinting out of it. And the last share of the flight holds solid: the blinking *stopping* is the
 * final thing this says, and a mark still flickering at the moment of impact has no way to say it.
 */
function pushIncomingCircle(
  built: RenderFloorDecal[],
  x: number,
  y: number,
  radius: number,
  flown: number,
  seconds: number,
): void {
  built.push({
    x,
    y,
    shape: { kind: "disc", radius },
    color: SHELL_INCOMING,
    strength: incomingFlash(flown, seconds),
  });
  pushBlastRim(built, x, y, radius);
}

/**
 * The blink, as a decal strength.
 *
 * Flashes are counted rather than a rate sampled. The phase is the integral of a rate rising linearly
 * across the flight, which is what lets the blink speed up and stay smooth doing it; multiplying the
 * current rate by the elapsed time instead would drag the phase backwards every frame and read as a
 * stutter rather than as acceleration.
 */
function incomingFlash(flown: number, seconds: number): number {
  if (flown >= 1 - INCOMING_SOLID_SHARE) {
    return INCOMING_HOT;
  }

  const averageRate = INCOMING_FLASH_START + ((INCOMING_FLASH_END - INCOMING_FLASH_START) * flown) / 2;
  const wave = (Math.sin(seconds * flown * averageRate * Math.PI * 2) + 1) / 2;
  return INCOMING_DIM + (INCOMING_HOT - INCOMING_DIM) * wave;
}

/**
 * The blast's true edge, at its true width, drawn identically for both phases.
 *
 * The one thing on this floor a player reads to decide where to stand, so it is the one thing neither
 * phase is allowed to move, shrink, or blink out. Shared rather than written twice for exactly that
 * reason: a rim that drifted between the two would be a lie told at the worst possible moment.
 */
function pushBlastRim(built: RenderFloorDecal[], x: number, y: number, radius: number): void {
  built.push({
    x,
    y,
    shape: { kind: "ring", radius, thickness: RING_THICKNESS },
    color: CIRCLE_EDGE,
    strength: 0.9,
  });
}

/**
 * A light per side-room fixture, and the blessing altar's claim readout.
 *
 * Lights are rebuilt every frame while structure geometry is cached against the floor, which is why the
 * five-second claim is told here rather than by the posts rising: the dais brightens and its pool widens
 * as the hold accumulates, and goes to full when the claim lands. Leaving the room drops it back to
 * nothing on the next frame, because the hold itself resets — the readout is the state, not a copy of it.
 */
function roomLights(world: DemoWorld): RenderLight[] {
  const built: RenderLight[] = [];

  for (const room of world.maze.rooms) {
    const x = room.center.x + 0.5;
    const y = room.center.y + 0.5;

    if (room.role === "blessingAltar") {
      const held = world.maze.progress.blessingTaken
        ? 1
        : Math.min(1, world.maze.progress.heldSeconds / BLESSING_HOLD_SECONDS);
      built.push({
        id: "demo-blessing-light",
        x,
        y,
        radius: 2.6 + held * 3.4,
        intensity: 0.5 + held * 1.1,
        color: [244, 246, 255],
      });
    }

    if (room.role === "hotSpring") {
      built.push({
        id: "demo-spring-light",
        x,
        y,
        radius: 4,
        intensity: 0.7 + Math.sin(world.elapsedSeconds * 0.9) * 0.08,
        color: [126, 196, 226],
      });
    }

    if (room.role === "extraction") {
      // Loud, and louder while the hold runs. The way out was the one thing on the floor a player
      // could walk past without noticing, and a room that is only worth finding is a room that has to
      // be recognisable the moment it is found.
      const holding = extractionShare(world);
      built.push({
        id: "demo-extract-light",
        x,
        y,
        radius: 6 + holding * 3,
        intensity: 1.05 + holding * 0.9 + Math.sin(world.elapsedSeconds * (2.4 + holding * 9)) * (0.2 + holding * 0.2),
        color: [130, 240, 74],
      });
    }
  }

  return built;
}

function lights(world: DemoWorld): RenderLight[] {
  // The torch the player is carrying, as an actual light in the world rather than a screen effect —
  // so it pools on the floor around them, throws their surroundings into relief, and dies out at a
  // distance that tells them how far they can see.
  const flicker = 0.9 + Math.sin(world.elapsedSeconds * 11.3) * 0.06 + Math.sin(world.elapsedSeconds * 4.1) * 0.04;
  const built: RenderLight[] = [
    {
      id: "demo-torch",
      x: world.player.x,
      y: world.player.y,
      radius: 8.5,
      color: [255, 176, 104],
      intensity: 1.35 * flicker,
    },
  ];

  // The green over the stairs belongs to the stairs being open, and only to that. It used to burn from
  // the first second of the floor, which made the way down the brightest thing on it while it was also
  // the one thing that would refuse you — and gave away where it was for free, which is what the main
  // task is supposed to be bought with.
  if (world.maze.progress.main.met) {
    built.push({
      id: "demo-exit-light",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      radius: 5,
      color: [110, 240, 172],
      intensity: 0.95,
    });
  }

  if (world.altar.hp > 0) {
    // Pulses slowly, so an unspent altar reads as waiting rather than as scenery — and contracts as
    // it is broken open, which is the same damage readout as the stone but visible from anywhere.
    const left = altarShare(world);
    built.push({
      id: "demo-altar-light",
      x: world.altar.x,
      y: world.altar.y,
      radius: 3.2 + left * 1.4,
      intensity: (0.85 + Math.sin(world.elapsedSeconds * 1.6) * 0.15) * (0.55 + left * 0.45),
      color: [214, 62, 58],
    });
  }

  built.push(...roomLights(world));

  for (const hazard of world.hazards) {
    built.push({
      id: `${hazard.id}-light`,
      x: hazard.x,
      y: hazard.y,
      radius: 2.6,
      color: [255, 96, 72],
      intensity: 0.8,
    });
  }

  for (const mortar of world.mortars) {
    if (mortar.phase !== "locked") {
      continue;
    }

    // The muzzle coming up to heat. It is the only cue an emplacement gives about itself — the circle
    // it paints is somewhere else entirely — so a player who has learned the glow can tell which one
    // is about to fire without following the mark back to it.
    const closing = 1 - mortar.seconds / MORTAR_LOCK_SECONDS;
    built.push({
      id: `mortar-light-${mortar.cellX}-${mortar.cellY}`,
      x: mortar.cellX + 0.5,
      y: mortar.cellY + 0.5,
      radius: 1.4 + closing * 2.2,
      color: [255, 138, 74],
      intensity: 0.25 + closing * 1.15,
    });
  }

  for (const enemy of world.enemies) {
    if (enemy.windupSeconds <= 0) {
      continue;
    }

    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);

    if (enemy.intent === "shoot") {
      // The shot gathering inside the body. Small and close, so it lights the ground the shooter is
      // standing on rather than the room — enough to catch the eye off to one side of the view
      // without competing with the torch.
      built.push({
        id: `${enemy.id}-windup-light`,
        x: enemy.x,
        y: enemy.y,
        radius: 1.4 + progress * 1.1,
        color: [255, 108, 96],
        intensity: 0.35 + progress * 0.75,
      });
      continue;
    }

    if (enemy.intent === "melee") {
      // A full second is long enough that this has to carry across a crowded room, not just separate
      // the swordsman from whatever is standing behind it. It pulses faster as the swing nears, which
      // is the same clock the mark over its head and the wedge on the ground are counting.
      built.push({
        id: `${enemy.id}-windup-light`,
        x: enemy.x,
        y: enemy.y,
        radius: 1.6 + progress * 1.8,
        color: [255, 146, 112],
        intensity: (0.3 + progress * 1.05) * (0.88 + Math.sin(world.elapsedSeconds * (8 + progress * 16)) * 0.12),
      });
      continue;
    }

    if (enemy.intent === "charge") {
      // Deliberately the loudest light in the room besides the torch. A charger holds still for three
      // seconds, which is long enough to miss entirely if the only thing saying so is a mark over its
      // head — so it lights the walls around it instead, and a charge being stoked somewhere behind
      // you is something the room tells you about.
      built.push({
        id: `${enemy.id}-windup-light`,
        x: enemy.x,
        y: enemy.y,
        radius: 2 + progress * 3,
        color: [255, 96, 48],
        intensity: (0.4 + progress * 1.5) * (0.9 + Math.sin(world.elapsedSeconds * (7 + progress * 12)) * 0.1),
      });
    }
  }

  for (const effect of world.vfx) {
    const life = Math.min(1, effect.age / effect.life);

    if (effect.kind === "blast") {
      built.push({
        id: `${effect.id}-light`,
        x: effect.x,
        y: effect.y,
        radius: effect.radius * (1.6 + life * 1.6),
        color: [255, 176, 84],
        intensity: 1.6 * (1 - life),
      });
      continue;
    }

    built.push({
      id: `${effect.id}-light`,
      x: (effect.fromX + effect.toX) / 2,
      y: (effect.fromY + effect.toY) / 2,
      radius: 3.4,
      color: [150, 214, 255],
      intensity: 1.2 * (1 - life),
    });
  }

  return built;
}

function emitters(world: DemoWorld): RenderEmitter[] {
  const built: RenderEmitter[] = world.enemies
    .filter((enemy) => enemy.drowningSeconds > 0)
    .map((enemy) => ({ id: `${enemy.id}-drown`, x: enemy.x, y: enemy.y, kind: "steam" as const, density: 9 }));

  // The two things worth walking towards get their own signal in the air above them, so they read
  // as live from further away than their light reaches. The stairs earn theirs by being open; before
  // that they are a sealed capstone and give off nothing.
  if (world.maze.progress.main.met) {
    built.push({
      id: "demo-exit-motes",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      kind: "steam",
      density: 6,
    });
  }

  if (world.altar.hp > 0) {
    built.push({
      id: "demo-altar-embers",
      x: world.altar.x,
      y: world.altar.y,
      kind: "embers",
      density: Math.max(2, Math.round(altarShare(world) * 7)),
      color: [236, 74, 66],
    });
  }

  for (const room of world.maze.rooms) {
    const x = room.center.x + 0.5;
    const y = room.center.y + 0.5;

    if (room.role === "hotSpring") {
      built.push({ id: "demo-spring-steam", x, y, kind: "steam", density: 10 });
    }

    // A canister venting rather than a fountain of it: the plume drifts like steam and is the wrong
    // colour for anything else on a floor, so green in the air means one thing only.
    //
    // One plume in the middle of the room was too little of it — from the doorway, at torchlight
    // distance, it read as one more piece of drifting dust. It vents from the middle and from all four
    // posts now, and harder while the hold runs, so the room announces itself and then announces that
    // it is working.
    if (room.role === "extraction") {
      const holding = extractionShare(world);
      const density = Math.round(20 + holding * 22);
      built.push({ id: "demo-extract-smoke", x, y, kind: "steam", density, color: [136, 238, 78] });

      for (const cornerX of [-1, 1]) {
        for (const cornerY of [-1, 1]) {
          built.push({
            id: `demo-extract-smoke-${cornerX}-${cornerY}`,
            x: x + cornerX * PAD_HALF,
            y: y + cornerY * PAD_HALF,
            kind: "steam",
            density: Math.round(10 + holding * 12),
            color: [136, 238, 78],
          });
        }
      }
    }
  }

  return built;
}

/**
 * A kick on the camera when something detonates.
 *
 * Applied to pitch only. Pitch is presentation — nothing in the simulation reads it, and aiming is
 * horizontal — so shaking it cannot cost the player a shot, which a positional shake could.
 */
function blastKick(world: DemoWorld): number {
  let kick = 0;

  for (const effect of world.vfx) {
    if (effect.kind !== "blast") {
      continue;
    }

    const life = Math.min(1, effect.age / effect.life);
    const distance = Math.max(1, Math.hypot(effect.x - world.player.x, effect.y - world.player.y));
    kick += (Math.sin(effect.age * 46) * 0.035 * (1 - life) ** 2) / distance;
  }

  return kick;
}

/**
 * The same kick, for weight rather than for explosions: heaving a body out of your hands, and a body
 * coming down near you. The world holds one number for it and this is the only thing that reads it.
 *
 * Kept to a tap. This fires far more often than a detonation does — every throw and every landing —
 * and a camera that swings on all of them stops reading as weight and starts making people ill.
 */
function weightKick(world: DemoWorld): number {
  return Math.sin(world.elapsedSeconds * 52) * world.shake * 0.014;
}

/**
 * The parts of the scene that only change when the terrain does.
 *
 * Walls, floor materials and structures were being rebuilt from scratch sixty times a second —
 * around seven hundred fresh objects a frame for a grid that changes when someone breaks something.
 * Holding them until the terrain version moves costs one integer comparison and removes all of it.
 *
 * Keyed on the maze object as well as the version so a new floor can never serve stale geometry,
 * however the counter happens to line up.
 */
type TerrainCache = {
  maze: DemoMaze;
  version: number;
  surfaces: RenderSurface[];
  floorPatches: RenderFloorPatch[];
  boxes: RenderBox[];
};

let terrainCache: TerrainCache | undefined;

/**
 * The stain overlays, held until another drop lands.
 *
 * Rebuilding them per frame allocated an object per bloodied cell sixty times a second — late in a
 * fight that is most of the floor — and a fresh array identity also forced the renderer to rebuild
 * its per-cell grids every frame. Blood only changes when something bleeds; this only rebuilds then.
 */
type StainCache = {
  stains: Float32Array;
  version: number;
  overlays: RenderFloorOverlay[];
};

let stainCache: StainCache | undefined;

function cachedOverlays(world: DemoWorld): RenderFloorOverlay[] {
  if (stainCache && stainCache.stains === world.stains && stainCache.version === world.stainsVersion) {
    return stainCache.overlays;
  }

  stainCache = { stains: world.stains, version: world.stainsVersion, overlays: floorOverlays(world) };
  return stainCache.overlays;
}

function cachedTerrain(world: DemoWorld): TerrainCache {
  if (terrainCache && terrainCache.maze === world.maze && terrainCache.version === world.terrainVersion) {
    return terrainCache;
  }

  terrainCache = {
    maze: world.maze,
    version: world.terrainVersion,
    surfaces: surfaces(world),
    floorPatches: floorPatches(world),
    boxes: boxes(world),
  };
  return terrainCache;
}

export function createDemoScene(world: DemoWorld): RenderScene {
  const terrain = cachedTerrain(world);
  const rows: string[] = [];

  for (let y = 0; y < world.maze.height; y += 1) {
    let row = "";

    for (let x = 0; x < world.maze.width; x += 1) {
      // Asked as the walk question rather than by kind, so a pool the bodies have filled in reads
      // as the floor it now is. Every other kind answers exactly as it did before.
      row += blocksWalk(world.maze, x, y) ? "#" : ".";
    }

    rows.push(row);
  }

  return {
    floorId: `demo-${world.depth}`,
    theme: "demo",
    width: world.maze.width,
    height: world.maze.height,
    tiles: rows,
    camera: {
      x: world.player.x,
      y: world.player.y,
      angle: world.player.angle,
      pitch: world.player.pitch + blastKick(world) + weightKick(world) + demoMeleeImpactPitch(world.impact),
    },
    // Just enough ambient that an unlit corridor is a silhouette rather than a black rectangle.
    ambient: [0.16, 0.14, 0.24],
    sky: NIGHT_SKY,
    wallHeight: DEMO_WALL_HEIGHT,
    eyeHeight: 0.5,
    surfaces: terrain.surfaces,
    floorPatches: terrain.floorPatches,
    floorOverlays: cachedOverlays(world),
    floorDecals: floorDecals(world),
    boxes: terrain.boxes,
    blobs: blobs(world),
    sprites: sprites(world),
    beams: beams(world),
    particles: particles(world),
    lights: lights(world),
    emitters: emitters(world),
  };
}

/**
 * A short downward camera hitch while a melee impact decays.
 *
 * Kept small on purpose. This fires on every connected swing, which in a room worth clearing is most
 * of the seconds the player is alive for, and at the amplitude it used to have the view was still
 * settling from one cut when the next one landed — a floor cleared at speed read as a shaking screen
 * rather than as a series of hits.
 */
export function demoMeleeImpactPitch(impact: number): number {
  const strength = Math.max(0, Math.min(1, impact));
  return -Math.sin((1 - strength) * Math.PI) * strength * 0.011;
}

export function createDemoEffects(world: DemoWorld): PresentationRenderEffects {
  return {
    // Enemy state and deaths are carried by the blobs in the scene itself now — flash, pose and
    // corpse animation included — so the sprite-side effect channels stay empty here.
    enemies: [],
    deaths: [],
    swing: world.swing > 0 ? 1 - world.swing / Math.max(0.0001, world.swingTotal) : 0,
    playerHit: world.hitFlash,
    walkBob: world.walkBob,
    rejectionTorch: 1,
    rejectionStaticCue: false,
  };
}
