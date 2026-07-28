/**
 * Projects the demo world into the shipped renderer's scene format.
 *
 * Everything the demo added since — pools, altars, wind-up markers, blasts, lightning arcs — is
 * expressed as ordinary scene sprites rather than as new renderer features. That is deliberate: a
 * sprite gets depth sorting, lighting, and wall occlusion for free, so a lightning arc drawn as a
 * string of sparks is correctly hidden by the wall between you and it.
 */

import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { DEMO_GRID_SIZE, tileIndex } from "@/demo/maze";
import { SWING_SECONDS, type DemoEnemy, type DemoPropKind, type DemoWorld } from "@/demo/world";
import type { PresentationRenderEffects } from "@/presentation/canvas-gameplay-renderer";
import type {
  RenderBeam,
  RenderEmitter,
  RenderFloorPatch,
  RenderLight,
  RenderScene,
  RenderSprite,
  RenderSurface,
  RenderSurfaceMaterial,
} from "@/presentation/render-scene";

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
const JAVELIN_THROW_HEIGHT = 0.52;
/** Radians of nose-down per cell travelled, capped so a long throw never points at the floor. */
const JAVELIN_PITCH = 0.022;
const JAVELIN_MAX_PITCH = 0.3;

const AXE_LENGTH = 0.46;
const AXE_WIDTH = 0.12;
/** Radians of tumble per cell travelled. An axe is defined by turning over.  */
const AXE_SPIN = 7.2;
const AXE_THROW_HEIGHT = 0.52;
const AXE_DROOP = 0.14;

const PROP_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stick,
  rock: DEMO_ASSET_IDS.rock,
  bomb: DEMO_ASSET_IDS.bomb,
  axe: DEMO_ASSET_IDS.axe,
};

const PROP_SCALES: Readonly<Record<DemoPropKind, number>> = { stick: 0.5, rock: 0.42, bomb: 0.4, axe: 0.5 };

/** A pile looks like what it holds, so its worth is readable from across the room. */
const PILE_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stickPile,
  rock: DEMO_ASSET_IDS.rockPile,
  bomb: DEMO_ASSET_IDS.bombPile,
  // Never appears — the axe only ever drops from a corpse — but the table must be total.
  axe: DEMO_ASSET_IDS.bombPile,
};

