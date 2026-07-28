/**
 * The demo's own first-person hands and melee flourish.
 *
 * The shipped viewmodel is one baked image of a torch in the left hand and a sword in the right,
 * with a pre-drawn slash sprite over it. The demo needs the left hand free to show whatever is being
 * carried, so it turns that whole layer off in the renderer and paints this instead: the right half
 * of the shipped artwork for the sword arm, the carried object where the torch used to be, and a
 * slash drawn live rather than blitted. A throw gets an arm motion and no slash at all.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { slimeBody } from "@/demo/demo-scene";
import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { SWING_SECONDS, type DemoWorld } from "@/demo/world";
import type { PresentationImages } from "@/presentation/presentation-image-loader";

/** The shipped viewmodel is 512 square with the torch arm left of centre and the sword arm right. */
const VIEWMODEL_SOURCE_SIZE = 512;

/**
 * Where each melee form's arc begins and ends, in radians around a centre below the screen.
 *
 * Four shapes rather than one, cycled by the caller. A single arc replayed at every press is the
 * thing that made the attack read as a twitch: the eye learns it in two swings and then stops
 * seeing it. These differ in direction, length and speed, and the chop and thrust barely arc at all.
 */
const SWING_ARCS: Readonly<Record<string, Readonly<{ from: number; to: number; sweep: number }>>> = {
  slash: { from: -Math.PI * 0.12, to: -Math.PI * 0.9, sweep: 0.42 },
  backhand: { from: -Math.PI * 0.92, to: -Math.PI * 0.08, sweep: 0.38 },
  chop: { from: -Math.PI * 0.72, to: -Math.PI * 0.34, sweep: 0.62 },
  thrust: { from: -Math.PI * 0.54, to: -Math.PI * 0.46, sweep: 0.2 },
};

function easeOut(progress: number): number {
  return 1 - (1 - progress) * (1 - progress);
}

/**
 * The captured slime, squirming in the fist — the same ring-stack body the world draws, in screen
 * space. It struggles on a cycle: gathers itself, strains upward, sags back.
 */
