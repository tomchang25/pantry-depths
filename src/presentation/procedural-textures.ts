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
  spalled: boolean,
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

    if (jointX < 1.2 || jointY < 1.2) {
      const damp = 0.72 + smoothNoise(x, y, 3, 11) * 0.5;
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

    if (spalled) {
      const bite = smoothNoise(x, y, 11, 21);
      const fracture = Math.abs(smoothNoise(x, y * 0.35, 13, 31) - 0.5);

      if (fracture < 0.035) {
        light *= 0.34;
      } else if (bite > 0.74) {
        light *= 0.6 + (bite - 0.74) * 1.4;
      }
    }

    return [base[0] * light, base[1] * light, base[2] * light];
  });
}

/** Old timber: separate boards, deep gaps between them, knots, and iron banding. */
function timber(documentOwner: Document, splintered: boolean): HTMLCanvasElement {
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

    if (splintered) {
      const split = Math.abs(smoothNoise(x * 0.6, y * 0.25, 9, 53) - 0.5);

      if (split < 0.045) {
        return [26, 16, 12];
      }

      if (split < 0.075) {
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
 * Still water, built to tile in both axes.
 *
 * Every wave term is a whole number of periods across the tile, so a pool spanning several cells has
 * no seam where one cell meets the next — which a pool has to survive, being made of cells. It also
 * deliberately carries no bright cell-boundary edge, unlike the walkable floor: counting squares is
 * how the player judges distance on ground they can cross, and this is ground they cannot.
 */
function stillWater(documentOwner: Document): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  const image = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const turn = (Math.PI * 2) / TEXTURE_SIZE;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const ripple =
        Math.sin(x * turn * 2 + Math.sin(y * turn) * 1.6) * 0.5 +
        Math.sin(y * turn * 3 - Math.cos(x * turn) * 1.1) * 0.5;
      const sheen = Math.max(0, ripple) ** 2;
      const index = (y * TEXTURE_SIZE + x) * 4;
      image.data[index] = 14 + sheen * 46;
      image.data[index + 1] = 38 + sheen * 74;
      image.data[index + 2] = 58 + sheen * 92;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return surface;
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
      demoFoundation: ashlar(documentOwner, [58, 48, 72], [22, 17, 32], 4, false),
      demoAshlar: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, false),
      demoSpalledAshlar: ashlar(documentOwner, [104, 72, 84], [34, 20, 34], 6, true),
      woodWall: timber(documentOwner, false),
      splinteredWoodWall: timber(documentOwner, true),
    },
    // The floor carries the cell count the player navigates by, so its seam is the readable one.
    // The ceiling is never counted against and keeps its seam near the base colour to stay quiet.
    floor: plane(documentOwner, "#281e31", "#54406a", "#33253e"),
    ceiling: plane(documentOwner, "#191321", "#2f2440", "#211a2b"),
    floors: {
      water: stillWater(documentOwner),
      demoFlagstone: flagstone(documentOwner),
      demoVault: vault(documentOwner),
    },
  };
}
