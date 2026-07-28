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
  rock: "demo.rock",
  bomb: "demo.bomb",
  ammoPile: "demo.ammoPile",
  debris: "demo.debris",
  exit: "demo.exit",
  entrance: "demo.entrance",
  altar: "demo.altar",
  altarSpent: "demo.altarSpent",
  blast: "demo.blast",
  spark: "demo.spark",
  warnShoot: "demo.warnShoot",
  warnCharge: "demo.warnCharge",
  laneMarker: "demo.laneMarker",
  bubble: "demo.bubble",
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

function bomb(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const gradient = context.createRadialGradient(210, 210, 20, 256, 268, 190);
  gradient.addColorStop(0, "#ff8a72");
  gradient.addColorStop(0.45, "#d02d34");
  gradient.addColorStop(1, "#6b1119");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(256, 268, 172, 172, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgb(255 226 200 / 55%)";
  context.beginPath();
  context.ellipse(198, 200, 48, 32, -0.6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#3a2413";
  context.fillRect(236, 74, 40, 44);
  context.strokeStyle = "#c8a06a";
  context.lineWidth = 13;
  context.beginPath();
  context.moveTo(256, 78);
  context.bezierCurveTo(300, 34, 344, 62, 336, 20);
  context.stroke();
  const fuseGlow = context.createRadialGradient(336, 20, 0, 336, 20, 54);
  fuseGlow.addColorStop(0, "rgb(255 250 210 / 95%)");
  fuseGlow.addColorStop(1, "rgb(255 130 40 / 0%)");
  context.fillStyle = fuseGlow;
  context.beginPath();
  context.arc(336, 20, 54, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

function altar(spent: boolean): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "#1d1526";
  context.beginPath();
  context.ellipse(256, 430, 190, 54, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#4b4157";
  context.beginPath();
  context.roundRect(146, 250, 220, 190, 12);
  context.fill();
  context.fillStyle = "#5d5169";
  context.beginPath();
  context.roundRect(118, 214, 276, 56, 10);
  context.fill();
  context.fillStyle = "#6d6079";
  context.beginPath();
  context.roundRect(160, 120, 192, 100, 10);
  context.fill();

  if (spent) {
    context.strokeStyle = "#2b2233";
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(178, 132);
    context.lineTo(258, 214);
    context.lineTo(206, 240);
    context.stroke();
    return canvas;
  }

  const glow = context.createRadialGradient(256, 168, 8, 256, 168, 130);
  glow.addColorStop(0, "rgb(255 246 206 / 95%)");
  glow.addColorStop(0.4, "rgb(233 176 96 / 60%)");
  glow.addColorStop(1, "rgb(233 176 96 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 168, 130, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fdf3d8";
  context.font = "bold 96px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("✦", 256, 174);
  return canvas;
}

function blast(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const fire = context.createRadialGradient(256, 256, 20, 256, 256, 250);
  fire.addColorStop(0, "rgb(255 252 226 / 96%)");
  fire.addColorStop(0.3, "rgb(255 176 62 / 88%)");
  fire.addColorStop(0.66, "rgb(226 74 40 / 62%)");
  fire.addColorStop(1, "rgb(120 24 20 / 0%)");
  context.fillStyle = fire;
  context.beginPath();
  context.arc(256, 256, 250, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

function spark(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 4, 256, 256, 210);
  glow.addColorStop(0, "rgb(240 252 255 / 98%)");
  glow.addColorStop(0.32, "rgb(143 212 240 / 82%)");
  glow.addColorStop(1, "rgb(86 152 220 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 210, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

function bubble(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "rgb(196 232 248 / 62%)";
  context.beginPath();
  context.arc(256, 256, 120, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgb(255 255 255 / 72%)";
  context.beginPath();
  context.arc(212, 214, 34, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** The floating "it is about to do the thing" marker. Colour is the whole message. */
function warning(color: string, glyph: string): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 10, 256, 256, 220);
  glow.addColorStop(0, `${color}f0`);
  glow.addColorStop(0.5, `${color}70`);
  glow.addColorStop(1, `${color}00`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 220, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff8e8";
  context.font = "bold 300px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 256, 268);
  return canvas;
}

/** One chevron of the strip a charger paints down the lane it is about to run. */
function laneMarker(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "rgb(226 88 95 / 72%)";
  context.beginPath();
  context.moveTo(256, 96);
  context.lineTo(430, 300);
  context.lineTo(340, 300);
  context.lineTo(340, 420);
  context.lineTo(172, 420);
  context.lineTo(172, 300);
  context.lineTo(82, 300);
  context.closePath();
  context.fill();
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
  merged.set(DEMO_ASSET_IDS.rock, rock(150));
  merged.set(DEMO_ASSET_IDS.bomb, bomb());
  merged.set(DEMO_ASSET_IDS.ammoPile, spikePile());
  merged.set(DEMO_ASSET_IDS.debris, rockPile());
  merged.set(DEMO_ASSET_IDS.exit, marker("#2f6b46", "#7fd8a2", "↑"));
  merged.set(DEMO_ASSET_IDS.entrance, marker("#4a3060", "#a789d4", "↓"));
  merged.set(DEMO_ASSET_IDS.altar, altar(false));
  merged.set(DEMO_ASSET_IDS.altarSpent, altar(true));
  merged.set(DEMO_ASSET_IDS.blast, blast());
  merged.set(DEMO_ASSET_IDS.spark, spark());
  merged.set(DEMO_ASSET_IDS.bubble, bubble());
  merged.set(DEMO_ASSET_IDS.warnShoot, warning("#5aa8e0", "!"));
  merged.set(DEMO_ASSET_IDS.warnCharge, warning("#e2585f", "!"));
  merged.set(DEMO_ASSET_IDS.laneMarker, laneMarker());
  return merged;
}
