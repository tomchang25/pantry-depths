/**
 * The demo's own first-person arm and whatever the other hand is carrying.
 *
 * The shipped viewmodel is one baked image of a torch in the left hand and a sword in the right, with
 * a pre-drawn slash sprite over it. The demo turns that whole layer off and paints this instead: the
 * drawn eight-cut sword arm from `@/content/viewmodel/melee-viewmodel`, and the carried object where
 * the torch used to be.
 *
 * The arm itself is not this module's work — it is authored against a 720x405 stage and previewed at
 * `/debug/melee-viewmodel-lab`. What is here is the join: scaling that stage onto the backing store,
 * converting the point a swing landed on into stage coordinates so the arc chases it, and the second
 * hand, which the stage knows nothing about.
 *
 * Two things it deliberately does not draw. There is no hand on the carried object: what the player
 * needs from that corner is what they are holding, not whose hand is holding it, and every attempt at
 * a second fist has read as a lump of meat rather than as a hand. And a throw plays no cut, because
 * the throw is the *other* hand's — the sword arm only dips, and what animates is the object leaving.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import {
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS_BY_ID,
  MELEE_IDLE_POSE,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
  type MeleeViewPoint,
  type MeleeViewmodelPose,
} from "@/content/viewmodel/melee-viewmodel";
import { slimeBody } from "@/demo/demo-scene";
import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import type { DemoWorld } from "@/demo/world";
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
  world: DemoWorld,
  viewSize: number,
  bob: number,
  aim: MeleeViewPoint | undefined,
): void {
  const active = world.swing > 0;
  const progress = active ? 1 - world.swing / Math.max(0.0001, world.swingTotal) : 0;

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
  const strength = (world.swingTarget?.connected ? 1 : 0.7) + world.impact * 0.5;
  drawMeleeAttack(context, MELEE_ATTACKS_BY_ID[world.swingKind], progress, {
    aim: aim ? toStageSpace(aim, placement) : undefined,
    strength,
  });
  context.restore();
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
  const viewSize = Math.min(width * STAGE_WIDTH_FRACTION, height * STAGE_HEIGHT_FRACTION);
  const active = world.swing > 0;
  const progress = active ? 1 - world.swing / Math.max(0.0001, world.swingTotal) : 0;
  const bob = Math.sin(world.elapsedSeconds * 2.2) * height * 0.006 + world.walkBob * height * 0.017;
  // The arm draws its own arc and its own sparks, inside the stage, so this one call is the whole
  // swing. There is no separate slash pass any more: the trail is part of the drawing it belongs to.
  drawArm(context, world, viewSize, bob, aim);

  const held = world.held;
  const unit = viewSize * 0.34;
  const carriedX = width * 0.215;
  const carriedY = height * 0.86 + bob * 1.6;

  if (held) {
    const sway = Math.sin(world.elapsedSeconds * 1.7) * 0.025;

    if (held.kind === "enemy") {
      drawHeldSlime(context, carriedX, carriedY, unit, held.enemy.appearance, world.elapsedSeconds);
    } else {
      const carried = images.get(DEMO_ASSET_IDS[held.prop]);

      if (carried) {
        context.save();
        context.translate(carriedX, carriedY);
        context.rotate(-0.18 + sway);
        // Matched to how dark the arm beside it reads, so the carried thing does not glow next to it.
        context.filter = "brightness(0.86) saturate(0.92)";
        context.drawImage(carried, -unit * 0.5, -unit * 0.5, unit, unit);
        context.restore();
      }
    }
  }

  // What was just thrown, on its way out of the hand.
  //
  // Without this the object simply stopped being drawn the moment the button went down, which is the
  // one thing a throw must never look like: the whole read of a throw is that the weight left. The
  // body of a thrown enemy is not drawn here — it is already in the world, in flight, and large.
  if (active && world.swingKind === "throw" && world.thrownKind && world.thrownKind !== "enemy") {
    const leaving = images.get(DEMO_ASSET_IDS[world.thrownKind]);

    if (leaving) {
      const flight = easeOut(progress);
      context.save();
      context.globalAlpha = Math.max(0, 1 - flight * 1.2);
      context.translate(carriedX + (width * 0.5 - carriedX) * flight * 0.7, carriedY - height * 0.42 * flight);
      context.rotate(-0.18 - flight * 2.4);
      context.filter = "brightness(0.86) saturate(0.92)";
      const shrunk = unit * (1 - flight * 0.55);
      context.drawImage(leaving, -shrunk * 0.5, -shrunk * 0.5, shrunk, shrunk);
      context.restore();
    }
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
