/**
 * The player's own hands: the game's, drawn over the frame.
 *
 * This module used to build two arms and offer a switch — a camera-attached block mesh beside the
 * authored 2D stage — because the plan called the choice open. The judging session closed it: the
 * mesh arm is cut, and what the player sees is the arm the game already has, drawn by the game's own
 * code onto a canvas over the rendered image.
 *
 * That is a finding rather than a compromise. The stage is eight hand-tuned cuts authored against a
 * 720x405 frame and judged on a workbench; a swing is a three-pose illusion timed at a pace a person
 * chose. None of that survives being re-derived as a rigged forearm, and none of it needs to — it is
 * content, so a renderer that draws nothing else can still draw this.
 *
 * The other hand is here too, and it was missing for a whole judging session: what the player is
 * carrying, the torch glow it sits in, the green frame the spring pulses, and the arcs pointing at
 * whatever just hit them. All four are screen-space layers over the picture, and none of them cares
 * what drew the picture.
 *
 * What is deliberately not attempted: a hand *on* the carried object. Every attempt at one in this
 * project has read as a lump of meat rather than as a hand, and the reason is recorded where the
 * shipped viewmodel is drawn rather than rediscovered here.
 */

import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind } from "@/content/presentation/prop-display-schema";
import { SKELETON_PICKUP_URLS } from "@/content/enemies/skeleton-pickup-definitions";
import {
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS_BY_ID,
  MELEE_IDLE_POSE,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
} from "@/content/viewmodel/melee-viewmodel";
import type { EnemyAppearanceId } from "@/core/enemy-contract";
import type { PropKind } from "@/core/prop-kinds";
import { bodyFootprint, type World } from "@/core/world";

import { createSceneSprites, type SceneSpriteId } from "./scene-sprites";

export type ViewmodelKind = "authored" | "none";

/**
 * How much of the frame the authored stage covers, and where its bottom edge sits.
 *
 * Anchored bottom-centre and scaled off its width, so the arm keeps the proportions it was drawn
 * with whatever shape the viewport happens to be. What the stage draws below its own bottom edge —
 * the sleeve running back to the shoulder — leaves the frame, which is what makes it an arm rather
 * than a sword hanging in the air.
 */
const STAGE_WIDTH_FRACTION = 0.94;
const STAGE_HEIGHT_FRACTION = 1.45;

/** Which picture each carried object is drawn from; `authored` ones are PNGs the content layer ships. */
const CARRIED_SPRITES: Readonly<Record<PropKind, SceneSpriteId | "authored">> = {
  stick: "stick",
  rock: "rock",
  bomb: "bomb",
  hammer: "hammer",
  skeletonSword: "authored",
  skeletonSkull: "authored",
  skeletonFemur: "authored",
  skeletonFemurCracked: "authored",
  skeletonJavelin: "stick",
  skeletonJavelinCracked: "stick",
  crossbow: "hammer",
  crossbowSpent: "hammer",
  crossbowBolt: "stick",
};

/** How each carried object fills the hand, authored beside how it lies on the floor. */
const PROP_DISPLAYS = propDisplaysByKind(parsePropDisplays(propDisplayJson));

/** How tall a carried slime stands and what colour it is. Height authored; colour is not. */
const SLIME_COLORS: Readonly<Partial<Record<EnemyAppearanceId, readonly [number, number, number]>>> = {
  greenSlime: [118, 198, 92],
  yellowSlime: [216, 200, 92],
  blueSlime: [96, 152, 218],
  redSlime: [216, 92, 86],
  purpleSlime: [169, 108, 216],
};

const SLIME_HEIGHTS: Readonly<Partial<Record<EnemyAppearanceId, number>>> = {
  greenSlime: 0.3,
  blueSlime: 0.42,
  redSlime: 0.56,
};

/** The arcs that point at whatever just landed a hit. */
const MARK_RADIUS_FRACTION = 0.17;
const MARK_HALF_ANGLE = 0.4;
const MARK_THICKNESS_FRACTION = 0.028;

