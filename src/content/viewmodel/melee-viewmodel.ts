/**
 * The first-person sword arm, drawn rather than baked.
 *
 * Everything here is vector work against a fixed 720x405 stage. Nothing in it loads an image, reads a
 * clock, or knows what a dungeon is, which is what lets the debug lab and the demo show the same arm:
 * the lab draws it over a painted corridor to tune the poses, the demo scales the whole stage onto its
 * own backing store and draws it over the real one.
 *
 * The illusion is three poses, not an animation. A cut goes idle -> windup -> follow-through, and the
 * sword is *not drawn at all* across the middle of it — what the eye follows there is the arc, and a
 * blade drawn under the arc only ever contradicts it. That is why a swing reads as fast while lasting
 * long enough to see; it is also why the stage is a stage. Every number below was tuned against these
 * proportions, so they are held in this one space and scaled at the edge rather than re-derived per
 * caller.
 */

/** The space every coordinate in this module lives in. Callers scale it onto whatever they have. */
export const MELEE_VIEW_WIDTH = 720;
export const MELEE_VIEW_HEIGHT = 405;

/**
 * How long one cut takes, in seconds.
 *
 * Part of the drawing rather than of any one caller: a lab that previewed one duration while the game
 * played another would be a lab for something the game does not do. Both read this.
 *
 * The poses were authored at 0.767 and that is still where they are clearest, but clarity was never
 * the only thing being paid for — a swing is also how fast the floor empties, and three quarters of a
 * second of committed arm is a long time to stand in a room that keeps producing. This is the trade
 * taken deliberately: about a fifth off the authored pace, which the eye still resolves as three
 * distinct poses. Below roughly 0.4 it stops being a cut and becomes a flicker, and the illusion the
 * whole module is built on is gone — that is the floor, not a suggestion.
 */
export const MELEE_SWING_SECONDS = 0.6;

/**
 * Where in a swing the blade is at the target.
 *
 * The cut phase runs from here to {@link MELEE_CUT_END}; the arc is drawn across it and the sparks
 * land inside it. A caller that resolves a hit rather than only drawing one wants this number, so the
 * damage happens on the frame the sword is through the thing rather than on the frame of the press.
 */
export const MELEE_CUT_START = 0.24;
export const MELEE_CUT_END = 0.49;

const TAU = Math.PI * 2;

/**
 * How far the arc chases what was actually hit, as a fraction of the way there.
 *
 * The curves are authored crossing the middle of the stage. Sliding one the whole way to the target
 * takes its ends off the stage and the sweep stops reading as a sweep, so it goes most of the way and
 * the eye supplies the rest.
 */
const AIM_FOLLOW = 0.6;

export type MeleeViewPoint = Readonly<{ x: number; y: number }>;

export type MeleeViewmodelPose = Readonly<{
  angle: number;
  handX: number;
  handY: number;
  opacity?: number;
  scale: number;
  swordVisible?: boolean | undefined;
}>;

/** The eight cuts. One closed enumeration: the id names the pose pair *and* selects the arc. */
export type MeleeAttackId =
  | "horizontal-left-high"
  | "horizontal-left"
  | "horizontal-left-low"
  | "horizontal-right"
  | "diagonal-right"
  | "overhead"
  | "diagonal-left"
  | "thrust";

export type MeleeAttackDefinition = Readonly<{
  follow: MeleeViewmodelPose;
  /**
   * Whether the follow-through is drawn at all.
   *
   * The wide cuts end with the arm somewhere it could not have got back from, and drawing that pose
   * only announces how far it has to travel. They hide instead and the idle fades back in, which is
   * the same trick the cut itself uses and costs nothing to look at.
   */
  hideFollow?: boolean;
  id: MeleeAttackId;
  label: string;
  windup: MeleeViewmodelPose;
}>;

export type MeleeDrawOptions = Readonly<{
  /**
   * Where the swing landed, in stage coordinates. The arc and the sparks move onto it.
   *
   * Undefined leaves every effect at its authored place, which is what the lab wants: there is nothing
   * in a lab to hit.
   */
  aim?: MeleeViewPoint | undefined;
  /** How bright the effects burn. Below one for a swing that connected with nothing. */
  strength: number;
}>;

export const MELEE_IDLE_POSE: MeleeViewmodelPose = {
  angle: -0.38,
  handX: 578,
  handY: 336,
  scale: 1,
};

