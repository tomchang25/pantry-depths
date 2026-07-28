import type { EnemyAppearanceId } from "@/content/combat/enemies";
import type { EnemySpriteState } from "@/content/presentation/presentation-asset-definitions";
import type { Facing } from "@/core/grid";
import { createProceduralTextures, type TextureSet } from "@/presentation/procedural-textures";
import type {
  RenderBeam,
  RenderEmitter,
  RenderFloorMaterial,
  RenderPoint,
  RenderScene,
  RenderSprite,
  RenderSurface,
  RenderSurfaceMaterial,
} from "@/presentation/render-scene";
import type { PresentationImages } from "@/presentation/presentation-image-loader";

const WALL_FACE_NORMALS: Readonly<Record<Facing, Readonly<{ x: number; y: number }>>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const DEFAULT_TORCH_COLOR: readonly [number, number, number] = [255, 112, 45];

const MAX_DEPTH = 18;
const RENDER_SCALE = 0.55;
const MAX_WIDTH = 1050;
const MAX_HEIGHT = 650;
const TEXTURE_SIZE = 64;
const LIT_SPRITE_CACHE_LIMIT = 64;
/**
 * Index order for the per-cell floor lookup; position here is what the patch grid stores.
 *
 * Every member of `RenderFloorMaterial` must appear, or a scene naming the missing one silently
 * falls back to the default floor instead of failing.
 */
const FLOOR_MATERIALS: readonly RenderFloorMaterial[] = ["water", "demoFlagstone", "demoVault"];
/** Rods are cut off closer than this, so a rod leaving the player's own hand cannot fill the screen. */
const BEAM_NEAR_PLANE = 0.5;
/** Quads swept along a rod. Enough that the taper is smooth without paying for a real mesh. */
const BEAM_PIECES = 10;
/** Lightmap texels per cell. Three is the point where a light pool stops looking like a staircase. */
const LIGHTMAP_SCALE = 3;

export type EnemyRenderEffect = Readonly<{
  entityId: string;
  state: EnemySpriteState;
  whiteFlash: number;
}>;

export type DeathRenderEffect = Readonly<{
  entityId: string;
  appearanceId: EnemyAppearanceId;
  x: number;
  y: number;
  scale: number;
  verticalAnchor: number;
  progress: number;
}>;

export type PresentationRenderEffects = Readonly<{
  enemies: readonly EnemyRenderEffect[];
  deaths: readonly DeathRenderEffect[];
  swing: number;
  playerHit: number;
  /** 0..1 envelope for the movement-only walking bob, on top of the always-on idle bob. */
  walkBob: number;
  /** Torch-light multiplier during a backward rejection; 1 is normal, lower is contracted. */
  rejectionTorch: number;
  /** True only while the reduced-motion static cue should replace the rejection nudge. */
  rejectionStaticCue: boolean;
}>;

export type RendererPreferences = Readonly<{
  reducedMotion: boolean;
  /**
   * Whether to draw the shipped torch-and-sword viewmodel. The demo surface turns it off and paints
   * its own hands, because it has to show whatever is currently being carried.
   */
  viewmodel?: boolean;
  /**
   * Turns on the lightmap: placed lights actually pool on walls and floor instead of only warming
   * nearby sprites.
   *
   * Off everywhere at present. It works, but the lightmap is sampled at three texels per cell with
   * no interpolation, and a light that moves — the torch the player carries — crosses those texel
   * boundaries every frame, so whole patches of wall snap between levels as you walk. Fixing it
   * means filtering the sample, not tuning the numbers; until then this stays off.
   */
  enhancedLighting?: boolean;
  /**
   * The vignette and warm centre. Independent of the lightmap, because it is a lens effect rather
   * than a lighting model and looks right over either one.
   */
  grade?: boolean;
}>;

const NO_EFFECTS: PresentationRenderEffects = {
  enemies: [],
  deaths: [],
  swing: 0,
  playerHit: 0,
  walkBob: 0,
  rejectionTorch: 1,
  rejectionStaticCue: false,
};

type RayHit = Readonly<{
  distance: number;
  surface: RenderSurface;
  textureX: number;
  face: "north" | "east" | "south" | "west";
  shade: number;
  /** Where on the face the ray landed, so lighting can vary across a wall rather than per cell. */
  hitX: number;
  hitY: number;
}>;

