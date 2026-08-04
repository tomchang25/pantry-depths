/**
 * The floor's procedural textures.
 *
 * These began as a copy of the ray-marched renderer's generators, taken because a sandbox experiment
 * could not import the presentation layer it was going to replace. Both the experiment and that
 * renderer are gone and this is the only set left, so the note that used to sit here — change one and
 * the other is unchanged — no longer describes anything. Still cut down to the materials an assembled
 * floor actually emits: the brick, bars, doors and breakable stone the baked floors authored were
 * never emitted by these maps and died with the renderer that drew them.
 */

/** The wall materials an assembled floor emits. */
export type SceneWallMaterial =
  | "foundation"
  | "ashlar"
  | "ashlarWorn"
  | "ashlarCracked"
  | "ashlarFailing"
  | "wood"
  | "woodCracked"
  | "woodSplintered";

/** The floor materials, likewise. */
export type SceneFloorMaterial = "flagstone" | "water" | "waterFouled" | "waterChoked" | "trench" | "carrion";

export type SceneTextureSet = Readonly<{
  walls: Readonly<Record<SceneWallMaterial, HTMLCanvasElement>>;
  floors: Readonly<Record<SceneFloorMaterial, HTMLCanvasElement>>;
  /**
   * What a bloodied cell is mixed towards, at whatever depth it has taken.
   *
   * Not a floor material, because it never replaces the ground it is on — every stained cell is the
   * ground it was plus some of this, and how much is what a fight writes into the grid.
   */
  blood: HTMLCanvasElement;
}>;

const TEXTURE_SIZE = 64;

function canvas(): readonly [HTMLCanvasElement, CanvasRenderingContext2D] {
  const surface = document.createElement("canvas");
  surface.width = TEXTURE_SIZE;
  surface.height = TEXTURE_SIZE;
  const context = surface.getContext("2d");

  if (!context) {
    throw new Error("scene-3d: Canvas 2D is unavailable, and the textures are drawn with it");
  }

  return [surface, context];
}

