import type { RenderSurfaceMaterial } from "@/presentation/render-scene";

export type TextureSet = Readonly<{
  walls: Readonly<Record<RenderSurfaceMaterial, HTMLCanvasElement>>;
  floor: HTMLCanvasElement;
  ceiling: HTMLCanvasElement;
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

function plane(documentOwner: Document, base: string, line: string): HTMLCanvasElement {
  const [surface, context] = canvas(documentOwner);
  context.fillStyle = base;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.strokeStyle = line;
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, 31, 31);
  context.strokeRect(32.5, 32.5, 31, 31);
  context.strokeRect(32.5, 0.5, 31, 31);
  context.strokeRect(0.5, 32.5, 31, 31);
  noise(context);
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
    },
    floor: plane(documentOwner, "#281e31", "#3c2c46"),
    ceiling: plane(documentOwner, "#191321", "#2a2034"),
  };
}
