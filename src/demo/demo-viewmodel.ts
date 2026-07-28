/**
 * The demo's own first-person hands and melee flourish.
 *
 * The shipped viewmodel is one baked image of a torch in the left hand and a sword in the right,
 * with a pre-drawn slash sprite over it. The demo needs the left hand free to show whatever is being
 * carried, so it turns that whole layer off in the renderer and paints this instead: the right half
 * of the shipped artwork for the sword arm, the carried object where the torch used to be, and a
 * slash drawn live rather than blitted. A throw gets an arm motion and no slash at all.
 */

import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { SWING_SECONDS, type DemoWorld } from "@/demo/world";
import type { PresentationImages } from "@/presentation/presentation-image-loader";

/** The shipped viewmodel is 512 square with the torch arm left of centre and the sword arm right. */
const VIEWMODEL_SOURCE_SIZE = 512;

// Right-handed, so the blade travels from the upper right down across to the left.
const SLASH_START = -Math.PI * 0.12;
const SLASH_END = -Math.PI * 0.9;

function easeOut(progress: number): number {
  return 1 - (1 - progress) * (1 - progress);
}

function heldAssetId(world: DemoWorld): string | undefined {
  const held = world.held;

  if (!held) {
    return undefined;
  }

  if (held.kind === "enemy") {
    return `enemy.${held.enemy.appearance}.normal`;
  }

  return DEMO_ASSET_IDS[held.prop];
}

function drawSlash(context: CanvasRenderingContext2D, progress: number): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const centreX = width * 0.52;
  const centreY = height * 1.22;
  const radius = height * 1.02;
  const sweep = SLASH_END - SLASH_START;
  const head = SLASH_START + sweep * easeOut(progress);
  // Bright the moment it lands, gone almost immediately after — a slash that lingers reads as a
  // held pose rather than a strike.
  const envelope = Math.sin(Math.PI * Math.min(1, progress * 1.15));

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (let layer = 0; layer < 5; layer += 1) {
    const spread = layer / 4;
    // The tail trails the head whichever way the sweep runs, so the two angles are ordered rather
    // than assumed: an unordered pair draws the long way round the circle.
    const tail = head - sweep * 0.42 * (0.3 + 0.7 * spread);
    context.beginPath();
    context.arc(centreX, centreY, radius * (1 - 0.06 * spread), Math.min(head, tail), Math.max(head, tail));
    context.lineWidth = height * (0.03 - 0.023 * spread);
    context.strokeStyle = `rgba(255, ${Math.round(244 - 70 * spread)}, ${Math.round(214 - 160 * spread)}, ${
      envelope * (0.92 - 0.66 * spread)
    })`;
    context.stroke();
  }

  const sparkX = centreX + Math.cos(head) * radius;
  const sparkY = centreY + Math.sin(head) * radius;
  const spark = context.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, height * 0.1);
  spark.addColorStop(0, `rgba(255, 250, 224, ${envelope * 0.85})`);
  spark.addColorStop(1, "rgba(255, 160, 60, 0)");
  context.fillStyle = spark;
  context.beginPath();
  context.arc(sparkX, sparkY, height * 0.1, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/**
 * A gloved left fist, drawn rather than cropped.
 *
 * The shipped artwork has no free left hand — its left hand is wrapped around a torch, and any crop
 * of it brings the torch along. The palette is matched to the shipped glove so the two arms read as
 * one character.
 */
function drawFist(context: CanvasRenderingContext2D, centreX: number, centreY: number, unit: number): void {
  context.save();
  context.translate(centreX, centreY);
  context.rotate(0.34);

  context.fillStyle = "#8a5a30";
  context.beginPath();
  context.roundRect(-unit * 0.1, -unit * 0.05, unit * 0.2, unit * 1.1, unit * 0.06);
  context.fill();

  context.fillStyle = "#4f6b3a";
  context.beginPath();
  context.roundRect(-unit * 0.12, -unit * 0.08, unit * 0.24, unit * 0.2, unit * 0.05);
  context.fill();

  context.fillStyle = "#c8814a";
  context.beginPath();
  context.ellipse(0, -unit * 0.2, unit * 0.145, unit * 0.13, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(122 68 32 / 65%)";
  context.lineWidth = Math.max(1, unit * 0.014);

  for (let finger = 0; finger < 3; finger += 1) {
    const y = -unit * 0.26 + finger * unit * 0.06;
    context.beginPath();
    context.moveTo(-unit * 0.1, y);
    context.lineTo(unit * 0.1, y);
    context.stroke();
  }

  context.restore();
}

/** Paints the demo hands over an already-rendered frame. */
export function drawDemoViewmodel(
  context: CanvasRenderingContext2D,
  images: PresentationImages,
  world: DemoWorld,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const viewSize = Math.min(width * 0.94, height * 1.45);
  const progress = world.swing > 0 ? 1 - world.swing / SWING_SECONDS : 0;
  const active = world.swing > 0;
  const arc = active ? Math.sin(progress * Math.PI) : 0;
  const bob = Math.sin(world.elapsedSeconds * 2.2) * height * 0.006 + world.walkBob * height * 0.017;
  const throwing = world.swingKind === "throw";
  const arm = images.get("presentation.playerViewmodel");

  if (arm) {
    context.save();
    // A throw shoves the arm down and away instead of rotating it, so the two presses never read
    // as the same animation played at different speeds.
    context.translate(width / 2, height + bob + (throwing ? arc * height * 0.09 : 0));
    context.rotate(throwing ? arc * 0.05 : arc * -0.16);
    const scale = throwing ? 1 + arc * 0.06 : 1;
    context.drawImage(
      arm,
      VIEWMODEL_SOURCE_SIZE / 2,
      0,
      VIEWMODEL_SOURCE_SIZE / 2,
      VIEWMODEL_SOURCE_SIZE,
      0,
      -viewSize * 0.8 * scale,
      (viewSize / 2) * scale,
      viewSize * scale,
    );
    context.restore();
  }

  const assetId = heldAssetId(world);
  const carried = assetId === undefined ? undefined : images.get(assetId);

  if (carried) {
    const unit = viewSize * 0.34;
    const sway = Math.sin(world.elapsedSeconds * 1.7) * 0.025;
    const centreX = width * 0.215;
    const centreY = height * 0.92 + bob * 1.6;
    drawFist(context, centreX, centreY, unit);
    context.save();
    context.translate(centreX + unit * 0.02, centreY - unit * 0.34);
    context.rotate(-0.18 + sway);
    // Matched to how dark the shipped viewmodel already reads, so the carried thing does not glow
    // against the arm holding it.
    context.filter = "brightness(0.86) saturate(0.92)";
    context.drawImage(carried, -unit * 0.5, -unit * 0.5, unit, unit);
    context.restore();
  }

  if (active && !throwing) {
    drawSlash(context, progress);
  }
}
