/**
 * The demo's own first-person arm and whatever the other hand is carrying.
 *
 * The shipped viewmodel is one baked image of a torch in the left hand and a sword in the right, with
 * a pre-drawn slash sprite over it. The demo turns that whole layer off and paints this instead: the
 * drawn eight-cut sword arm from `@/content/viewmodel/melee-viewmodel`, and the carried object where
 * the torch used to be.
 *
 * The arm itself is not this module's work — it is authored against a 720x405 stage and previewed at
 * `/debug/hud-attack-workbench`. What is here is the join: scaling that stage onto the backing store,
 * converting the point a swing landed on into stage coordinates so the arc chases it, and the second
 * hand, which the stage knows nothing about.
 *
 * Three things it deliberately does not draw. There is no hand on the carried object: what the player
 * needs from that corner is what they are holding, not whose hand is holding it, and every attempt at
 * a second fist has read as a lump of meat rather than as a hand. A throw plays no cut, because the
 * throw is the *other* hand's and the sword arm only dips. And the thrown object itself does not fly
 * out of the corner of the screen: what says a throw happened is the throw's own effects out in the
 * world, and a second copy of the object sailing across the viewmodel only competes with the real one.
 */

import type { EnemyAppearanceId } from "@/core/enemy-contract";
import {
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS_BY_ID,
  MELEE_IDLE_POSE,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
  type MeleeAttackDefinition,
  type MeleeViewPoint,
  type MeleeViewmodelPose,
} from "@/content/viewmodel/melee-viewmodel";
import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind } from "@/content/presentation/prop-display-schema";
import { slimeBody } from "@/demo/demo-scene";
import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import { bodyFootprint, type World } from "@/core/world";
import type { PresentationImages } from "@/presentation/presentation-image-loader";

/**
 * How much of the frame the sword stage covers, and where its bottom edge sits.
 *
 * The stage is anchored bottom-centre and scaled off its width, so the arm keeps the proportions it
 * was authored with whatever shape the backing store happens to be. Anything the stage draws below
 * its own bottom edge — the sleeve running back to the shoulder — leaves the frame, which is what
 * makes it an arm rather than a sword hanging in the air.
 */
const STAGE_WIDTH_FRACTION = 0.94;
const STAGE_HEIGHT_FRACTION = 1.45;

/** How each carried object fills the hand, authored beside how it looks on the floor. */
const PROP_DISPLAYS = propDisplaysByKind(parsePropDisplays(propDisplayJson));

export type DemoViewmodelModel = Pick<
  World,
  | "damageMarks"
  | "elapsedSeconds"
  | "held"
  | "impact"
  | "player"
  | "soakSeconds"
  | "swing"
  | "swingKind"
  | "swingTarget"
  | "swingTotal"
  | "walkBob"
>;

/** Where the direction arcs sit around the crosshair, and how much of the ring each one covers. */
const MARK_RADIUS_FRACTION = 0.17;
const MARK_HALF_ANGLE = 0.4;
const MARK_THICKNESS_FRACTION = 0.028;

/**
 * Arcs around the crosshair pointing at what just hit you.
 *
 * The screen used to answer a hit with a full-frame red flash, which in a room with twenty bodies in
 * it and shots arriving from off-camera says that something happened and nothing about what to do
 * next. Every damage path already knows where the blow came from — a rule about frontal hits needed
 * it first — so the only thing missing was keeping it for a moment and drawing it.
 *
 * The bearing is recomputed from the stored world position every frame, which is the entire point:
 * turning towards the attacker has to sweep the arc up to the top of the ring and off it. A mark
 * pinned to the screen would keep pointing over the player's shoulder after they had already turned.
 *
 * Drawn here rather than in the HUD because this is the pass that runs every frame; the HUD is DOM
 * and updates when discrete state changes, which is the wrong shape for something continuously fading.
 */
