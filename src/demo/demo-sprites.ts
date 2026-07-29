/**
 * Procedural artwork for the demo-only props.
 *
 * The shipped sprite manifest has no stick, rock, or rubble pile, and authoring PNGs is not what a
 * demo is for. These are drawn once into offscreen canvases and merged into the loaded image map,
 * which the renderer accepts because it only ever needs a `CanvasImageSource`.
 */

import {
  SKELETON_PICKUP_ASSETS,
  SKELETON_PICKUP_URLS,
  SKELETON_SWORDSMAN_ATLAS_SIZE,
  SKELETON_SWORDSMAN_ATLAS_URLS,
} from "@/content/enemies/skeleton-swordsman-definitions";
import { loadPresentationImages, type PresentationImages } from "@/presentation/presentation-image-loader";

const SPRITE_SIZE = 512;

export const DEMO_ASSET_IDS = {
  stick: "demo.stick",
  rock: "demo.rock",
  bomb: "demo.bomb",
  axe: "demo.axe",
  stickPile: "demo.stickPile",
  rockPile: "demo.rockPile",
  bombPile: "demo.bombPile",
  exit: "demo.exit",
  entrance: "demo.entrance",
  altar: "demo.altar",
  altarSpent: "demo.altarSpent",
  blast: "demo.blast",
  spark: "demo.spark",
  hitSpark: "demo.hitSpark",
  rune: "demo.rune",
  shaft: "demo.shaft",
  groundGlow: "demo.groundGlow",
  dropShadow: "demo.dropShadow",
  bloodDrop: "demo.bloodDrop",
  stoneChip: "demo.stoneChip",
  woodChip: "demo.woodChip",
  dustPuff: "demo.dustPuff",
  hazardOrb: "demo.hazardOrb",
  warnShoot: "demo.warnShoot",
  warnCharge: "demo.warnCharge",
  warnMelee: "demo.warnMelee",
  laneDim: "demo.laneDim",
  laneHot: "demo.laneHot",
  bubble: "demo.bubble",
  wallSplat: "demo.wallSplat",
  skeletonSword: SKELETON_PICKUP_ASSETS.skeletonSword.assetId,
  skeletonSkull: SKELETON_PICKUP_ASSETS.skeletonSkull.assetId,
  skeletonFemur: SKELETON_PICKUP_ASSETS.skeletonFemur.assetId,
  skeletonFemurCracked: SKELETON_PICKUP_ASSETS.skeletonFemurCracked.assetId,
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

/** The axe as it lies on the floor and sits in the hand; in flight it is a beam instead. */
function axe(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.save();
  context.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
  context.rotate(-0.5);
  context.fillStyle = "#58381f";
  context.fillRect(-22, -190, 44, 380);
  context.fillStyle = "#75512f";
  context.fillRect(-22, -190, 14, 380);
  context.fillStyle = "#3d2a17";
  context.fillRect(-24, 120, 48, 12);
  context.fillRect(-24, 156, 48, 12);

  const steel = context.createLinearGradient(-10, -190, 150, -60);
  steel.addColorStop(0, "#9aa3ad");
  steel.addColorStop(0.5, "#e4ecf4");
  steel.addColorStop(1, "#8b949e");
  context.fillStyle = steel;
  context.beginPath();
  context.moveTo(-6, -196);
  context.quadraticCurveTo(150, -220, 176, -78);
  context.quadraticCurveTo(120, -34, -6, -46);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(6, -196);
  context.quadraticCurveTo(-138, -220, -164, -78);
  context.quadraticCurveTo(-108, -34, 6, -46);
  context.closePath();
  context.fill();
  context.fillStyle = "rgb(255 255 255 / 55%)";
  context.beginPath();
  context.moveTo(-6, -186);
  context.quadraticCurveTo(120, -200, 150, -96);
  context.lineTo(126, -92);
  context.quadraticCurveTo(100, -180, -6, -170);
  context.closePath();
  context.fill();
  context.restore();
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

/**
 * The mark a landed hit leaves: a tight core with shards thrown off it.
 *
 * Distinct from the blast gradient, which is a fireball and swallows whatever it is drawn over. What
 * a hit needs is something small and sharp enough to point at a body without hiding it.
 */
function hitSpark(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const core = context.createRadialGradient(256, 256, 0, 256, 256, 96);
  core.addColorStop(0, "rgb(255 250 226 / 96%)");
  core.addColorStop(0.4, "rgb(255 196 120 / 72%)");
  core.addColorStop(1, "rgb(255 140 60 / 0%)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(256, 256, 96, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(255 226 176 / 88%)";
  context.lineCap = "round";

  for (let shard = 0; shard < 7; shard += 1) {
    const angle = (shard / 7) * Math.PI * 2 + 0.4;
    const inner = 40 + ((shard * 37) % 30);
    const outer = inner + 90 + ((shard * 61) % 80);
    context.lineWidth = 13 - (shard % 3) * 3;
    context.beginPath();
    context.moveTo(256 + Math.cos(angle) * inner, 256 + Math.sin(angle) * inner);
    context.lineTo(256 + Math.cos(angle) * outer, 256 + Math.sin(angle) * outer);
    context.stroke();
  }

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

/**
 * The orb a shooter throws.
 *
 * Red regardless of which enemy fired it: everything that can take the player's health is red in
 * this demo, and the blue spark is the player's own lightning. Colouring a shot after the creature
 * that fired it would put an incoming projectile and a friendly effect in the same palette.
 */
function hazardOrb(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 4, 256, 256, 220);
  glow.addColorStop(0, "rgb(255 244 232 / 98%)");
  glow.addColorStop(0.24, "rgb(255 132 96 / 92%)");
  glow.addColorStop(0.58, "rgb(214 46 44 / 66%)");
  glow.addColorStop(1, "rgb(140 18 26 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 220, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** A soft round blob. Every particle is one of these in a different colour and size. */
function blob(red: number, green: number, blue: number, hardness: number, alpha = 1): () => HTMLCanvasElement {
  return () => {
    const [canvas, context] = surface();
    const glow = context.createRadialGradient(256, 256, 0, 256, 256, 240);
    glow.addColorStop(0, `rgb(${red} ${green} ${blue} / ${alpha * 100}%)`);
    glow.addColorStop(hardness, `rgb(${red} ${green} ${blue} / ${alpha * 82}%)`);
    glow.addColorStop(1, `rgb(${red} ${green} ${blue} / 0%)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(256, 256, 240, 0, Math.PI * 2);
    context.fill();
    return canvas;
  };
}

/**
 * What a body pinned to a wall turns into: a mark on the masonry, thickest at the centre, with
 * runs starting down from it.
 *
 * A wall decal rather than another blob. The blob is a stack of horizontal rings, so it can be
 * flattened into a puddle on the *floor* and cannot be flattened onto anything vertical — a body
 * spread across a wall is exactly the shape that vocabulary cannot say. The renderer already knows
 * how to hang an image on a wall face and foreshorten it as the view goes oblique, so this is drawn
 * once and hung there.
 */
function wallSplat(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const core = context.createRadialGradient(256, 236, 10, 256, 236, 210);
  core.addColorStop(0, "rgb(168 26 34 / 94%)");
  core.addColorStop(0.42, "rgb(126 18 28 / 82%)");
  core.addColorStop(0.78, "rgb(86 12 22 / 44%)");
  core.addColorStop(1, "rgb(70 10 18 / 0%)");
  context.fillStyle = core;

  // An irregular rim rather than a circle: the radius is pushed in and out around the turn, so the
  // edge reads as something that hit and spread rather than as a stamped disc.
  context.beginPath();

  for (let step = 0; step <= 48; step += 1) {
    const angle = (step / 48) * Math.PI * 2;
    const wobble = 0.72 + Math.sin(angle * 3 + 0.7) * 0.14 + Math.sin(angle * 7 + 2.1) * 0.09;
    const radius = 210 * wobble;
    const x = 256 + Math.cos(angle) * radius;
    const y = 236 + Math.sin(angle) * radius * 0.86;

    if (step === 0) {
      context.moveTo(x, y);
      continue;
    }

    context.lineTo(x, y);
  }

  context.fill();

  // Runs, and the drop at the end of each. Gravity is the one thing that tells a viewer this is on
  // a wall and not on the ground.
  context.fillStyle = "rgb(120 16 26 / 76%)";

  for (const run of [
    { x: 176, width: 15, length: 172 },
    { x: 232, width: 21, length: 232 },
    { x: 296, width: 13, length: 138 },
    { x: 336, width: 17, length: 196 },
  ]) {
    context.fillRect(run.x, 236, run.width, run.length);
    context.beginPath();
    context.arc(run.x + run.width / 2, 236 + run.length, run.width * 0.8, 0, Math.PI * 2);
    context.fill();
  }

  // A few flecks thrown clear of the main mark, which is what stops the outline reading as drawn.
  context.fillStyle = "rgb(150 22 32 / 68%)";

  for (const fleck of [
    { x: 96, y: 150, radius: 15 },
    { x: 402, y: 188, radius: 12 },
    { x: 350, y: 96, radius: 9 },
    { x: 140, y: 320, radius: 11 },
  ]) {
    context.beginPath();
    context.arc(fleck.x, fleck.y, fleck.radius, 0, Math.PI * 2);
    context.fill();
  }

  return canvas;
}

/** The rune that hangs over an unspent altar; the part of it worth seeing through a wall. */
function rune(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 8, 256, 256, 230);
  glow.addColorStop(0, "rgb(255 246 206 / 92%)");
  glow.addColorStop(0.35, "rgb(240 186 104 / 52%)");
  glow.addColorStop(1, "rgb(240 186 104 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 230, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff6d8";
  context.font = "bold 220px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("✦", 256, 262);
  return canvas;
}

/** The column of light standing in the stairwell, brightest at the floor and fading upward. */
function shaft(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const column = context.createLinearGradient(0, 512, 0, 0);
  column.addColorStop(0, "rgb(150 255 198 / 46%)");
  column.addColorStop(0.45, "rgb(120 236 178 / 18%)");
  column.addColorStop(1, "rgb(110 226 170 / 0%)");
  context.fillStyle = column;
  context.beginPath();
  // Narrower at the top, so it reads as light rising out of an opening.
  context.moveTo(150, 512);
  context.lineTo(362, 512);
  context.lineTo(306, 0);
  context.lineTo(206, 0);
  context.closePath();
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

/**
 * The red every wind-up marker is drawn in.
 *
 * One colour for all three, because the colour is the part read first and it should say exactly one
 * thing: something is about to hit you. Which of the three it is, and therefore what to do about it,
 * is carried by the shape — which survives being small and being glimpsed, and does not require the
 * player to have learned a palette.
 */
const WARN_RED = "#e2434b";

/** The glow every wind-up marker floats in, so the shape reads against a dark room. */
function warningGlow(context: CanvasRenderingContext2D): void {
  const glow = context.createRadialGradient(256, 256, 10, 256, 256, 220);
  glow.addColorStop(0, `${WARN_RED}f0`);
  glow.addColorStop(0.5, `${WARN_RED}70`);
  glow.addColorStop(1, `${WARN_RED}00`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 220, 0, Math.PI * 2);
  context.fill();
}

/** A shot is coming: a ring with ticks, which is the only shape that reads as "you are being aimed at". */
function warnReticle(): HTMLCanvasElement {
  const [canvas, context] = surface();
  warningGlow(context);
  context.strokeStyle = "#fff2ee";
  context.lineWidth = 26;
  context.beginPath();
  context.arc(256, 256, 116, 0, Math.PI * 2);
  context.stroke();
  context.lineCap = "round";

  for (let tick = 0; tick < 4; tick += 1) {
    const angle = (tick * Math.PI) / 2;
    const inner = 62;
    const outer = 186;
    context.beginPath();
    context.moveTo(256 + Math.cos(angle) * inner, 256 + Math.sin(angle) * inner);
    context.lineTo(256 + Math.cos(angle) * outer, 256 + Math.sin(angle) * outer);
    context.stroke();
  }

  context.fillStyle = "#fff2ee";
  context.beginPath();
  context.arc(256, 256, 26, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** A charge is coming: a tongue of flame, tapering upward, for the thing that is stoking itself. */
function warnFlame(): HTMLCanvasElement {
  const [canvas, context] = surface();
  warningGlow(context);
  context.fillStyle = "#fff2ee";
  context.beginPath();
  context.moveTo(256, 78);
  context.bezierCurveTo(352, 196, 372, 286, 330, 358);
  context.bezierCurveTo(300, 410, 212, 410, 182, 358);
  context.bezierCurveTo(140, 286, 168, 210, 232, 150);
  context.bezierCurveTo(222, 226, 250, 250, 256, 78);
  context.fill();
  // The cooler heart of it, so the tongue has depth instead of reading as a leaf.
  context.fillStyle = `${WARN_RED}cc`;
  context.beginPath();
  context.moveTo(256, 232);
  context.bezierCurveTo(300, 288, 300, 330, 274, 362);
  context.bezierCurveTo(256, 382, 224, 372, 216, 340);
  context.bezierCurveTo(208, 304, 232, 274, 256, 232);
  context.fill();
  return canvas;
}

/** A cut is coming: an angled edge, which is the one shape a sword makes that a flame cannot. */
function warnBlade(): HTMLCanvasElement {
  const [canvas, context] = surface();
  warningGlow(context);
  context.fillStyle = "#fff2ee";
  context.beginPath();
  context.moveTo(120, 392);
  context.lineTo(360, 108);
  context.lineTo(404, 152);
  context.lineTo(172, 420);
  context.closePath();
  context.fill();
  // A short guard across the base, so the shape is a weapon rather than a stripe.
  context.save();
  context.translate(150, 402);
  context.rotate(-Math.PI / 4);
  context.fillRect(-70, -18, 140, 36);
  context.restore();
  return canvas;
}

/**
 * One blot of the strip a charger paints down the lane it is about to run.
 *
 * A soft round blot rather than the chevron this replaced, because the strip is laid by overlapping
 * many of these along the lane and a chevron only points the right way when the lane happens to run
 * along an axis. Sprites cannot be rotated per instance and carry no per-instance opacity either,
 * which is why the dim length and the bright fill are two baked images rather than one at two
 * strengths.
 */
function laneBlot(color: string): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 40, 256, 256, 236);
  glow.addColorStop(0, color);
  glow.addColorStop(0.62, color);
  glow.addColorStop(1, "#00000000");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 236, 0, Math.PI * 2);
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

/** A nest of live bombs. Reads at a glance as the one pile you would rather not stand next to. */
function bombPile(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.fillStyle = "#2a1420";
  context.beginPath();
  context.ellipse(256, 404, 200, 58, 0, 0, Math.PI * 2);
  context.fill();

  for (const [centreX, centreY, radius] of [
    [148, 344, 82],
    [364, 350, 74],
    [256, 300, 104],
    [212, 226, 58],
  ] as const) {
    const shell = context.createRadialGradient(
      centreX - radius * 0.3,
      centreY - radius * 0.35,
      radius * 0.1,
      centreX,
      centreY,
      radius,
    );
    shell.addColorStop(0, "#ff8a72");
    shell.addColorStop(0.45, "#c92b33");
    shell.addColorStop(1, "#5f0f17");
    context.fillStyle = shell;
    context.beginPath();
    context.ellipse(centreX, centreY, radius, radius, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#c8a06a";
    context.lineWidth = radius * 0.11;
    context.beginPath();
    context.moveTo(centreX, centreY - radius);
    context.quadraticCurveTo(
      centreX + radius * 0.5,
      centreY - radius * 1.5,
      centreX + radius * 0.15,
      centreY - radius * 1.8,
    );
    context.stroke();
  }

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
  const [shipped, skeletonAtlases, skeletonPickups] = await Promise.all([
    loadPresentationImages(),
    loadPresentationImages(SKELETON_SWORDSMAN_ATLAS_URLS, undefined, {
      width: SKELETON_SWORDSMAN_ATLAS_SIZE,
      height: SKELETON_SWORDSMAN_ATLAS_SIZE,
    }),
    loadPresentationImages(SKELETON_PICKUP_URLS),
  ]);
  const merged = new Map<string, CanvasImageSource>(shipped);

  for (const [assetId, image] of [...skeletonAtlases, ...skeletonPickups]) {
    merged.set(assetId, image);
  }

  merged.set(DEMO_ASSET_IDS.stick, stick());
  merged.set(DEMO_ASSET_IDS.rock, rock(150));
  merged.set(DEMO_ASSET_IDS.bomb, bomb());
  merged.set(DEMO_ASSET_IDS.axe, axe());
  merged.set(DEMO_ASSET_IDS.stickPile, spikePile());
  merged.set(DEMO_ASSET_IDS.rockPile, rockPile());
  merged.set(DEMO_ASSET_IDS.bombPile, bombPile());
  merged.set(DEMO_ASSET_IDS.exit, marker("#2f6b46", "#7fd8a2", "↑"));
  merged.set(DEMO_ASSET_IDS.entrance, marker("#4a3060", "#a789d4", "↓"));
  merged.set(DEMO_ASSET_IDS.altar, altar(false));
  merged.set(DEMO_ASSET_IDS.altarSpent, altar(true));
  merged.set(DEMO_ASSET_IDS.blast, blast());
  merged.set(DEMO_ASSET_IDS.spark, spark());
  merged.set(DEMO_ASSET_IDS.hitSpark, hitSpark());
  merged.set(DEMO_ASSET_IDS.rune, rune());
  merged.set(DEMO_ASSET_IDS.shaft, shaft());
  merged.set(DEMO_ASSET_IDS.groundGlow, blob(255, 214, 150, 0.18, 0.4)());
  merged.set(DEMO_ASSET_IDS.dropShadow, blob(6, 3, 12, 0.42, 0.66)());
  merged.set(DEMO_ASSET_IDS.bloodDrop, blob(128, 18, 26, 0.72)());
  merged.set(DEMO_ASSET_IDS.stoneChip, blob(122, 112, 136, 0.76)());
  merged.set(DEMO_ASSET_IDS.woodChip, blob(134, 90, 48, 0.76)());
  merged.set(DEMO_ASSET_IDS.dustPuff, blob(176, 158, 176, 0.1, 0.5)());
  merged.set(DEMO_ASSET_IDS.hazardOrb, hazardOrb());
  merged.set(DEMO_ASSET_IDS.bubble, bubble());
  merged.set(DEMO_ASSET_IDS.wallSplat, wallSplat());
  merged.set(DEMO_ASSET_IDS.warnShoot, warnReticle());
  merged.set(DEMO_ASSET_IDS.warnCharge, warnFlame());
  merged.set(DEMO_ASSET_IDS.warnMelee, warnBlade());
  merged.set(DEMO_ASSET_IDS.laneDim, laneBlot("rgb(190 54 62 / 42%)"));
  merged.set(DEMO_ASSET_IDS.laneHot, laneBlot("rgb(255 122 96 / 88%)"));
  return merged;
}