/** How far the healing frame reaches in from each edge, and which four edges those are. */
const SOAK_FRAME_FRACTION = 0.19;
const SOAK_EDGES: readonly Readonly<{ far: boolean; vertical: boolean }>[] = [
  { far: false, vertical: true },
  { far: true, vertical: true },
  { far: false, vertical: false },
  { far: true, vertical: false },
];

export type Viewmodel = Readonly<{
  overlay: HTMLCanvasElement;
  setKind(kind: ViewmodelKind): void;
  sync(world: World): void;
  resize(width: number, height: number): void;
  dispose(): void;
}>;

export function createViewmodel(): Viewmodel {
  const overlay = document.createElement("canvas");
  overlay.className = "scene-3d__overlay";
  const context = overlay.getContext("2d");
  const sprites = createSceneSprites();
  // The authored pickup artwork, loaded once. A carried object that has not arrived yet simply is
  // not drawn for a frame or two, which is the same thing the shipped loader does.
  const authored = new Map<string, HTMLImageElement>();

  for (const [kind, url] of Object.entries(SKELETON_PICKUP_URLS)) {
    const image = new Image();
    image.src = url;
    authored.set(kind, image);
  }

  let kind: ViewmodelKind = "authored";
  let width = 1;
  let height = 1;

  return {
    overlay,

    setKind(next) {
      kind = next;
      overlay.style.display = next === "authored" ? "block" : "none";

      if (next !== "authored" && context) {
        context.clearRect(0, 0, overlay.width, overlay.height);
      }
    },

    resize(nextWidth, nextHeight) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      overlay.width = width;
      overlay.height = height;
    },

    sync(world) {
      if (kind !== "authored" || !context) {
        return;
      }

      context.clearRect(0, 0, width, height);
      const viewSize = Math.min(width * STAGE_WIDTH_FRACTION, height * STAGE_HEIGHT_FRACTION);
      const bob = Math.sin(world.elapsedSeconds * 2.2) * height * 0.006 + world.walkBob * height * 0.017;
      drawArm(context, world, viewSize, bob);
      drawCarried(context, world, viewSize, bob);
      drawCarriedLight(context, world.elapsedSeconds);
      // Under the damage marks, deliberately. Being healed is good news and news you can wait a
      // moment for; being hit is not, and the frame must never be the thing that hides an arc.
      drawSoakFrame(context, world);
      drawDamageMarks(context, world);
    },

    dispose() {
      overlay.remove();
    },
  };

  /**
   * The sword arm, on its own 720x405 stage anchored bottom-centre.
   *
   * Sized off whichever of the two fractions binds first, and uniformly, so the arm is never
   * stretched by the window's shape and never outgrows a wide one. Scaling off the width alone —
   * which this did until the game started drawing through here — is invisible in a viewport that
   * happens to be roughly square and puts the hand in the middle of the screen on one that is twice
   * as wide as it is tall.
   */
  function drawArm(target: CanvasRenderingContext2D, world: World, viewSize: number, bob: number): void {
    const scale = viewSize / MELEE_VIEW_WIDTH;
    target.save();
    target.translate(width * 0.5, height + bob);
    target.scale(scale, scale);
    target.translate(-MELEE_VIEW_WIDTH * 0.5, -MELEE_VIEW_HEIGHT);

    const total = Math.max(0.0001, world.swingTotal);
    const progress = world.swing > 0 ? 1 - world.swing / total : 0;

    if (world.swing > 0 && world.swingKind !== "throw") {
      const attack = MELEE_ATTACKS_BY_ID[world.swingKind];
      const connected = world.swingTarget?.connected ?? false;
      drawMeleeAttack(target, attack, progress, {
        // No aim: chasing the point a swing landed on needs the renderer's own projection wired
        // through, and the arc stays where it was authored instead — the same place the workbench
        // judges it.
        connected,
        strength: connected ? 1 : 0.55,
      });
    } else {
      drawMeleeViewmodel(target, MELEE_IDLE_POSE);
    }

    target.restore();
  }

  /** What is in the other hand: a pickup at its authored size and turn, or a squirming body. */
  function drawCarried(target: CanvasRenderingContext2D, world: World, viewSize: number, bob: number): void {
    const held = world.held;

    if (!held) {
      return;
    }

    const unit = viewSize * 0.34;
    const carriedX = width * 0.215;
    const carriedY = height * 0.86 + bob * 1.6;
    const sway = Math.sin(world.elapsedSeconds * 1.7) * 0.025;

    if (held.kind === "enemy") {
      drawHeldSlime(
        target,
        carriedX,
        carriedY,
        unit,
        held.enemy.appearance,
        bodyFootprint(held.enemy.archetype),
        world.elapsedSeconds,
      );
      return;
    }

    const source = CARRIED_SPRITES[held.prop];
    const picture = source === "authored" ? authored.get(held.prop) : sprites[source];

    if (!picture || (picture instanceof HTMLImageElement && !picture.complete)) {
      return;
    }

    // Its own size and turn in the hand, authored per kind. Every prop used to be drawn into the
    // same square, so a stake and a bomb were carried at identical size however different they are
    // anywhere else.
    const display = PROP_DISPLAYS[held.prop];
    const drawn = unit * (display?.handScale ?? 1);
    target.save();
    target.translate(carriedX, carriedY);
    target.rotate((display?.handRotation ?? 0) + sway);
    // Matched to how dark the arm beside it reads, so the carried thing does not glow next to it.
    target.filter = "brightness(0.86) saturate(0.92)";
    target.drawImage(picture, -drawn * 0.5, -drawn * 0.5, drawn, drawn);
    target.restore();
  }

  /**
   * The captured slime, squirming in the fist.
   *
   * The same ring-stack body the world draws, in screen space: a stack of ellipses down a dome
   * profile, wobbling on its own phase. A carried body is the one thing in the corner of the frame
   * that has to look alive, because it is the one thing that can still hurt the player.
   */
  function drawHeldSlime(
    target: CanvasRenderingContext2D,
    centreX: number,
    centreY: number,
    unit: number,
    appearance: EnemyAppearanceId,
    footprint: number,
    elapsedSeconds: number,
  ): void {
    const color = SLIME_COLORS[appearance] ?? [160, 160, 160];
    const bodyHeight = SLIME_HEIGHTS[appearance] ?? 0.46;
    const struggle = Math.max(0, Math.sin(elapsedSeconds * 2.1)) * Math.abs(Math.sin(elapsedSeconds * 8));
    const radius = unit * 0.4 * (footprint / 0.3);
    const domeHeight = unit * 0.52 * (bodyHeight / 0.46) * (1 + struggle * 0.18);
    const rings = 10;
    target.save();
    target.translate(centreX, centreY + unit * 0.16);
    target.rotate(-0.12 + Math.sin(elapsedSeconds * 1.7) * 0.03);

    for (let ring = 0; ring < rings; ring += 1) {
      const up = ring / (rings - 1);
      const profile = Math.sqrt(Math.max(0, 1 - up * up)) * (1 - 0.12 * up) + 0.05;
      const wobble = 1 + Math.sin(elapsedSeconds * 9 + up * 5) * (0.05 + struggle * 0.07);
      const radiusX = radius * profile * wobble * (1 - struggle * 0.12);
      const radiusY = Math.max(1, radiusX * 0.4);
      const shade = (0.5 + 0.42 * up) * 0.86;
      target.fillStyle = `rgb(${(color[0] * shade) | 0}, ${(color[1] * shade) | 0}, ${(color[2] * shade) | 0})`;
      target.beginPath();
      target.ellipse(0, -up * domeHeight, radiusX, radiusY, 0, 0, Math.PI * 2);
      target.fill();
    }

    target.fillStyle = "rgba(255, 255, 255, 0.14)";
    target.beginPath();
    target.ellipse(-radius * 0.25, -domeHeight * 0.68, radius * 0.32, radius * 0.14, -0.3, 0, Math.PI * 2);
    target.fill();

    // Cross about being carried: squeezed eyes and a small complaining mouth.
    const faceY = -domeHeight * 0.5;
    const eye = Math.max(1.5, radius * 0.13);
    const eyeGap = radius * 0.4;
    target.fillStyle = "rgb(26, 15, 30)";
    target.fillRect(-eyeGap - eye, faceY - eye * 0.45, eye * 2, eye * 0.9);
    target.fillRect(eyeGap - eye, faceY - eye * 0.45, eye * 2, eye * 0.9);
    target.beginPath();
    target.ellipse(0, faceY + eye * 2.2, eye * 0.8, eye * 1, 0, 0, Math.PI * 2);
    target.fill();
    target.restore();
  }

  /** The torch's own light on the frame, from the hand that is carrying it. */
  function drawCarriedLight(target: CanvasRenderingContext2D, elapsedSeconds: number): void {
    const flicker = 0.88 + Math.sin(elapsedSeconds * 9.7) * 0.07 + Math.sin(elapsedSeconds * 3.3) * 0.05;
    const glow = target.createRadialGradient(
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
    target.save();
    target.globalCompositeOperation = "lighter";
    target.fillStyle = glow;
    target.fillRect(0, 0, width, height);
    target.restore();
  }

  /** A green pulse around the frame while the spring is working. */
  function drawSoakFrame(target: CanvasRenderingContext2D, world: World): void {
    if (world.soakSeconds <= 0) {
      return;
    }

    // Swells in over the first moment so stepping on does not slam, then breathes.
    const arrival = Math.min(1, world.soakSeconds * 2.4);
    const breath = 0.62 + Math.sin(world.soakSeconds * 4.4) * 0.38;
    const strength = arrival * (0.3 + breath * 0.42);
    const reach = Math.min(width, height) * SOAK_FRAME_FRACTION;
    target.save();
    target.globalCompositeOperation = "lighter";

    for (const edge of SOAK_EDGES) {
      const span = edge.vertical ? height : width;
      // The gradient runs inward from the edge itself, so the near end is opaque wherever it is.
      const from = edge.far ? span : 0;
      const to = edge.far ? span - reach : reach;
      const gradient = edge.vertical
        ? target.createLinearGradient(0, from, 0, to)
        : target.createLinearGradient(from, 0, to, 0);
      gradient.addColorStop(0, `rgba(96, 232, 132, ${strength})`);
      gradient.addColorStop(1, "rgba(96, 232, 132, 0)");
      target.fillStyle = gradient;
      target.fillRect(
        edge.vertical ? 0 : Math.min(from, to),
        edge.vertical ? Math.min(from, to) : 0,
        edge.vertical ? width : reach,
        edge.vertical ? reach : height,
      );
    }

    target.restore();
  }

  /**
   * Arcs around the crosshair pointing at what just hit you.
   *
   * Kept in world space by the rules and turned into a bearing here, so turning to face the attacker
   * walks the arc round to the front rather than dragging it along with the view.
   */
  function drawDamageMarks(target: CanvasRenderingContext2D, world: World): void {
    if (world.damageMarks.length === 0) {
      return;
    }

    const centreX = width / 2;
    const centreY = height / 2;
    const radius = Math.min(width, height) * MARK_RADIUS_FRACTION;
    target.save();
    target.lineCap = "round";

    for (const mark of world.damageMarks) {
      const dx = mark.x - world.player.x;
      const dy = mark.y - world.player.y;

      if (Math.hypot(dx, dy) < 0.0001) {
        continue;
      }

      // Shortest turn from where the player is looking to where the blow came from, then a quarter
      // turn because screen-up is straight ahead while the canvas measures angles from screen-right.
      const turn = Math.atan2(dy, dx) - world.player.angle;
      const bearing = Math.atan2(Math.sin(turn), Math.cos(turn)) - Math.PI / 2;
      const spent = Math.min(1, mark.age / Math.max(0.0001, mark.life));
      // Full strength for most of its life and then gone. A linear fade spends half its time too
      // faint to read, which turns a warning into a smudge.
      const strength = (1 - spent) ** 1.6 * mark.severity;
      target.strokeStyle = `rgb(255 74 66 / ${strength * 92}%)`;
      target.lineWidth = Math.min(width, height) * MARK_THICKNESS_FRACTION * (0.55 + mark.severity * 0.65);
      target.beginPath();
      target.arc(centreX, centreY, radius, bearing - MARK_HALF_ANGLE, bearing + MARK_HALF_ANGLE);
      target.stroke();
    }

    target.restore();
  }
}
