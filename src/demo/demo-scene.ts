/**
 * Projects the demo world into the shipped renderer's scene format.
 *
 * Everything the demo added since — pools, altars, wind-up markers, blasts, lightning arcs — is
 * expressed as ordinary scene sprites rather than as new renderer features. That is deliberate: a
 * sprite gets depth sorting, lighting, and wall occlusion for free, so a lightning arc drawn as a
 * string of sparks is correctly hidden by the wall between you and it.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { blocksWalk, DEMO_GRID_SIZE, DEMO_WALL_HEIGHT, holdsStains, tileIndex } from "@/demo/maze";
import type { DemoParticleKind } from "@/demo/particles";
import type { DemoPropKind } from "@/demo/throw-weight";
import type { DemoMaze, DemoTile } from "@/demo/maze";
import { projectileHeight, SWING_SECONDS, type DemoDeath, type DemoEnemy, type DemoWorld } from "@/demo/world";
import type { PresentationRenderEffects } from "@/presentation/canvas-gameplay-renderer";
import type {
  RenderBeam,
  RenderBlob,
  RenderBlobFace,
  RenderBox,
  RenderEmitter,
  RenderFloorMaterial,
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

const EXIT_XRAY = { color: [138, 255, 190] as const, alpha: 0.95 };
const ALTAR_XRAY = { color: [255, 208, 118] as const, alpha: 0.8 };
/** How many spark billboards a lightning arc is drawn with. */
const ARC_SEGMENTS = 7;

/**
 * A javelin holds its line: no tumble at all, just a slow nose-down as it carries.
 *
 * The tumble was what made the old stick read as a hatchet — an object turning end over end is an
 * axe, and one that stays pointed where it is going is a spear. That single difference is now the
 * whole distinction between the two weapons, so it belongs to them rather than to the renderer.
 */
const JAVELIN_LENGTH = 0.95;
const JAVELIN_WIDTH = 0.055;

const AXE_LENGTH = 0.46;
const AXE_WIDTH = 0.12;
/** Radians of tumble per cell travelled. An axe is defined by turning over.  */
const AXE_SPIN = 7.2;

const PROP_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stick,
  rock: DEMO_ASSET_IDS.rock,
  bomb: DEMO_ASSET_IDS.bomb,
  axe: DEMO_ASSET_IDS.axe,
};

const PROP_SCALES: Readonly<Record<DemoPropKind, number>> = { stick: 0.5, rock: 0.42, bomb: 0.4, axe: 0.5 };