function surfaces(world: DemoWorld): RenderSurface[] {
  const built: RenderSurface[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      if (!tile || tile.kind === "open" || tile.kind === "water") {
        continue;
      }

      if (tile.kind === "border") {
        built.push({ cell: { x, y }, material: "demoFoundation" });
        continue;
      }

      // Wear is read off the fraction of hit points left, so it keeps working whatever the numbers
      // are: a wall that has taken half of what it can take starts showing damage.
      const worn = tile.hp <= tile.maxHp / 2;

      if (tile.kind === "wood") {
        const material: RenderSurfaceMaterial = worn ? "splinteredWoodWall" : "woodWall";
        built.push({ cell: { x, y }, material });
        continue;
      }

      built.push({ cell: { x, y }, material: worn ? "demoSpalledAshlar" : "demoAshlar" });
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

  built.push({
    ...ground("demo-exit", world.maze.exit.x + 0.5, world.maze.exit.y + 0.5, DEMO_ASSET_IDS.exit, 1.2),
    xray: EXIT_XRAY,
  });
  built.push(
    ground("demo-entrance", world.maze.entrance.x + 0.5, world.maze.entrance.y + 0.5, DEMO_ASSET_IDS.entrance, 1),
  );
  built.push({
    id: "demo-altar",
    x: world.altar.x,
    y: world.altar.y,
    placement: "billboard",
    assetId: world.altar.hp > 0 ? DEMO_ASSET_IDS.altar : DEMO_ASSET_IDS.altarSpent,
    scale: 0.85,
    verticalAnchor: 0,
    ...(world.altar.hp > 0 ? { xray: ALTAR_XRAY } : {}),
  });

  for (const pile of world.piles) {
    built.push(ground(pile.id, pile.x, pile.y, PILE_ASSETS[pile.ammo], 1.05));
  }

  for (const prop of world.props) {
    built.push(ground(prop.id, prop.x, prop.y, PROP_ASSETS[prop.kind], PROP_SCALES[prop.kind]));
  }

  for (const enemy of world.enemies) {
    const sinking = enemy.drowningSeconds > 0 ? 1 - enemy.drowningSeconds / 1.1 : 0;
    built.push({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      placement: "billboard",
      assetId: `enemy.${enemy.appearance}.normal`,
      appearanceId: enemy.appearance,
      scale: 0.62,
      // Sinks out of sight as it drowns; the bubbles above it are emitters.
      verticalAnchor: sinking * 0.9,
    });
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
    // A javelin or an axe in flight is a beam, not a picture of one; see `beams`. What a javelin is
    // carrying, though, is still a body and still drawn as one — strung back along the shaft.
    if (projectile.kind === "stick") {
      projectile.skewered.forEach((enemy, index) => {
        const back = 0.3 + index * 0.3;
        built.push({
          id: `${projectile.id}-run-${index}`,
          x: projectile.x - projectile.directionX * back,
          y: projectile.y - projectile.directionY * back,
          placement: "billboard",
          assetId: `enemy.${enemy.appearance}.hurt`,
          scale: 0.5,
          verticalAnchor: -0.1,
        });
      });
      continue;
    }

    if (projectile.kind === "axe") {
      continue;
    }

    if (projectile.kind === "enemy") {
      if (projectile.payload) {
        built.push({
          id: projectile.id,
          x: projectile.x,
          y: projectile.y,
          placement: "billboard",
          assetId: `enemy.${projectile.payload.appearance}.hurt`,
          scale: 0.55,
          verticalAnchor: -0.3,
        });
      }

      continue;
    }

    built.push({
      id: projectile.id,
      x: projectile.x,
      y: projectile.y,
      placement: "billboard",
      assetId: PROP_ASSETS[projectile.kind],
      scale: PROP_SCALES[projectile.kind] * 0.8,
      verticalAnchor: -0.35,
    });
  }

  vfxSprites(world, built);
  return built;
}

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
      const water = world.maze.tiles[tileIndex(x, y)]?.kind === "water";
      built.push({ cell: { x, y }, material: water ? "water" : "demoFlagstone" });
    }
  }

  return built;
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
      const pitch = -Math.min(JAVELIN_MAX_PITCH, projectile.travelled * JAVELIN_PITCH);
      built.push(
        rodBeam(
          projectile.id,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          pitch,
          JAVELIN_THROW_HEIGHT,
          JAVELIN_LENGTH,
          JAVELIN_WIDTH,
          [104, 66, 36],
          [232, 214, 176],
        ),
      );
      continue;
    }

    if (projectile.kind === "axe") {
      const flight = projectile.travelled / Math.max(0.0001, projectile.range);
      built.push(
        rodBeam(
          projectile.id,
          projectile.x,
          projectile.y,
          projectile.directionX,
          projectile.directionY,
          projectile.travelled * AXE_SPIN,
          AXE_THROW_HEIGHT - flight * flight * AXE_DROOP,
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
    built.push({
      id: "demo-altar-light",
      x: world.altar.x,
      y: world.altar.y,
      radius: 4.6,
      // Pulses slowly, so an unspent altar reads as waiting rather than as scenery.
      intensity: 0.85 + Math.sin(world.elapsedSeconds * 1.6) * 0.15,
      color: [255, 206, 128],
    });
  }

  for (const pile of world.piles) {
    if (pile.ammo === "bomb") {
      built.push({ id: `${pile.id}-light`, x: pile.x, y: pile.y, radius: 2.4, color: [226, 82, 74], intensity: 0.5 });
    }
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
    built.push({ id: "demo-altar-embers", x: world.altar.x, y: world.altar.y, kind: "embers", density: 7 });
  }

  for (const pile of world.piles) {
    if (pile.ammo === "bomb") {
      built.push({ id: `${pile.id}-fuse`, x: pile.x, y: pile.y, kind: "embers", density: 3 });
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

export function createDemoScene(world: DemoWorld): RenderScene {
  const rows: string[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    let row = "";

    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      row += world.maze.tiles[tileIndex(x, y)]?.kind === "open" ? "." : "#";
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
      pitch: world.player.pitch + blastKick(world),
    },
    // Just enough ambient that an unlit corridor is a silhouette rather than a black rectangle.
    ambient: [0.16, 0.14, 0.24],
    ceilingMaterial: "demoVault",
    surfaces: surfaces(world),
    floorPatches: floorPatches(world),
    sprites: sprites(world),
    beams: beams(world),
    lights: lights(world),
    emitters: emitters(world),
  };
}

export function createDemoEffects(world: DemoWorld): PresentationRenderEffects {
  return {
    enemies: world.enemies.map((enemy) => ({
      entityId: enemy.id,
      state: enemy.hurtSeconds > 0 ? "hurt" : enemy.attackPoseSeconds > 0 ? "attack" : "normal",
      // A committed enemy pulses faster the closer it is to releasing, which is the second half of
      // the telegraph: the marker says what, the pulse says when.
      whiteFlash:
        enemy.windupSeconds > 0
          ? 0.25 + 0.35 * Math.abs(Math.sin(world.elapsedSeconds * (10 + 14 * (1 - enemy.windupSeconds))))
          : enemy.hurtSeconds > 0
            ? Math.min(1, enemy.hurtSeconds / 0.28)
            : 0,
    })),
    deaths: world.deaths.map((death) => ({
      entityId: death.id,
      appearanceId: death.appearance,
      x: death.x,
      y: death.y,
      scale: 0.62,
      verticalAnchor: 0,
      progress: death.progress,
    })),
    swing: world.swing > 0 ? 1 - world.swing / SWING_SECONDS : 0,
    playerHit: world.hitFlash,
    walkBob: world.walkBob,
    rejectionTorch: 1,
    rejectionStaticCue: false,
  };
}
