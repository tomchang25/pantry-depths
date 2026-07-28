import type { RenderFloorMaterial, RenderSurfaceMaterial } from "@/presentation/render-scene";

export type TextureSet = Readonly<{
  walls: Readonly<Record<RenderSurfaceMaterial, HTMLCanvasElement>>;
  floor: HTMLCanvasElement;
  ceiling: HTMLCanvasElement;
  /** Alternate floors, selected per cell. One tile covers exactly one cell, same as `floor`. */
  floors: Readonly<Record<RenderFloorMaterial, HTMLCanvasElement>>;
}>;

const TEXTURE_SIZE = 64;

function canvas(documentOwner: Document): readonly [HTMLCanvasElement, CanvasRenderingContext2D] {
  const surface = documentOwner.createElement("canvas");
  surface.width = TEXTURE_SIZE;
  surface.height = TEXTURE_SIZE;
  const context = surface.getContext("2d");

  if (!context) {
    throw new Error("procedural textures: Canvas 2D is unavailable");
  }

  return [surface, context];
}

/**
 * Deterministic value noise, tiling over the texture.
 *
 * The older `noise` below stamps a fixed arithmetic pattern over finished pixels, which is enough to
 * break up a flat fill but visibly repeats and cannot be sampled at a chosen frequency. This one is
 * a hash the demo textures can query per pixel and at more than one octave, which is what stone
 * needs to stop reading as a vector drawing.
 */
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

/** Runs a per-pixel painter over a fresh tile. Every demo texture is built this way. */
function paint(
  documentOwner: Document,
  shade: (x: number, y: number) => readonly [number, number, number],
): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
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

function noise(context: CanvasRenderingContext2D, opacity = 0.13): void {
  const image = context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  for (let index = 0; index < image.data.length; index += 4) {
    const variation = ((index * 17 + Math.floor(index / 19) * 29) % 31) - 15;
    image.data[index] = Math.max(0, Math.min(255, (image.data[index] ?? 0) + variation));
    image.data[index + 1] = Math.max(0, Math.min(255, (image.data[index + 1] ?? 0) + variation));
    image.data[index + 2] = Math.max(0, Math.min(255, (image.data[index + 2] ?? 0) + variation));
    image.data[index + 3] = Math.round(255 * (1 - opacity * 0.2));
  }

  context.putImageData(image, 0, 0);
}

function masonry(
  documentOwner: Document,
  base: string,
  mortar: string,
  rows: number,
  columns: number,
): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = mortar;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const cellWidth = TEXTURE_SIZE / columns;
  const cellHeight = TEXTURE_SIZE / rows;

  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : -cellWidth / 2;

    for (let column = -1; column <= columns; column += 1) {
      context.fillStyle = base;
      context.fillRect(offset + column * cellWidth + 1, row * cellHeight + 1, cellWidth - 2, cellHeight - 2);
    }
  }

  noise(context);
  return surface;
}

function ironBars(documentOwner: Document): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = "#171026";
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.fillStyle = "#575064";

  for (let x = 4; x < TEXTURE_SIZE; x += 12) {
    context.fillRect(x, 0, 5, TEXTURE_SIZE);
    context.fillStyle = "#89808f";
    context.fillRect(x + 1, 0, 1, TEXTURE_SIZE);
    context.fillStyle = "#575064";
  }

  context.fillRect(0, 15, TEXTURE_SIZE, 5);
  context.fillRect(0, 45, TEXTURE_SIZE, 5);
  noise(context, 0.08);
  return surface;
}

function door(documentOwner: Document, color: string, highlight: string): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = "#1a1024";
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.fillStyle = color;
  context.fillRect(5, 2, 54, 62);
  context.strokeStyle = highlight;
  context.lineWidth = 3;
  context.strokeRect(10, 8, 44, 48);
  context.strokeRect(16, 14, 32, 17);
  context.strokeRect(16, 35, 32, 15);
  context.fillStyle = "#f0bb69";
  context.beginPath();
  context.arc(47, 34, 2.5, 0, Math.PI * 2);
  context.fill();
  noise(context, 0.07);
  return surface;
}