export const MELEE_ATTACKS: readonly MeleeAttackDefinition[] = [
  {
    follow: { angle: -1.72, handX: 128, handY: 252, scale: 1.06 },
    id: "horizontal-left-high",
    label: "高位左劈",
    windup: { angle: 0.94, handX: 642, handY: 226, scale: 0.94 },
  },
  {
    follow: { angle: -1.82, handX: 204, handY: 304, scale: 1.05 },
    id: "horizontal-left",
    label: "中位左劈",
    windup: { angle: 1.08, handX: 622, handY: 286, scale: 0.96 },
  },
  {
    follow: { angle: -2.02, handX: 154, handY: 378, scale: 1.08 },
    id: "horizontal-left-low",
    label: "低位左劈",
    windup: { angle: 1.26, handX: 658, handY: 336, scale: 0.98 },
  },
  {
    follow: { angle: 1.82, handX: 872, handY: 286, scale: 1.12 },
    hideFollow: true,
    id: "horizontal-right",
    label: "水平右劈",
    windup: { angle: -1.52, handX: 132, handY: 292, scale: 1.02 },
  },
  {
    follow: { angle: 1.28, handX: 862, handY: 106, scale: 1.12 },
    hideFollow: true,
    id: "diagonal-right",
    label: "斜右劈",
    windup: { angle: -2.12, handX: 112, handY: 382, scale: 1.02 },
  },
  {
    follow: { angle: 3.08, handX: 358, handY: 510, scale: 1.18 },
    hideFollow: true,
    id: "overhead",
    label: "直劈",
    windup: { angle: 0.58, handX: 606, handY: 142, scale: 0.94 },
  },
  {
    follow: { angle: -2.64, handX: -118, handY: 454, scale: 1.14 },
    hideFollow: true,
    id: "diagonal-left",
    label: "斜左劈",
    windup: { angle: 0.48, handX: 608, handY: 116, scale: 0.92 },
  },
  {
    follow: { angle: -1.06, handX: 520, handY: 302, scale: 0.72 },
    hideFollow: true,
    id: "thrust",
    label: "直刺",
    windup: { angle: -0.82, handX: 664, handY: 382, scale: 0.84 },
  },
];

