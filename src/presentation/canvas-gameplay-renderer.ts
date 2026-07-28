import type { EnemyAppearanceId } from "@/content/combat/enemies";
import type { EnemySpriteState } from "@/content/presentation/presentation-asset-definitions";
import type { Facing } from "@/core/grid";
import { createProceduralTextures, type TextureSet } from "@/presentation/procedural-textures";
import type {
  RenderEmitter,
  RenderFloorMaterial,
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
/** Index order for the per-cell floor lookup; position here is what the patch grid stores. */
const FLOOR_MATERIALS: readonly RenderFloorMaterial[] = ["water"];

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
    this.#drawProjectedPlanes(scene, elapsedSeconds, preferences.reducedMotion, effects.rejectionTorch);
    this.#drawWalls(scene, surfaceMap, elapsedSeconds, effects.rejectionTorch);
    this.#drawSprites(scene, elapsedSeconds, effects);
    this.#drawEmitters(scene.emitters, scene, elapsedSeconds, preferences.reducedMotion);
    this.#drawAtmosphere(elapsedSeconds, preferences.reducedMotion);

    if (preferences.viewmodel !== false) {
      this.#drawViewmodel(elapsedSeconds, effects, preferences.reducedMotion);
    }

    if (effects.playerHit > 0) {
      this.#context.fillStyle = `rgba(180, 24, 54, ${0.23 * effects.playerHit})`;
      this.#context.fillRect(0, 0, width, height);
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
      const defaultPixels = below ? this.#texturePixels.floor : this.#texturePixels.ceiling;
      // Only the floor half can be patched; a pool has no counterpart on the ceiling.
      const patchable = below && patchGrid !== undefined;

      for (let x = 0; x < width; x += 1) {
        const textureX = ((Math.floor(planeXPosition * TEXTURE_SIZE) % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
        const textureY = ((Math.floor(planeYPosition * TEXTURE_SIZE) % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
        const source = (textureY * TEXTURE_SIZE + textureX) * 4;
        let pixels = defaultPixels;

        if (patchable) {
          const cellX = Math.floor(planeXPosition);
          const cellY = Math.floor(planeYPosition);

          if (cellX >= 0 && cellY >= 0 && cellX < scene.width && cellY < scene.height) {
            const patch = patchGrid[cellY * scene.width + cellX] ?? 0;

            if (patch !== 0) {
              pixels = this.#floorPatchPixels[patch - 1] ?? defaultPixels;
            }
          }
        }

        this.#writeLitPixel(image.data, (y * width + x) * 4, pixels, source, fog, torch);
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
      return { distance, surface, textureX, face, shade: side === 0 ? 1 : 0.78 };
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
      const torch = clamp(1.15 - hit.distance / 7.5, 0, 1) * flicker * torchContraction;
      this.#context.fillStyle = `rgba(13, 5, 24, ${fog + (1 - hit.shade) * 0.15})`;
      this.#context.fillRect(x, start, 1, wallHeight);

      if (torch > 0) {
        this.#context.fillStyle = `rgba(255, 112, 35, ${torch * 0.16})`;
        this.#context.fillRect(x, start, 1, wallHeight);
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

    for (const light of scene.lights) {
      const reach = clamp(1 - Math.hypot(light.x - x, light.y - y) / light.radius, 0, 1) * light.intensity;

      if (reach > warmth) {
        warmth = reach;
        warmColor = light.color;
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
