import type { EnemyAppearanceId } from "@/content/combat/enemies";
import type { EnemySpriteState } from "@/content/presentation/presentation-asset-definitions";
import type { Facing } from "@/core/grid";
import { createProceduralTextures, type TextureSet } from "@/presentation/procedural-textures";
import type {
  RenderBeam,
  RenderBlob,
  RenderEmitter,
  RenderFloorMaterial,
  RenderFloorOverlay,
  RenderFloorPatch,
  RenderParticle,
  RenderPoint,
  RenderBox,
  RenderScene,
  RenderSky,
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
/** Distinct wall heights a single column can show at once. Beyond this the walk stops collecting. */
const MAX_COLUMN_HITS = 4;
const MAX_WIDTH = 1050;
const MAX_HEIGHT = 650;
const TEXTURE_SIZE = 64;
/**
 * The lit-sprite cache: how many variants are kept, how big each is, and how finely they are keyed.
 *
 * A variant exists per asset, per depth step, per warmth step. With eight depth steps and five
 * warmth steps a dozen enemies at mixed distances generated more variants than the cache held, so it
 * evicted and rebuilt continuously. Fewer steps and smaller canvases mean the working set fits.
 */
const LIT_SPRITE_CACHE_LIMIT = 160;
const LIT_SPRITE_SIZE = 160;
const LIT_DEPTH_STEPS = 5;
const LIT_WARMTH_STEPS = 3;
/**
 * Index order for the per-cell floor lookup; position here is what the patch grid stores.
 *
 * Every member of `RenderFloorMaterial` must appear, or a scene naming the missing one silently
 * falls back to the default floor instead of failing.
 */
const FLOOR_MATERIALS: readonly RenderFloorMaterial[] = ["water", "demoFlagstone", "demoVault", "demoBlood"];
/** Rods are cut off closer than this, so a rod leaving the player's own hand cannot fill the screen. */
const BEAM_NEAR_PLANE = 0.5;
/** Quads swept along a rod. Enough that the taper is smooth without paying for a real mesh. */
const BEAM_PIECES = 10;
/** Lightmap texels per cell. Three is the point where a light pool stops looking like a staircase. */
const LIGHTMAP_SCALE = 3;
/** How far into a pool, in cells, the shoreline foam reaches. */
const FOAM_WIDTH = 0.11;
/**
 * Quantisation and budget for the fog-and-torch-tinted wall textures.
 *
 * The unlit wall pass painted each column three times: the texture slice, a fog rectangle, and a
 * torch rectangle — with a freshly built `rgba(...)` string between them. Per column, per hit, that
 * is thousands of one-pixel canvas operations a frame whose interleaved state changes defeat any
 * batching, and a view full of separate walls through gaps was pinned to half its frame rate by
 * them. Baking the two tints into a cached texture keyed by quantised fog and torch makes a wall
 * column one `drawImage` again. The fog ladder matches `SHADOW_STEPS`; the torch ladder is fine
 * enough that the flicker still reads as movement rather than as stepping.
 */
const WALL_FOG_STEPS = 48;
const WALL_TORCH_STEPS = 24;
const TINTED_WALL_CACHE_LIMIT = 384;
/**
 * Stain strength levels a floor overlay is quantised to.
 *
 * Overlay blending was three multiply-adds per stained pixel, every frame, forever — a floor soaked
 * over a long fight billed more than a milliisecond a frame for pixels that never change. Quantising
 * the amount lets the blend be baked into a cached texture instead, read like any other floor. Eight
 * levels spans the deepest stain the demo produces in steps too small to see.
 */
const STAIN_STEPS = 8;
/**
 * The water wave, tabulated. The slide the water texture reads through was a `Math.sin` per water
 * pixel, which billed a screen-filling pool around ten milliseconds a frame; a table lookup is the
 * same wobble at a fraction of that. The amplitude is baked into the entries.
 */
const WAVE_TABLE_SIZE = 1024;
const WAVE_SCALE = WAVE_TABLE_SIZE / (Math.PI * 2);
const WAVE_TABLE = new Float32Array(WAVE_TABLE_SIZE);

for (let index = 0; index < WAVE_TABLE_SIZE; index += 1) {
  WAVE_TABLE[index] = Math.sin((index / WAVE_TABLE_SIZE) * Math.PI * 2) * 0.02;
}
/** The two knobs on the turn vignette. Roughly a third of the first attempt, which was too obvious. */
const TURN_VIGNETTE_REACH = 0.06;
const TURN_VIGNETTE_DEPTH = 0.08;

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
  /**
   * How hard the view is turning, from zero to one, which draws the vignette in a little.
   *
   * Kept deliberately slight. An earlier version closed the frame by a fifth and was obvious enough
   * to be its own distraction; the intent is that the periphery quietens during a fast turn without
   * the player ever noticing the frame move.
   */
  turnRate?: number;
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

type ProjectedCorner = Readonly<{ x: number; y: number; inverseDepth: number }>;

/** One entry in the shared back-to-front pass: exactly one of `sprite`, `box` or `blob` is set. */
type Drawable = Readonly<{ depth: number; sprite?: ProjectedSprite; box?: RenderBox; blob?: RenderBlob }>;

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

/**
 * How much white water to add at a point inside a pool, given which of its cell's four sides are
 * dry — bit 1 west, 2 east, 4 north, 8 south, precomputed per cell alongside the patch grid.
 *
 * Foam is a property of the boundary between water and dry floor, and the boundary is not in the
 * water texture — it is in the map. The old form re-derived the four neighbours per water pixel,
 * closure and grid reads included; almost every pixel of a pool is interior, where the mask is zero
 * and this function is never even called.
 */
function foamAt(mask: number, withinX: number, withinY: number): number {
  // Only the closest shore contributes. Summing every dry neighbour turned a one-cell pool — which
  // is dry on all four sides — into a solid block of foam with no water left in it.
  let nearest = 1;

  if ((mask & 1) !== 0 && withinX < nearest) {
    nearest = withinX;
  }

  if ((mask & 2) !== 0 && 1 - withinX < nearest) {
    nearest = 1 - withinX;
  }

  if ((mask & 4) !== 0 && withinY < nearest) {
    nearest = withinY;
  }

  if ((mask & 8) !== 0 && 1 - withinY < nearest) {
    nearest = 1 - withinY;
  }

  if (nearest >= FOAM_WIDTH) {
    return 0;
  }

  // A narrow band that peaks just inside the waterline and falls away on both sides, so the shore
  // reads as a line of white water rather than as a glow over the whole pool.
  return Math.sin((nearest / FOAM_WIDTH) * Math.PI) * 0.42;
}

function brighten(color: readonly [number, number, number], factor: number): readonly [number, number, number] {
  return [Math.min(255, color[0] * factor), Math.min(255, color[1] * factor), Math.min(255, color[2] * factor)];
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
  readonly #storeyTextures = new Map<string, HTMLCanvasElement>();
  /** Wall textures with fog and torch baked in, keyed by material, storeys and quantised tints. */
  readonly #tintedWallCache = new Map<number, HTMLCanvasElement>();
  /** Stable small integers for materials, so the tinted-wall key needs no string. */
  readonly #materialIds = new Map<RenderSurfaceMaterial, number>();
  /** Reused by every column so a per-frame walk of the maze allocates nothing. */
  readonly #rayColumn: RayHit[] = [];
  #planeBuffer: ImageData | undefined;
  /** Per column, the hits the cast pass found, flattened `MAX_COLUMN_HITS` to a column. */
  #columnHits: (RayHit | undefined)[] = [];
  #columnHitCount = new Uint8Array(1);
  /**
   * Per column, the screen band the walls cover, inset by a pixel or two so the plane pass can skip
   * it without ever leaving a gap the walls do not actually paint over.
   */
  #coverTop = new Float32Array(1);
  #coverBottom = new Float32Array(1);
  /**
   * Projects every other floor and sky row and duplicates it onto the next.
   *
   * Off by default: it trades vertical resolution on the planes for roughly half the cost of the
   * most expensive pass, and that is a trade only a caller can make. The baked floors leave it
   * alone and render exactly as before.
   */
  public halvePlaneRows = false;
  /**
   * The horizontal twin of `halvePlaneRows`: every other plane column is projected and written
   * twice. Same trade, same default — and taking both knobs together keeps the coarser pixels
   * square rather than stretched one way.
   */
  public halvePlaneColumns = false;
  #patchGridSource: readonly RenderFloorPatch[] | undefined;
  #patchGrid: Uint8Array | undefined;
  /** Per cell, which sides of a water cell face dry floor. Built with, and cached like, the patch grid. */
  #shoreMask: Uint8Array | undefined;
  /** Floor textures with a stain baked in, keyed by base, stain and quantised strength. */
  readonly #stainedPixelCache = new Map<number, Uint8ClampedArray>();
  /**
   * Per cell, the texture the floor reads: default, patch, or the patch with its stain baked in.
   *
   * Resolved per cell rather than per pixel. Per-pixel resolution was fine while a cell spanned many
   * pixels, but in the middle distance a screen row crosses about one cell per pixel, and on a floor
   * stained to different depths every pixel then re-derived patch, stain, step and cache key — which
   * is exactly the band where the frame rate dipped.
   */
  #cellTextures: (Uint8ClampedArray | undefined)[] = [];
  #cellTexturesPatchSource: Uint8Array | undefined;
  #cellTexturesOverlaySource: Readonly<{ material: Uint8Array; amount: Float32Array }> | undefined;
  #overlayGridsSource: readonly RenderFloorOverlay[] | undefined;
  #overlayGrids: Readonly<{ material: Uint8Array; amount: Float32Array }> | undefined;
  #surfaceGridSource: readonly RenderSurface[] | undefined;
  #surfaceGrid = new Int16Array(0);
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
  #buildLightmap(scene: RenderScene): void {
    const width = scene.width * LIGHTMAP_SCALE;
    const height = scene.height * LIGHTMAP_SCALE;

    // A flat grid of which cells are solid. The occlusion march below runs tens of thousands of
    // times a frame, and asking a string-keyed map each step allocated a key per step — on its own
    // that was most of the frame.
    if (this.#solidGrid.length !== scene.width * scene.height) {
      this.#solidGrid = new Uint8Array(scene.width * scene.height);
    }

    this.#solidGrid.fill(0);

    for (const surface of scene.surfaces) {
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

  /**
   * A wall texture stacked to the room's height, built once and kept.
   *
   * The upper storeys are darkened progressively and a cornice line is drawn at each boundary, which
   * is what makes a two-storey room read as two storeys rather than as one very tall wall.
   */
  #storeyTexture(material: RenderSurfaceMaterial, storeys: number): CanvasImageSource {
    const base = this.#textures.walls[material];

    if (storeys <= 1) {
      return base;
    }

    const key = `${material}:${storeys}`;
    const cached = this.#storeyTextures.get(key);

    if (cached) {
      return cached;
    }

    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = TEXTURE_SIZE;
    surface.height = TEXTURE_SIZE * storeys;
    const context = surface.getContext("2d");

    if (!context) {
      return base;
    }

    for (let storey = 0; storey < storeys; storey += 1) {
      // Counted from the top down, so the storey nearest the floor stays the brightest.
      const above = storeys - 1 - storey;
      const top = storey * TEXTURE_SIZE;
      context.drawImage(base, 0, top);
      context.fillStyle = `rgba(8, 4, 16, ${Math.min(0.5, above * 0.16)})`;
      context.fillRect(0, top, TEXTURE_SIZE, TEXTURE_SIZE);

      if (storey > 0) {
        context.fillStyle = "rgba(4, 2, 9, 0.55)";
        context.fillRect(0, top - 1, TEXTURE_SIZE, 3);
        context.fillStyle = "rgba(196, 168, 140, 0.16)";
        context.fillRect(0, top + 2, TEXTURE_SIZE, 1);
      }
    }

    this.#storeyTextures.set(key, surface);
    return surface;
  }

  /**
   * The storey texture with the unlit pass's fog and torch rectangles already applied.
   *
   * Same two fills the per-column path used to make, performed once onto a 64-wide canvas instead of
   * once per screen column. Steady state is a pure cache hit: the flicker only wanders between two
   * adjacent torch buckets, and both stay resident.
   */
  #tintedWallTexture(
    material: RenderSurfaceMaterial,
    storeys: number,
    fogAlpha: number,
    torch: number,
  ): CanvasImageSource {
    const fogStep = Math.round(clamp(fogAlpha, 0, 1) * WALL_FOG_STEPS);
    const torchStep = Math.round(clamp(torch, 0, 1) * WALL_TORCH_STEPS);
    let materialId = this.#materialIds.get(material);

    if (materialId === undefined) {
      materialId = this.#materialIds.size;
      this.#materialIds.set(material, materialId);
    }

    const key = ((materialId * 16 + storeys) * (WALL_FOG_STEPS + 1) + fogStep) * (WALL_TORCH_STEPS + 1) + torchStep;
    const cached = this.#tintedWallCache.get(key);

    if (cached) {
      this.#tintedWallCache.delete(key);
      this.#tintedWallCache.set(key, cached);
      return cached;
    }

    const base = this.#storeyTexture(material, storeys);
    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = TEXTURE_SIZE;
    surface.height = TEXTURE_SIZE * storeys;
    const context = surface.getContext("2d");

    if (!context) {
      return base;
    }

    context.drawImage(base, 0, 0);
    context.fillStyle = `rgba(13, 5, 24, ${fogStep / WALL_FOG_STEPS})`;
    context.fillRect(0, 0, surface.width, surface.height);

    if (torchStep > 0) {
      context.fillStyle = `rgba(255, 112, 35, ${(torchStep / WALL_TORCH_STEPS) * 0.16})`;
      context.fillRect(0, 0, surface.width, surface.height);
    }

    this.#tintedWallCache.set(key, surface);

    for (const staleKey of this.#tintedWallCache.keys()) {
      if (this.#tintedWallCache.size <= TINTED_WALL_CACHE_LIMIT) {
        break;
      }

      this.#tintedWallCache.delete(staleKey);
    }

    return surface;
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

    // Reused whenever the caller hands back the same array. A scene that caches its terrain gets the
    // grid built once per change rather than once per frame, for the cost of one identity check.
    if (this.#patchGridSource === patches && this.#patchGrid) {
      return this.#patchGrid;
    }

    const grid = new Uint8Array(scene.width * scene.height);

    for (const patch of patches) {
      if (patch.cell.x < 0 || patch.cell.y < 0 || patch.cell.x >= scene.width || patch.cell.y >= scene.height) {
        continue;
      }

      grid[patch.cell.y * scene.width + patch.cell.x] = FLOOR_MATERIALS.indexOf(patch.material) + 1;
    }

    // Which sides of each water cell face dry floor, resolved here once instead of once per water
    // pixel. Out of bounds counts as dry, matching how the per-pixel version treated the map edge.
    const water = FLOOR_MATERIALS.indexOf("water") + 1;
    const mask = new Uint8Array(scene.width * scene.height);

    for (let y = 0; y < scene.height; y += 1) {
      for (let x = 0; x < scene.width; x += 1) {
        const cell = y * scene.width + x;

        if (grid[cell] !== water) {
          continue;
        }

        let sides = 0;

        if (x === 0 || grid[cell - 1] !== water) {
          sides |= 1;
        }

        if (x === scene.width - 1 || grid[cell + 1] !== water) {
          sides |= 2;
        }

        if (y === 0 || grid[cell - scene.width] !== water) {
          sides |= 4;
        }

        if (y === scene.height - 1 || grid[cell + scene.width] !== water) {
          sides |= 8;
        }

        mask[cell] = sides;
      }
    }

    this.#patchGridSource = patches;
    this.#patchGrid = grid;
    this.#shoreMask = mask;
    return grid;
  }

  /**
   * A per-cell index into `scene.surfaces`, offset by one so zero means no wall.
   *
   * The ray walk read the surfaces through a map keyed by a `"x,y"` string, which allocated a key
   * per step — and in an open room, where nothing stops a ray early, that was tens of thousands of
   * allocations a frame. A flat typed array makes the step one bounds check and one read.
   */
  #surfaceIndexGrid(scene: RenderScene): Int16Array {
    const surfaces = scene.surfaces;
    const length = scene.width * scene.height;

    // Reused whenever the caller hands back the same array, exactly like the floor-patch grid: a
    // scene that caches its terrain pays for a rebuild only when the terrain actually changes.
    if (this.#surfaceGridSource === surfaces && this.#surfaceGrid.length === length) {
      return this.#surfaceGrid;
    }

    if (this.#surfaceGrid.length === length) {
      this.#surfaceGrid.fill(0);
    } else {
      this.#surfaceGrid = new Int16Array(length);
    }

    const grid = this.#surfaceGrid;

    for (let index = 0; index < surfaces.length; index += 1) {
      const cell = (surfaces[index] as RenderSurface).cell;

      if (cell.x >= 0 && cell.y >= 0 && cell.x < scene.width && cell.y < scene.height) {
        grid[cell.y * scene.width + cell.x] = index + 1;
      }
    }

    this.#surfaceGridSource = surfaces;
    return grid;
  }

  /** Per-cell overlay material and strength, packed as two parallel grids. */
  #floorOverlayGrids(scene: RenderScene): Readonly<{ material: Uint8Array; amount: Float32Array }> | undefined {
    const overlays = scene.floorOverlays;

    if (!overlays || overlays.length === 0) {
      return undefined;
    }

    // Reused whenever the caller hands back the same array, like the patch grid. A scene that keeps
    // its overlays stable between stains pays for a rebuild only when something actually bleeds.
    if (this.#overlayGridsSource === overlays && this.#overlayGrids) {
      return this.#overlayGrids;
    }

    const material = new Uint8Array(scene.width * scene.height);
    const amount = new Float32Array(scene.width * scene.height);

    for (const overlay of overlays) {
      if (
        overlay.cell.x < 0 ||
        overlay.cell.y < 0 ||
        overlay.cell.x >= scene.width ||
        overlay.cell.y >= scene.height ||
        overlay.amount <= 0
      ) {
        continue;
      }

      const index = overlay.cell.y * scene.width + overlay.cell.x;
      material[index] = FLOOR_MATERIALS.indexOf(overlay.material) + 1;
      amount[index] = clamp(overlay.amount, 0, 1);
    }

    this.#overlayGridsSource = overlays;
    this.#overlayGrids = { material, amount };
    return this.#overlayGrids;
  }

  /**
   * Fills `#cellTextures` from the patch and overlay grids, one resolution per cell per change.
   *
   * Cached on the two grids' identities, so with a scene that keeps terrain and overlays stable the
   * whole table is a straight reuse — and even a rebuild is a few hundred cells, not a few hundred
   * thousand pixels.
   */
  #cellFloorTextures(
    scene: RenderScene,
    patchGrid: Uint8Array | undefined,
    overlays: Readonly<{ material: Uint8Array; amount: Float32Array }> | undefined,
  ): (Uint8ClampedArray | undefined)[] {
    const length = scene.width * scene.height;

    if (
      this.#cellTextures.length === length &&
      this.#cellTexturesPatchSource === patchGrid &&
      this.#cellTexturesOverlaySource === overlays
    ) {
      return this.#cellTextures;
    }

    if (this.#cellTextures.length !== length) {
      this.#cellTextures = Array.from({ length });
    }

    const table = this.#cellTextures;
    const floor = this.#texturePixels.floor;

    for (let cell = 0; cell < length; cell += 1) {
      const patch = patchGrid ? (patchGrid[cell] ?? 0) : 0;
      let pixels = patch === 0 ? floor : (this.#floorPatchPixels[patch - 1] ?? floor);

      if (overlays) {
        const stain = overlays.material[cell] ?? 0;

        if (stain !== 0) {
          const step = ((overlays.amount[cell] ?? 0) * STAIN_STEPS + 0.5) | 0;

          if (step > 0) {
            pixels = this.#stainedFloorPixels(patch, stain, step);
          }
        }
      }

      table[cell] = pixels;
    }

    this.#cellTexturesPatchSource = patchGrid;
    this.#cellTexturesOverlaySource = overlays;
    return table;
  }

  /**
   * The floor texture for a stained cell: base and stain blended once, then read like any other
   * floor. `base` is the patch index with zero meaning the default floor; `step` is the quantised
   * strength, from one to `STAIN_STEPS`.
   */
  #stainedFloorPixels(base: number, stain: number, step: number): Uint8ClampedArray {
    const key = (base << 16) | (stain << 8) | step;
    const cached = this.#stainedPixelCache.get(key);

    if (cached) {
      return cached;
    }

    const basePixels =
      base === 0 ? this.#texturePixels.floor : (this.#floorPatchPixels[base - 1] ?? this.#texturePixels.floor);
    const stainPixels = this.#floorPatchPixels[stain - 1] ?? basePixels;
    const amount = step / STAIN_STEPS;
    const blended = new Uint8ClampedArray(basePixels.length);

    for (let index = 0; index < blended.length; index += 4) {
      blended[index] = (basePixels[index] ?? 0) + ((stainPixels[index] ?? 0) - (basePixels[index] ?? 0)) * amount;
      blended[index + 1] =
        (basePixels[index + 1] ?? 0) + ((stainPixels[index + 1] ?? 0) - (basePixels[index + 1] ?? 0)) * amount;
      blended[index + 2] =
        (basePixels[index + 2] ?? 0) + ((stainPixels[index + 2] ?? 0) - (basePixels[index + 2] ?? 0)) * amount;
      blended[index + 3] = 255;
    }

    this.#stainedPixelCache.set(key, blended);
    return blended;
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
    this.#columnHits = Array.from({ length: width * MAX_COLUMN_HITS });
    this.#columnHitCount = new Uint8Array(width);
    this.#coverTop = new Float32Array(width);
    this.#coverBottom = new Float32Array(width);
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

  /** How far up the room the eye sits, in cells. */
  #eyeHeight(scene: RenderScene): number {
    return scene.eyeHeight ?? 0.5;
  }

  /** Room height in cells. One is the shipped game's only value; the demo raises it per floor. */
  #wallHeight(scene: RenderScene): number {
    return scene.wallHeight ?? 1;
  }

  /** The screen row a world height projects to at a given depth. */
  #screenY(scene: RenderScene, z: number, depth: number): number {
    return this.#horizon(scene) + ((this.#eyeHeight(scene) - z) * this.canvas.height) / depth;
  }

  /**
   * Projects a world point to the screen. Public because the demo aims its melee at what it is about
   * to hit, and that means knowing where on screen the target is.
   */
  public project(
    scene: RenderScene,
    point: RenderPoint,
  ): Readonly<{ screenX: number; screenY: number; depth: number }> | undefined {
    return this.#projectPoint(scene, point);
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

    this.#lit = preferences.enhancedLighting === true;

    if (this.#lit) {
      this.#buildLightmap(scene);
    }

    // Cast before the planes are painted, not as part of drawing the walls. The rays are cheap and
    // knowing where the walls land is what lets the plane pass skip the pixels they will cover.
    this.#castScene(scene);
    this.#drawProjectedPlanes(scene, elapsedSeconds, preferences.reducedMotion, effects.rejectionTorch);

    if (scene.sky) {
      this.#drawStars(scene, scene.sky, elapsedSeconds, preferences.reducedMotion);
    }

    this.#drawWalls(scene, elapsedSeconds, effects.rejectionTorch);
    this.#drawSprites(scene, elapsedSeconds, effects);

    if (scene.beams && scene.beams.length > 0) {
      this.#drawBeams(scene, scene.beams);
    }

    if (scene.particles && scene.particles.length > 0) {
      this.#drawParticles(scene, scene.particles);
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
      this.#drawGrade(elapsedSeconds, preferences.reducedMotion, preferences.turnRate ?? 0);
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

  #planeImage(width: number, height: number): ImageData {
    const existing = this.#planeBuffer;

    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }

    const created = this.#context.createImageData(width, height);
    this.#planeBuffer = created;
    return created;
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
    // Reused between frames rather than allocated per frame. Every pixel of it is written every
    // frame — sky rows and plane rows both cover the full width, alpha included — so there is
    // nothing to clear, and `createImageData` was allocating and zeroing a megabyte a frame for a
    // buffer that never carried anything forward.
    const image = this.#planeImage(width, height);
    const flicker = reducedMotion ? 1 : 0.96 + Math.sin(elapsedSeconds * 7.1) * 0.025;
    const patchGrid = this.#floorPatchGrid(scene);
    const shoreMask = this.#shoreMask;
    const overlays = this.#floorOverlayGrids(scene);
    const cellTextures = this.#cellFloorTextures(scene, patchGrid, overlays);
    const waterPatch = FLOOR_MATERIALS.indexOf("water") + 1;
    const sky = scene.sky;
    const ceilingIndex = scene.ceilingMaterial ? FLOOR_MATERIALS.indexOf(scene.ceilingMaterial) : -1;
    const ceilingMaterial = ceilingIndex >= 0 ? ceilingIndex : undefined;
    const drift = reducedMotion ? 0 : elapsedSeconds * 0.045;
    const lightWidth = scene.width * LIGHTMAP_SCALE;
    const lastLightX = lightWidth - 1;
    const lastLightY = scene.height * LIGHTMAP_SCALE - 1;
    const eyeHeight = this.#eyeHeight(scene);
    const roomHeight = this.#wallHeight(scene);

    // Every row is walked rather than the floor half being walked and the ceiling mirrored onto it:
    // once the horizon can sit anywhere on the screen, the two halves are no longer the same size
    // and a mirror leaves whichever half grew unpainted.
    // Under `halvePlaneRows`, every other row is projected and then copied onto its neighbour.
    //
    // The copy is a `copyWithin` over a whole row of bytes, so the duplicated row costs a memcpy
    // instead of a projection, a cell lookup and a texture sample per pixel. For the sky this is
    // nearly exact — a vertical gradient's neighbouring rows are close to what the duplicate would
    // have computed — and for the floor it costs vertical resolution, worst near the horizon where
    // consecutive rows are furthest apart in world space and where the fog already hides the most.
    const rowStride = width * 4;
    const coverTop = this.#coverTop;
    const coverBottom = this.#coverBottom;
    const rowStep = this.halvePlaneRows ? 2 : 1;
    // Columns halve the same way rows do, except the duplicate is written inline — four bytes are
    // not worth a copyWithin. A skipped pair is only skipped when both of its columns are covered,
    // so a wall edge column can never inherit a stale neighbour.
    const colStep = this.halvePlaneColumns ? 2 : 1;
    // Once per row rather than once per pixel, so the call is not on the hot path.
    const duplicateRow = (row: number): void => {
      if (rowStep === 2 && row + 1 < height) {
        image.data.copyWithin((row + 1) * rowStride, row * rowStride, (row + 1) * rowStride);
      }
    };

    for (let y = 0; y < height; y += rowStep) {
      const offset = y - horizon;
      const below = offset > 0;

      // Sky rows short-circuit the whole projection. A ceiling row costs a distance, two plane
      // steps, a texture sample, a cell lookup and a materials lookup per pixel; a sky row costs one
      // write. Roughly half the screen is above the horizon, so this is the cheapest half of the
      // frame rather than the most expensive.
      if (sky && !below) {
        const t = clamp(-offset / Math.max(1, horizon), 0, 1);
        const ease = t * t * (3 - 2 * t);
        const red = sky.horizonColor[0] + (sky.zenithColor[0] - sky.horizonColor[0]) * ease;
        const green = sky.horizonColor[1] + (sky.zenithColor[1] - sky.horizonColor[1]) * ease;
        const blue = sky.horizonColor[2] + (sky.zenithColor[2] - sky.horizonColor[2]) * ease;

        for (let x = 0; x < width; x += colStep) {
          const hasNext = colStep === 2 && x + 1 < width;
          const coveredNext = !hasNext || (y >= coverTop[x + 1]! && y < coverBottom[x + 1]!);

          if (y >= coverTop[x]! && y < coverBottom[x]! && coveredNext) {
            continue;
          }

          const target = (y * width + x) * 4;
          image.data[target] = red;
          image.data[target + 1] = green;
          image.data[target + 2] = blue;
          image.data[target + 3] = 255;

          if (hasNext) {
            image.data[target + 4] = red;
            image.data[target + 5] = green;
            image.data[target + 6] = blue;
            image.data[target + 7] = 255;
          }
        }

        duplicateRow(y);
        continue;
      }

      // How far the plane is from the eye, vertically: the floor is `eye` below, the ceiling is the
      // rest of the room above. Equal only when the room is exactly one cell tall.
      const rowDistance = ((below ? eyeHeight : roomHeight - eyeHeight) * height) / Math.max(1, Math.abs(offset));
      const stepX = (rowDistance * (rayX1 - rayX0)) / width;
      const stepY = (rowDistance * (rayY1 - rayY0)) / width;
      let planeXPosition = camera.x + rowDistance * rayX0;
      let planeYPosition = camera.y + rowDistance * rayY0;
      const fog = clamp(1 - rowDistance / MAX_DEPTH, 0.12, 1) * (below ? 1 : 0.82);
      const torch = clamp(1.2 - rowDistance / 8, 0, 1) * flicker * torchContraction * (below ? 1 : 0.5);
      const fogRed = 9 * (1 - fog);
      const fogGreen = 5 * (1 - fog);
      const fogBlue = 16 * (1 - fog);
      const fogFlatRed = 18 * (1 - fog);
      const fogFlatGreen = 11 * (1 - fog);
      const fogFlatBlue = 28 * (1 - fog);
      const ceilingPixels = ceilingMaterial ? this.#floorPatchPixels[ceilingMaterial] : undefined;
      const defaultPixels = below ? this.#texturePixels.floor : (ceilingPixels ?? this.#texturePixels.ceiling);
      const stepXCol = stepX * colStep;
      const stepYCol = stepY * colStep;
      // The current cell run: how many pixels remain before the sample crosses a cell edge, and
      // what was resolved for the cell they share. Cell lookup, water test and shore mask move from
      // once per pixel to once per run — near the horizon a run is a single pixel and this changes
      // nothing, but across most of the floor a run is many.
      let runLeft = 0;
      let runPixels = defaultPixels;
      let runWater = false;
      let runMask = 0;
      let runCellX = 0;
      let runCellY = 0;

      for (let x = 0; x < width; x += colStep) {
        const hasNext = colStep === 2 && x + 1 < width;
        const coveredNext = !hasNext || (y >= coverTop[x + 1]! && y < coverBottom[x + 1]!);

        // Behind a wall. The step still has to be taken — the plane position walks the row rather
        // than being computed from x — but everything after it is thrown away, so skipping here is
        // the whole point of casting before painting.
        if (y >= coverTop[x]! && y < coverBottom[x]! && coveredNext) {
          runLeft -= 1;
          planeXPosition += stepXCol;
          planeYPosition += stepYCol;
          continue;
        }

        let sampleX = planeXPosition;
        let sampleY = planeYPosition;
        let pixels = defaultPixels;

        let foam = 0;

        if (below) {
          if (runLeft <= 0) {
            const cellX = Math.floor(planeXPosition);
            const cellY = Math.floor(planeYPosition);
            runCellX = cellX;
            runCellY = cellY;

            if (cellX >= 0 && cellY >= 0 && cellX < scene.width && cellY < scene.height) {
              const cell = cellY * scene.width + cellX;
              // Patch, stain and strength were already resolved into one texture per cell.
              runPixels = cellTextures[cell] ?? defaultPixels;
              runWater = patchGrid !== undefined && patchGrid[cell] === waterPatch;
              runMask = runWater && shoreMask ? (shoreMask[cell] ?? 0) : 0;
            } else {
              runPixels = defaultPixels;
              runWater = false;
              runMask = 0;
            }

            // Iterations until either axis of the sample leaves this cell.
            const untilX =
              stepXCol > 0
                ? (cellX + 1 - planeXPosition) / stepXCol
                : stepXCol < 0
                  ? (cellX - planeXPosition) / stepXCol
                  : Number.POSITIVE_INFINITY;
            const untilY =
              stepYCol > 0
                ? (cellY + 1 - planeYPosition) / stepYCol
                : stepYCol < 0
                  ? (cellY - planeYPosition) / stepYCol
                  : Number.POSITIVE_INFINITY;
            runLeft = Math.max(1, Math.ceil(Math.min(untilX, untilY)));
          }

          runLeft -= 1;
          pixels = runPixels;

          if (runWater) {
            // Water is the one surface that moves. Sliding where the texture is read from, rather
            // than rebuilding the texture, animates it — via the wave table, because a real sine
            // per water pixel was most of what a screen-filling pool cost.
            sampleX += drift;
            sampleY += WAVE_TABLE[((sampleX * 2.2 + elapsedSeconds) * WAVE_SCALE) & (WAVE_TABLE_SIZE - 1)] ?? 0;

            if (runMask !== 0) {
              foam = foamAt(runMask, planeXPosition - runCellX, planeYPosition - runCellY);
            }
          }
        }

        // Masking wraps the texel for negatives too, because `&` works on the two's complement int32
        // — but only while `TEXTURE_SIZE` is a power of two. Two modulos per axis per pixel priced
        // the polite version out of this loop.
        const textureX = Math.floor(sampleX * TEXTURE_SIZE) & (TEXTURE_SIZE - 1);
        const textureY = Math.floor(sampleY * TEXTURE_SIZE) & (TEXTURE_SIZE - 1);
        const source = (textureY * TEXTURE_SIZE + textureX) * 4;
        const target = (y * width + x) * 4;

        if (!this.#lit) {
          // Inlined rather than calling a helper: this runs once per floor and ceiling pixel, so a
          // call with nine arguments happens a fifth of a million times a frame.
          const pixel = image.data;
          let red = pixels[source] ?? 0;
          let green = pixels[source + 1] ?? 0;
          let blue = pixels[source + 2] ?? 0;

          if (foam > 0) {
            red += (206 - red) * foam;
            green += (232 - green) * foam;
            blue += (246 - blue) * foam;
          }

          const outRed = red * fog + fogFlatRed + 31 * torch;
          const outGreen = green * fog + fogFlatGreen + 12 * torch;
          const outBlue = blue * fog + fogFlatBlue - 3 * torch;
          pixel[target] = outRed;
          pixel[target + 1] = outGreen;
          pixel[target + 2] = outBlue;
          pixel[target + 3] = 255;

          if (hasNext) {
            pixel[target + 4] = outRed;
            pixel[target + 5] = outGreen;
            pixel[target + 6] = outBlue;
            pixel[target + 7] = 255;
          }

          planeXPosition += stepX * colStep;
          planeYPosition += stepY * colStep;
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
        void foam;
        const red = (pixels[source] ?? 0) * (this.#lightmap[light] ?? 0) * fog + fogRed;
        const green = (pixels[source + 1] ?? 0) * (this.#lightmap[light + 1] ?? 0) * fog + fogGreen;
        const blue = (pixels[source + 2] ?? 0) * (this.#lightmap[light + 2] ?? 0) * fog + fogBlue;
        pixel[target] = red;
        pixel[target + 1] = green;
        pixel[target + 2] = blue;
        pixel[target + 3] = 255;

        if (hasNext) {
          pixel[target + 4] = red;
          pixel[target + 5] = green;
          pixel[target + 6] = blue;
          pixel[target + 7] = 255;
        }

        planeXPosition += stepX * colStep;
        planeYPosition += stepY * colStep;
      }

      duplicateRow(y);
    }

    this.#context.putImageData(image, 0, 0);
  }

  /**
   * Stars and a moon, placed by where the head is pointed rather than where the body is standing.
   *
   * That is the whole reason they help: a star sweeps across as you turn and stays put as you walk,
   * so it is a fixed thing to read your own rotation against — which is exactly what a ceiling one
   * cell above your head cannot be. Elevation is a screen-space band, because a genuinely distant
   * point projects onto the horizon in this camera and the whole sky would collapse to a line.
   */
  #drawStars(scene: RenderScene, sky: RenderSky, elapsedSeconds: number, reducedMotion: boolean): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const horizon = this.#horizon(scene);

    if (horizon <= 0) {
      return;
    }

    const context = this.#context;
    const planeLength = this.#planeLength();
    const halfAngle = Math.atan(planeLength);
    const band = Math.min(horizon, height * 0.9);
    context.save();

    if (sky.moonAngle !== undefined) {
      const moon = this.#skyScreenX(sky.moonAngle, scene.camera.angle, halfAngle, planeLength, width);

      if (moon !== undefined) {
        const moonY = horizon - band * 0.72;
        const radius = height * 0.05;
        const glow = context.createRadialGradient(moon, moonY, 0, moon, moonY, radius * 4);
        glow.addColorStop(0, "rgba(206, 220, 255, 0.42)");
        glow.addColorStop(1, "rgba(140, 164, 220, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(moon, moonY, radius * 4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#e6ecff";
        context.beginPath();
        context.arc(moon, moonY, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(176, 190, 230, 0.5)";
        context.beginPath();
        context.arc(moon - radius * 0.3, moonY - radius * 0.2, radius * 0.22, 0, Math.PI * 2);
        context.arc(moon + radius * 0.34, moonY + radius * 0.26, radius * 0.16, 0, Math.PI * 2);
        context.fill();
      }
    }

    for (let index = 0; index < sky.stars; index += 1) {
      // Positions are derived from the index by the golden angle, so the same sky is drawn every
      // frame, spread evenly, without a table to store or seed.
      const azimuth = (index * 2.399_963) % (Math.PI * 2);
      const rise = 0.12 + (((index * 37) % 79) / 79) * 0.86;
      const screenX = this.#skyScreenX(azimuth, scene.camera.angle, halfAngle, planeLength, width);

      if (screenX === undefined) {
        continue;
      }

      const twinkle = reducedMotion ? 1 : 0.65 + Math.sin(elapsedSeconds * (1.1 + (index % 7) * 0.3) + index) * 0.35;
      const size = index % 11 === 0 ? 2 : 1;
      context.fillStyle = `rgba(226, 234, 255, ${(0.22 + (index % 5) * 0.12) * twinkle})`;
      context.fillRect(screenX, horizon - band * rise, size, size);
    }

    context.restore();
  }

  /** Where a compass direction lands on screen, or undefined when it is outside the view. */
  #skyScreenX(
    azimuth: number,
    cameraAngle: number,
    halfAngle: number,
    planeLength: number,
    width: number,
  ): number | undefined {
    let relative = azimuth - cameraAngle;
    relative -= Math.PI * 2 * Math.floor((relative + Math.PI) / (Math.PI * 2));

    if (Math.abs(relative) >= halfAngle) {
      return undefined;
    }

    return (width / 2) * (1 + Math.tan(relative) / planeLength);
  }

  /**
   * Walks a column's ray and collects every wall that can show above the ones in front of it,
   * nearest first.
   *
   * A single-hit cast is only correct while every wall is the same height, because then the first
   * one covers everything behind it. Once surfaces carry their own height — a boundary wall standing
   * taller than the maze inside it — the wall behind a short one is visible above it, and returning
   * early left open sky in its place. So the walk continues past a hit, keeping only surfaces taller
   * than everything already in front (a shorter wall further away can never clear a taller near one),
   * and stops as soon as the tallest so far reaches the top of the screen.
   */
  #castColumn(
    scene: RenderScene,
    grid: Int16Array,
    surfaceList: readonly RenderSurface[],
    cameraX: number,
    roomHeight: number,
    maxSurfaceHeight: number,
    eyeHeight: number,
    coverScale: number,
    into: RayHit[],
  ): void {
    const directionX = Math.cos(scene.camera.angle);
    const directionY = Math.sin(scene.camera.angle);
    const planeLength = this.#planeLength();
    const rayX = directionX - directionY * planeLength * cameraX;
    const rayY = directionY + directionX * planeLength * cameraX;
    const sceneWidth = scene.width;
    const sceneHeight = scene.height;
    let mapX = Math.floor(scene.camera.x);
    let mapY = Math.floor(scene.camera.y);
    const deltaX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
    const deltaY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
    const stepX = rayX < 0 ? -1 : 1;
    const stepY = rayY < 0 ? -1 : 1;
    let sideX = rayX < 0 ? (scene.camera.x - mapX) * deltaX : (mapX + 1 - scene.camera.x) * deltaX;
    let sideY = rayY < 0 ? (scene.camera.y - mapY) * deltaY : (mapY + 1 - scene.camera.y) * deltaY;
    let side: 0 | 1 = 0;
    let tallest = 0;
    into.length = 0;

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

      const distance = side === 0 ? sideX - deltaX : sideY - deltaY;

      // Distance alone ends the walk, hit or no hit. The check used to live on the hit path only,
      // so a ray crossing open floor never stopped — in a room with its walls knocked down every
      // column walked the full step budget through empty cells.
      if (distance > MAX_DEPTH) {
        return;
      }

      // Outside the named grid is empty, not solid; the distance cutoff above is what ends the walk.
      if (mapX < 0 || mapY < 0 || mapX >= sceneWidth || mapY >= sceneHeight) {
        continue;
      }

      const surfaceIndex = grid[mapY * sceneWidth + mapX] ?? 0;

      if (surfaceIndex === 0) {
        continue;
      }

      const surface = surfaceList[surfaceIndex - 1] as RenderSurface;
      const surfaceHeight = surface.height ?? roomHeight;

      // A wall no taller than one already in front of it can never clear that one's silhouette, so
      // it is stepped over without being drawn.
      if (surfaceHeight <= tallest) {
        continue;
      }

      tallest = surfaceHeight;

      const wallCoordinate = side === 0 ? scene.camera.y + distance * rayY : scene.camera.x + distance * rayX;
      let textureX = Math.floor((wallCoordinate - Math.floor(wallCoordinate)) * TEXTURE_SIZE);

      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) {
        textureX = TEXTURE_SIZE - textureX - 1;
      }

      const face = side === 0 ? (rayX > 0 ? "west" : "east") : rayY > 0 ? "north" : "south";
      into.push({
        distance,
        surface,
        textureX,
        face,
        shade: side === 0 ? 1 : 0.78,
        hitX: scene.camera.x + rayX * distance,
        hitY: scene.camera.y + rayY * distance,
      });

      // Two ways the walk is done, and both matter. Nothing in the scene stands taller than this,
      // so nothing behind it can clear it — which is the whole walk when every wall is the same
      // height, as it is for the baked floors. Or it already reaches the top of the screen.
      if (surfaceHeight >= maxSurfaceHeight || distance <= (surfaceHeight - eyeHeight) * coverScale) {
        return;
      }
    }
  }

  /**
   * Casts every column once, recording the hits for the wall pass and the screen band they cover.
   *
   * Split out of `#drawWalls` so the plane pass in between can consult it. The floor used to be
   * projected across the whole screen below the horizon and then painted over by the walls, which in
   * a corridor threw away most of it — that pass costs a reprojection, a cell lookup and a texture
   * sample per pixel, and a corridor is the one view where both it and the walls are at full extent
   * at once.
   */
  #castScene(scene: RenderScene): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const horizon = this.#horizon(scene);
    const eyeHeight = this.#eyeHeight(scene);
    const roomHeight = this.#wallHeight(scene);
    const coverScale = horizon > 0 ? height / horizon : Number.POSITIVE_INFINITY;
    const column = this.#rayColumn;
    const grid = this.#surfaceIndexGrid(scene);
    let maxSurfaceHeight = roomHeight;

    for (const surface of scene.surfaces) {
      if (surface.height !== undefined && surface.height > maxSurfaceHeight) {
        maxSurfaceHeight = surface.height;
      }
    }

    // Hoisted out of the column loop, which was allocating one closure per column per frame.
    const spanOf = (hit: RayHit): { top: number; bottom: number } => {
      const depth = Math.max(0.001, hit.distance);
      const surfaceHeight = hit.surface.height ?? roomHeight;
      const bottom = horizon + (eyeHeight * height) / depth;
      return { top: bottom - (surfaceHeight * height) / depth, bottom };
    };

    for (let x = 0; x < width; x += 1) {
      this.#castColumn(
        scene,
        grid,
        scene.surfaces,
        (2 * x) / width - 1,
        roomHeight,
        maxSurfaceHeight,
        eyeHeight,
        coverScale,
        column,
      );
      const count = Math.min(column.length, MAX_COLUMN_HITS);
      this.#columnHitCount[x] = count;

      for (let index = 0; index < count; index += 1) {
        this.#columnHits[x * MAX_COLUMN_HITS + index] = column[index];
      }

      if (count === 0) {
        this.#depthBuffer[x] = MAX_DEPTH;
        // An empty band: `y >= 0 && y < -1` is false for every row.
        this.#coverTop[x] = 0;
        this.#coverBottom[x] = -1;
        continue;
      }

      // Sprites test against the nearest wall.
      const nearest = column[0]!;
      this.#depthBuffer[x] = nearest.distance;
      const near = spanOf(nearest);
      let top = near.top;

      // Farther hits are kept only when taller, so each reaches higher up the screen than the one in
      // front. They normally overlap into one band; the merge stops at the first that does not,
      // because a gap between them is sky the walls will not paint over.
      for (let index = 1; index < count; index += 1) {
        const span = spanOf(column[index]!);

        if (span.bottom < top) {
          break;
        }

        top = Math.min(top, span.top);
      }

      // Inset by two, not one: under `halvePlaneRows` a skipped row is also copied onto its
      // neighbour, so the band has to clear the wall's own edge by more than a single row.
      this.#coverTop[x] = Math.ceil(Math.max(0, top)) + 2;
      this.#coverBottom[x] = Math.floor(Math.min(height, near.bottom)) - 2;
    }
  }

  /** Paints the columns `#castScene` already resolved. Casting no longer happens here. */
  #drawWalls(scene: RenderScene, elapsedSeconds: number, torchContraction: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const horizon = this.#horizon(scene);
    const flicker = 0.96 + Math.sin(elapsedSeconds * 7.1) * 0.025;
    const lightWidth = scene.width * LIGHTMAP_SCALE;
    const lightHeight = scene.height * LIGHTMAP_SCALE;
    const eyeHeight = this.#eyeHeight(scene);
    const roomHeight = this.#wallHeight(scene);
    // Keyed by material *and* height, because a boundary wall standing taller than the ones inside
    // it needs its own stack of courses.
    const frameTextures = new Map<string, CanvasImageSource>();

    for (let x = 0; x < width; x += 1) {
      // Already cast by `#castScene`, before the planes were painted.
      const count = this.#columnHitCount[x] ?? 0;

      // Painted far to near, so a nearer wall covers the one it stands in front of.
      for (let index = count - 1; index >= 0; index -= 1) {
        this.#drawWallColumn(
          this.#columnHits[x * MAX_COLUMN_HITS + index]!,
          x,
          height,
          horizon,
          eyeHeight,
          roomHeight,
          frameTextures,
          flicker,
          torchContraction,
          lightWidth,
          lightHeight,
        );
      }
    }
  }

  #drawWallColumn(
    hit: RayHit,
    x: number,
    height: number,
    horizon: number,
    eyeHeight: number,
    roomHeight: number,
    frameTextures: Map<string, CanvasImageSource>,
    flicker: number,
    torchContraction: number,
    lightWidth: number,
    lightHeight: number,
  ): void {
    // The column runs from the floor to the top of the room, which is only symmetric about the
    // horizon when the eye is halfway up it.
    const depth = Math.max(0.001, hit.distance);
    const surfaceHeight = hit.surface.height ?? roomHeight;
    const storeys = Math.max(1, Math.round(surfaceHeight));
    const bottom = horizon + (eyeHeight * height) / depth;
    const wallHeight = (surfaceHeight * height) / depth;
    const start = bottom - wallHeight;
    const material: RenderSurfaceMaterial =
      hit.surface.material === "breakableWall" && !hit.surface.hintFaces?.includes(hit.face)
        ? "stoneWall"
        : hit.surface.material;

    // Clipped against the screen in *source* space, not by shortening the destination.
    //
    // The height was previously clamped to a maximum, which quietly squashed the texture into a
    // shorter rectangle for near columns while leaving neighbouring columns unsquashed — so the
    // masonry courses stepped sideways from column to column and a wall you stood next to came out
    // visibly sheared. Taking the matching slice of the source keeps every column's texels on the
    // same lines no matter how close the wall gets.
    const sourceHeight = TEXTURE_SIZE * storeys;
    const above = Math.max(0, -start);
    const below = Math.max(0, start + wallHeight - height);
    const visible = wallHeight - above - below;

    if (visible <= 0) {
      return;
    }

    const sourceTop = (above / wallHeight) * sourceHeight;
    const sourceSpan = (visible / wallHeight) * sourceHeight;
    const fog = clamp(hit.distance / MAX_DEPTH, 0, 0.88);

    if (!this.#lit) {
      // One draw from a texture with the tints already in it. The former texture-then-two-fills
      // form cost three interleaved canvas operations per column, which is what a view of many
      // separate walls multiplied into a frame-rate cliff.
      const torch = clamp(1.15 - hit.distance / 7.5, 0, 1) * flicker * torchContraction;
      const tinted = this.#tintedWallTexture(material, storeys, fog + (1 - hit.shade) * 0.15, torch);
      this.#context.drawImage(tinted, hit.textureX, sourceTop, 1, sourceSpan, x, start + above, 1, visible);
      return;
    }

    // Resolved from a table built once per frame. Looking it up by a key composed here instead
    // allocated a string per screen column, which measured as most of the wall pass.
    const textureKey = storeys === 1 ? material : `${material}:${storeys}`;
    let texture = frameTextures.get(textureKey);

    if (texture === undefined) {
      texture = this.#storeyTexture(material, storeys);
      frameTextures.set(textureKey, texture);
    }

    this.#context.drawImage(texture, hit.textureX, sourceTop, 1, sourceSpan, x, start + above, 1, visible);

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
    const groundLine = this.#screenY(scene, 0, depth);
    // Authored anchors are measured from the floor line: 0 stands on the ground, negative floats.
    const startY =
      sprite.placement === "ground"
        ? groundLine - height * 0.58 + sprite.verticalAnchor * height
        : groundLine - height + sprite.verticalAnchor * height;

    return { sprite, depth, screenX, startX, endX: Math.ceil(screenX + width / 2), startY, width, height };
  }

  /**
   * Sprites and boxes, interleaved by depth and drawn back to front.
   *
   * They have to share one ordering. The depth buffer only records walls, so it cannot arbitrate
   * between a box and a sprite — and drawing all the boxes first meant every creature painted itself
   * over the barricade it was standing behind. Sorting them together is the painter's algorithm, and
   * it gets this right for everything except a sprite standing inside a box, which is a case the
   * geometry here never produces.
   */
  #drawSprites(scene: RenderScene, elapsedSeconds: number, effects: PresentationRenderEffects): void {
    const enemyEffects = new Map(effects.enemies.map((effect) => [effect.entityId, effect]));
    const drawables: Drawable[] = [];

    for (const sprite of scene.sprites) {
      const projected = this.#projectSprite(scene, sprite);

      if (projected) {
        drawables.push({ depth: projected.depth, sprite: projected });
      }
    }

    for (const box of scene.boxes ?? []) {
      // Measured to the nearest corner of the footprint rather than the centre: a wide box read as
      // further away than its own leading edge and sank behind things standing in front of it.
      const nearestX = clamp(scene.camera.x, box.x - box.halfX, box.x + box.halfX);
      const nearestY = clamp(scene.camera.y, box.y - box.halfY, box.y + box.halfY);
      drawables.push({ depth: Math.hypot(nearestX - scene.camera.x, nearestY - scene.camera.y), box });
    }

    for (const blob of scene.blobs ?? []) {
      const depth = this.#cameraDepth(scene, blob.x, blob.y);

      if (depth > 0.08 && depth <= MAX_DEPTH && blob.alpha > 0.01) {
        drawables.push({ depth, blob });
      }
    }

    // Far to near, sorted in place — the list is built fresh above, so nothing else holds it.
    // `sort` is stable, so drawables at equal depth keep their scene order: the same tie-break the
    // quadratic insertion loop this replaces had, at a cost that stays sane as crowds grow.
    const ordered = drawables.sort((left, right) => right.depth - left.depth);

    for (const entry of ordered) {
      if (entry.box) {
        this.#drawBox(scene, entry.box);
        continue;
      }

      if (entry.blob) {
        this.#drawBlob(scene, entry.blob);
        continue;
      }

      const projected = entry.sprite as ProjectedSprite;
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
    for (const entry of ordered) {
      const xray = entry.sprite?.sprite.xray;

      if (xray && entry.sprite) {
        this.#drawSilhouette(entry.sprite, xray, elapsedSeconds);
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

    return {
      screenX: (this.canvas.width / 2) * (1 + transformX / depth),
      screenY: this.#screenY(scene, point.z, depth),
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

  /**
   * Fills a projected convex quad column by column, depth-tested against the walls.
   *
   * Column-wise rather than as one canvas path because the depth buffer is per column: a path fill
   * is one decision for the whole shape, and a box standing at a corner needs to be cut off halfway
   * across. Depth is interpolated as its reciprocal, which is the part that varies linearly on
   * screen.
   */
  #fillProjectedQuad(corners: readonly ProjectedCorner[], style: string): void {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;

    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
    }

    const from = Math.max(0, Math.floor(minX));
    const to = Math.min(this.canvas.width - 1, Math.ceil(maxX));

    if (to < from) {
      return;
    }

    this.#context.fillStyle = style;

    // Whole-face fast path: when even the farthest corner is nearer than every wall across the
    // span, no column of it can be clipped, and one path fill replaces a fill per pixel column.
    // Standing at the exit dais put several near, wide, unoccluded faces on screen at once, and the
    // column loop billed each of them hundreds of one-pixel rects.
    let slowestInverse = Number.POSITIVE_INFINITY;

    for (const corner of corners) {
      slowestInverse = Math.min(slowestInverse, corner.inverseDepth);
    }

    let nearestWall = Number.POSITIVE_INFINITY;

    for (let x = from; x <= to; x += 1) {
      const wall = this.#depthBuffer[x] ?? MAX_DEPTH;

      if (wall < nearestWall) {
        nearestWall = wall;
      }
    }

    if (1 / slowestInverse < nearestWall) {
      const context = this.#context;
      context.beginPath();
      context.moveTo((corners[0] as ProjectedCorner).x, (corners[0] as ProjectedCorner).y);

      for (let index = 1; index < corners.length; index += 1) {
        context.lineTo((corners[index] as ProjectedCorner).x, (corners[index] as ProjectedCorner).y);
      }

      context.closePath();
      context.fill();
      return;
    }

    for (let x = from; x <= to; x += 1) {
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      let inverseDepth = 0;
      let crossings = 0;
      const sample = x + 0.5;

      for (let index = 0; index < corners.length; index += 1) {
        const start = corners[index] as ProjectedCorner;
        const end = corners[(index + 1) % corners.length] as ProjectedCorner;

        if (start.x === end.x || sample < Math.min(start.x, end.x) || sample > Math.max(start.x, end.x)) {
          continue;
        }

        const t = (sample - start.x) / (end.x - start.x);
        const y = start.y + (end.y - start.y) * t;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        inverseDepth += start.inverseDepth + (end.inverseDepth - start.inverseDepth) * t;
        crossings += 1;
      }

      if (crossings === 0 || bottom <= top) {
        continue;
      }

      const depth = crossings / inverseDepth;

      if (depth >= (this.#depthBuffer[x] ?? MAX_DEPTH)) {
        continue;
      }

      this.#context.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
  }

  /**
   * Draws one box: the two sides facing the camera, then the top.
   *
   * The faces turned away are behind the near ones and would only cost fill, and each visible face
   * is shaded by its own orientation so the box reads as solid rather than as a flat silhouette.
   */
  #drawBox(scene: RenderScene, box: RenderBox): void {
    {
      const west = box.x - box.halfX;
      const east = box.x + box.halfX;
      const north = box.y - box.halfY;
      const south = box.y + box.halfY;
      const faces: readonly Readonly<{ corners: readonly RenderPoint[]; shade: number; facing: boolean }>[] = [
        {
          corners: [
            { x: west, y: north, z: box.top },
            { x: east, y: north, z: box.top },
            { x: east, y: north, z: box.bottom },
            { x: west, y: north, z: box.bottom },
          ],
          shade: 0.78,
          facing: scene.camera.y < north,
        },
        {
          corners: [
            { x: west, y: south, z: box.top },
            { x: east, y: south, z: box.top },
            { x: east, y: south, z: box.bottom },
            { x: west, y: south, z: box.bottom },
          ],
          shade: 0.78,
          facing: scene.camera.y > south,
        },
        {
          corners: [
            { x: west, y: north, z: box.top },
            { x: west, y: south, z: box.top },
            { x: west, y: south, z: box.bottom },
            { x: west, y: north, z: box.bottom },
          ],
          shade: 1,
          facing: scene.camera.x < west,
        },
        {
          corners: [
            { x: east, y: north, z: box.top },
            { x: east, y: south, z: box.top },
            { x: east, y: south, z: box.bottom },
            { x: east, y: north, z: box.bottom },
          ],
          shade: 1,
          facing: scene.camera.x > east,
        },
        {
          corners: [
            { x: west, y: north, z: box.top },
            { x: east, y: north, z: box.top },
            { x: east, y: south, z: box.top },
            { x: west, y: south, z: box.top },
          ],
          shade: -1,
          facing: true,
        },
      ];

      for (const face of faces) {
        if (!face.facing) {
          continue;
        }

        const projected: ProjectedCorner[] = [];
        let visible = true;
        let nearest = MAX_DEPTH;

        for (const corner of face.corners) {
          const point = this.#projectPoint(scene, corner);

          if (!point) {
            visible = false;
            break;
          }

          nearest = Math.min(nearest, point.depth);
          projected.push({ x: point.screenX, y: point.screenY, inverseDepth: 1 / point.depth });
        }

        if (!visible) {
          continue;
        }

        const source = face.shade < 0 ? (box.topColor ?? brighten(box.color, 1.28)) : box.color;
        const shade = clamp(1 - nearest / MAX_DEPTH, 0.2, 1) * (face.shade < 0 ? 1 : face.shade);
        this.#fillProjectedQuad(
          projected,
          `rgb(${Math.round(source[0] * shade)}, ${Math.round(source[1] * shade)}, ${Math.round(source[2] * shade)})`,
        );
      }
    }
  }

  /**
   * Draws one soft body as a stack of filled rings.
   *
   * The profile is a dome deformed by the blob's parameters: squash trades height for width, lean
   * shifts rings progressively toward the crown, droop sags them back down, and the wobble
   * modulates each ring's radius — which together cover walking bounce, lunges, shivers, melting
   * and sinking without any skeleton. A split body is the same stack drawn twice, each half clipped
   * at the cut and toppling outward. Rings are cheap — one ellipse fill each, a dozen or so per
   * body — and the whole body is depth-clipped against the walls at once.
   */
  #drawBlob(scene: RenderScene, blob: RenderBlob): void {
    const context = this.#context;
    const squash = Math.max(0.05, blob.squash);
    const base = this.#projectPoint(scene, { x: blob.x, y: blob.y, z: blob.sink });

    if (!base) {
      return;
    }

    const depth = base.depth;
    const pxPerCell = this.canvas.height / depth;
    const widen = 1 / Math.sqrt(squash);
    const maxRadius = blob.radius * widen * (1 + Math.abs(blob.wobbleAmp)) * pxPerCell;
    const clipReach =
      maxRadius + (Math.abs(blob.split?.separation ?? 0) + Math.abs(blob.leanX) + Math.abs(blob.leanY)) * pxPerCell;
    context.save();

    if (!this.#clipToVisibleColumns(base.screenX - clipReach, base.screenX + clipReach, depth)) {
      context.restore();
      return;
    }

    context.globalAlpha = clamp(blob.alpha, 0, 1);

    // Bodies below the floor stay below it. The floor never enters the depth buffer, so a sinking
    // blob has to be cut off at its own waterline instead of being hidden by the ground.
    if (blob.sink < 0) {
      const floorLineY = base.screenY + blob.sink * pxPerCell;
      context.beginPath();
      context.rect(0, floorLineY - this.canvas.height * 4, this.canvas.width, this.canvas.height * 4);
      context.clip();
    }

    // Screen-space shadow of the lean: its component along the camera's right axis. The depth
    // component is dropped — at body scale it moves a ring by less than a pixel.
    const leanScreen =
      (blob.leanX * -Math.sin(scene.camera.angle) + blob.leanY * Math.cos(scene.camera.angle)) * pxPerCell;

    // Distance shading shared with the sprite pipeline's unlit path: darker with depth, warmed by
    // whatever light reaches the spot.
    const fade = 1 - clamp(depth / MAX_DEPTH, 0, 0.82);
    let warmth = clamp(1 - depth / 7, 0, 0.42);
    let warmColor = DEFAULT_TORCH_COLOR;

    if (this.#lit) {
      const placed = this.#sampleLight(scene, blob.x, blob.y);
      const strength = Math.max(placed[0], placed[1], placed[2]);

      if (strength > warmth) {
        const scale = 255 / strength;
        warmth = Math.min(1, strength);
        warmColor = [placed[0] * scale, placed[1] * scale, placed[2] * scale];
      }
    } else {
      for (const light of scene.lights) {
        const lightReach =
          clamp(1 - Math.hypot(light.x - blob.x, light.y - blob.y) / light.radius, 0, 1) * light.intensity;

        if (lightReach > warmth) {
          warmth = lightReach;
          warmColor = light.color;
        }
      }
    }

    const heightWorld = blob.height * squash;
    const ringCount = Math.max(6, Math.min(16, Math.round(maxRadius / 6)));
    const flash = clamp(blob.flash, 0, 1);

    const ringStyle = (h: number): string => {
      // Lit from above: the crown takes most of the light, the skirt sits in its own shadow.
      const shade = (0.5 + 0.5 * h) * fade;
      const red = (blob.color[0] + (255 - blob.color[0]) * flash) * shade + warmColor[0] * warmth * 0.3;
      const green = (blob.color[1] + (255 - blob.color[1]) * flash) * shade + warmColor[1] * warmth * 0.3;
      const blue = (blob.color[2] + (255 - blob.color[2]) * flash) * shade + warmColor[2] * warmth * 0.3;
      return `rgb(${Math.min(255, red) | 0}, ${Math.min(255, green) | 0}, ${Math.min(255, blue) | 0})`;
    };

    const ringZ = (h: number): number => h * heightWorld - blob.droop * h * h;

    const drawStack = (offsetX: number, dropPx: number, tilt: number, side: -1 | 0 | 1): void => {
      context.save();
      context.translate(base.screenX + offsetX, base.screenY + dropPx);

      if (tilt !== 0) {
        context.rotate(tilt);
      }

      if (side !== 0) {
        // The cut face: each half keeps its own side of the body, clipped in local space so the
        // cut edge topples along with the half.
        context.beginPath();
        context.rect(side < 0 ? -maxRadius * 2 : 0, -this.canvas.height * 2, maxRadius * 2, this.canvas.height * 4);
        context.clip();
      }

      for (let ring = 0; ring < ringCount; ring += 1) {
        const h = ring / (ringCount - 1);
        const profile = Math.sqrt(Math.max(0, 1 - h * h)) * (1 - 0.12 * h) + 0.04;
        const wobble = 1 + blob.wobbleAmp * Math.sin(blob.wobblePhase + h * 4.6);
        const radius = blob.radius * widen * profile * wobble;
        const rx = Math.max(0.8, radius * pxPerCell);
        const ry = Math.max(0.6, rx * 0.36);
        context.fillStyle = ringStyle(h);
        context.beginPath();
        context.ellipse(leanScreen * h, -ringZ(h) * pxPerCell, rx, ry, 0, 0, Math.PI * 2);
        context.fill();
      }

      // A soft crown highlight, which is most of what makes the body read as wet.
      const glossH = 0.66;
      const glossR = blob.radius * widen * Math.sqrt(1 - glossH * glossH) * pxPerCell;
      context.fillStyle = `rgba(255, 255, 255, ${0.16 * fade + 0.04})`;
      context.beginPath();
      context.ellipse(
        leanScreen * glossH - glossR * 0.3,
        -ringZ(glossH) * pxPerCell,
        glossR * 0.5,
        glossR * 0.22,
        -0.3,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();
    };

    if (blob.split) {
      const separation = blob.split.separation * pxPerCell;
      const drop = blob.split.drop * pxPerCell;
      drawStack(-separation, drop, -blob.split.tilt, -1);
      drawStack(separation, drop, blob.split.tilt, 1);
    } else {
      drawStack(0, 0, 0, 0);

      if (blob.face) {
        this.#drawBlobFace(blob, base.screenX, base.screenY, pxPerCell, leanScreen, widen, heightWorld);
      }
    }

    context.restore();
  }

  /** The face, drawn flat on the camera side: the one part of the body that stays a cartoon. */
  #drawBlobFace(
    blob: RenderBlob,
    baseX: number,
    baseY: number,
    pxPerCell: number,
    leanScreen: number,
    widen: number,
    heightWorld: number,
  ): void {
    const context = this.#context;
    const h = 0.52;
    const faceRadius = blob.radius * widen * Math.sqrt(1 - h * h) * pxPerCell;

    if (faceRadius < 3) {
      return;
    }

    const centerX = baseX + leanScreen * h;
    const centerY = baseY - (h * heightWorld - blob.droop * h * h) * pxPerCell;
    const eyeGap = faceRadius * 0.42;
    const eye = Math.max(1, faceRadius * 0.14);
    context.fillStyle = "rgb(26, 15, 30)";

    if (blob.face === "hurt") {
      // Squeezed shut: two short bars and a small round mouth.
      context.fillRect(centerX - eyeGap - eye, centerY - eye * 0.45, eye * 2, eye * 0.9);
      context.fillRect(centerX + eyeGap - eye, centerY - eye * 0.45, eye * 2, eye * 0.9);
      context.beginPath();
      context.ellipse(centerX, centerY + eye * 2.4, eye * 0.9, eye * 1.1, 0, 0, Math.PI * 2);
      context.fill();
      return;
    }

    if (blob.face === "attack") {
      // Brows angled in over the eyes, mouth open wide.
      context.beginPath();
      context.moveTo(centerX - eyeGap - eye, centerY - eye * 1.6);
      context.lineTo(centerX - eyeGap + eye, centerY - eye * 0.7);
      context.lineTo(centerX - eyeGap + eye, centerY - eye * 0.2);
      context.lineTo(centerX - eyeGap - eye, centerY - eye * 1.1);
      context.moveTo(centerX + eyeGap + eye, centerY - eye * 1.6);
      context.lineTo(centerX + eyeGap - eye, centerY - eye * 0.7);
      context.lineTo(centerX + eyeGap - eye, centerY - eye * 0.2);
      context.lineTo(centerX + eyeGap + eye, centerY - eye * 1.1);
      context.fill();
      context.beginPath();
      context.arc(centerX - eyeGap, centerY + eye * 0.4, eye * 0.8, 0, Math.PI * 2);
      context.arc(centerX + eyeGap, centerY + eye * 0.4, eye * 0.8, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(centerX, centerY + eye * 2.6, eye * 1.2, eye * 1.5, 0, 0, Math.PI * 2);
      context.fill();
      return;
    }

    // Calm: two round eyes and a small mouth.
    context.beginPath();
    context.arc(centerX - eyeGap, centerY, eye, 0, Math.PI * 2);
    context.arc(centerX + eyeGap, centerY, eye, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(centerX, centerY + eye * 2.2, eye * 0.7, eye * 0.5, 0, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Draws particles as flat circles, sorted far to near and depth-tested at their centre.
   *
   * One `arc` and one `fill` each, and no image anywhere in the path. Measured against the sprite
   * pipeline this is the difference between four hundred specks costing a third of the frame and
   * costing almost nothing.
   */
  #drawParticles(scene: RenderScene, particles: readonly RenderParticle[]): void {
    const context = this.#context;
    const height = this.canvas.height;
    const projected: Readonly<{ x: number; y: number; radius: number; depth: number; particle: RenderParticle }>[] = [];

    for (const particle of particles) {
      const point = this.#projectPoint(scene, particle);

      if (!point) {
        continue;
      }

      const radius = (particle.size * height) / (2 * point.depth);

      if (radius < 0.35) {
        continue;
      }

      const column = clamp(Math.round(point.screenX), 0, this.canvas.width - 1);

      if (point.depth >= (this.#depthBuffer[column] ?? MAX_DEPTH)) {
        continue;
      }

      projected.push({ x: point.screenX, y: point.screenY, radius, depth: point.depth, particle });
    }

    // Painter's order among themselves; the depth buffer only arbitrates against walls.
    projected.sort((left, right) => right.depth - left.depth);
    context.save();

    for (const item of projected) {
      const fade = clamp(1 - item.depth / MAX_DEPTH, 0.15, 1);
      const color = item.particle.color;
      context.globalCompositeOperation = item.particle.additive === true ? "lighter" : "source-over";
      context.fillStyle = `rgba(${Math.round(color[0] * fade)}, ${Math.round(color[1] * fade)}, ${Math.round(
        color[2] * fade,
      )}, ${clamp(item.particle.alpha, 0, 1)})`;
      context.beginPath();
      context.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  /**
   * Draws a sprite, skipping the columns a wall is in front of.
   *
   * The depth test has to be per column — that is the resolution the depth buffer has — but the
   * drawing does not. Consecutive visible columns are gathered into runs and each run is issued as
   * one `drawImage`, so a sprite standing in the open costs a single call instead of one per pixel
   * of its width. Measured on a crowd, this was most of the cost of drawing them.
   */
  #drawProjectedImage(projected: ProjectedSprite, source: CanvasImageSource, alpha: number): void {
    const dimensions = imageDimensions(source);
    const startX = Math.max(0, projected.startX);
    const endX = Math.min(this.canvas.width, projected.endX);

    if (endX <= startX) {
      return;
    }

    this.#context.save();
    this.#context.globalAlpha = clamp(alpha, 0, 1);
    let runStart = -1;

    const flush = (runEnd: number): void => {
      if (runStart < 0) {
        return;
      }

      const sourceFrom = ((runStart - projected.startX) / projected.width) * dimensions.width;
      const sourceTo = ((runEnd - projected.startX) / projected.width) * dimensions.width;
      this.#context.drawImage(
        source,
        sourceFrom,
        0,
        Math.max(0.01, sourceTo - sourceFrom),
        dimensions.height,
        runStart,
        projected.startY,
        runEnd - runStart,
        projected.height,
      );
      runStart = -1;
    };

    for (let x = startX; x < endX; x += 1) {
      if (projected.depth < (this.#depthBuffer[x] ?? MAX_DEPTH)) {
        if (runStart < 0) {
          runStart = x;
        }
      } else {
        flush(x);
      }
    }

    flush(endX);
    this.#context.restore();
  }

  #litImage(assetId: string, depth: number, scene: RenderScene, x: number, y: number): CanvasImageSource {
    const darknessBucket = Math.round(clamp(depth / MAX_DEPTH, 0, 0.82) * LIT_DEPTH_STEPS) / LIT_DEPTH_STEPS;
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

    const warmthBucket = Math.round(warmth * LIT_WARMTH_STEPS) / LIT_WARMTH_STEPS;
    const key = `${assetId}:${darknessBucket}:${warmthBucket}:${warmColor.join()}`;
    const cached = this.#litSpriteCache.get(key);

    if (cached) {
      this.#litSpriteCache.delete(key);
      this.#litSpriteCache.set(key, cached);
      return cached;
    }

    const source = requireImage(this.images, assetId);
    const dimensions = imageDimensions(source);
    // Cached at a fraction of the source resolution. These are only ever drawn a column at a time at
    // whatever size perspective gives them, almost always far under the source's own 512 — and the
    // full-size version cost a megabyte to allocate and clear, which is what made the cache missing
    // so expensive that a crowd of enemies halved the frame rate.
    const scale = Math.min(1, LIT_SPRITE_SIZE / Math.max(dimensions.width, dimensions.height));
    const surface = this.canvas.ownerDocument.createElement("canvas");
    surface.width = Math.max(1, Math.round(dimensions.width * scale));
    surface.height = Math.max(1, Math.round(dimensions.height * scale));
    const context = surface.getContext("2d");

    if (!context) {
      return source;
    }

    context.drawImage(source, 0, 0, surface.width, surface.height);
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

    // The halves are rotated, so they cannot be sliced per column the way an upright sprite is.
    // Clipping to the same visible runs gets the depth test back — without it a death played out
    // through the wall it happened behind, because these two calls were the only ones in the sprite
    // pass that reached the canvas without consulting the depth buffer at all.
    if (this.#clipToVisibleColumns(projected.startX, projected.endX, projected.depth)) {
      this.#context.globalAlpha = alpha;
      this.#drawDeathHalf(projected, source, dimensions, 0, -spread, fall, -progress * 0.42);
      this.#drawDeathHalf(projected, source, dimensions, 1, spread, fall, progress * 0.42);
    }

    this.#context.restore();
  }

  /**
   * Clips the context to the columns of a span that no wall stands in front of.
   *
   * For anything drawn rotated or otherwise not column-aligned. Returns false when the span is
   * entirely hidden, so the caller can skip it rather than draw into an empty clip.
   */
  #clipToVisibleColumns(spanStartX: number, spanEndX: number, depth: number): boolean {
    const startX = Math.max(0, Math.floor(spanStartX));
    const endX = Math.min(this.canvas.width, Math.ceil(spanEndX));

    if (endX <= startX) {
      return false;
    }

    const context = this.#context;
    context.beginPath();
    let runStart = -1;
    let any = false;

    for (let x = startX; x <= endX; x += 1) {
      const visible = x < endX && (this.#depthBuffer[x] ?? MAX_DEPTH) > depth;

      if (visible && runStart < 0) {
        runStart = x;
      } else if (!visible && runStart >= 0) {
        // Full canvas height: the depth buffer only resolves horizontally, and the sprite's own
        // bounds already limit the vertical extent.
        context.rect(runStart, 0, x - runStart, this.canvas.height);
        runStart = -1;
        any = true;
      }
    }

    if (!any) {
      return false;
    }

    context.clip();
    return true;
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
  #drawGrade(elapsedSeconds: number, reducedMotion: boolean, turnRate: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centreX = width * 0.5;
    const centreY = height * 0.54;
    const breath = reducedMotion ? 1 : 1 + Math.sin(elapsedSeconds * 0.9) * 0.03;
    const closing = clamp(turnRate, 0, 1);
    const outer = Math.hypot(width, height) * (0.62 - closing * TURN_VIGNETTE_REACH) * breath;
    const vignette = this.#context.createRadialGradient(centreX, centreY, outer * 0.34, centreX, centreY, outer);
    vignette.addColorStop(0, "rgba(6, 2, 12, 0)");
    vignette.addColorStop(0.62, `rgba(6, 2, 12, ${0.3 + closing * TURN_VIGNETTE_DEPTH})`);
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