export const MELEE_ATTACKS_BY_ID: Readonly<Record<MeleeAttackId, MeleeAttackDefinition>> = Object.fromEntries(
  MELEE_ATTACKS.map((attack) => [attack.id, attack]),
) as Readonly<Record<MeleeAttackId, MeleeAttackDefinition>>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function easeInCubic(progress: number): number {
  return progress * progress * progress;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function phaseProgress(progress: number, start: number, end: number): number {
  return clamp((progress - start) / (end - start), 0, 1);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolatePose(from: MeleeViewmodelPose, to: MeleeViewmodelPose, progress: number): MeleeViewmodelPose {
  return {
    angle: interpolate(from.angle, to.angle, progress),
    handX: interpolate(from.handX, to.handX, progress),
    handY: interpolate(from.handY, to.handY, progress),
    opacity: interpolate(from.opacity ?? 1, to.opacity ?? 1, progress),
    scale: interpolate(from.scale, to.scale, progress),
    swordVisible: to.swordVisible ?? from.swordVisible,
  };
}

function drawArm(context: CanvasRenderingContext2D, pose: MeleeViewmodelPose): void {
  const shoulder = { x: MELEE_VIEW_WIDTH + 62, y: MELEE_VIEW_HEIGHT + 82 };
  const deltaX = pose.handX - shoulder.x;
  const deltaY = pose.handY - shoulder.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const normalX = (-deltaY / distance) * 39 * pose.scale;
  const normalY = (deltaX / distance) * 39 * pose.scale;
  const sleeve = context.createLinearGradient(shoulder.x, shoulder.y, pose.handX, pose.handY);
  sleeve.addColorStop(0, "#293820");
  sleeve.addColorStop(0.52, "#617b4a");
  sleeve.addColorStop(1, "#9aad78");

  context.save();
  context.globalAlpha = pose.opacity ?? 1;
  context.fillStyle = sleeve;
  context.beginPath();
  context.moveTo(shoulder.x + normalX * 1.35, shoulder.y + normalY * 1.35);
  context.quadraticCurveTo(
    interpolate(shoulder.x, pose.handX, 0.52) + normalX,
    interpolate(shoulder.y, pose.handY, 0.52) + normalY,
    pose.handX + normalX * 0.72,
    pose.handY + normalY * 0.72,
  );
  context.lineTo(pose.handX - normalX * 0.72, pose.handY - normalY * 0.72);
  context.quadraticCurveTo(
    interpolate(shoulder.x, pose.handX, 0.52) - normalX,
    interpolate(shoulder.y, pose.handY, 0.52) - normalY,
    shoulder.x - normalX * 1.35,
    shoulder.y - normalY * 1.35,
  );
  context.closePath();
  context.fill();

  context.strokeStyle = "rgb(191 205 155 / 24%)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(shoulder.x - normalX * 0.5, shoulder.y - normalY * 0.5);
  context.quadraticCurveTo(540, 365, pose.handX - normalX * 0.28, pose.handY - normalY * 0.28);
  context.stroke();
  context.restore();
}

function drawSword(context: CanvasRenderingContext2D, pose: MeleeViewmodelPose): void {
  if (pose.swordVisible === false) {
    return;
  }

  context.save();
  context.globalAlpha = pose.opacity ?? 1;
  context.translate(pose.handX, pose.handY);
  context.rotate(pose.angle);
  context.scale(pose.scale, pose.scale);

  const blade = context.createLinearGradient(-18, 0, 18, 0);
  blade.addColorStop(0, "#6c7783");
  blade.addColorStop(0.22, "#e9f1f4");
  blade.addColorStop(0.48, "#8b99a5");
  blade.addColorStop(0.75, "#414b58");
  blade.addColorStop(1, "#1e2530");
  context.fillStyle = blade;
  context.beginPath();
  context.moveTo(-17, -70);
  context.lineTo(-13, -266);
  context.lineTo(0, -314);
  context.lineTo(13, -266);
  context.lineTo(17, -70);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgb(246 252 255 / 82%)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-12, -75);
  context.lineTo(-9, -263);
  context.lineTo(0, -304);
  context.stroke();

  const guard = context.createLinearGradient(-80, 0, 80, 0);
  guard.addColorStop(0, "#70501c");
  guard.addColorStop(0.45, "#e2b94d");
  guard.addColorStop(0.7, "#8f6726");
  guard.addColorStop(1, "#4f3616");
  context.fillStyle = guard;
  context.beginPath();
  context.roundRect(-75, -77, 150, 21, 10);
  context.fill();

  context.fillStyle = "#4d2718";
  context.beginPath();
  context.roundRect(-16, -58, 32, 86, 12);
  context.fill();

  context.strokeStyle = "#b46f35";
  context.lineWidth = 4;

  for (let wrap = -48; wrap < 22; wrap += 13) {
    context.beginPath();
    context.moveTo(-13, wrap);
    context.lineTo(13, wrap + 8);
    context.stroke();
  }

  context.fillStyle = "#d0a840";
  context.beginPath();
  context.arc(0, 35, 19, 0, TAU);
  context.fill();
  context.restore();
}

function drawHand(context: CanvasRenderingContext2D, pose: MeleeViewmodelPose): void {
  context.save();
  context.globalAlpha = pose.opacity ?? 1;
  context.translate(pose.handX, pose.handY);
  context.rotate(pose.angle * 0.22);
  context.scale(pose.scale, pose.scale);
  const glove = context.createRadialGradient(-12, -12, 2, 0, 0, 48);
  glove.addColorStop(0, "#d19a62");
  glove.addColorStop(0.55, "#9a603c");
  glove.addColorStop(1, "#563424");
  context.fillStyle = glove;
  context.beginPath();
  context.ellipse(0, 2, 40, 48, -0.15, 0, TAU);
  context.fill();
  context.strokeStyle = "rgb(76 39 26 / 58%)";
  context.lineWidth = 6;

  for (let finger = -18; finger <= 18; finger += 12) {
    context.beginPath();
    context.moveTo(finger, -23);
    context.quadraticCurveTo(finger + 7, -2, finger + 2, 23);
    context.stroke();
  }

  context.restore();
}

/** The whole arm in one pose: sleeve, sword, fist. */
export function drawMeleeViewmodel(context: CanvasRenderingContext2D, pose: MeleeViewmodelPose): void {
  drawArm(context, pose);
  drawSword(context, pose);
  drawHand(context, pose);
}

/**
 * Where a cut's arc is authored to cross, per attack.
 *
 * All eight sit near the middle of the stage, which is what makes them usable as anchors: the offset
 * from here to what was actually hit is how far the whole effect has to move.
 */
function arcAnchor(attack: MeleeAttackId): MeleeViewPoint {
  switch (attack) {
    case "horizontal-left-high":
    case "horizontal-left":
    case "horizontal-left-low":
    case "horizontal-right":
    case "diagonal-right":
      return { x: 356, y: 205 };
    case "overhead":
      return { x: 350, y: 250 };
    case "diagonal-left":
      return { x: 360, y: 220 };
    case "thrust":
      return { x: 358, y: 206 };
  }

  attack satisfies never;
  throw new Error(`melee viewmodel: no arc anchor for ${String(attack)}`);
}

/**
 * Where the effects actually go: the anchor, pulled most of the way toward what was hit.
 *
 * Clamped well inside the stage first. An arc hung off something at the very edge of the view leaves
 * the frame entirely, and an effect nobody can see is worse than one in the wrong place.
 */
function contactPoint(attack: MeleeAttackId, aim: MeleeViewPoint | undefined): MeleeViewPoint {
  const anchor = arcAnchor(attack);

  if (!aim) {
    return anchor;
  }

  const targetX = clamp(aim.x, MELEE_VIEW_WIDTH * 0.12, MELEE_VIEW_WIDTH * 0.88);
  const targetY = clamp(aim.y, MELEE_VIEW_HEIGHT * 0.1, MELEE_VIEW_HEIGHT * 0.82);
  return {
    x: anchor.x + (targetX - anchor.x) * AIM_FOLLOW,
    y: anchor.y + (targetY - anchor.y) * AIM_FOLLOW,
  };
}

/**
 * The trail, translated onto the contact point rather than redrawn through it.
 *
 * The curve, its gradient, the glow and the white core are all authored against the anchor, so moving
 * the whole coordinate space is what keeps a swing at a body on the left looking like the swing that
 * was tuned — only somewhere else. Redrawing the bezier through an arbitrary point instead would mean
 * eight curves re-derived every frame, and none of them would be the one that was approved.
 */
function drawSlashEffect(
  context: CanvasRenderingContext2D,
  attack: MeleeAttackId,
  progress: number,
  strength: number,
  contact: MeleeViewPoint,
): void {
  const anchor = arcAnchor(attack);
  const alpha = Math.sin(clamp(progress, 0, 1) * Math.PI) * strength;

  context.save();
  context.translate(contact.x - anchor.x, contact.y - anchor.y);

  const trail = context.createLinearGradient(650, 90, 90, 330);
  trail.addColorStop(0, `rgb(255 222 138 / ${alpha * 0.08})`);
  trail.addColorStop(0.45, `rgb(255 242 205 / ${alpha * 0.95})`);
  trail.addColorStop(1, `rgb(231 126 55 / ${alpha * 0.1})`);
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.strokeStyle = trail;
  context.shadowColor = `rgb(255 174 76 / ${alpha})`;
  context.shadowBlur = 22;
  context.lineWidth = 15;
  context.beginPath();

  switch (attack) {
    case "horizontal-left-high":
      context.moveTo(712, 54);
      context.bezierCurveTo(550, 52, 238, 108, -22, 220);
      break;
    case "horizontal-left":
      context.moveTo(660, 118);
      context.bezierCurveTo(540, 82, 265, 160, 82, 302);
      break;
    case "horizontal-left-low":
      context.moveTo(718, 232);
      context.bezierCurveTo(548, 224, 252, 298, -24, 408);
      break;
    case "horizontal-right":
      context.moveTo(-24, 116);
      context.bezierCurveTo(190, 70, 544, 142, 764, 286);
      break;
    case "diagonal-right":
      context.moveTo(-28, 422);
      context.bezierCurveTo(182, 352, 530, 154, 766, -24);
      break;
    case "overhead":
      context.moveTo(402, -24);
      context.bezierCurveTo(394, 94, 378, 250, 366, 432);
      break;
    case "diagonal-left":
      context.moveTo(620, -34);
      context.bezierCurveTo(522, 86, 286, 292, -52, 452);
      break;
    case "thrust":
      context.moveTo(638, 354);
      context.bezierCurveTo(566, 314, 446, 254, 358, 206);
      break;
    default:
      attack satisfies never;
      break;
  }

  context.stroke();
  context.lineWidth = 3;
  context.strokeStyle = `rgb(255 252 228 / ${alpha})`;
  context.stroke();
  context.restore();
}

/** A thrust has no sweep to follow, so what sells it is the blade itself going out to the target. */
function drawThrustEffect(
  context: CanvasRenderingContext2D,
  pose: MeleeViewmodelPose,
  progress: number,
  strength: number,
  contact: MeleeViewPoint,
): void {
  const alpha = Math.sin(clamp(progress, 0, 1) * Math.PI) * strength;
  const deltaX = contact.x - pose.handX;
  const deltaY = contact.y - pose.handY;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const normalX = (-deltaY / distance) * 16;
  const normalY = (deltaX / distance) * 16;
  const blade = context.createLinearGradient(pose.handX, pose.handY, contact.x, contact.y);
  blade.addColorStop(0, `rgb(126 148 167 / ${alpha * 0.18})`);
  blade.addColorStop(0.72, `rgb(238 247 250 / ${alpha * 0.84})`);
  blade.addColorStop(1, `rgb(255 246 204 / ${alpha})`);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = blade;
  context.shadowColor = `rgb(202 231 255 / ${alpha})`;
  context.shadowBlur = 24;
  context.beginPath();
  context.moveTo(pose.handX + normalX, pose.handY + normalY);
  context.lineTo(contact.x + 3, contact.y - 3);
  context.lineTo(pose.handX - normalX, pose.handY - normalY);
  context.closePath();
  context.fill();

  context.strokeStyle = `rgb(255 252 228 / ${alpha})`;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(pose.handX, pose.handY);
  context.lineTo(contact.x, contact.y);
  context.stroke();
  context.restore();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  contact: MeleeViewPoint,
  progress: number,
  strength: number,
): void {
  const alpha = (1 - clamp(progress, 0, 1)) * strength;
  context.save();
  context.translate(contact.x, contact.y);
  context.strokeStyle = `rgb(255 227 143 / ${alpha})`;
  context.lineWidth = 3;

  for (let spark = 0; spark < 8; spark += 1) {
    const angle = (spark / 8) * TAU + 0.18;
    const inner = 10 + progress * 18;
    const outer = 28 + progress * 54;
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }

  context.restore();
}

/**
 * One cut, at a normalized position through it.
 *
 * The caller owns the clock. Whatever drives `progress` from 0 to 1 — a lab's own timer or a world's
 * countdown — gets the same four phases: wind up, cut, hold or hide the follow-through, fade back to
 * rest.
 */
export function drawMeleeAttack(
  context: CanvasRenderingContext2D,
  attack: MeleeAttackDefinition,
  progress: number,
  options: MeleeDrawOptions,
): void {
  if (progress <= 0) {
    drawMeleeViewmodel(context, MELEE_IDLE_POSE);
    return;
  }

  if (progress < MELEE_CUT_START) {
    drawMeleeViewmodel(
      context,
      interpolatePose(MELEE_IDLE_POSE, attack.windup, easeOutCubic(progress / MELEE_CUT_START)),
    );
    return;
  }

  if (progress < MELEE_CUT_END) {
    const active = phaseProgress(progress, MELEE_CUT_START, MELEE_CUT_END);
    const cutting = interpolatePose(attack.windup, attack.follow, easeOutCubic(active));
    const contact = contactPoint(attack.id, options.aim);
    // Sleeve and fist only. The blade is deliberately absent for the whole cut: the arc is the
    // sword here, and a second sword drawn under it is what makes a swing look like it is dragging.
    drawArm(context, cutting);

    if (attack.id === "thrust") {
      drawThrustEffect(context, cutting, active, options.strength, contact);
    } else {
      drawSlashEffect(context, attack.id, active, options.strength, contact);
    }

    drawHand(context, cutting);

    if (active > 0.46) {
      drawImpact(context, contact, phaseProgress(active, 0.46, 1), options.strength);
    }

    return;
  }

  if (attack.hideFollow) {
    if (progress < 0.78) {
      return;
    }

    drawMeleeViewmodel(context, { ...MELEE_IDLE_POSE, opacity: easeInCubic(phaseProgress(progress, 0.78, 1)) });
    return;
  }

  if (progress < 0.7) {
    drawMeleeViewmodel(context, { ...attack.follow, opacity: 1 - phaseProgress(progress, 0.58, 0.7) * 0.8 });
    return;
  }

  drawMeleeViewmodel(context, { ...MELEE_IDLE_POSE, opacity: easeInCubic(phaseProgress(progress, 0.7, 1)) });
}

/**
 * The next cut, never the one just played.
 *
 * Eight attacks with no chain between them, so the only thing standing between this and a visible
 * pattern is that consecutive swings differ. Two in a row is the one repetition the eye catches.
 */
export function chooseMeleeAttack(previous: MeleeAttackId | undefined): MeleeAttackDefinition {
  const candidates = previous ? MELEE_ATTACKS.filter(({ id }) => id !== previous) : MELEE_ATTACKS;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  if (!selected) {
    throw new Error("melee viewmodel: no attack candidate is available");
  }

  return selected;
}
