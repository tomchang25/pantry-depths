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

function planks(documentOwner: Document, splintered: boolean): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = "#1d1220";
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  for (let column = 0; column < 4; column += 1) {
    const shade = column % 2 === 0 ? "#6b4526" : "#5a3820";
    context.fillStyle = shade;
    context.fillRect(column * 16 + 1, 0, 14, TEXTURE_SIZE);
    context.fillStyle = "rgb(0 0 0 / 22%)";

    for (let grain = 0; grain < 3; grain += 1) {
      context.fillRect(column * 16 + 3 + grain * 4, (column * 7 + grain * 13) % 40, 1, 26);
    }
  }

  context.fillStyle = "#3a2413";
  context.fillRect(0, 20, TEXTURE_SIZE, 3);
  context.fillRect(0, 43, TEXTURE_SIZE, 3);

  if (splintered) {
    context.strokeStyle = "#d8b184";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(20, 22);
    context.lineTo(12, 40);
    context.lineTo(30, 63);
    context.moveTo(52, 4);
    context.lineTo(42, 30);
    context.lineTo(56, 52);
    context.stroke();
  }

  noise(context, 0.1);
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
      woodWall: planks(documentOwner, false),
      splinteredWoodWall: planks(documentOwner, true),
    },
    // The floor carries the cell count the player navigates by, so its seam is the readable one.
    // The ceiling is never counted against and keeps its seam near the base colour to stay quiet.
    floor: plane(documentOwner, "#281e31", "#54406a", "#33253e"),
    ceiling: plane(documentOwner, "#191321", "#2f2440", "#211a2b"),
    floors: { water: stillWater(documentOwner) },
  };
}