function breakable(documentOwner: Document): HTMLCanvasElement {
  const surface = masonry(documentOwner, "#55475c", "#21152c", 4, 4);
  const context = surface.getContext("2d");

  if (!context) {
    return surface;
  }

  context.strokeStyle = "#cf9f86";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(32, 2);
  context.lineTo(26, 18);
  context.lineTo(36, 27);
  context.lineTo(22, 40);
  context.lineTo(31, 62);
  context.stroke();
  return surface;
}

/**
 * One tile of this texture covers exactly one cell, so its outer edge is the only line in the scene
 * that marks a cell boundary. The four flagstones inside are decoration, and drawing them in the
 * same weight as that edge doubled the apparent number of lines down a corridor: a player counting
 * squares to judge how far away an opening is read every cell as two. The seam is therefore drawn
 * heavier and brighter than the flagstone joints it must never be mistaken for.
 */
function plane(documentOwner: Document, base: string, seam: string, joint: string): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = base;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.strokeStyle = joint;
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, 31, 31);
  context.strokeRect(32.5, 32.5, 31, 31);
  context.strokeRect(32.5, 0.5, 31, 31);
  context.strokeRect(0.5, 32.5, 31, 31);
  // Inset by half the line width so the whole stroke lands inside the tile; a stroke centred on the
  // edge would be clipped, and the neighbouring cell contributes the other half of the seam anyway.
  context.strokeStyle = seam;
  context.lineWidth = 2;
  context.strokeRect(1, 1, TEXTURE_SIZE - 2, TEXTURE_SIZE - 2);
  noise(context);
  return surface;
}

/**
 * Coursed stone with real relief.
 *
 * Three things do the work here, and they are what the shipped flat-fill masonry lacks: each block
 * is tinted individually so a wall is not one colour repeated, the mortar is recessed with a lit top
 * edge and a shadowed bottom one so the blocks read as proud of it, and grime settles into the
 * courses. `spalled` knocks a bite out of some blocks and adds a fracture, for a wall that has been
 * hit and is about to come down.
 */
function ashlar(
  documentOwner: Document,
  base: readonly [number, number, number],
  mortar: readonly [number, number, number],
  courses: number,
  /** Zero is intact; one is about to come down. Drives crack width, spalling, and lost mortar. */
  damage: number,
): HTMLCanvasElement {
  const courseHeight = TEXTURE_SIZE / courses;
  const blockWidth = TEXTURE_SIZE / 2;
  const bevel = 1.6;

  return paint(documentOwner, (x, y) => {
    const course = Math.floor(y / courseHeight);
    // Alternate courses are offset by half a block, which is what makes it read as bonded masonry.
    const offset = course % 2 === 0 ? 0 : blockWidth / 2;
    const blockX = Math.floor((x + offset) / blockWidth);
    const withinX = (x + offset) % blockWidth;
    const withinY = y % courseHeight;
    const jointX = Math.min(withinX, blockWidth - withinX);
    const jointY = Math.min(withinY, courseHeight - withinY);

    // Mortar crumbles out of the joints before the blocks themselves give, so a damaged wall widens
    // at its seams first — which is what a wall about to fail actually looks like.
    if (jointX < 1.2 + damage * 1.6 || jointY < 1.2 + damage * 1.6) {
      const damp = (0.72 + smoothNoise(x, y, 3, 11) * 0.5) * (1 - damage * 0.4);
      return [mortar[0] * damp, mortar[1] * damp, mortar[2] * damp];
    }

    const blockSeed = blockX * 7 + course * 13;
    const tone = 0.84 + valueNoise(blockX, course, 5) * 0.34;
    const grain = 0.9 + smoothNoise(x, y, 2.5, blockSeed) * 0.2;
    // Lit along the top and left of each block, shadowed along the bottom and right: one convention,
    // applied per block, is all it takes for a flat grid to become a wall of separate stones.
    const lift = jointY < bevel + 1.2 ? 1.22 : jointX < bevel + 1.2 && withinX < blockWidth / 2 ? 1.12 : 1;
    const sink = withinY > courseHeight - bevel - 2 ? 0.72 : withinX > blockWidth - bevel - 2 ? 0.82 : 1;
    // Grime pools in the lower part of every course and streaks down from the joints above.
    const settle = 1 - (withinY / courseHeight) * 0.16 * (0.5 + smoothNoise(x, 0, 9, 3) * 1.2);
    let light = tone * grain * lift * sink * settle;

    if (damage > 0) {
      const bite = smoothNoise(x, y, 11, 21);
      // The main fracture opens first and widens; a second one joins it only once badly damaged.
      const fracture = Math.abs(smoothNoise(x, y * 0.35, 13, 31) - 0.5);
      const branch = Math.abs(smoothNoise(y, x * 0.4, 17, 47) - 0.5);

      if (fracture < 0.012 + damage * 0.05 || (damage > 0.6 && branch < (damage - 0.6) * 0.09)) {
        light *= 0.3;
      } else if (bite > 0.82 - damage * 0.16) {
        light *= 0.58 + (bite - (0.82 - damage * 0.16)) * 1.4;
      }

      // Dust ground into the whole face as it loses integrity.
      light *= 1 - damage * 0.12;
    }

    return [base[0] * light, base[1] * light, base[2] * light];
  });
}

