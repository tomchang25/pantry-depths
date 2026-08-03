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
 * What is deliberately not attempted: a second hand holding the carried object. Every attempt at one
 * in this project has read as a lump of meat rather than as a hand, and the reason is recorded where
 * the shipped viewmodel is drawn rather than rediscovered here.
 */

import {
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS_BY_ID,
  MELEE_IDLE_POSE,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
} from "@/content/viewmodel/melee-viewmodel";
import type { World } from "@/core/world";

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

export type Viewmodel = Readonly<{
  overlay: HTMLCanvasElement;
  setKind(kind: ViewmodelKind): void;
  sync(world: World): void;
  resize(width: number, height: number): void;
  dispose(): void;
}>;

export function createViewmodel(): Viewmodel {
  const overlay = document.createElement("canvas");
  overlay.className = "three-scene__overlay";
  const context = overlay.getContext("2d");
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
      const stageWidth = width * STAGE_WIDTH_FRACTION;
      const scale = stageWidth / MELEE_VIEW_WIDTH;
      const stageHeight = MELEE_VIEW_HEIGHT * scale;
      context.save();
      context.translate((width - stageWidth) / 2, height - stageHeight * STAGE_HEIGHT_FRACTION + stageHeight);
      context.scale(scale, scale);
      context.translate(0, -MELEE_VIEW_HEIGHT);

      const total = Math.max(0.0001, world.swingTotal);
      const progress = world.swing > 0 ? 1 - world.swing / total : 0;

      if (world.swing > 0 && world.swingKind !== "throw") {
        const attack = MELEE_ATTACKS_BY_ID[world.swingKind];
        const connected = world.swingTarget?.connected ?? false;
        drawMeleeAttack(context, attack, progress, {
          // No aim: chasing the point a swing landed on needs the renderer's own projection wired
          // through, and the arc stays where it was authored instead — the same place the workbench
          // judges it.
          connected,
          strength: connected ? 1 : 0.55,
        });
      } else {
        drawMeleeViewmodel(context, MELEE_IDLE_POSE);
      }

      context.restore();
    },

    dispose() {
      overlay.remove();
    },
  };
}
