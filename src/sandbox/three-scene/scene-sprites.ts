/**
 * The procedural artwork the floor is dressed with, copied into the experiment.
 *
 * A copy for the same reason the textures are: these live in the interim projection layer, which a
 * sandbox experiment may not import, and drawing an approximation instead is exactly how the first
 * build lost the atmosphere. Every drawing below is the shipped one, at the shipped size, so a puff
 * of dust here is the puff of dust the game draws.
 *
 * Cut down to what an assembled floor actually raises: the soft blobs every particle is made of, the
 * three wind-up markers, the pickups, and the few glows. The atlases and the wall mark are left
 * behind — the bodies are block models here and nothing is pinned to masonry yet.
 */

const SPRITE_SIZE = 512;

/** How many charge steps the sword marker is baked at, as one horizontal strip. */
export const WARN_BLADE_STEPS = 8;

function surface(width = SPRITE_SIZE): readonly [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = SPRITE_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("three-scene: Canvas 2D is unavailable, and every sprite is drawn with it");
  }

  return [canvas, context];
}

/** A lumpy stone with one lit facet, which is what a rock and every rock in a pile is made of. */
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

/** A soft round blob. Every particle is one of these in a different colour and size. */
function blob(red: number, green: number, blue: number, hardness: number, alpha = 1): HTMLCanvasElement {
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

function rock(): HTMLCanvasElement {
  const [canvas, context] = surface();
  stone(context, SPRITE_SIZE / 2, SPRITE_SIZE / 2 + 20, 150, "#5c5566", "#8b8298");
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

function hammer(): HTMLCanvasElement {
  const [canvas, context] = surface();
  context.save();
  context.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
  context.rotate(-0.5);
  context.fillStyle = "#58381f";
  context.fillRect(-22, -170, 44, 360);
  context.fillStyle = "#75512f";
  context.fillRect(-22, -170, 14, 360);
  context.fillStyle = "#3d2a17";
  context.fillRect(-24, 120, 48, 12);
  context.fillRect(-24, 156, 48, 12);

  const steel = context.createLinearGradient(-150, -230, 150, -140);
  steel.addColorStop(0, "#8b949e");
  steel.addColorStop(0.5, "#e4ecf4");
  steel.addColorStop(1, "#7f8790");
  context.fillStyle = steel;
  context.beginPath();
  context.moveTo(-146, -218);
  context.lineTo(-146, -140);
  context.lineTo(-52, -152);
  context.lineTo(96, -152);
  context.lineTo(126, -178);
  context.lineTo(96, -206);
  context.lineTo(-52, -206);
  context.closePath();
  context.fill();
  context.fillStyle = "#66707a";
  context.fillRect(-160, -222, 22, 88);
  context.fillStyle = "rgb(255 255 255 / 45%)";
  context.beginPath();
  context.moveTo(-140, -210);
  context.lineTo(88, -198);
  context.lineTo(88, -186);
  context.lineTo(-140, -196);
  context.closePath();
  context.fill();
  context.restore();
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

/** The player's own lightning, and the bead every arc is strung from. */
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

/** The orb a shooter throws: red, because everything that can take the player's health is red. */
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

function stunStar(): HTMLCanvasElement {
  const [canvas, context] = surface();
  const glow = context.createRadialGradient(256, 256, 12, 256, 256, 210);
  glow.addColorStop(0, "rgb(255 236 150 / 78%)");
  glow.addColorStop(1, "rgb(255 210 90 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(256, 256, 210, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff6d2";
  context.beginPath();

  for (let point = 0; point < 8; point += 1) {
    const angle = (point * Math.PI) / 4 - Math.PI / 2;
    const reach = point % 2 === 0 ? 196 : 54;
    const x = 256 + Math.cos(angle) * reach;
    const y = 256 + Math.sin(angle) * reach;

    if (point === 0) {
      context.moveTo(x, y);
      continue;
    }

    context.lineTo(x, y);
  }

  context.closePath();
  context.fill();
  return canvas;
}

/**
 * The red every wind-up marker is drawn in.
 *
 * One colour for all three, because the colour is the part read first and it should say exactly one
 * thing: something is about to hit you. Which of the three it is is carried by the shape.
 */
const WARN_RED = "#e2434b";

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

/** A shot is coming: a ring with ticks, the only shape that reads as "you are being aimed at". */
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
    context.beginPath();
    context.moveTo(256 + Math.cos(angle) * 62, 256 + Math.sin(angle) * 62);
    context.lineTo(256 + Math.cos(angle) * 186, 256 + Math.sin(angle) * 186);
    context.stroke();
  }

  context.fillStyle = "#fff2ee";
  context.beginPath();
  context.arc(256, 256, 26, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** A charge is coming: a tongue of flame, for the thing that is stoking itself. */
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
  context.fillStyle = `${WARN_RED}cc`;
  context.beginPath();
  context.moveTo(256, 232);
  context.bezierCurveTo(300, 288, 300, 330, 274, 362);
  context.bezierCurveTo(256, 382, 224, 372, 216, 340);
  context.bezierCurveTo(208, 304, 232, 274, 256, 232);
  context.fill();
  return canvas;
}

function bladePath(context: CanvasRenderingContext2D): void {
  context.beginPath();
  context.moveTo(120, 392);
  context.lineTo(360, 108);
  context.lineTo(404, 152);
  context.lineTo(172, 420);
  context.closePath();
}

function bladeGuard(context: CanvasRenderingContext2D): void {
  context.save();
  context.translate(150, 402);
  context.rotate(-Math.PI / 4);
  context.fillRect(-70, -18, 140, 36);
  context.restore();
}

/**
 * A cut is coming, and how much of the wind-up is left.
 *
 * A strip rather than one picture: the marker fills as the swing charges, and a swordsman is the one
 * attack with no other way of saying how long is left. Read by choosing a cell rather than by
 * clipping, which is all a textured quad can do.
 */
function warnBladeStrip(): HTMLCanvasElement {
  const [canvas, context] = surface(SPRITE_SIZE * WARN_BLADE_STEPS);

  for (let step = 0; step < WARN_BLADE_STEPS; step += 1) {
    context.save();
    context.translate(step * SPRITE_SIZE, 0);
    warningGlow(context);
    context.fillStyle = "#6d2028";
    bladePath(context);
    context.fill();
    bladeGuard(context);

    const filled = (step + 1) / WARN_BLADE_STEPS;
    context.save();
    bladePath(context);
    context.clip();
    context.fillStyle = "#fff2ee";
    context.fillRect(0, SPRITE_SIZE * (1 - filled), SPRITE_SIZE, SPRITE_SIZE * filled);
    context.restore();
    context.fillStyle = "#fff2ee";
    bladeGuard(context);
    context.restore();
  }

  return canvas;
}

export type SceneSpriteId =
  | "stick"
  | "rock"
  | "bomb"
  | "hammer"
  | "stickPile"
  | "rockPile"
  | "bombPile"
  | "spark"
  | "hazardOrb"
  | "bubble"
  | "stunStar"
  | "groundGlow"
  | "dropShadow"
  | "bloodDrop"
  | "stoneChip"
  | "woodChip"
  | "dustPuff"
  | "warnShoot"
  | "warnCharge"
  | "warnMelee";

export type SceneSprites = Readonly<Record<SceneSpriteId, HTMLCanvasElement>>;

/** Draws every sprite the floor can ask for, once. */
export function createSceneSprites(): SceneSprites {
  return {
    stick: stick(),
    rock: rock(),
    bomb: bomb(),
    hammer: hammer(),
    stickPile: spikePile(),
    rockPile: rockPile(),
    bombPile: bombPile(),
    spark: spark(),
    hazardOrb: hazardOrb(),
    bubble: bubble(),
    stunStar: stunStar(),
    // The four soft blobs every particle and every glow is made of, at the shipped hardness and
    // alpha. Their size is what the first build got wrong: these are drawn at the particle's own
    // world size, and a dust puff is a large soft disc rather than a point.
    groundGlow: blob(255, 214, 150, 0.18, 0.4),
    dropShadow: blob(6, 3, 12, 0.42, 0.66),
    bloodDrop: blob(128, 18, 26, 0.72),
    stoneChip: blob(122, 112, 136, 0.76),
    woodChip: blob(134, 90, 48, 0.76),
    dustPuff: blob(176, 158, 176, 0.1, 0.5),
    warnShoot: warnReticle(),
    warnCharge: warnFlame(),
    warnMelee: warnBladeStrip(),
  };
}