function drawHeldSlime(
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  unit: number,
  appearance: EnemyAppearanceId,
  elapsedSeconds: number,
): void {
  const body = slimeBody(appearance);
  const struggle = Math.max(0, Math.sin(elapsedSeconds * 2.1)) * Math.abs(Math.sin(elapsedSeconds * 8));
  const radius = unit * 0.4 * (body.radius / 0.3);
  const height = unit * 0.52 * (body.height / 0.46) * (1 + struggle * 0.18);
  const rings = 10;
  context.save();
  context.translate(centreX, centreY + unit * 0.16);
  context.rotate(-0.12 + Math.sin(elapsedSeconds * 1.7) * 0.03);

  for (let ring = 0; ring < rings; ring += 1) {
    const h = ring / (rings - 1);
    const profile = Math.sqrt(Math.max(0, 1 - h * h)) * (1 - 0.12 * h) + 0.05;
    const wobble = 1 + Math.sin(elapsedSeconds * 9 + h * 5) * (0.05 + struggle * 0.07);
    const rx = radius * profile * wobble * (1 - struggle * 0.12);
    const ry = Math.max(1, rx * 0.4);
    // Matched to how dark the shipped viewmodel already reads, like the carried props are.
    const shade = (0.5 + 0.42 * h) * 0.86;
    context.fillStyle = `rgb(${(body.color[0] * shade) | 0}, ${(body.color[1] * shade) | 0}, ${
      (body.color[2] * shade) | 0
    })`;
    context.beginPath();
    context.ellipse(0, -h * height, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(255, 255, 255, 0.14)";
  context.beginPath();
  context.ellipse(-radius * 0.25, -height * 0.68, radius * 0.32, radius * 0.14, -0.3, 0, Math.PI * 2);
  context.fill();

  // Cross about being carried: squeezed eyes and a small complaining mouth.
  const faceY = -height * 0.5;
  const eye = Math.max(1.5, radius * 0.13);
  const eyeGap = radius * 0.4;
  context.fillStyle = "rgb(26, 15, 30)";
  context.fillRect(-eyeGap - eye, faceY - eye * 0.45, eye * 2, eye * 0.9);
  context.fillRect(eyeGap - eye, faceY - eye * 0.45, eye * 2, eye * 0.9);
  context.beginPath();
  context.ellipse(0, faceY + eye * 2.2, eye * 0.8, eye * 1, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSlash(
  context: CanvasRenderingContext2D,
  progress: number,
  kind: string,
  aim: Readonly<{ x: number; y: number }> | undefined,
  impact: number,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const shape = SWING_ARCS[kind] ?? SWING_ARCS.slash;

  if (!shape) {
    return;
  }

  // The arc is hung off the point the swing actually landed on. Without this every attack sweeps
  // the same patch of screen no matter where the thing you hit was standing.
  const aimX = aim ? clamp(aim.x, width * 0.1, width * 0.9) : width * 0.5;
  const aimY = aim ? clamp(aim.y, height * 0.1, height * 0.86) : height * 0.42;
  const centreX = width * 0.52 + (aimX - width * 0.5) * 0.55;
  const centreY = height * 1.22 + (aimY - height * 0.45) * 0.4;
  const radius = Math.max(height * 0.42, Math.hypot(aimX - centreX, aimY - centreY));
  const sweep = shape.to - shape.from;
  const head = shape.from + sweep * easeOut(progress);
  // Bright the moment it lands, gone almost immediately after — a slash that lingers reads as a
  // held pose rather than a strike.
  const envelope = Math.sin(Math.PI * Math.min(1, progress * 1.15)) * (1 + impact * 0.5);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (let layer = 0; layer < 5; layer += 1) {
    const spread = layer / 4;
    // The tail trails the head whichever way the sweep runs, so the two angles are ordered rather
    // than assumed: an unordered pair draws the long way round the circle.
    const tail = head - sweep * shape.sweep * (0.3 + 0.7 * spread);
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * How the sword arm moves for each form.
 *
 * Rotation, lateral travel and lift, all as fractions of the frame — one row per form, so adding a
 * fifth is a line here rather than another branch in the drawing code.
 */
function armPose(
  kind: string,
  arc: number,
  aimBias: number,
): Readonly<{ rotate: number; shiftX: number; shiftY: number; scale: number }> {
  if (kind === "throw") {
    return { rotate: arc * 0.05, shiftX: 0, shiftY: arc * 0.09, scale: 1 + arc * 0.06 };
  }

  if (kind === "backhand") {
    return { rotate: arc * 0.2, shiftX: arc * -0.1 + aimBias * 0.04, shiftY: arc * 0.01, scale: 1 };
  }

  if (kind === "chop") {
    // Rises first, then comes down hard: the lift is what tells you the heavy one is coming.
    return {
      rotate: arc * -0.06,
      shiftX: aimBias * 0.05,
      shiftY: arc * 0.12 - Math.sin(arc * Math.PI) * 0.04,
      scale: 1 + arc * 0.05,
    };
  }

  if (kind === "thrust") {
    return { rotate: arc * -0.02, shiftX: aimBias * 0.03, shiftY: arc * 0.05, scale: 1 + arc * 0.16 };
  }

  return { rotate: arc * -0.16, shiftX: arc * 0.07 + aimBias * 0.04, shiftY: 0, scale: 1 };
}

/** Paints the demo hands over an already-rendered frame. */
export function drawDemoViewmodel(
  context: CanvasRenderingContext2D,
  images: PresentationImages,
  world: DemoWorld,
  aim?: Readonly<{ x: number; y: number }>,
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
  // A connected hit stops the arm dead for an instant rather than following through.
  const hitch = world.impact * 0.4;
  const aimBias = aim ? clamp((aim.x - width * 0.5) / (width * 0.5), -1, 1) : 0;
  const pose = armPose(world.swingKind, arc * (1 - hitch), aimBias);

  if (arm) {
    context.save();
    context.translate(width / 2 + pose.shiftX * width, height + bob + pose.shiftY * height);
    context.rotate(pose.rotate);
    context.drawImage(
      arm,
      VIEWMODEL_SOURCE_SIZE / 2,
      0,
      VIEWMODEL_SOURCE_SIZE / 2,
      VIEWMODEL_SOURCE_SIZE,
      0,
      -viewSize * 0.8 * pose.scale,
      (viewSize / 2) * pose.scale,
      viewSize * pose.scale,
    );
    context.restore();
  }

  const held = world.held;

  if (held) {
    const unit = viewSize * 0.34;
    const sway = Math.sin(world.elapsedSeconds * 1.7) * 0.025;
    const centreX = width * 0.215;
    const centreY = height * 0.92 + bob * 1.6;
    drawFist(context, centreX, centreY, unit);

    if (held.kind === "enemy") {
      drawHeldSlime(
        context,
        centreX + unit * 0.02,
        centreY - unit * 0.34,
        unit,
        held.enemy.appearance,
        world.elapsedSeconds,
      );
    } else {
      const carried = images.get(DEMO_ASSET_IDS[held.prop]);

      if (carried) {
        context.save();
        context.translate(centreX + unit * 0.02, centreY - unit * 0.34);
        context.rotate(-0.18 + sway);
        // Matched to how dark the shipped viewmodel already reads, so the carried thing does not
        // glow against the arm holding it.
        context.filter = "brightness(0.86) saturate(0.92)";
        context.drawImage(carried, -unit * 0.5, -unit * 0.5, unit, unit);
        context.restore();
      }
    }
  }

  // A thrust has no arc worth drawing — the whole read is the arm going forward — so it gets a
  // flash at the aim point instead of a sweep.
  if (active && !throwing && world.swingKind !== "thrust") {
    drawSlash(context, progress, world.swingKind, aim, world.impact);
  }

  if (active && world.swingKind === "thrust" && aim) {
    const punch = Math.sin(progress * Math.PI) * (0.4 + world.impact * 0.6);
    const flash = context.createRadialGradient(aim.x, aim.y, 0, aim.x, aim.y, height * 0.16);
    flash.addColorStop(0, `rgba(255, 248, 214, ${punch * 0.7})`);
    flash.addColorStop(1, "rgba(255, 150, 60, 0)");
    context.save();
    context.globalCompositeOperation = "lighter";
    context.fillStyle = flash;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  drawCarriedLight(context, world.elapsedSeconds);
}

/**
 * A warm wash rising from the bottom of the frame.
 *
 * The demo took the torch out of the left hand so that hand could hold things, but the world is
 * still lit as though the player were carrying one. This is what puts the light source back in the
 * picture: not a flame to look at, just the glow it would be throwing on everything near the eye.
 */
function drawCarriedLight(context: CanvasRenderingContext2D, elapsedSeconds: number): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const flicker = 0.88 + Math.sin(elapsedSeconds * 9.7) * 0.07 + Math.sin(elapsedSeconds * 3.3) * 0.05;
  const glow = context.createRadialGradient(
    width * 0.5,
    height * 1.06,
    height * 0.05,
    width * 0.5,
    height * 1.06,
    height * 0.86,
  );
  glow.addColorStop(0, `rgba(255, 172, 96, ${0.2 * flicker})`);
  glow.addColorStop(0.45, `rgba(255, 138, 62, ${0.08 * flicker})`);
  glow.addColorStop(1, "rgba(255, 120, 40, 0)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.restore();
}