function drawDamageMarks(context: CanvasRenderingContext2D, world: DemoViewmodelModel): void {
  if (world.damageMarks.length === 0) {
    return;
  }

  const width = context.canvas.width;
  const height = context.canvas.height;
  const centreX = width / 2;
  const centreY = height / 2;
  const radius = Math.min(width, height) * MARK_RADIUS_FRACTION;
  context.save();
  context.lineCap = "round";

  for (const mark of world.damageMarks) {
    const dx = mark.x - world.player.x;
    const dy = mark.y - world.player.y;

    if (Math.hypot(dx, dy) < 0.0001) {
      continue;
    }

    // Shortest turn from where the player is looking to where the blow came from, then a quarter turn
    // because screen-up is straight ahead while the canvas measures its angles from screen-right.
    const turn = Math.atan2(dy, dx) - world.player.angle;
    const bearing = Math.atan2(Math.sin(turn), Math.cos(turn)) - Math.PI / 2;
    const spent = Math.min(1, mark.age / Math.max(0.0001, mark.life));
    // Full strength for most of its life and then gone. A linear fade spends half its time too faint
    // to read, which turns a warning into a smudge.
    const strength = (1 - spent) ** 1.6 * mark.severity;
    context.strokeStyle = `rgb(255 74 66 / ${strength * 92}%)`;
    context.lineWidth = Math.min(width, height) * MARK_THICKNESS_FRACTION * (0.55 + mark.severity * 0.65);
    context.beginPath();
    context.arc(centreX, centreY, radius, bearing - MARK_HALF_ANGLE, bearing + MARK_HALF_ANGLE);
    context.stroke();
  }

  context.restore();
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
  footprint: number,
  elapsedSeconds: number,
): void {
  const body = slimeBody(appearance);
  const struggle = Math.max(0, Math.sin(elapsedSeconds * 2.1)) * Math.abs(Math.sin(elapsedSeconds * 8));
  const radius = unit * 0.4 * (footprint / 0.3);
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

/**
 * The sword arm has nothing authored for a throw, so it gets out of the way.
 *
 * A dip and a slight push toward the eye, over the resting pose. The throw itself is the object
 * leaving the other hand, and anything more than this from the sword arm competes with it.
 */
function throwPose(arc: number): MeleeViewmodelPose {
  return {
    ...MELEE_IDLE_POSE,
    handY: MELEE_IDLE_POSE.handY + arc * 34,
    scale: MELEE_IDLE_POSE.scale * (1 + arc * 0.05),
  };
}

/**
 * Places the 720x405 sword stage on the backing store.
 *
 * Bottom-centre anchored and uniformly scaled, so the arm is never stretched by the window's shape.
 *
 * The stage does not lean toward what is being hit, and used to. That lean was worth having when the
 * arc could not move: it was the only thing that made a swing to the left look like one. Now the arc
 * goes to the target itself, and the lean is left with one job it cannot do — the point it leaned
 * toward does not exist until the blade lands, so it snapped into place mid-swing and snapped back on
 * the next press. Two pops to buy a tilt the arc already conveys.
 */
function placeStage(
  context: CanvasRenderingContext2D,
  viewSize: number,
  bob: number,
): Readonly<{ originX: number; originY: number; scale: number }> {
  const scale = viewSize / MELEE_VIEW_WIDTH;
  const originX = context.canvas.width * 0.5;
  const originY = context.canvas.height + bob;
  context.translate(originX, originY);
  context.scale(scale, scale);
  context.translate(-MELEE_VIEW_WIDTH * 0.5, -MELEE_VIEW_HEIGHT);
  return { originX, originY, scale };
}

/** The inverse of {@link placeStage}, for turning a projected world point into a stage coordinate. */
function toStageSpace(
  aim: MeleeViewPoint,
  placement: Readonly<{ originX: number; originY: number; scale: number }>,
): MeleeViewPoint {
  return {
    x: (aim.x - placement.originX) / placement.scale + MELEE_VIEW_WIDTH * 0.5,
    y: (aim.y - placement.originY) / placement.scale + MELEE_VIEW_HEIGHT,
  };
}

function drawArm(
  context: CanvasRenderingContext2D,
  world: DemoViewmodelModel,
  viewSize: number,
  bob: number,
  aim: MeleeViewPoint | undefined,
  attackOverride: MeleeAttackDefinition | undefined,
): void {
  const active = world.swing > 0;
  const rawProgress = active ? 1 - world.swing / Math.max(0.0001, world.swingTotal) : 0;
  const progress = Math.max(0, rawProgress - world.impact * 0.035);

  context.save();
  const placement = placeStage(context, viewSize, bob);

  if (!active) {
    drawMeleeViewmodel(context, MELEE_IDLE_POSE);
    context.restore();
    return;
  }

  if (world.swingKind === "throw") {
    drawMeleeViewmodel(context, throwPose(Math.sin(progress * Math.PI)));
    context.restore();
    return;
  }

  // A swing that connected burns brighter than one that hit air. `impact` is already the demo's
  // measure of that and it decays on its own, so the arc inherits the hitch the camera gets.
  const connected = world.swingTarget?.connected ?? false;
  const strength = (connected ? 1 : 0.7) + world.impact * 0.5;
  drawMeleeAttack(context, attackOverride ?? MELEE_ATTACKS_BY_ID[world.swingKind], progress, {
    aim: aim ? toStageSpace(aim, placement) : undefined,
    strength,
    connected,
  });
  context.restore();
}

/** Paints the demo hands over an already-rendered frame. */
export function drawDemoViewmodel(
  context: CanvasRenderingContext2D,
  images: PresentationImages,
  world: DemoViewmodelModel,
  aim?: Readonly<{ x: number; y: number }>,
  attackOverride?: MeleeAttackDefinition,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const viewSize = Math.min(width * STAGE_WIDTH_FRACTION, height * STAGE_HEIGHT_FRACTION);
  const bob = Math.sin(world.elapsedSeconds * 2.2) * height * 0.006 + world.walkBob * height * 0.017;
  // The arm draws its own arc and its own sparks, inside the stage, so this one call is the whole
  // swing. There is no separate slash pass any more: the trail is part of the drawing it belongs to.
  drawArm(context, world, viewSize, bob, aim, attackOverride);

  const held = world.held;
  const unit = viewSize * 0.34;
  const carriedX = width * 0.215;
  const carriedY = height * 0.86 + bob * 1.6;

  if (held) {
    const sway = Math.sin(world.elapsedSeconds * 1.7) * 0.025;

    if (held.kind === "enemy") {
      drawHeldSlime(
        context,
        carriedX,
        carriedY,
        unit,
        held.enemy.appearance,
        bodyFootprint(held.enemy.archetype),
        world.elapsedSeconds,
      );
    } else {
      const carried = images.get(DEMO_ASSET_IDS[held.prop]);

      if (carried) {
        // Its own size and turn in the hand, authored per kind. Every prop used to be drawn into the
        // same square, so a stake and a bomb were carried at identical size however different they are
        // anywhere else; the numbers are tuned on the HUD workbench's carried tab.
        const display = PROP_DISPLAYS[held.prop];
        const drawn = unit * display.handScale;
        context.save();
        context.translate(carriedX, carriedY);
        context.rotate(display.handRotation + sway);
        // Matched to how dark the arm beside it reads, so the carried thing does not glow next to it.
        context.filter = "brightness(0.86) saturate(0.92)";
        context.drawImage(carried, -drawn * 0.5, -drawn * 0.5, drawn, drawn);
        context.restore();
      }
    }
  }

  drawCarriedLight(context, world.elapsedSeconds);
  // Under the damage marks, deliberately. Being healed is good news and news you can wait a moment
  // for; being hit is not, and the frame must never be the thing that hides an arc.
  drawSoakFrame(context, world);
  // Last, over everything including the arm. A warning that the thing in your hand can hide is not
  // one you can rely on in the moment it matters.
  drawDamageMarks(context, world);
}

/** How far in from the edge the soak glow reaches, as a fraction of the smaller axis. */
const SOAK_FRAME_FRACTION = 0.19;

/**
 * The four edges of the frame, as which axis they run along and which end of it they sit at.
 *
 * A table rather than four near-identical blocks: every edge is the same gradient and the same
 * rectangle with two numbers swapped, and writing that out four times is four places for one of the
 * numbers to be wrong.
 */
const SOAK_EDGES: readonly Readonly<{ far: boolean; vertical: boolean }>[] = [
  { far: false, vertical: true },
  { far: true, vertical: true },
  { far: false, vertical: false },
  { far: true, vertical: false },
];

/**
 * A green pulse around the edge of the frame while the spring is working.
 *
 * The mirror image of what a hit does, and mirrored on purpose: damage arrives as red at the edge of
 * vision, so healing arriving the same way needs no explaining. Without it the spring paid in a number
 * on a bar at the bottom of the screen — the one thing a player looking for the next body is not
 * reading — and standing in the right square felt like standing in the wrong one.
 *
 * It breathes rather than holds, so a full-health soak still reads as the room doing something while
 * the bar is saying nothing.
 */
function drawSoakFrame(context: CanvasRenderingContext2D, world: DemoViewmodelModel): void {
  if (world.soakSeconds <= 0) {
    return;
  }

  const width = context.canvas.width;
  const height = context.canvas.height;
  // Swells in over the first moment so stepping on does not slam, then breathes.
  const arrival = Math.min(1, world.soakSeconds * 2.4);
  const breath = 0.62 + Math.sin(world.soakSeconds * 4.4) * 0.38;
  const strength = arrival * (0.3 + breath * 0.42);
  const reach = Math.min(width, height) * SOAK_FRAME_FRACTION;
  context.save();
  context.globalCompositeOperation = "lighter";

  for (const edge of SOAK_EDGES) {
    const span = edge.vertical ? height : width;
    // The gradient runs inward from the edge itself, so the near end is opaque wherever the edge is.
    const from = edge.far ? span : 0;
    const to = edge.far ? span - reach : reach;
    const gradient = edge.vertical
      ? context.createLinearGradient(0, from, 0, to)
      : context.createLinearGradient(from, 0, to, 0);
    gradient.addColorStop(0, `rgba(96, 232, 132, ${strength})`);
    gradient.addColorStop(1, "rgba(96, 232, 132, 0)");
    context.fillStyle = gradient;
    context.fillRect(
      edge.vertical ? 0 : Math.min(from, to),
      edge.vertical ? Math.min(from, to) : 0,
      edge.vertical ? width : reach,
      edge.vertical ? reach : height,
    );
  }

  context.restore();
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
