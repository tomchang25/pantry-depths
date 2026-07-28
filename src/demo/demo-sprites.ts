/**
 * Procedural artwork for the demo-only props.
 *
 * The shipped sprite manifest has no stick, rock, or rubble pile, and authoring PNGs is not what a
 * demo is for. These are drawn once into offscreen canvases and merged into the loaded image map,
 * which the renderer accepts because it only ever needs a `CanvasImageSource`.
 */

import { loadPresentationImages, type PresentationImages } from "@/presentation/presentation-image-loader";

const SPRITE_SIZE = 512;

export const DEMO_ASSET_IDS = {
  stick: "demo.stick",
  smallRock: "demo.smallRock",
  bigRock: "demo.bigRock",
  spikePile: "demo.spikePile",
  rockPile: "demo.rockPile",
  exit: "demo.exit",
  entrance: "demo.entrance",
} as const;

function surface(): readonly [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("demo sprites: Canvas 2D is unavailable");
  }

  return [canvas, context];
}

function stone(
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  radius: number,
  base: string,
  light: string,
): void {
  context.fillStyle = base;
  context.beginPath();

  for (let step = 0; step < 9; step += 1) {
    const angle = (step / 9) * Math.PI * 2;
    const wobble = radius * (0.78 + ((step * 37) % 11) / 32);
    const x = centreX + Math.cos(angle) * wobble;
    const y = centreY + Math.sin(angle) * wobble * 0.88;

    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fill();
  context.fillStyle = light;
  context.beginPath();
  context.ellipse(centreX - radius * 0.24, centreY - radius * 0.3, radius * 0.36, radius * 0.24, -0.5, 0, Math.PI * 2);
  context.fill();
}

function stick(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.save();
  context.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
  context.rotate(-0.42);
  context.fillStyle = "#6b4526";
  context.fillRect(-28, -215, 56, 430);
  context.fillStyle = "#8b5c31";
  context.fillRect(-28, -215, 18, 430);
  context.fillStyle = "#3a2413";
  context.fillRect(-28, -60, 56, 10);
  context.fillRect(-28, 96, 56, 10);
  context.fillStyle = "#d8c39d";
  context.beginPath();
  context.moveTo(-28, -215);
  context.lineTo(28, -215);
  context.lineTo(4, -262);
  context.closePath();
  context.fill();
  context.restore();
  return canvas;
}

function rock(radius: number): HTMLCanvasElement {
  const [canvas, context] = surface();
  stone(context, SPRITE_SIZE / 2, SPRITE_SIZE / 2 + 20, radius, "#5c5566", "#8b8298");
  return canvas;
}

function spikePile(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "#3a2413";
  context.beginPath();
  context.ellipse(256, 400, 210, 62, 0, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 11; index += 1) {
    const x = 70 + index * 32 + ((index * 53) % 17);
    const height = 130 + ((index * 71) % 130);
    const lean = ((index % 5) - 2) * 26;
    context.fillStyle = index % 2 === 0 ? "#7a5029" : "#5f3d1f";
    context.beginPath();
    context.moveTo(x - 16, 410);
    context.lineTo(x + 16, 410);
    context.lineTo(x + lean, 410 - height);
    context.closePath();
    context.fill();
    context.fillStyle = "#d8c39d";
    context.beginPath();
    context.moveTo(x + lean, 410 - height);
    context.lineTo(x + lean - 7, 410 - height + 30);
    context.lineTo(x + lean + 7, 410 - height + 28);
    context.closePath();
    context.fill();
  }

  return canvas;
}

function rockPile(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "#241a2c";
  context.beginPath();
  context.ellipse(256, 402, 205, 60, 0, 0, Math.PI * 2);
  context.fill();
  stone(context, 150, 350, 96, "#4d4757", "#6f677e");
  stone(context, 362, 356, 88, "#544c60", "#7a7186");
  stone(context, 256, 300, 120, "#615869", "#8e849c");
  stone(context, 214, 232, 70, "#524a5e", "#7b7288");
  return canvas;
}

function marker(inner: string, outer: string, glyph: string): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = outer;
  context.beginPath();
  context.ellipse(256, 256, 236, 236, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = inner;
  context.beginPath();
  context.ellipse(256, 256, 176, 176, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fdf3d8";
  context.font = "bold 210px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 256, 268);
  return canvas;
}

/** Loads the shipped manifest and folds the demo-only procedural sprites in beside it. */
export async function loadDemoImages(): Promise<PresentationImages> {
  const shipped = await loadPresentationImages();
  const merged = new Map<string, CanvasImageSource>(shipped);
  merged.set(DEMO_ASSET_IDS.stick, stick());
  merged.set(DEMO_ASSET_IDS.smallRock, rock(96));
  merged.set(DEMO_ASSET_IDS.bigRock, rock(186));
  merged.set(DEMO_ASSET_IDS.spikePile, spikePile());
  merged.set(DEMO_ASSET_IDS.rockPile, rockPile());
  merged.set(DEMO_ASSET_IDS.exit, marker("#2f6b46", "#7fd8a2", "↑"));
  merged.set(DEMO_ASSET_IDS.entrance, marker("#4a3060", "#a789d4", "↓"));
  return merged;
}