/** Old timber: separate boards, deep gaps between them, knots, and iron banding. */
function timber(documentOwner: Document, damage: number): HTMLCanvasElement {
  const boards = 4;
  const boardWidth = TEXTURE_SIZE / boards;

  return paint(documentOwner, (x, y) => {
    const board = Math.floor(x / boardWidth);
    const withinX = x % boardWidth;
    const edge = Math.min(withinX, boardWidth - withinX);
    const tone = 0.82 + valueNoise(board, 0, 17) * 0.3;
    // Grain runs the length of the board, stretched hard in y so it reads as timber and not as noise.
    const grain = 0.88 + smoothNoise(x * 3.2, y * 0.35, 2, board * 5) * 0.24;
    const knotDistance = Math.hypot(withinX - boardWidth * 0.5, ((y + board * 23) % TEXTURE_SIZE) - 30);
    const knot = knotDistance < 5 ? 0.55 + knotDistance * 0.07 : 1;
    let light = tone * grain * knot;

    if (edge < 1.3) {
      light *= 0.3;
    } else if (edge < 2.6) {
      light *= withinX < boardWidth / 2 ? 1.16 : 0.78;
    }

    // Two iron bands hold the boards together; they are what a wood wall is braced by.
    const band = y > 17 && y < 24 ? 1 : y > 41 && y < 48 ? 1 : 0;

    if (band === 1) {
      const across = y > 41 ? y - 41 : y - 17;
      const metal = 0.5 + smoothNoise(x, y, 3, 41) * 0.3 + (across < 2 ? 0.3 : across > 4 ? -0.16 : 0);
      return [74 * metal * 1.5, 70 * metal * 1.5, 78 * metal * 1.5];
    }

    if (damage > 0) {
      const split = Math.abs(smoothNoise(x * 0.6, y * 0.25, 9, 53) - 0.5);

      // A split opens to daylight; the pale lip either side is fresh wood torn open.
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
function flagstone(documentOwner: Document): HTMLCanvasElement {
  const slab = TEXTURE_SIZE / 2;

  return paint(documentOwner, (x, y) => {
    const slabX = Math.floor(x / slab);
    const slabY = Math.floor(y / slab);
    const withinX = x % slab;
    const withinY = y % slab;
    const jointX = Math.min(withinX, slab - withinX);
    const jointY = Math.min(withinY, slab - withinY);
    const joint = Math.min(jointX, jointY);
    // The tile edge is the cell boundary the player counts distance by, so it stays the strongest
    // line in the texture — the interior joint is deliberately drawn weaker than it.
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
    // Kept cool and fairly dark: the flat lighting model adds a warm term that rises steeply near
    // the eye, and a floor mixed any brighter than this turns pink under the player's feet.
    const light = tone * grain * damp * chip;
    return [52 * light, 44 * light, 72 * light];
  });
}

/**
 * Spilled blood, as a floor material.
 *
 * Mixed into whatever floor is underneath rather than laid over it, so the stone's own joints and
 * grain still show through a thin splash and drown under a thick one. Mottled rather than flat: an
 * even wash of red reads as a decal, and blood on stone never pools evenly.
 */
function bloodstain(documentOwner: Document): HTMLCanvasElement {
  return paint(documentOwner, (x, y) => {
    const pool = smoothNoise(x, y, 7, 83) * 0.7 + smoothNoise(x, y, 2.5, 89) * 0.3;
    const depth = 0.5 + pool * 0.8;
    // A darker rim where a pool has dried at its edge, which is the detail that sells it as fluid.
    const rim = pool > 0.62 && pool < 0.72 ? 0.68 : 1;
    return [72 * depth * rim, 12 * depth * rim, 16 * depth * rim];
  });
}

/** The vault overhead: rough, dark, and quieter than the floor so it never competes for attention. */
function vault(documentOwner: Document): HTMLCanvasElement {
  return paint(documentOwner, (x, y) => {
    const rib = Math.min(x, TEXTURE_SIZE - 1 - x, y, TEXTURE_SIZE - 1 - y);
    const rough = 0.8 + smoothNoise(x, y, 4, 71) * 0.3 + smoothNoise(x, y, 1.5, 73) * 0.12;
    const arch = 1 - Math.max(0, 1 - rib / 9) * 0.34;
    const light = rough * arch;
    return [40 * light, 32 * light, 56 * light];
  });
}

/**
 * Where a drowned body lies in a pool tile, in texels, taken in order: one body in the cell uses the
 * first entry, two use both.
 *
 * Each sits well inside the tile. A shape reaching the border appears twice over in a pool made of
 * several cells, and a body that repeats reads as wallpaper rather than as something that drowned.
 */
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

/**
 * How much of a pixel the bodies under the surface take, and how far the blood off them has spread.
 *
 * Both fall off smoothly and both are the nearest body's rather than a sum: overlapping falloffs
 * brighten where two bodies happen to be close, which is the opposite of what a body in dark water
 * does to the light.
 */
function sunkenAt(x: number, y: number, bodies: number): readonly [number, number] {
  let mass = 0;
  let bleed = 0;

  for (let index = 0; index < bodies; index += 1) {
    const body = SUNKEN_BODIES[index];

    if (!body) {
      continue;
    }

    // The outline is pushed in and out by noise, because a circle under water reads as a coin.
    const distance = wrappedDistance(x, y, body.x, body.y) * (0.86 + smoothNoise(x, y, 11, 97) * 0.3);
    mass = Math.max(mass, Math.max(0, 1 - distance / body.radius) ** 0.7);
    bleed = Math.max(bleed, Math.max(0, 1 - distance / (body.radius * 1.7)) ** 2);
  }

  return [mass, bleed];
}

/**
 * Still water, built to tile in both axes, holding however many bodies have gone under in it.
 *
 * Every wave term is a whole number of periods across the tile, so a pool spanning several cells has
 * no seam where one cell meets the next — which a pool has to survive, being made of cells. It also
 * deliberately carries no bright cell-boundary edge, unlike the walkable floor: counting squares is
 * how the player judges distance on ground they can cross, and this is ground they cannot.
 *
 * The bodies belong in here rather than in the world for the same reason the pool does: what is
 * under a surface cannot be drawn as a sprite standing on it.
 */
function stillWater(documentOwner: Document, bodies: number): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const turn = (Math.PI * 2) / TEXTURE_SIZE;
  // Each body clouds the whole cell, so a fouled pool reads as dirtier water from further off than
  // the shape in it can be made out from.
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
        // Never brighter than the surface it is seen through: the body is lit by how close to the
        // top of the water it floats, which is what makes a shape read as submerged rather than
        // painted on.
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

/**
 * A filled pool: bodies heaped to the surface, and the ground the player now walks over them.
 *
 * Carries the bright cell edge the flagstones have and the water deliberately does not. That edge is
 * how distance is counted on ground you can cross, and the whole point of a filled pool is that it
 * has become ground you can cross. These bodies do reach the tile border, unlike the sunken ones:
 * the heap is meant to run continuously across every cell of a pool that has closed over.
 */
function carrion(documentOwner: Document): HTMLCanvasElement {
  return paint(documentOwner, (x, y) => {
    const cellEdge = Math.min(x, TEXTURE_SIZE - 1 - x, y, TEXTURE_SIZE - 1 - y);

    if (cellEdge < 1) {
      return [72, 56, 92];
    }

    // The body nearest the surface is the one that takes the pixel, so the heap reads as a pile
    // with things behind it rather than as one flat silhouette.
    let crown = 0;

    for (const body of PACKED_BODIES) {
      const distance = wrappedDistance(x, y, body.x, body.y) * (0.86 + smoothNoise(x, y, 9, 113) * 0.28);

      if (distance >= body.radius) {
        continue;
      }

      crown = Math.max(crown, Math.sqrt(1 - (distance / body.radius) ** 2));
    }

    if (crown <= 0) {
      // Between them: what is left of the water, thick with everything that has come off the pile.
      const grime = 0.7 + smoothNoise(x, y, 3, 131) * 0.5;
      return [30 * grime, 24 * grime, 32 * grime];
    }

    const light = (0.46 + crown * 0.66) * (0.9 + smoothNoise(x, y, 2.5, 137) * 0.22);
    return [76 * light, 94 * light, 60 * light];
  });
}

/** Builds deterministic small procedural textures once per renderer. */
export function createProceduralTextures(documentOwner: Document): TextureSet {
  return {
    walls: {
      stoneWall: masonry(documentOwner, "#4a3c57", "#21152e", 4, 4),
      oldBrickWall: masonry(documentOwner, "#613a49", "#241427", 8, 4),
      ironBarWall: ironBars(documentOwner),
      doorRed: door(documentOwner, "#742f43", "#c46b62"),
      doorBlue: door(documentOwner, "#304c75", "#6d9bc2"),
      doorYellow: door(documentOwner, "#80632e", "#d0ae58"),
      breakableWall: breakable(documentOwner),
      demoFoundation: ashlar(documentOwner, [58, 48, 72], [22, 17, 32], 4, 0),
      demoAshlar: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, 0),
      demoAshlarWorn: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, 0.34),
      demoAshlarCracked: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, 0.68),
      demoAshlarFailing: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, 1),
      woodWall: timber(documentOwner, 0),
      woodWallCracked: timber(documentOwner, 0.55),
      splinteredWoodWall: timber(documentOwner, 1),
    },
    // The floor carries the cell count the player navigates by, so its seam is the readable one.
    // The ceiling is never counted against and keeps its seam near the base colour to stay quiet.
    floor: plane(documentOwner, "#281e31", "#54406a", "#33253e"),
    ceiling: plane(documentOwner, "#191321", "#2f2440", "#211a2b"),
    floors: {
      water: stillWater(documentOwner, 0),
      waterFouled: stillWater(documentOwner, 1),
      waterChoked: stillWater(documentOwner, 2),
      demoCarrion: carrion(documentOwner),
      demoFlagstone: flagstone(documentOwner),
      demoVault: vault(documentOwner),
      demoBlood: bloodstain(documentOwner),
    },
  };
}
