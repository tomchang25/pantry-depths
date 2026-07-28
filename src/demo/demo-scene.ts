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
  RenderEmitter,
  RenderFloorPatch,
  RenderLight,
  RenderScene,
  RenderSprite,
  RenderSurface,
  RenderSurfaceMaterial,
} from "@/presentation/render-scene";

const ALL_FACES = ["north", "east", "south", "west"] as const;
const EXIT_XRAY = { color: [138, 255, 190] as const, alpha: 0.95 };
const ALTAR_XRAY = { color: [255, 208, 118] as const, alpha: 0.8 };
/** How many spark billboards a lightning arc is drawn with. */
const ARC_SEGMENTS = 7;

const PROP_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stick,
  rock: DEMO_ASSET_IDS.rock,
  bomb: DEMO_ASSET_IDS.bomb,
};

const PROP_SCALES: Readonly<Record<DemoPropKind, number>> = { stick: 0.5, rock: 0.42, bomb: 0.4 };

function surfaces(world: DemoWorld): RenderSurface[] {
  const built: RenderSurface[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      if (!tile || tile.kind === "open" || tile.kind === "water") {
        continue;
      }

      if (tile.kind === "border") {
        built.push({ cell: { x, y }, material: "stoneWall" });
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

      // A cracked stone face is the shipped breakable material, which only shows its cracks on the
      // faces it is hinted for; a demo wall can be broken from any side, so hint all four.
      if (worn) {
        built.push({ cell: { x, y }, material: "breakableWall", hintFaces: ALL_FACES });
      } else {
        built.push({ cell: { x, y }, material: "oldBrickWall" });
      }
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
    built.push(
      ground(pile.id, pile.x, pile.y, pile.kind === "ammo" ? DEMO_ASSET_IDS.ammoPile : DEMO_ASSET_IDS.debris, 1.05),
    );
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
  }

  for (const hazard of world.hazards) {
    built.push({
      id: hazard.id,
      x: hazard.x,
      y: hazard.y,
      placement: "billboard",
      assetId: DEMO_ASSET_IDS.spark,
      scale: 0.32,
      verticalAnchor: -0.42,
    });
  }

  for (const projectile of world.projectiles) {
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

/** Pools are floor, not scenery: the renderer swaps the floor texture for these cells. */
function floorPatches(world: DemoWorld): RenderFloorPatch[] {
  const built: RenderFloorPatch[] = [];

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (world.maze.tiles[tileIndex(x, y)]?.kind === "water") {
        built.push({ cell: { x, y }, material: "water" });
      }
    }
  }

  return built;
}

function lights(world: DemoWorld): RenderLight[] {
  const built: RenderLight[] = [
    {
      id: "demo-exit-light",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      radius: 4.5,
      color: [122, 226, 168],
      intensity: 0.85,
    },
  ];

  if (world.altar.hp > 0) {
    built.push({
      id: "demo-altar-light",
      x: world.altar.x,
      y: world.altar.y,
      radius: 4,
      color: [244, 202, 122],
      intensity: 0.8,
    });
  }

  for (const effect of world.vfx) {
    if (effect.kind === "blast") {
      built.push({
        id: `${effect.id}-light`,
        x: effect.x,
        y: effect.y,
        radius: effect.radius * 2.4,
        color: [255, 168, 72],
        intensity: 1,
      });
    }
  }

  return built;
}

function emitters(world: DemoWorld): RenderEmitter[] {
  return world.enemies
    .filter((enemy) => enemy.drowningSeconds > 0)
    .map((enemy) => ({ id: `${enemy.id}-drown`, x: enemy.x, y: enemy.y, kind: "steam" as const, density: 9 }));
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
    camera: { x: world.player.x, y: world.player.y, angle: world.player.angle, pitch: world.player.pitch },
    surfaces: surfaces(world),
    floorPatches: floorPatches(world),
    sprites: sprites(world),
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