/** Deterministic value noise, tiling over the texture. */
function valueNoise(x: number, y: number, seed: number): number {
  const wrapped = ((x % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
  const wrappedY = ((y % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
  let hash = wrapped * 374_761_393 + wrappedY * 668_265_263 + seed * 2_246_822_519;
  hash = (hash ^ (hash >>> 13)) * 1_274_126_177;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_295;
}

/** Smoothed noise at a chosen cell size, so a texture can carry both coarse and fine variation. */
function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const gridX = Math.floor(x / scale);
  const gridY = Math.floor(y / scale);
  const fractionX = (x / scale) % 1;
  const fractionY = (y / scale) % 1;
  const easeX = fractionX * fractionX * (3 - 2 * fractionX);
  const easeY = fractionY * fractionY * (3 - 2 * fractionY);
  const topLeft = valueNoise(gridX, gridY, seed);
  const topRight = valueNoise(gridX + 1, gridY, seed);
  const bottomLeft = valueNoise(gridX, gridY + 1, seed);
  const bottomRight = valueNoise(gridX + 1, gridY + 1, seed);
  const top = topLeft + (topRight - topLeft) * easeX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * easeX;
  return top + (bottom - top) * easeY;
}

/** Runs a per-pixel painter over a fresh tile. */
function paint(shade: (x: number, y: number) => readonly [number, number, number]): HTMLCanvasElement {
  const [surface, context] = canvas();
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const [red, green, blue] = shade(x, y);
      const index = (y * TEXTURE_SIZE + x) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return surface;
}

/** Coursed stone with real relief: per-block tint, recessed mortar, grime, and damage. */
function ashlar(
  base: readonly [number, number, number],
  mortar: readonly [number, number, number],
  courses: number,
  damage: number,
): HTMLCanvasElement {
  const courseHeight = TEXTURE_SIZE / courses;
  const blockWidth = TEXTURE_SIZE / 2;
  const bevel = 1.6;

  return paint((x, y) => {
    const course = Math.floor(y / courseHeight);
    const offset = course % 2 === 0 ? 0 : blockWidth / 2;
    const blockX = Math.floor((x + offset) / blockWidth);
    const withinX = (x + offset) % blockWidth;
    const withinY = y % courseHeight;
    const jointX = Math.min(withinX, blockWidth - withinX);
    const jointY = Math.min(withinY, courseHeight - withinY);

    if (jointX < 1.2 + damage * 1.6 || jointY < 1.2 + damage * 1.6) {
      const damp = (0.72 + smoothNoise(x, y, 3, 11) * 0.5) * (1 - damage * 0.4);
      return [mortar[0] * damp, mortar[1] * damp, mortar[2] * damp];
    }

    const blockSeed = blockX * 7 + course * 13;
    const tone = 0.84 + valueNoise(blockX, course, 5) * 0.34;
    const grain = 0.9 + smoothNoise(x, y, 2.5, blockSeed) * 0.2;
    const lift = jointY < bevel + 1.2 ? 1.22 : jointX < bevel + 1.2 && withinX < blockWidth / 2 ? 1.12 : 1;
    const sink = withinY > courseHeight - bevel - 2 ? 0.72 : withinX > blockWidth - bevel - 2 ? 0.82 : 1;
    const settle = 1 - (withinY / courseHeight) * 0.16 * (0.5 + smoothNoise(x, 0, 9, 3) * 1.2);
    let light = tone * grain * lift * sink * settle;

    if (damage > 0) {
      const bite = smoothNoise(x, y, 11, 21);
      const fracture = Math.abs(smoothNoise(x, y * 0.35, 13, 31) - 0.5);
      const branch = Math.abs(smoothNoise(y, x * 0.4, 17, 47) - 0.5);

      if (fracture < 0.012 + damage * 0.05 || (damage > 0.6 && branch < (damage - 0.6) * 0.09)) {
        light *= 0.3;
      } else if (bite > 0.82 - damage * 0.16) {
        light *= 0.58 + (bite - (0.82 - damage * 0.16)) * 1.4;
      }

      light *= 1 - damage * 0.12;
    }

    return [base[0] * light, base[1] * light, base[2] * light];
  });
}

/** Old timber: separate boards, deep gaps between them, knots, and iron banding. */
function timber(damage: number): HTMLCanvasElement {
  const boards = 4;
  const boardWidth = TEXTURE_SIZE / boards;

  return paint((x, y) => {
    const board = Math.floor(x / boardWidth);
    const withinX = x % boardWidth;
    const edge = Math.min(withinX, boardWidth - withinX);
    const tone = 0.82 + valueNoise(board, 0, 17) * 0.3;
    const grain = 0.88 + smoothNoise(x * 3.2, y * 0.35, 2, board * 5) * 0.24;
    const knotDistance = Math.hypot(withinX - boardWidth * 0.5, ((y + board * 23) % TEXTURE_SIZE) - 30);
    const knot = knotDistance < 5 ? 0.55 + knotDistance * 0.07 : 1;
    let light = tone * grain * knot;

    if (edge < 1.3) {
      light *= 0.3;
    } else if (edge < 2.6) {
      light *= withinX < boardWidth / 2 ? 1.16 : 0.78;
    }

    const banded = (y > 17 && y < 24) || (y > 41 && y < 48);

    if (banded) {
      const across = y > 41 ? y - 41 : y - 17;
      const metal = 0.5 + smoothNoise(x, y, 3, 41) * 0.3 + (across < 2 ? 0.3 : across > 4 ? -0.16 : 0);
      return [74 * metal * 1.5, 70 * metal * 1.5, 78 * metal * 1.5];
    }

    if (damage > 0) {
      const split = Math.abs(smoothNoise(x * 0.6, y * 0.25, 9, 53) - 0.5);

      if (split < 0.012 + damage * 0.045) {
        return [26, 16, 12];
      }

      if (split < 0.04 + damage * 0.05) {
        light *= 1.5;
      }
    }

    return [124 * light, 82 * light, 44 * light];
  });
}

/** Worn flagstones: large slabs, chipped edges, damp patches, and grit in the joints. */
function flagstone(): HTMLCanvasElement {
  const slab = TEXTURE_SIZE / 2;

  return paint((x, y) => {
    const slabX = Math.floor(x / slab);
    const slabY = Math.floor(y / slab);
    const withinX = x % slab;
    const withinY = y % slab;
    const jointX = Math.min(withinX, slab - withinX);
    const jointY = Math.min(withinY, slab - withinY);
    const joint = Math.min(jointX, jointY);
    const cellEdge = Math.min(x, TEXTURE_SIZE - 1 - x, y, TEXTURE_SIZE - 1 - y);

    if (cellEdge < 1) {
      return [72, 56, 92];
    }

    if (joint < 1.4) {
      const grit = 0.6 + smoothNoise(x, y, 2, 61) * 0.5;
      return [34 * grit, 26 * grit, 44 * grit];
    }

    const tone = 0.86 + valueNoise(slabX, slabY, 23) * 0.28;
    const grain = 0.9 + smoothNoise(x, y, 3.5, 29) * 0.2;
    const damp = 1 - Math.max(0, smoothNoise(x, y, 16, 37) - 0.62) * 0.9;
    const chip = joint < 3 ? 0.86 + joint * 0.05 : 1;
    const light = tone * grain * damp * chip;
    return [52 * light, 44 * light, 72 * light];
  });
}

/** Where a drowned body lies in a pool tile, in texels, taken in order. */
const SUNKEN_BODIES: readonly Readonly<{ x: number; y: number; radius: number }>[] = [
  { x: 25, y: 36, radius: 18 },
  { x: 44, y: 19, radius: 16 },
];

/** Distance to a point on a tiling texture, taking whichever way round the tile is shorter. */
function wrappedDistance(x: number, y: number, toX: number, toY: number): number {
  const dx = Math.abs(x - toX);
  const dy = Math.abs(y - toY);
  return Math.hypot(Math.min(dx, TEXTURE_SIZE - dx), Math.min(dy, TEXTURE_SIZE - dy));
}

/** How much of a pixel the bodies under the surface take, and how far the blood off them has spread. */
function sunkenAt(x: number, y: number, bodies: number): readonly [number, number] {
  let mass = 0;
  let bleed = 0;

  for (let index = 0; index < bodies; index += 1) {
    const body = SUNKEN_BODIES[index];

    if (!body) {
      continue;
    }

    const distance = wrappedDistance(x, y, body.x, body.y) * (0.86 + smoothNoise(x, y, 11, 97) * 0.3);
    mass = Math.max(mass, Math.max(0, 1 - distance / body.radius) ** 0.7);
    bleed = Math.max(bleed, Math.max(0, 1 - distance / (body.radius * 1.7)) ** 2);
  }

  return [mass, bleed];
}

/** Still water, built to tile in both axes, holding however many bodies have gone under in it. */
function stillWater(bodies: number): HTMLCanvasElement {
  const [surface, context] = canvas();
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const turn = (Math.PI * 2) / TEXTURE_SIZE;
  const murk = 1 - bodies * 0.13;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const ripple =
        Math.sin(x * turn * 2 + Math.sin(y * turn) * 1.6) * 0.5 +
        Math.sin(y * turn * 3 - Math.cos(x * turn) * 1.1) * 0.5;
      const sheen = Math.max(0, ripple) ** 2;
      let red = (14 + sheen * 46) * murk;
      let green = (38 + sheen * 74) * murk;
      let blue = (58 + sheen * 92) * murk;
      const [mass, bleed] = sunkenAt(x, y, bodies);

      if (bleed > 0) {
        red += (86 - red) * bleed * 0.45;
        green += (18 - green) * bleed * 0.45;
        blue += (26 - blue) * bleed * 0.45;
      }

      if (mass > 0) {
        const lit = 0.36 + mass * 0.52;
        const claim = mass * 0.82;
        red += (94 * lit - red) * claim;
        green += (116 * lit - green) * claim;
        blue += (76 * lit - blue) * claim;
      }

      const index = (y * TEXTURE_SIZE + x) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return surface;
}

/** The bodies of a pool that has taken all it can hold, packed edge to edge and crossing the seam. */
const PACKED_BODIES: readonly Readonly<{ x: number; y: number; radius: number }>[] = [
  { x: 17, y: 20, radius: 21 },
  { x: 46, y: 14, radius: 19 },
  { x: 33, y: 45, radius: 22 },
  { x: 58, y: 44, radius: 17 },
  { x: 4, y: 50, radius: 18 },
];

/** A trench: strata of rock receding into the dark, with a hairline rim where the floor gives out. */
function trench(): HTMLCanvasElement {
  return paint((x, y) => {
    const edge = Math.min(x, TEXTURE_SIZE - 1 - x, y, TEXTURE_SIZE - 1 - y);

    if (edge < 1) {
      const grain = 0.8 + valueNoise(x, y, 31) * 0.4;
      return [50 * grain, 41 * grain, 62 * grain];
    }

    const wobble = smoothNoise(x, y, 21, 41) * 7;
    const band = Math.abs(Math.sin(((y + wobble) / TEXTURE_SIZE) * Math.PI * 7));
    const layer = band > 0.92 ? 1.9 : 1;
    const rough = 0.7 + smoothNoise(x, y, 6, 43) * 0.6;
    const depth = 1 - Math.min(1, edge / 16) * 0.55;
    const light = layer * rough * depth;
    return [13 * light + 3, 11 * light + 2, 17 * light + 4];
  });
}

/** A filled pool: bodies heaped to the surface, and the ground the player now walks over them. */
function carrion(): HTMLCanvasElement {
  return paint((x, y) => {
    const cellEdge = Math.min(x, TEXTURE_SIZE - 1 - x, y, TEXTURE_SIZE - 1 - y);

    if (cellEdge < 1) {
      return [72, 56, 92];
    }

    let crown = 0;

    for (const body of PACKED_BODIES) {
      const distance = wrappedDistance(x, y, body.x, body.y) * (0.86 + smoothNoise(x, y, 9, 113) * 0.28);

      if (distance >= body.radius) {
        continue;
      }

      crown = Math.max(crown, Math.sqrt(1 - (distance / body.radius) ** 2));
    }

    if (crown <= 0) {
      const grime = 0.7 + smoothNoise(x, y, 3, 131) * 0.5;
      return [30 * grime, 24 * grime, 32 * grime];
    }

    const light = (0.46 + crown * 0.66) * (0.9 + smoothNoise(x, y, 2.5, 137) * 0.22);
    return [76 * light, 94 * light, 60 * light];
  });
}

/** Builds every texture an assembled floor can ask for, once. */
/**
 * Blood, as a tiling surface rather than a colour.
 *
 * The flat red the experiment used before this was most of what made a bloodied floor read as brown:
 * one value per cell has no pooling and no dried edge, so a stained cell is a coloured square and a
 * row of them is a coloured stripe. Two octaves give the pooling; the narrow band where the coarse
 * one sits between 0.62 and 0.72 is the darker rim a pool dries to, and it is the detail that sells
 * the whole thing as fluid.
 */
function bloodstain(): HTMLCanvasElement {
  return paint((x, y) => {
    const pool = smoothNoise(x, y, 7, 83) * 0.7 + smoothNoise(x, y, 2.5, 89) * 0.3;
    const depth = 0.5 + pool * 0.8;
    const rim = pool > 0.62 && pool < 0.72 ? 0.68 : 1;
    return [72 * depth * rim, 12 * depth * rim, 16 * depth * rim];
  });
}

export function createSceneTextures(): SceneTextureSet {
  return {
    walls: {
      foundation: ashlar([58, 48, 72], [22, 17, 32], 4, 0),
      ashlar: ashlar([104, 72, 84], [34, 20, 34], 6, 0),
      ashlarWorn: ashlar([104, 72, 84], [34, 20, 34], 6, 0.34),
      ashlarCracked: ashlar([104, 72, 84], [34, 20, 34], 6, 0.68),
      ashlarFailing: ashlar([104, 72, 84], [34, 20, 34], 6, 1),
      wood: timber(0),
      woodCracked: timber(0.55),
      woodSplintered: timber(1),
    },
    floors: {
      flagstone: flagstone(),
      water: stillWater(0),
      waterFouled: stillWater(1),
      waterChoked: stillWater(2),
      trench: trench(),
      carrion: carrion(),
    },
    blood: bloodstain(),
  };
}