type ProjectedSprite = Readonly<{
  sprite: RenderSprite;
  depth: number;
  screenX: number;
  startX: number;
  endX: number;
  startY: number;
  width: number;
  height: number;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function requireImage(images: PresentationImages, assetId: string): CanvasImageSource {
  const image = images.get(assetId);

  if (!image) {
    throw new Error(`renderer: missing loaded image ${assetId}`);
  }

  return image;
}

/**
 * Fill styles for the wall pass, quantised and cached.
 *
 * Every one of these is set once per screen column, so building the `rgba(...)` string each time
 * allocated a few thousand strings a frame — enough to be the single largest cost in the lit path.
 * Quantising to a small ladder costs nothing visible and makes the styles reusable.
 */
const SHADOW_STEPS = 48;
const SHADOW_STYLES = Array.from({ length: SHADOW_STEPS + 1 }, (_, step) => `rgba(7, 3, 15, ${step / SHADOW_STEPS})`);

function shadowStyle(alpha: number): string {
  return SHADOW_STYLES[Math.round(clamp(alpha, 0, 1) * SHADOW_STEPS)] ?? SHADOW_STYLES[0] ?? "rgba(7, 3, 15, 0)";
}

function along(start: RenderPoint, end: RenderPoint, t: number): RenderPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

function imageDimensions(image: CanvasImageSource): Readonly<{ width: number; height: number }> {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  if ("width" in image && "height" in image) {
    return { width: Number(image.width), height: Number(image.height) };
  }

  return { width: 512, height: 512 };
}

export class CanvasGameplayRenderer {
  readonly #context: CanvasRenderingContext2D;
  readonly #textures: TextureSet;
  readonly #texturePixels: Readonly<{ floor: Uint8ClampedArray; ceiling: Uint8ClampedArray }>;
  readonly #litSpriteCache = new Map<string, HTMLCanvasElement>();
  readonly #whiteSpriteCache = new Map<string, HTMLCanvasElement>();
  readonly #tintedSpriteCache = new Map<string, HTMLCanvasElement>();
  readonly #floorPatchPixels: readonly Uint8ClampedArray[];
  #depthBuffer = new Float64Array(1);
  #lightmap = new Float32Array(0);
  #solidGrid = new Uint8Array(0);
  readonly #tintStyles = new Map<number, string>();
  #lit = false;

  public constructor(
    readonly canvas: HTMLCanvasElement,
    readonly images: PresentationImages,
    documentOwner: Document = document,
  ) {
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas 2D is unavailable");
    }

    this.#context = context;
    this.#context.imageSmoothingEnabled = false;
    this.#textures = createProceduralTextures(documentOwner);
    const floorContext = this.#textures.floor.getContext("2d");
    const ceilingContext = this.#textures.ceiling.getContext("2d");

    if (!floorContext || !ceilingContext) {
      throw new Error("procedural texture pixels are unavailable");
    }

    this.#texturePixels = {
      floor: floorContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data,
      ceiling: ceilingContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data,
    };
    this.#floorPatchPixels = FLOOR_MATERIALS.map((material) => {
      const patchContext = this.#textures.floors[material].getContext("2d");

      if (!patchContext) {
        throw new Error(`procedural floor pixels are unavailable for ${material}`);
      }

      return patchContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
    });
  }

  /**
   * Builds the frame's lightmap: placed lights accumulated onto a grid finer than the cells.
   *
   * Sampling per pixel against every light would cost a multiply-add per light per floor pixel, so
   * the light is resolved once per lightmap texel instead and every surface reads it back with a
   * single array index. Three samples per cell is enough that a torch pool has a soft edge rather
   * than a staircase, and coarse enough that the whole grid is a few thousand texels.
   *
   * Occlusion is a short march from texel to light: without it a lamp in one room lights the far
   * side of the wall it is standing against, which is exactly the giveaway that a scene is faked.
   */
  #buildLightmap(scene: RenderScene, surfaces: ReadonlyMap<string, RenderSurface>): void {
    const width = scene.width * LIGHTMAP_SCALE;
    const height = scene.height * LIGHTMAP_SCALE;

    // A flat grid of which cells are solid. The occlusion march below runs tens of thousands of
    // times a frame, and asking a string-keyed map each step allocated a key per step — on its own
    // that was most of the frame.
    if (this.#solidGrid.length !== scene.width * scene.height) {
      this.#solidGrid = new Uint8Array(scene.width * scene.height);
    }

    this.#solidGrid.fill(0);

    for (const surface of surfaces.values()) {
      if (surface.cell.x >= 0 && surface.cell.y >= 0 && surface.cell.x < scene.width && surface.cell.y < scene.height) {
        this.#solidGrid[surface.cell.y * scene.width + surface.cell.x] = 1;
      }
    }

    if (this.#lightmap.length !== width * height * 3) {
      this.#lightmap = new Float32Array(width * height * 3);
    }

    const map = this.#lightmap;
    const ambient = scene.ambient ?? [0, 0, 0];

    for (let index = 0; index < map.length; index += 3) {
      map[index] = ambient[0];
      map[index + 1] = ambient[1];
      map[index + 2] = ambient[2];
    }

    for (const light of scene.lights) {
      const minX = Math.max(0, Math.floor((light.x - light.radius) * LIGHTMAP_SCALE));
      const maxX = Math.min(width - 1, Math.ceil((light.x + light.radius) * LIGHTMAP_SCALE));
      const minY = Math.max(0, Math.floor((light.y - light.radius) * LIGHTMAP_SCALE));
      const maxY = Math.min(height - 1, Math.ceil((light.y + light.radius) * LIGHTMAP_SCALE));

      for (let texelY = minY; texelY <= maxY; texelY += 1) {
        for (let texelX = minX; texelX <= maxX; texelX += 1) {
          const worldX = (texelX + 0.5) / LIGHTMAP_SCALE;
          const worldY = (texelY + 0.5) / LIGHTMAP_SCALE;
          const distance = Math.hypot(worldX - light.x, worldY - light.y);

          if (distance > light.radius) {
            continue;
          }

          // A gentler curve than inverse-square: a torch that falls off physically leaves the player
          // standing in a bright disc with a hard edge, and the readable thing is a long soft reach.
          const falloff = (1 - distance / light.radius) ** 1.7 * light.intensity;

          if (falloff < 0.01 || this.#occluded(scene, light.x, light.y, worldX, worldY)) {
            continue;
          }

          const index = (texelY * width + texelX) * 3;
          map[index] = (map[index] ?? 0) + (light.color[0] / 255) * falloff;
          map[index + 1] = (map[index + 1] ?? 0) + (light.color[1] / 255) * falloff;
          map[index + 2] = (map[index + 2] ?? 0) + (light.color[2] / 255) * falloff;
        }
      }
    }
  }

  /** Coarse line test between a light and a lightmap texel. Wrong by at most part of one cell. */
  #occluded(scene: RenderScene, fromX: number, fromY: number, toX: number, toY: number): boolean {
    const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) * 2);

    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const x = Math.floor(fromX + (toX - fromX) * t);
      const y = Math.floor(fromY + (toY - fromY) * t);

      if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) {
        continue;
      }

      if (this.#solidGrid[y * scene.width + x] === 1) {
        return true;
      }
    }

    return false;
  }

  /** The additive light tint for a wall column, quantised so the strings can be reused. */
  #tintStyle(red: number, green: number, blue: number, alpha: number): string {
    const quantisedRed = Math.round(clamp(red, 0, 1) * 15);
    const quantisedGreen = Math.round(clamp(green, 0, 1) * 15);
    const quantisedBlue = Math.round(clamp(blue, 0, 1) * 15);
    const quantisedAlpha = Math.round(clamp(alpha, 0, 1) * 15);
    const key = (quantisedRed << 12) | (quantisedGreen << 8) | (quantisedBlue << 4) | quantisedAlpha;
    const cached = this.#tintStyles.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const style = `rgba(${Math.round((quantisedRed / 15) * 190)}, ${Math.round(
      (quantisedGreen / 15) * 190,
    )}, ${Math.round((quantisedBlue / 15) * 190)}, ${quantisedAlpha / 15})`;
    this.#tintStyles.set(key, style);
    return style;
  }

  /** Reads the lightmap at a world position, clamped to the grid. */
  #sampleLight(scene: RenderScene, x: number, y: number): readonly [number, number, number] {
    const width = scene.width * LIGHTMAP_SCALE;
    const height = scene.height * LIGHTMAP_SCALE;
    const texelX = clamp(Math.floor(x * LIGHTMAP_SCALE), 0, width - 1);
    const texelY = clamp(Math.floor(y * LIGHTMAP_SCALE), 0, height - 1);
    const index = (texelY * width + texelX) * 3;
    return [this.#lightmap[index] ?? 0, this.#lightmap[index + 1] ?? 0, this.#lightmap[index + 2] ?? 0];
  }

  /**
   * A per-cell index into `FLOOR_MATERIALS`, offset by one so zero means the default floor.
   *
   * A flat typed array rather than a map keyed by coordinate: this is read once per floor pixel, so
   * roughly a fifth of a million times a frame, and a string key built per read is not affordable.
   */
  #floorPatchGrid(scene: RenderScene): Uint8Array | undefined {
    const patches = scene.floorPatches;

    if (!patches || patches.length === 0) {
      return undefined;
    }

    const grid = new Uint8Array(scene.width * scene.height);

    for (const patch of patches) {
      if (patch.cell.x < 0 || patch.cell.y < 0 || patch.cell.x >= scene.width || patch.cell.y >= scene.height) {
        continue;
      }

      grid[patch.cell.y * scene.width + patch.cell.x] = FLOOR_MATERIALS.indexOf(patch.material) + 1;
    }

    return grid;
  }

  public resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    if (cssWidth <= 0 || cssHeight <= 0) {
      return;
    }

    // One scale for both axes. Clamping them independently shrank the backing store on only one
    // side while CSS still stretched it across the whole box, so the world arrived at the eye
    // horizontally squashed by whatever the two clamps happened to disagree by.
    const scale = Math.min(devicePixelRatio * RENDER_SCALE, MAX_WIDTH / cssWidth, MAX_HEIGHT / cssHeight);
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));

    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.#context.imageSmoothingEnabled = false;
    this.#depthBuffer = new Float64Array(width);
  }

  /**
   * Half-width of the camera plane at unit depth, which is what sets the horizontal field of view.
   *
   * Walls, floor rows, and sprites are all projected as `canvasHeight / depth`, so the vertical
   * field of view is pinned by that convention and cannot be authored. The horizontal half-width
   * must therefore be derived from the canvas aspect: any other value renders square world geometry
   * as a non-square number of pixels. A fixed 60-degree angle left the world magnified about 1.4x
   * horizontally, which cost the player the side walls at a junction and made a 90-degree turn
   * sweep far more of the screen than the quarter-turn it represents.
   */
  #planeLength(): number {
    return this.canvas.width / (2 * this.canvas.height);
  }

  /**
   * The screen row the world's eye level projects to. Vertical look is a shear of this line rather
   * than a real camera rotation, which is the only kind of pitch a column raycaster can express —
   * the columns stay vertical, so looking up slides the whole projection down the screen.
   */
  #horizon(scene: RenderScene): number {
    return this.canvas.height * (0.49 + (scene.camera.pitch ?? 0));
  }

  public render(
    scene: RenderScene,
    elapsedSeconds: number,
    effects: PresentationRenderEffects = NO_EFFECTS,
    preferences: RendererPreferences = { reducedMotion: false },
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (width === 0 || height === 0) {
      return;
    }

    const surfaceMap = new Map(scene.surfaces.map((surface) => [keyOf(surface.cell.x, surface.cell.y), surface]));
    this.#lit = preferences.enhancedLighting === true;

    if (this.#lit) {
      this.#buildLightmap(scene, surfaceMap);
    }

    this.#drawProjectedPlanes(scene, elapsedSeconds, preferences.reducedMotion, effects.rejectionTorch);
    this.#drawWalls(scene, surfaceMap, elapsedSeconds, effects.rejectionTorch);
    this.#drawSprites(scene, elapsedSeconds, effects);

    if (scene.beams && scene.beams.length > 0) {
      this.#drawBeams(scene, scene.beams);
    }

    this.#drawEmitters(scene.emitters, scene, elapsedSeconds, preferences.reducedMotion);

    if (preferences.grade === true) {
      this.#drawMotes(scene, elapsedSeconds, preferences.reducedMotion);
    } else {
      this.#drawAtmosphere(elapsedSeconds, preferences.reducedMotion);
    }

    if (preferences.viewmodel !== false) {
      this.#drawViewmodel(elapsedSeconds, effects, preferences.reducedMotion);
    }

    if (preferences.grade === true) {
      this.#drawGrade(elapsedSeconds, preferences.reducedMotion);
    }

    if (effects.playerHit > 0) {
      this.#drawPlayerHit(effects.playerHit);
    }

    if (effects.rejectionStaticCue) {
      const lineWidth = Math.max(4, height * 0.02);
      this.#context.save();
      this.#context.strokeStyle = "rgba(255, 214, 168, 0.55)";
      this.#context.lineWidth = lineWidth;
      this.#context.strokeRect(lineWidth / 2, lineWidth / 2, width - lineWidth, height - lineWidth);
      this.#context.restore();
    }
  }

  #drawProjectedPlanes(
    scene: RenderScene,
    elapsedSeconds: number,
    reducedMotion: boolean,
    torchContraction: number,
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const horizon = this.#horizon(scene);
    const camera = scene.camera;
    const directionX = Math.cos(camera.angle);
    const directionY = Math.sin(camera.angle);
    const planeLength = this.#planeLength();
    const planeX = -directionY * planeLength;
    const planeY = directionX * planeLength;
    const rayX0 = directionX - planeX;
    const rayY0 = directionY - planeY;
    const rayX1 = directionX + planeX;
    const rayY1 = directionY + planeY;
    const image = this.#context.createImageData(width, height);
    const flicker = reducedMotion ? 1 : 0.96 + Math.sin(elapsedSeconds * 7.1) * 0.025;
    const patchGrid = this.#floorPatchGrid(scene);
    const waterMaterial = FLOOR_MATERIALS.indexOf("water");
    const ceilingIndex = scene.ceilingMaterial ? FLOOR_MATERIALS.indexOf(scene.ceilingMaterial) : -1;
    const ceilingMaterial = ceilingIndex >= 0 ? ceilingIndex : undefined;
    const drift = reducedMotion ? 0 : elapsedSeconds * 0.045;
    const lightWidth = scene.width * LIGHTMAP_SCALE;
    const lastLightX = lightWidth - 1;
    const lastLightY = scene.height * LIGHTMAP_SCALE - 1;

    // Every row is walked rather than the floor half being walked and the ceiling mirrored onto it:
    // once the horizon can sit anywhere on the screen, the two halves are no longer the same size
    // and a mirror leaves whichever half grew unpainted.
    for (let y = 0; y < height; y += 1) {
      const offset = y - horizon;
      const below = offset > 0;
      const rowDistance = (0.5 * height) / Math.max(1, Math.abs(offset));
      const stepX = (rowDistance * (rayX1 - rayX0)) / width;
      const stepY = (rowDistance * (rayY1 - rayY0)) / width;
      let planeXPosition = camera.x + rowDistance * rayX0;
      let planeYPosition = camera.y + rowDistance * rayY0;
      const fog = clamp(1 - rowDistance / MAX_DEPTH, 0.12, 1) * (below ? 1 : 0.82);
      const torch = clamp(1.2 - rowDistance / 8, 0, 1) * flicker * torchContraction * (below ? 1 : 0.5);
      const fogRed = 9 * (1 - fog);
      const fogGreen = 5 * (1 - fog);
      const fogBlue = 16 * (1 - fog);
      const ceilingPixels = ceilingMaterial ? this.#floorPatchPixels[ceilingMaterial] : undefined;
      const defaultPixels = below ? this.#texturePixels.floor : (ceilingPixels ?? this.#texturePixels.ceiling);
      // Only the floor half can be patched; a pool has no counterpart on the ceiling.
      const patchable = below && patchGrid !== undefined;

      for (let x = 0; x < width; x += 1) {
        let sampleX = planeXPosition;
        let sampleY = planeYPosition;
        let pixels = defaultPixels;

        if (patchable) {
          const cellX = Math.floor(planeXPosition);
          const cellY = Math.floor(planeYPosition);

          if (cellX >= 0 && cellY >= 0 && cellX < scene.width && cellY < scene.height) {
            const patch = patchGrid[cellY * scene.width + cellX] ?? 0;

            if (patch !== 0) {
              pixels = this.#floorPatchPixels[patch - 1] ?? defaultPixels;

              // Water is the one surface that moves. Sliding where the texture is read from, rather
              // than rebuilding the texture, animates it for the cost of two adds per pixel.
              if (patch - 1 === waterMaterial) {
                sampleX += drift;
                sampleY += Math.sin(sampleX * 2.2 + elapsedSeconds) * 0.02;
              }
            }
          }
        }

        const textureX = ((Math.floor(sampleX * TEXTURE_SIZE) % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
        const textureY = ((Math.floor(sampleY * TEXTURE_SIZE) % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
        const source = (textureY * TEXTURE_SIZE + textureX) * 4;
        const target = (y * width + x) * 4;

        if (!this.#lit) {
          this.#writeLitPixel(image.data, target, pixels, source, fog, torch);
          planeXPosition += stepX;
          planeYPosition += stepY;
          continue;
        }

        // Read and shade inline. This body runs a fifth of a million times a frame, so a helper call
        // and a returned tuple per pixel are both real costs rather than tidiness.
        let texelX = (planeXPosition * LIGHTMAP_SCALE) | 0;
        let texelY = (planeYPosition * LIGHTMAP_SCALE) | 0;
        texelX = texelX < 0 ? 0 : texelX > lastLightX ? lastLightX : texelX;
        texelY = texelY < 0 ? 0 : texelY > lastLightY ? lastLightY : texelY;
        const light = (texelY * lightWidth + texelX) * 3;
        const pixel = image.data;
        const red = (pixels[source] ?? 0) * (this.#lightmap[light] ?? 0) * fog + fogRed;
        const green = (pixels[source + 1] ?? 0) * (this.#lightmap[light + 1] ?? 0) * fog + fogGreen;
        const blue = (pixels[source + 2] ?? 0) * (this.#lightmap[light + 2] ?? 0) * fog + fogBlue;
        pixel[target] = red;
        pixel[target + 1] = green;
        pixel[target + 2] = blue;
        pixel[target + 3] = 255;
        planeXPosition += stepX;
        planeYPosition += stepY;
      }
    }

    this.#context.putImageData(image, 0, 0);
  }

  #writeLitPixel(
    target: Uint8ClampedArray,
    targetIndex: number,
    source: Uint8ClampedArray,
    sourceIndex: number,
    fog: number,
    torch: number,
  ): void {
    const purple = 18;
    target[targetIndex] = (source[sourceIndex] ?? 0) * fog + purple * (1 - fog) + 31 * torch;
    target[targetIndex + 1] = (source[sourceIndex + 1] ?? 0) * fog + 11 * (1 - fog) + 12 * torch;
    target[targetIndex + 2] = (source[sourceIndex + 2] ?? 0) * fog + 28 * (1 - fog) - 3 * torch;
    target[targetIndex + 3] = 255;
  }

  #castRay(scene: RenderScene, surfaces: ReadonlyMap<string, RenderSurface>, cameraX: number): RayHit | undefined {
    const directionX = Math.cos(scene.camera.angle);
    const directionY = Math.sin(scene.camera.angle);
    const planeLength = this.#planeLength();
    const rayX = directionX - directionY * planeLength * cameraX;
    const rayY = directionY + directionX * planeLength * cameraX;
    let mapX = Math.floor(scene.camera.x);
    let mapY = Math.floor(scene.camera.y);
    const deltaX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
    const deltaY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
    const stepX = rayX < 0 ? -1 : 1;
    const stepY = rayY < 0 ? -1 : 1;
    let sideX = rayX < 0 ? (scene.camera.x - mapX) * deltaX : (mapX + 1 - scene.camera.x) * deltaX;
    let sideY = rayY < 0 ? (scene.camera.y - mapY) * deltaY : (mapY + 1 - scene.camera.y) * deltaY;
    let side: 0 | 1 = 0;

    for (let step = 0; step < 64; step += 1) {
      if (sideX < sideY) {
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideY += deltaY;
        mapY += stepY;
        side = 1;
      }

      const surface = surfaces.get(keyOf(mapX, mapY));

      if (!surface) {
        continue;
      }

      const distance = side === 0 ? sideX - deltaX : sideY - deltaY;

      if (distance > MAX_DEPTH) {
        return undefined;
      }

      const wallCoordinate = side === 0 ? scene.camera.y + distance * rayY : scene.camera.x + distance * rayX;
      let textureX = Math.floor((wallCoordinate - Math.floor(wallCoordinate)) * TEXTURE_SIZE);

      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) {
        textureX = TEXTURE_SIZE - textureX - 1;
      }

      const face = side === 0 ? (rayX > 0 ? "west" : "east") : rayY > 0 ? "north" : "south";
      return {
        distance,
        surface,
        textureX,
        face,
        shade: side === 0 ? 1 : 0.78,
        hitX: scene.camera.x + rayX * distance,
        hitY: scene.camera.y + rayY * distance,
      };
    }

    return undefined;
  }

  #drawWalls(
    scene: RenderScene,
    surfaces: ReadonlyMap<string, RenderSurface>,
    elapsedSeconds: number,
    torchContraction: number,
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const horizon = this.#horizon(scene);
    const flicker = 0.96 + Math.sin(elapsedSeconds * 7.1) * 0.025;
    const lightWidth = scene.width * LIGHTMAP_SCALE;
    const lightHeight = scene.height * LIGHTMAP_SCALE;

    for (let x = 0; x < width; x += 1) {
      const hit = this.#castRay(scene, surfaces, (2 * x) / width - 1);

      if (!hit) {
        this.#depthBuffer[x] = MAX_DEPTH;
        continue;
      }

      this.#depthBuffer[x] = hit.distance;
      const wallHeight = Math.min(height * 2, height / Math.max(0.001, hit.distance));
      const start = Math.floor(horizon - wallHeight / 2);
      const material: RenderSurfaceMaterial =
        hit.surface.material === "breakableWall" && !hit.surface.hintFaces?.includes(hit.face)
          ? "stoneWall"
          : hit.surface.material;
      const texture = this.#textures.walls[material];
      this.#context.drawImage(texture, hit.textureX, 0, 1, TEXTURE_SIZE, x, start, 1, wallHeight);
      const fog = clamp(hit.distance / MAX_DEPTH, 0, 0.88);

      if (!this.#lit) {
        const torch = clamp(1.15 - hit.distance / 7.5, 0, 1) * flicker * torchContraction;
        this.#context.fillStyle = `rgba(13, 5, 24, ${fog + (1 - hit.shade) * 0.15})`;
        this.#context.fillRect(x, start, 1, wallHeight);

        if (torch > 0) {
          this.#context.fillStyle = `rgba(255, 112, 35, ${torch * 0.16})`;
          this.#context.fillRect(x, start, 1, wallHeight);
        }

        continue;
      }

      // Sampled a little in front of the face rather than inside the block, which is solid and
      // therefore always unlit.
      const normal = WALL_FACE_NORMALS[hit.face];
      const texelX = clamp(Math.floor((hit.hitX + normal.x * 0.4) * LIGHTMAP_SCALE), 0, lightWidth - 1);
      const texelY = clamp(Math.floor((hit.hitY + normal.y * 0.4) * LIGHTMAP_SCALE), 0, lightHeight - 1);
      const light = (texelY * lightWidth + texelX) * 3;
      // Faces turned away from the eye take less: the same one-line convention the block bevels use,
      // applied at wall scale, is what stops a corridor reading as one continuous painted surface.
      const level = clamp(
        Math.max(this.#lightmap[light] ?? 0, this.#lightmap[light + 1] ?? 0, this.#lightmap[light + 2] ?? 0) *
          hit.shade *
          flicker *
          torchContraction,
        0,
        1,
      );
      this.#context.fillStyle = shadowStyle(clamp(1 - level, 0, 0.94) * (1 - fog) + fog);
      this.#context.fillRect(x, start, 1, wallHeight);

      if (level > 0.05) {
        this.#context.globalCompositeOperation = "lighter";
        this.#context.fillStyle = this.#tintStyle(
          this.#lightmap[light] ?? 0,
          this.#lightmap[light + 1] ?? 0,
          this.#lightmap[light + 2] ?? 0,
          clamp(level * (1 - fog) * 0.42, 0, 0.8),
        );
        this.#context.fillRect(x, start, 1, wallHeight);
        this.#context.globalCompositeOperation = "source-over";
      }

      // Contact shadow where the wall meets the floor. Nothing else in this renderer grounds a wall
      // to the floor, and without it every corridor reads as flat cardboard standing on tile. Two
      // solid bands rather than a gradient object, which would be allocated once per column.
      const shade = 0.44 * (1 - fog) * level;

      if (shade > 0.03) {
        const skirting = wallHeight * 0.18;
        this.#context.fillStyle = shadowStyle(shade * 0.45);
        this.#context.fillRect(x, start + wallHeight - skirting, 1, skirting / 2 + 1);
        this.#context.fillStyle = shadowStyle(shade);
        this.#context.fillRect(x, start + wallHeight - skirting / 2, 1, skirting / 2 + 1);
      }
    }
  }

  /** Culls a wall decoration seen from behind its own face and narrows it as the view turns oblique. */
  #wallFacing(scene: RenderScene, sprite: RenderSprite): number | undefined {
    if (sprite.placement !== "wall" || !sprite.wallFace) {
      return 1;
    }

    const normal = WALL_FACE_NORMALS[sprite.wallFace];

    if ((scene.camera.x - sprite.x) * normal.x + (scene.camera.y - sprite.y) * normal.y <= 0) {
      return undefined;
    }

    const viewX = Math.cos(scene.camera.angle);
    const viewY = Math.sin(scene.camera.angle);
    return 0.45 + 0.55 * Math.abs(viewX * normal.x + viewY * normal.y);
  }

  #projectSprite(scene: RenderScene, sprite: RenderSprite): ProjectedSprite | undefined {
    const directionX = Math.cos(scene.camera.angle);
    const directionY = Math.sin(scene.camera.angle);
    const planeLength = this.#planeLength();
    const planeX = -directionY * planeLength;
    const planeY = directionX * planeLength;
    const relativeX = sprite.x - scene.camera.x;
    const relativeY = sprite.y - scene.camera.y;
    const inverse = 1 / (planeX * directionY - directionX * planeY);
    const transformX = inverse * (directionY * relativeX - directionX * relativeY);
    const depth = inverse * (-planeY * relativeX + planeX * relativeY);

    if (depth <= 0.08 || depth > MAX_DEPTH) {
      return undefined;
    }

    const facing = this.#wallFacing(scene, sprite);

    if (facing === undefined) {
      return undefined;
    }

    const screenX = Math.floor((this.canvas.width / 2) * (1 + transformX / depth));
    const baseSize = Math.abs(this.canvas.height / depth) * sprite.scale;
    const height = sprite.placement === "ground" ? baseSize * 0.38 : baseSize;
    const width = baseSize * facing;
    const startX = Math.floor(screenX - width / 2);
    const horizon = this.#horizon(scene);
    const groundLine = horizon + this.canvas.height / (2 * depth);
    // Authored anchors are measured from the floor line: 0 stands on the ground, negative floats.
    const startY =
      sprite.placement === "ground"
        ? groundLine - height * 0.58 + sprite.verticalAnchor * height
        : groundLine - height + sprite.verticalAnchor * height;

    return { sprite, depth, screenX, startX, endX: Math.ceil(screenX + width / 2), startY, width, height };
  }

  #drawSprites(scene: RenderScene, elapsedSeconds: number, effects: PresentationRenderEffects): void {
    const enemyEffects = new Map(effects.enemies.map((effect) => [effect.entityId, effect]));
    const sprites = scene.sprites
      .map((sprite) => this.#projectSprite(scene, sprite))
      .filter((sprite): sprite is ProjectedSprite => Boolean(sprite))
      .reduce<ProjectedSprite[]>((ordered, candidate) => {
        const index = ordered.findIndex((current) => current.depth < candidate.depth);

        if (index === -1) {
          ordered.push(candidate);
        } else {
          ordered.splice(index, 0, candidate);
        }

        return ordered;
      }, []);

    for (const projected of sprites) {
      const enemyEffect = enemyEffects.get(projected.sprite.id);
      const assetId = projected.sprite.appearanceId
        ? `enemy.${projected.sprite.appearanceId}.${enemyEffect?.state ?? "normal"}`
        : projected.sprite.assetId;
      const source = this.#litImage(assetId, projected.depth, scene, projected.sprite.x, projected.sprite.y);
      this.#drawProjectedImage(projected, source, 1);

      if (enemyEffect && enemyEffect.whiteFlash > 0) {
        this.#drawProjectedImage(projected, this.#whiteImage(assetId), enemyEffect.whiteFlash);
      }
    }

    // Last, and over everything: the silhouettes that are meant to be seen through the walls they
    // are behind. Drawn after the depth-tested pass so nothing can paint back over them.
    for (const projected of sprites) {
      const xray = projected.sprite.xray;

      if (xray) {
        this.#drawSilhouette(projected, xray, elapsedSeconds);
      }
    }

    for (const death of effects.deaths) {
      this.#drawDeath(scene, death, elapsedSeconds);
    }
  }

  /** Paints a sprite's outline in one colour, ignoring the depth buffer entirely. */
  #drawSilhouette(projected: ProjectedSprite, xray: NonNullable<RenderSprite["xray"]>, elapsedSeconds: number): void {
    const assetId = projected.sprite.appearanceId
      ? `enemy.${projected.sprite.appearanceId}.normal`
      : projected.sprite.assetId;
    const source = this.#outlineImage(assetId, xray.color);
    const dimensions = imageDimensions(source);
    // A slow pulse, so a marker sitting still behind a wall still reads as a live cue rather than
    // as a smear baked into the wall texture.
    const pulse = 0.78 + Math.sin(elapsedSeconds * 2.6) * 0.22;
    this.#context.save();
    this.#context.globalAlpha = clamp(xray.alpha * pulse, 0, 1);
    this.#context.globalCompositeOperation = "lighter";
    this.#context.drawImage(
      source,
      0,
      0,
      dimensions.width,
      dimensions.height,
      projected.startX,
      projected.startY,
      projected.width,
      projected.height,
    );
    this.#context.restore();
  }

  /**
   * The rim of a sprite in one colour, built by dilating its alpha and punching the original out.
   *
   * An outline rather than a filled silhouette: a solid shape seen through a wall reads as an object
   * embedded in the masonry, while a rim reads as a thing marked behind it. The margin is enlarged
   * to hold the stroke, since the dilation would otherwise be clipped at the source's own edge.
   */
  #outlineImage(assetId: string, color: readonly [number, number, number]): CanvasImageSource {
    const key = `${assetId}:${color.join()}`;
    const cached = this.#tintedSpriteCache.get(key);

    if (cached) {
      return cached;
    }

    const source = requireImage(this.images, assetId);
    const dimensions = imageDimensions(source);
    const stroke = Math.max(2, Math.round(Math.min(dimensions.width, dimensions.height) / 42));
    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = dimensions.width + stroke * 2;
    surface.height = dimensions.height + stroke * 2;
    const context = surface.getContext("2d");

    if (!context) {
      return source;
    }

    for (let step = 0; step < 8; step += 1) {
      const angle = (step / 8) * Math.PI * 2;
      context.drawImage(
        source,
        stroke + Math.round(Math.cos(angle) * stroke),
        stroke + Math.round(Math.sin(angle) * stroke),
      );
    }

    context.globalCompositeOperation = "destination-out";
    context.drawImage(source, stroke, stroke);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    context.fillRect(0, 0, surface.width, surface.height);
    this.#tintedSpriteCache.set(key, surface);
    return surface;
  }

  /**
   * Projects one world point, including its height off the floor.
   *
   * Sprites only ever needed a ground line and an anchor above it; a beam needs both of its ends
   * placed independently, so the vertical projection is written out here in full. One cell of height
   * subtends `canvasHeight / depth`, which is the same convention wall columns are drawn with.
   */
  #projectPoint(
    scene: RenderScene,
    point: RenderPoint,
  ): Readonly<{ screenX: number; screenY: number; depth: number }> | undefined {
    const directionX = Math.cos(scene.camera.angle);
    const directionY = Math.sin(scene.camera.angle);
    const planeLength = this.#planeLength();
    const planeX = -directionY * planeLength;
    const planeY = directionX * planeLength;
    const relativeX = point.x - scene.camera.x;
    const relativeY = point.y - scene.camera.y;
    const inverse = 1 / (planeX * directionY - directionX * planeY);
    const transformX = inverse * (directionY * relativeX - directionX * relativeY);
    const depth = inverse * (-planeY * relativeX + planeX * relativeY);

    if (depth <= 0.08 || depth > MAX_DEPTH) {
      return undefined;
    }

    const height = this.canvas.height;
    const groundLine = this.#horizon(scene) + height / (2 * depth);
    return {
      screenX: (this.canvas.width / 2) * (1 + transformX / depth),
      screenY: groundLine - point.z * (height / depth),
      depth,
    };
  }

  /** Camera-space distance of a world position, which is what the near clip and the shading need. */
  #cameraDepth(scene: RenderScene, x: number, y: number): number {
    const directionX = Math.cos(scene.camera.angle);
    const directionY = Math.sin(scene.camera.angle);
    const planeLength = this.#planeLength();
    const planeX = -directionY * planeLength;
    const planeY = directionX * planeLength;
    const inverse = 1 / (planeX * directionY - directionX * planeY);
    return inverse * (-planeY * (x - scene.camera.x) + planeX * (y - scene.camera.y));
  }

  /**
   * Trims a rod at the near plane.
   *
   * Without this a rod thrown from where the camera stands has an end a few centimetres from the eye,
   * and perspective quite correctly blows that end up to fill the screen. Clipping is the standard
   * answer: the geometry behind the near plane is cut away rather than drawn enormous.
   */
  #clipToNearPlane(
    scene: RenderScene,
    from: RenderPoint,
    to: RenderPoint,
  ): readonly [RenderPoint, RenderPoint] | undefined {
    const depthFrom = this.#cameraDepth(scene, from.x, from.y);
    const depthTo = this.#cameraDepth(scene, to.x, to.y);

    if (depthFrom < BEAM_NEAR_PLANE && depthTo < BEAM_NEAR_PLANE) {
      return undefined;
    }

    if (depthFrom < BEAM_NEAR_PLANE) {
      return [along(from, to, (BEAM_NEAR_PLANE - depthFrom) / (depthTo - depthFrom)), to];
    }

    if (depthTo < BEAM_NEAR_PLANE) {
      return [from, along(to, from, (BEAM_NEAR_PLANE - depthTo) / (depthFrom - depthTo))];
    }

    return [from, to];
  }

  /**
   * Draws oriented rods as a chain of quads swept along the segment.
   *
   * Splitting into pieces is what makes the rod behave in perspective: each piece gets its own depth,
   * so its own thickness and its own depth test, and a rod running away from the eye tapers instead
   * of being one uniform bar. The offset is perpendicular to the rod on screen rather than straight
   * up, so a rod crossing the view diagonally is thick across itself and not across the screen.
   *
   * A rod pointing directly at or away from the eye collapses to no screen length at all; that case
   * is drawn as the disc it actually is — the cross-section, seen end-on.
   */
  #drawBeams(scene: RenderScene, beams: readonly RenderBeam[]): void {
    const height = this.canvas.height;
    const context = this.#context;

    for (const beam of beams) {
      const clipped = this.#clipToNearPlane(scene, beam.from, beam.to);

      if (!clipped) {
        continue;
      }

      const from = this.#projectPoint(scene, clipped[0]);
      const to = this.#projectPoint(scene, clipped[1]);

      if (!from || !to) {
        continue;
      }

      const tip = beam.tipColor ?? beam.color;
      const inverseFrom = 1 / from.depth;
      const inverseTo = 1 / to.depth;
      const screenLength = Math.hypot(to.screenX - from.screenX, to.screenY - from.screenY);

      // End-on: what is actually visible is the cross-section, so draw that once and be done.
      if (screenLength < 0.5) {
        const near = from.depth <= to.depth ? from : to;
        const column = clamp(Math.round(near.screenX), 0, this.canvas.width - 1);

        if (near.depth < (this.#depthBuffer[column] ?? MAX_DEPTH)) {
          const shade = clamp(1 - near.depth / MAX_DEPTH, 0.18, 1);
          context.fillStyle = `rgb(${Math.round(tip[0] * shade)}, ${Math.round(tip[1] * shade)}, ${Math.round(
            tip[2] * shade,
          )})`;
          context.beginPath();
          context.arc(
            near.screenX,
            near.screenY,
            Math.max(0.6, (beam.width * height) / (2 * near.depth)),
            0,
            Math.PI * 2,
          );
          context.fill();
        }

        continue;
      }

      const normalX = -(to.screenY - from.screenY) / screenLength;
      const normalY = (to.screenX - from.screenX) / screenLength;

      for (let piece = 0; piece < BEAM_PIECES; piece += 1) {
        const nearT = piece / BEAM_PIECES;
        const farT = (piece + 1) / BEAM_PIECES;
        const midT = (nearT + farT) / 2;
        const depth = 1 / (inverseFrom + (inverseTo - inverseFrom) * midT);
        const midX = from.screenX + (to.screenX - from.screenX) * midT;
        const column = clamp(Math.round(midX), 0, this.canvas.width - 1);

        if (depth >= (this.#depthBuffer[column] ?? MAX_DEPTH)) {
          continue;
        }

        const shade = clamp(1 - depth / MAX_DEPTH, 0.18, 1);
        const red = Math.round((beam.color[0] + (tip[0] - beam.color[0]) * midT) * shade);
        const green = Math.round((beam.color[1] + (tip[1] - beam.color[1]) * midT) * shade);
        const blue = Math.round((beam.color[2] + (tip[2] - beam.color[2]) * midT) * shade);
        context.fillStyle = `rgb(${red}, ${green}, ${blue})`;

        const nearX = from.screenX + (to.screenX - from.screenX) * nearT;
        const nearY = from.screenY + (to.screenY - from.screenY) * nearT;
        const farX = from.screenX + (to.screenX - from.screenX) * farT;
        const farY = from.screenY + (to.screenY - from.screenY) * farT;
        const nearHalf = (beam.width * height * (inverseFrom + (inverseTo - inverseFrom) * nearT)) / 2;
        const farHalf = (beam.width * height * (inverseFrom + (inverseTo - inverseFrom) * farT)) / 2;
        context.beginPath();
        context.moveTo(nearX + normalX * nearHalf, nearY + normalY * nearHalf);
        context.lineTo(farX + normalX * farHalf, farY + normalY * farHalf);
        context.lineTo(farX - normalX * farHalf, farY - normalY * farHalf);
        context.lineTo(nearX - normalX * nearHalf, nearY - normalY * nearHalf);
        context.closePath();
        context.fill();
      }
    }
  }

  #drawProjectedImage(projected: ProjectedSprite, source: CanvasImageSource, alpha: number): void {
    const dimensions = imageDimensions(source);
    const startX = Math.max(0, projected.startX);
    const endX = Math.min(this.canvas.width, projected.endX);
    this.#context.save();
    this.#context.globalAlpha = clamp(alpha, 0, 1);

    for (let x = startX; x < endX; x += 1) {
      if (projected.depth >= (this.#depthBuffer[x] ?? MAX_DEPTH)) {
        continue;
      }

      const sourceX = Math.floor(((x - projected.startX) / projected.width) * dimensions.width);
      this.#context.drawImage(source, sourceX, 0, 1, dimensions.height, x, projected.startY, 1, projected.height);
    }

    this.#context.restore();
  }

  #litImage(assetId: string, depth: number, scene: RenderScene, x: number, y: number): CanvasImageSource {
    const darknessBucket = Math.round(clamp(depth / MAX_DEPTH, 0, 0.82) * 8) / 8;
    let warmth = clamp(1 - depth / 7, 0, 0.42);
    let warmColor = DEFAULT_TORCH_COLOR;

    if (this.#lit) {
      // Under the lightmap a sprite is tinted by the same accumulation the walls behind it use, so a
      // slime standing in the altar's glow is the same gold as the floor it is standing on.
      const placed = this.#sampleLight(scene, x, y);
      const strength = Math.max(placed[0], placed[1], placed[2]);

      if (strength > warmth) {
        const scale = 255 / strength;
        warmth = Math.min(1, strength);
        warmColor = [placed[0] * scale, placed[1] * scale, placed[2] * scale];
      }
    } else {
      for (const light of scene.lights) {
        const reach = clamp(1 - Math.hypot(light.x - x, light.y - y) / light.radius, 0, 1) * light.intensity;

        if (reach > warmth) {
          warmth = reach;
          warmColor = light.color;
        }
      }
    }

    const warmthBucket = Math.round(warmth * 4) / 4;
    const key = `${assetId}:${darknessBucket}:${warmthBucket}:${warmColor.join()}`;
    const cached = this.#litSpriteCache.get(key);

    if (cached) {
      this.#litSpriteCache.delete(key);
      this.#litSpriteCache.set(key, cached);
      return cached;
    }

    const source = requireImage(this.images, assetId);
    const dimensions = imageDimensions(source);
    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = dimensions.width;
    surface.height = dimensions.height;
    const context = surface.getContext("2d");

    if (!context) {
      return source;
    }

    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = `rgba(13, 5, 24, ${darknessBucket})`;
    context.fillRect(0, 0, surface.width, surface.height);
    context.fillStyle = `rgba(${warmColor[0]}, ${warmColor[1]}, ${warmColor[2]}, ${warmthBucket * 0.22})`;
    context.fillRect(0, 0, surface.width, surface.height);
    this.#litSpriteCache.set(key, surface);
    this.#evictLitSprites();
    return surface;
  }

  /** Every lit variant is a full-size offscreen canvas, so drop the least recently drawn ones. */
  #evictLitSprites(): void {
    for (const key of this.#litSpriteCache.keys()) {
      if (this.#litSpriteCache.size <= LIT_SPRITE_CACHE_LIMIT) {
        return;
      }

      this.#litSpriteCache.delete(key);
    }
  }

  #whiteImage(assetId: string): CanvasImageSource {
    const cached = this.#whiteSpriteCache.get(assetId);

    if (cached) {
      return cached;
    }

    const source = requireImage(this.images, assetId);
    const dimensions = imageDimensions(source);
    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = dimensions.width;
    surface.height = dimensions.height;
    const context = surface.getContext("2d");

    if (!context) {
      return source;
    }

    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#fff8e8";
    context.fillRect(0, 0, surface.width, surface.height);
    this.#whiteSpriteCache.set(assetId, surface);
    return surface;
  }

  #drawDeath(scene: RenderScene, death: DeathRenderEffect, _elapsedSeconds: number): void {
    const sprite: RenderSprite = {
      id: death.entityId,
      appearanceId: death.appearanceId,
      assetId: `enemy.${death.appearanceId}.hurt`,
      x: death.x,
      y: death.y,
      placement: "billboard",
      scale: death.scale,
      verticalAnchor: death.verticalAnchor,
    };
    const projected = this.#projectSprite(scene, sprite);

    if (!projected) {
      return;
    }

    const source = this.#litImage(sprite.assetId, projected.depth, scene, sprite.x, sprite.y);
    const dimensions = imageDimensions(source);
    const progress = clamp(death.progress, 0, 1);
    const alpha = 1 - progress;
    const fall = progress * progress * projected.height * 0.45;
    const spread = progress * projected.width * 0.28;
    this.#context.save();
    this.#context.globalAlpha = alpha;
    this.#drawDeathHalf(projected, source, dimensions, 0, -spread, fall, -progress * 0.42);
    this.#drawDeathHalf(projected, source, dimensions, 1, spread, fall, progress * 0.42);
    this.#context.restore();
  }

  #drawDeathHalf(
    projected: ProjectedSprite,
    source: CanvasImageSource,
    dimensions: Readonly<{ width: number; height: number }>,
    half: 0 | 1,
    offsetX: number,
    offsetY: number,
    rotation: number,
  ): void {
    const halfWidth = projected.width / 2;
    const centerX = projected.startX + halfWidth * (half + 0.5) + offsetX;
    const centerY = projected.startY + projected.height / 2 + offsetY;
    this.#context.save();
    this.#context.translate(centerX, centerY);
    this.#context.rotate(rotation);
    this.#context.drawImage(
      source,
      half * (dimensions.width / 2),
      0,
      dimensions.width / 2,
      dimensions.height,
      -halfWidth / 2,
      -projected.height / 2,
      halfWidth,
      projected.height,
    );
    this.#context.restore();
  }

  #drawEmitters(
    emitters: readonly RenderEmitter[],
    scene: RenderScene,
    elapsedSeconds: number,
    reducedMotion: boolean,
  ): void {
    const context = this.#context;

    for (const emitter of emitters) {
      const projected = this.#projectSprite(scene, {
        id: emitter.id,
        x: emitter.x,
        y: emitter.y,
        placement: "billboard",
        assetId: "",
        scale: emitter.kind === "steam" ? 0.7 : 0.3,
        verticalAnchor: emitter.kind === "steam" ? -0.65 : -0.25,
      });

      if (!projected) {
        continue;
      }

      for (let index = 0; index < emitter.density; index += 1) {
        const phase = reducedMotion ? (index * 0.19) % 1 : (elapsedSeconds * 0.17 + index * 0.19) % 1;
        const wobble = Math.sin(index * 8.3 + elapsedSeconds * (reducedMotion ? 0 : 1.8));
        const x = projected.screenX + wobble * projected.width * 0.25;
        const y = projected.startY + projected.height * (1 - phase);
        const radius = Math.max(1, projected.width * (0.015 + phase * 0.035));
        context.beginPath();
        context.fillStyle =
          emitter.kind === "steam"
            ? `rgba(225, 210, 222, ${0.18 * (1 - phase)})`
            : `rgba(255, 145, 42, ${0.68 * (1 - phase)})`;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  /**
   * The finishing pass: a vignette, a warm centre, and a breathing darkness at the edges.
   *
   * None of this is information — it is the difference between a rendering and a scene. The vignette
   * pulls the eye to the middle of the frame, the warm core keeps the torch reading as a light source
   * carried by the player, and the slow breath stops a still frame from looking like a screenshot.
   */
  #drawGrade(elapsedSeconds: number, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centreX = width * 0.5;
    const centreY = height * 0.54;
    const breath = reducedMotion ? 1 : 1 + Math.sin(elapsedSeconds * 0.9) * 0.03;
    const outer = Math.hypot(width, height) * 0.62 * breath;
    const vignette = this.#context.createRadialGradient(centreX, centreY, outer * 0.34, centreX, centreY, outer);
    vignette.addColorStop(0, "rgba(6, 2, 12, 0)");
    vignette.addColorStop(0.62, "rgba(6, 2, 12, 0.3)");
    vignette.addColorStop(1, "rgba(4, 1, 9, 0.82)");
    this.#context.fillStyle = vignette;
    this.#context.fillRect(0, 0, width, height);

    const warm = this.#context.createRadialGradient(centreX, centreY, 0, centreX, centreY, outer * 0.55);
    warm.addColorStop(0, "rgba(255, 156, 74, 0.07)");
    warm.addColorStop(1, "rgba(255, 156, 74, 0)");
    this.#context.save();
    this.#context.globalCompositeOperation = "lighter";
    this.#context.fillStyle = warm;
    this.#context.fillRect(0, 0, width, height);
    this.#context.restore();
  }

  /**
   * Dust in the air, in three layers that drift at different rates.
   *
   * The shipped atmosphere pass scatters a fixed number of identical specks at one speed, which
   * reads as static over the image. Parallax is what turns it into air the player is moving through:
   * the near layer is larger, brighter and faster, and slides against the turn of the head.
   */
  #drawMotes(scene: RenderScene, elapsedSeconds: number, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const time = reducedMotion ? 0 : elapsedSeconds;
    // Tied to the camera so the dust belongs to the room rather than to the screen.
    const sway = scene.camera.angle * width * 0.24 + scene.camera.x * 26 + scene.camera.y * 18;

    for (let layer = 0; layer < 3; layer += 1) {
      const depth = (layer + 1) / 3;
      const count = 30 - layer * 8;
      const size = 1 + layer;
      const alpha = 0.05 + layer * 0.035;
      this.#context.fillStyle = `rgba(238, 206, 168, ${alpha})`;

      for (let index = 0; index < count; index += 1) {
        const seed = index * 97 + layer * 311;
        const drift = time * (5 + layer * 11);
        const x = (((seed * 37) % width) + width + drift - sway * depth * 0.35) % width;
        const bob = Math.sin(time * (0.4 + layer * 0.25) + seed) * height * 0.03 * depth;
        const y = (((seed * 53) % height) + height + bob) % height;
        this.#context.fillRect(x, y, size, size);
      }
    }
  }

  /** Damage reads from the edges inward, so it never hides what is in front of the player. */
  #drawPlayerHit(strength: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centreX = width * 0.5;
    const centreY = height * 0.54;
    const outer = Math.hypot(width, height) * 0.62;
    const blood = this.#context.createRadialGradient(centreX, centreY, outer * 0.2, centreX, centreY, outer);
    blood.addColorStop(0, "rgba(180, 24, 54, 0)");
    blood.addColorStop(0.55, `rgba(168, 20, 48, ${0.24 * strength})`);
    blood.addColorStop(1, `rgba(122, 8, 30, ${0.6 * strength})`);
    this.#context.fillStyle = blood;
    this.#context.fillRect(0, 0, width, height);
  }

  #drawAtmosphere(elapsedSeconds: number, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const time = reducedMotion ? 0 : elapsedSeconds;
    this.#context.fillStyle = "rgba(73, 38, 86, 0.035)";
    this.#context.fillRect(0, 0, width, height);

    for (let index = 0; index < 28; index += 1) {
      const x = ((index * 83 + time * (3 + (index % 4))) % (width + 20)) - 10;
      const y = (index * 47 + Math.sin(time * 0.35 + index) * 10) % height;
      this.#context.fillStyle = `rgba(235, 190, 145, ${0.025 + (index % 3) * 0.012})`;
      this.#context.fillRect(x, y, 1, 1);
    }
  }

  #drawViewmodel(elapsedSeconds: number, effects: PresentationRenderEffects, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const image = requireImage(this.images, "presentation.playerViewmodel");
    const viewWidth = Math.min(width * 0.94, height * 1.45);
    const viewHeight = viewWidth;
    const idleBob = reducedMotion ? 0 : Math.sin(elapsedSeconds * 2.2) * height * 0.006;
    const walkBob = effects.walkBob * height * 0.017;
    const swing = clamp(effects.swing, 0, 1);
    const swingAngle = Math.sin(swing * Math.PI) * -0.16;
    this.#context.save();
    this.#context.translate(width / 2, height + idleBob + walkBob);
    this.#context.rotate(swingAngle);
    this.#context.drawImage(image, -viewWidth / 2, -viewHeight * 0.8, viewWidth, viewHeight);
    this.#context.restore();

    if (swing > 0.3 && swing < 0.82) {
      const slash = requireImage(this.images, "presentation.swordSlash");
      const alpha = Math.sin(((swing - 0.3) / 0.52) * Math.PI);
      this.#context.save();
      this.#context.globalAlpha = alpha * 0.86;
      this.#context.globalCompositeOperation = "screen";
      this.#context.drawImage(slash, width * 0.34, height * 0.05, width * 0.64, height * 0.83);
      this.#context.restore();
    }

    this.#drawPlayerFlame(elapsedSeconds, reducedMotion);
  }

  #drawPlayerFlame(elapsedSeconds: number, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const x = width * 0.24;
    const y = height * 0.51;
    const flicker = reducedMotion ? 1 : 0.9 + Math.sin(elapsedSeconds * 12.7) * 0.1;
    const gradient = this.#context.createRadialGradient(x, y, 0, x, y, height * 0.1);
    gradient.addColorStop(0, "rgba(255, 249, 190, 0.95)");
    gradient.addColorStop(0.2, "rgba(255, 143, 47, 0.74)");
    gradient.addColorStop(1, "rgba(255, 73, 20, 0)");
    this.#context.fillStyle = gradient;
    this.#context.beginPath();
    this.#context.ellipse(x, y, height * 0.05 * flicker, height * 0.11 * flicker, 0, 0, Math.PI * 2);
    this.#context.fill();
  }
}
