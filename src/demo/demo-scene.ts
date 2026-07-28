/**
 * Projects the demo world into the shipped renderer's scene format.
 *
 * The renderer already takes a floating-point camera and floating-point sprites, so nothing about
 * real-time movement needed changing there. Only the material mapping is new: two wood materials
 * were added so a two-hit wall never reads like a four-hit one.
 */

import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { DEMO_GRID_SIZE, tileIndex } from "@/demo/maze";
import { SWING_SECONDS, type DemoPropKind, type DemoWorld } from "@/demo/world";
import type { PresentationRenderEffects } from "@/presentation/canvas-gameplay-renderer";
import type {
  RenderLight,
  RenderScene,
  RenderSprite,
  RenderSurface,
  RenderSurfaceMaterial,
} from "@/presentation/render-scene";

const ALL_FACES = ["north", "east", "south", "west"] as const;

const PROP_ASSETS: Readonly<Record<DemoPropKind, string>> = {
  stick: DEMO_ASSET_IDS.stick,
  smallRock: DEMO_ASSET_IDS.smallRock,
  bigRock: DEMO_ASSET_IDS.bigRock,
};

const PROP_SCALES: Readonly<Record<DemoPropKind, number>> = {
  stick: 0.5,
  smallRock: 0.3,
  bigRock: 0.55,
};

function surfaces(world: DemoWorld): RenderSurface[] {
  const built: RenderSurface[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];

      if (!tile || tile.kind === "open") {
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

function sprites(world: DemoWorld): RenderSprite[] {
  const built: RenderSprite[] = [];

  built.push({
    id: "demo-exit",
    x: world.maze.exit.x + 0.5,
    y: world.maze.exit.y + 0.5,
    placement: "ground",
    assetId: DEMO_ASSET_IDS.exit,
    scale: 1.2,
    verticalAnchor: 0,
  });
  built.push({
    id: "demo-entrance",
    x: world.maze.entrance.x + 0.5,
    y: world.maze.entrance.y + 0.5,
    placement: "ground",
    assetId: DEMO_ASSET_IDS.entrance,
    scale: 1,
    verticalAnchor: 0,
  });

  for (const pile of world.piles) {
    built.push({
      id: pile.id,
      x: pile.x,
      y: pile.y,
      placement: "ground",
      assetId: pile.kind === "woodSpikes" ? DEMO_ASSET_IDS.spikePile : DEMO_ASSET_IDS.rockPile,
      scale: 1.05,
      verticalAnchor: 0,
    });
  }

  for (const prop of world.props) {
    built.push({
      id: prop.id,
      x: prop.x,
      y: prop.y,
      placement: "ground",
      assetId: PROP_ASSETS[prop.kind],
      scale: PROP_SCALES[prop.kind],
      verticalAnchor: 0,
    });
  }

  for (const enemy of world.enemies) {
    built.push({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      placement: "billboard",
      assetId: `enemy.${enemy.appearance}.normal`,
      appearanceId: enemy.appearance,
      scale: 0.62,
      verticalAnchor: 0,
    });
  }

  for (const projectile of world.projectiles) {
    if (projectile.kind === "enemy" && projectile.payload) {
      built.push({
        id: projectile.id,
        x: projectile.x,
        y: projectile.y,
        placement: "billboard",
        assetId: `enemy.${projectile.payload.appearance}.hurt`,
        scale: 0.55,
        verticalAnchor: -0.3,
      });
      continue;
    }

    if (projectile.kind === "enemy") {
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

  return built;
}

function lights(world: DemoWorld): RenderLight[] {
  return [
    {
      id: "demo-exit-light",
      x: world.maze.exit.x + 0.5,
      y: world.maze.exit.y + 0.5,
      radius: 4.5,
      color: [122, 226, 168],
      intensity: 0.85,
    },
  ];
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
    floorId: "demo",
    theme: "demo",
    width: DEMO_GRID_SIZE,
    height: DEMO_GRID_SIZE,
    tiles: rows,
    camera: { x: world.player.x, y: world.player.y, angle: world.player.angle, pitch: world.player.pitch },
    surfaces: surfaces(world),
    sprites: sprites(world),
    lights: lights(world),
    emitters: [],
  };
}

export function createDemoEffects(world: DemoWorld): PresentationRenderEffects {
  return {
    enemies: world.enemies.map((enemy) => ({
      entityId: enemy.id,
      state: enemy.hurtSeconds > 0 ? "hurt" : enemy.attackPoseSeconds > 0 ? "attack" : "normal",
      whiteFlash: enemy.hurtSeconds > 0 ? Math.min(1, enemy.hurtSeconds / 0.28) : 0,
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