function surfaces(world: DemoWorld): RenderSurface[] {
  const built: RenderSurface[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      // A barricade is boxes, not a wall face. Leaving it in here is what made a broken wood wall
      // render as a cracked stone one: the cell was still emitting a surface, and with its hit
      // points spent the damage ladder picked its most ruined texture.
      if (
        !tile ||
        tile.kind === "open" ||
        tile.kind === "water" ||
        tile.kind === "filled" ||
        tile.kind === "barricade"
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

/** The wind-up marker floating over a committed enemy, and the lane a charger has claimed. */
function telegraph(world: DemoWorld, enemy: DemoEnemy, built: RenderSprite[]): void {
  if (enemy.windupSeconds <= 0 || enemy.intent === "none") {
    return;
  }

  const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
  built.push({
    id: `${enemy.id}-warn`,
    x: enemy.x,
    y: enemy.y,
    placement: "billboard",
    assetId: enemy.intent === "charge" ? DEMO_ASSET_IDS.warnCharge : DEMO_ASSET_IDS.warnShoot,
    // Swells as the wind-up completes, so how much time is left is legible at a glance.
    scale: 0.44 + progress * 0.3,
    verticalAnchor: -0.85,
  });

  if (enemy.intent !== "charge") {
    return;
  }

  const dx = world.player.x - enemy.x;
  const dy = world.player.y - enemy.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));

  for (let step = 1; step <= 5; step += 1) {
    built.push(
      ground(
        `${enemy.id}-lane-${step}`,
        enemy.x + (dx / length) * step,
        enemy.y + (dy / length) * step,
        DEMO_ASSET_IDS.laneMarker,
        0.8,
      ),
    );
  }
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

  // The rune hanging over the altar and the shaft over the stairs are what carry the x-ray outline,
  // because they sit above the structure and so are what you want to see over a wall.
  if (world.altar.hp > 0) {
    built.push({
      id: "demo-altar-rune",
      x: world.altar.x,
      y: world.altar.y,
      placement: "billboard",
      assetId: DEMO_ASSET_IDS.rune,
      // Shrinks back towards the stone as the altar is broken, so the thing you can see through a
      // wall says how many swings are left in it rather than only that one is there.
      scale: 0.24 + altarShare(world) * 0.14,
      verticalAnchor: -0.72 - Math.sin(world.elapsedSeconds * 1.7) * 0.05,
      xray: ALTAR_XRAY,
    });
  }

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
  built.push(
    ground("demo-entrance", world.maze.entrance.x + 0.5, world.maze.entrance.y + 0.5, DEMO_ASSET_IDS.entrance, 0.9),
  );

  // Loose pickups float, bob, and cast a shadow. A stack of three shows as three, staggered, so its
  // worth is legible before you walk over to it.
  for (const prop of world.props) {
    const bob = Math.sin(world.elapsedSeconds * 2.2 + prop.x * 3 + prop.y * 5) * 0.06;
    built.push(ground(`${prop.id}-shadow`, prop.x, prop.y, DEMO_ASSET_IDS.dropShadow, 0.5 + prop.count * 0.06));
    built.push(ground(`${prop.id}-glow`, prop.x, prop.y, DEMO_ASSET_IDS.groundGlow, 0.75 + prop.count * 0.1));

    for (let copy = 0; copy < Math.min(prop.count, 3); copy += 1) {
      const spread = (copy - (Math.min(prop.count, 3) - 1) / 2) * 0.14;
      built.push({
        id: `${prop.id}-${copy}`,
        x: prop.x + spread,
        y: prop.y + spread * 0.5,
        placement: "billboard",
        assetId: PROP_ASSETS[prop.kind],
        scale: PROP_SCALES[prop.kind],
        verticalAnchor: -0.28 - bob - copy * 0.05,
      });
    }
  }

  for (const enemy of world.enemies) {
    // The body itself is a blob now, not a billboard; only the telegraphs and sparks stay sprites.
    telegraph(world, enemy, built);

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

    // A javelin or an axe in flight is a beam, not a picture of one; see `beams`. Bodies riding a
    // projectile — skewered on the shaft or thrown whole — are blobs now, built in `blobs`.
    if (projectile.kind === "stick" || projectile.kind === "axe" || projectile.kind === "enemy") {
      continue;
    }

    const scale = PROP_SCALES[projectile.kind] * 0.8;
    built.push({
      id: projectile.id,
      x: projectile.x,
      y: projectile.y,
      placement: "billboard",
      assetId: PROP_ASSETS[projectile.kind],
      scale,
      // Centred on the display arc, so a lob rises and a slam drops with the curve.
      verticalAnchor: 0.5 - projectileHeight(projectile) / scale,
    });
  }

  for (const death of world.deaths) {
    if (death.cause === "splattered") {
      built.push(wallMark(death));
    }
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
 * Body dimensions and colour per appearance — the whole visual identity of a slime archetype.
 *
 * The walker is the reference shape, the shooter is slimmer and taller, the charger is a wider,
 * lower wedge; the silhouettes have to differ because the blobs no longer carry distinct artwork.
 */
type SlimeBody = Readonly<{ radius: number; height: number; color: readonly [number, number, number] }>;

const SLIME_BODIES: Readonly<Partial<Record<EnemyAppearanceId, SlimeBody>>> = {
  greenSlime: { radius: 0.3, height: 0.46, color: [118, 198, 92] },
  blueSlime: { radius: 0.26, height: 0.54, color: [96, 152, 218] },
  redSlime: { radius: 0.35, height: 0.4, color: [216, 92, 86] },
};

const FALLBACK_BODY: SlimeBody = {
  radius: 0.3,
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
function enemyBlob(world: DemoWorld, enemy: DemoEnemy): RenderBlob {
  const body = SLIME_BODIES[enemy.appearance] ?? FALLBACK_BODY;
  const t = world.elapsedSeconds;
  const phase = enemyPhase(enemy.id);
  const toPlayerX = world.player.x - enemy.x;
  const toPlayerY = world.player.y - enemy.y;
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
    // Anticipation: crouched and pulled back off the target, pulsing with the telegraph.
    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    squash = 0.82 - progress * 0.08;
    leanX = -towardX * 0.1;
    leanY = -towardY * 0.1;
    flash = 0.25 + 0.35 * Math.abs(Math.sin(t * (10 + 14 * (1 - enemy.windupSeconds))));
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
    flash = Math.max(flash, hurt);
    face = "hurt";
  }

  if (enemy.drowningSeconds > 0) {
    // Sinking. The bubbles above it are emitters; the body just goes under.
    const gone = 1 - enemy.drowningSeconds / 1.1;
    sink = -(body.height + 0.15) * gone;
    wobbleAmp = 0.1;
    face = "hurt";
  }

  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    radius: body.radius,
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
function shatteredBlobs(death: DemoDeath, corpse: RenderBlob, body: SlimeBody, t: number): RenderBlob[] {
  const seed = enemyPhase(death.id);
  const flight = Math.min(1, t / 0.45);
  const settle = easeOut(flight);
  const built: RenderBlob[] = [];

  for (let piece = 0; piece < SHATTER_PIECES; piece += 1) {
    const angle = seed + (piece / SHATTER_PIECES) * Math.PI * 2;
    // Alternating near and far, so the pieces do not land on one neat ring around the crater.
    const reach = (0.4 + (piece % 3) * 0.26) * settle;
    const size = body.radius * (0.24 + ((piece * 7) % 5) * 0.05);
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
  const t = Math.min(1, Math.max(0, death.progress));
  const corpse: RenderBlob = {
    id: `${death.id}-corpse`,
    x: death.x,
    y: death.y,
    radius: body.radius,
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
    return shatteredBlobs(death, corpse, body, t);
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
        radius: body.radius * (1 - 0.16 * hang),
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
): RenderBlob {
  const body = SLIME_BODIES[appearance] ?? FALLBACK_BODY;
  return {
    id,
    x,
    y,
    radius: body.radius * (impaled ? 0.9 : 1),
    height: body.height,
    color: body.color,
    // A skewered body is compressed on the shaft and holds still; a thrown one flails the whole way.
    squash: impaled ? 0.72 : 0.95 + Math.sin(t * 16) * 0.08,
    leanX: directionX * (impaled ? 0.16 : 0.1),
    leanY: directionY * (impaled ? 0.16 : 0.1),
    wobbleAmp: impaled ? 0.05 : 0.11,
    wobblePhase: t * 30,
    sink: lift,
    droop: impaled ? 0.1 : 0,
    flash: impaled ? 0.25 : 0,
    alpha: 1,
    face: "hurt",
  };
}

function blobs(world: DemoWorld): RenderBlob[] {
  const built: RenderBlob[] = world.enemies.map((enemy) => enemyBlob(world, enemy));

  for (const death of world.deaths) {
    built.push(...deathBlobs(death));
  }

  for (const projectile of world.projectiles) {
    if (projectile.kind === "stick") {
      projectile.skewered.forEach((enemy, index) => {
        const back = 0.3 + index * 0.3;
        built.push(
          carriedBlob(
            `${projectile.id}-run-${index}`,
            enemy.appearance,
            projectile.x - projectile.directionX * back,
            projectile.y - projectile.directionY * back,
            projectile.directionX,
            projectile.directionY,
            world.elapsedSeconds,
            0.3,
            true,
          ),
        );
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

const ALTAR_STONE: readonly [number, number, number] = [96, 86, 106];
const ALTAR_RUINED_STONE: readonly [number, number, number] = [58, 52, 68];

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

/**
 * The structures that stand up: the altar and the mouth of the stairs.
 *
 * Both were flat images on the ground, which is the single thing that made them read as markers
 * painted on the floor rather than as places. The altar is now a plinth you can walk around; the
 * stair is a pit sunk below the floor with four steps descending into it and a raised kerb.
 */
function boxes(world: DemoWorld): RenderBox[] {
  const built: RenderBox[] = altarBoxes(world);
  const exitX = world.maze.exit.x + 0.5;
  const exitY = world.maze.exit.y + 0.5;

  // A dais climbing to a lit landing, rather than a pit descending into one. The depth buffer this
  // renderer keeps is one value per screen column, written only by the walls — the floor is never in
  // it — so anything drawn below floor level cannot be hidden by the floor and simply sits on top of
  // it. Geometry that stands up is the only kind this projection can honestly draw.
  for (let step = 0; step < 3; step += 1) {
    const inset = 0.46 - step * 0.09;
    built.push({
      id: `exit-step-${step}`,
      x: exitX,
      y: exitY,
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
      x: exitX + side * 0.38,
      y: exitY,
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
    x: exitX,
    y: exitY,
    halfX: 0.48,
    halfY: 0.1,
    bottom: 1.05,
    top: 1.24,
    color: [96, 88, 116],
    topColor: [146, 136, 168],
  });

  // Iron caltrops: two crossed rails carrying a row of upright spikes. Deliberately sparse and open
  // — you have to be able to see through one to whatever is standing behind it.
  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      if (tile?.kind !== "barricade") {
        continue;
      }

      // Bent and darkened as it takes damage, so how close one is to being cleared is visible.
      const wear = tile.maxHp > 0 ? 1 - tile.hp / tile.maxHp : 0;
      const iron: readonly [number, number, number] = [128 - wear * 44, 132 - wear * 46, 146 - wear * 50];
      const edge: readonly [number, number, number] = [196 - wear * 70, 204 - wear * 74, 220 - wear * 80];

      for (const along of [-0.28, 0, 0.28]) {
        built.push({
          id: `spike-${x}-${y}-${along}`,
          x: x + 0.5 + along,
          y: y + 0.5 + along * 0.35,
          halfX: 0.045,
          halfY: 0.045,
          bottom: 0.1,
          top: 0.66 - wear * 0.18,
          color: iron,
          topColor: edge,
        });
      }

      for (const cross of [-1, 1]) {
        built.push({
          id: `rail-${x}-${y}-${cross}`,
          x: x + 0.5,
          y: y + 0.5 + cross * 0.16,
          halfX: 0.42,
          halfY: 0.04,
          bottom: 0.06,
          top: 0.14,
          color: iron,
          topColor: edge,
        });
      }
    }
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
const POOL_FILL: readonly RenderFloorMaterial[] = ["water", "waterFouled", "waterChoked"];

/**
 * Every walkable cell names its floor.
 *
 * Pools are floor, not scenery — the renderer swaps the texture rather than laying a sprite on top.
 * The dry cells are named too, which is how the demo gets its own flagstones without touching the
 * default floor the shipped game draws.
 */
function floorPatches(world: DemoWorld): RenderFloorPatch[] {
  const built: RenderFloorPatch[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];
      built.push({ cell: { x, y }, material: floorMaterial(tile) });
    }
  }

  return built;
}

function floorMaterial(tile: DemoTile | undefined): RenderFloorMaterial {
  if (tile?.kind === "filled") {
    return "demoCarrion";
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
    if (projectile.kind === "stick") {
      // The shaft points along its own flight line, which is now the aim line it left the hand on.
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
          JAVELIN_LENGTH,
          JAVELIN_WIDTH,
          [104, 66, 36],
          [232, 214, 176],
        ),
      );
      continue;
    }

    if (projectile.kind === "axe") {
      built.push(
        rodBeam(
          projectile.id,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          projectile.travelled * AXE_SPIN,
          projectileHeight(projectile),
          AXE_LENGTH,
          AXE_WIDTH,
          [88, 58, 32],
          [214, 222, 232],
        ),
      );
    }
  }

  return built;
}

/** Blood already spilled, as a material mixed into the floor rather than an image laid over it. */
function floorOverlays(world: DemoWorld): RenderFloorOverlay[] {
  const built: RenderFloorOverlay[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const amount = world.stains[y * DEMO_GRID_SIZE + x] ?? 0;

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
    {
      id: "demo-exit-light",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      radius: 5,
      color: [110, 240, 172],
      intensity: 0.95,
    },
  ];

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
      color: [255, 206, 128],
    });
  }

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
  // as live from further away than their light reaches.
  built.push({
    id: "demo-exit-motes",
    x: world.maze.exit.x + 0.5,
    y: world.maze.exit.y + 0.5,
    kind: "steam",
    density: 6,
  });

  if (world.altar.hp > 0) {
    built.push({
      id: "demo-altar-embers",
      x: world.altar.x,
      y: world.altar.y,
      kind: "embers",
      density: Math.max(2, Math.round(altarShare(world) * 7)),
    });
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

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    let row = "";

    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      // Asked as the walk question rather than by kind, so a pool the bodies have filled in reads
      // as the floor it now is. Every other kind answers exactly as it did before.
      row += blocksWalk(world.maze, x, y) ? "#" : ".";
    }

    rows.push(row);
  }

  return {
    floorId: `demo-${world.depth}`,
    theme: "demo",
    width: DEMO_GRID_SIZE,
    height: DEMO_GRID_SIZE,
    tiles: rows,
    camera: {
      x: world.player.x,
      y: world.player.y,
      angle: world.player.angle,
      pitch: world.player.pitch + blastKick(world) + weightKick(world),
    },
    // Just enough ambient that an unlit corridor is a silhouette rather than a black rectangle.
    ambient: [0.16, 0.14, 0.24],
    sky: NIGHT_SKY,
    wallHeight: DEMO_WALL_HEIGHT,
    eyeHeight: 0.5,
    surfaces: terrain.surfaces,
    floorPatches: terrain.floorPatches,
    floorOverlays: cachedOverlays(world),
    boxes: terrain.boxes,
    blobs: blobs(world),
    sprites: sprites(world),
    beams: beams(world),
    particles: particles(world),
    lights: lights(world),
    emitters: emitters(world),
  };
}

export function createDemoEffects(world: DemoWorld): PresentationRenderEffects {
  return {
    // Enemy state and deaths are carried by the blobs in the scene itself now — flash, pose and
    // corpse animation included — so the sprite-side effect channels stay empty here.
    enemies: [],
    deaths: [],
    swing: world.swing > 0 ? 1 - world.swing / SWING_SECONDS : 0,
    playerHit: world.hitFlash,
    walkBob: world.walkBob,
    rejectionTorch: 1,
    rejectionStaticCue: false,
  };
}
