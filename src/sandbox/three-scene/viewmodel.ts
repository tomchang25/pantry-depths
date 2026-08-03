/**
 * The player's own hands, drawn two ways so the pair can be judged against each other.
 *
 * This is the checklist row the plan left genuinely open. A camera-attached mesh is what a 3D runtime
 * would naturally do; the arm the game actually ships is an authored 2D stage — eight cuts, drawn to
 * a 720x405 frame, tuned by a person against a workbench — and it lives in the content layer, so an
 * experiment can keep drawing the real thing on a canvas over the WebGL one. Neither is obviously
 * right, and picking between them from first principles is exactly the judgement a spike must not
 * make on the author's behalf. So both are built and a switch chooses.
 *
 * What is deliberately not attempted either way: a second hand holding the carried object. Every
 * attempt at one in this project has read as a lump of meat rather than as a hand, and the reason is
 * recorded where the shipped viewmodel is drawn rather than rediscovered here.
 */

import * as THREE from "three";

import {
  drawMeleeAttack,
  drawMeleeViewmodel,
  MELEE_ATTACKS_BY_ID,
  MELEE_IDLE_POSE,
  MELEE_VIEW_HEIGHT,
  MELEE_VIEW_WIDTH,
} from "@/content/viewmodel/melee-viewmodel";
import type { World } from "@/core/world";

export type ViewmodelKind = "mesh" | "authored" | "none";

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
  /** Added to the camera, so the mesh arm travels with the eye without a per-frame transform. */
  meshRoot: THREE.Object3D;
  overlay: HTMLCanvasElement;
  setKind(kind: ViewmodelKind): void;
  sync(world: World): void;
  resize(width: number, height: number): void;
  dispose(): void;
}>;

export function createViewmodel(): Viewmodel {
  const meshRoot = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  let kind: ViewmodelKind = "mesh";

  // The mesh arm: a forearm and a blade, blocky like everything else standing on this floor. Placed
  // in camera space, so its numbers are all "right of centre, below the eye, out in front".
  const boneMaterial = new THREE.MeshLambertMaterial({ color: 0xd9c9a8 });
  const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xc6cedb });
  const forearmGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.34);
  const bladeGeometry = new THREE.BoxGeometry(0.03, 0.12, 0.62);
  const guardGeometry = new THREE.BoxGeometry(0.035, 0.2, 0.05);
  disposables.push(boneMaterial, bladeMaterial, forearmGeometry, bladeGeometry, guardGeometry);

  const arm = new THREE.Group();
  const forearm = new THREE.Mesh(forearmGeometry, boneMaterial);
  forearm.position.set(0, 0, -0.17);
  const guard = new THREE.Mesh(guardGeometry, bladeMaterial);
  guard.position.set(0, 0, -0.34);
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.set(0, 0, -0.66);
  arm.add(forearm, guard, blade);
  // Right of centre and below the eye, angled inward the way a held weapon crosses the view.
  arm.position.set(0.24, -0.19, -0.28);
  arm.rotation.set(0.22, -0.26, 0.1);
  meshRoot.add(arm);
  // Never clipped by geometry it is standing inside: the hand is in front of the near plane's
  // business, and a wall the player is pressed against must not cut their own arm in half.
  meshRoot.renderOrder = 10;
  forearm.renderOrder = 10;
  guard.renderOrder = 10;
  blade.renderOrder = 10;

  const overlay = document.createElement("canvas");
  overlay.className = "three-scene__overlay";
  const context = overlay.getContext("2d");
  let width = 1;
  let height = 1;

  const restPosition = arm.position.clone();
  const restRotation = arm.rotation.clone();

  return {
    meshRoot,
    overlay,

    setKind(next) {
      kind = next;
      meshRoot.visible = next === "mesh";
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
      if (kind === "mesh") {
        syncMesh(world);
        return;
      }

      if (kind === "authored") {
        drawAuthored(world);
      }
    },

    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      overlay.remove();
    },
  };

  /**
   * The mesh arm through one swing.
   *
   * Three beats rather than an authored curve: back and up, through, and a settle. It is the crudest
   * honest version of what the authored stage does with eight hand-tuned cuts, and the gap between
   * the two is most of what this row is asking a person to look at.
   */
  function syncMesh(world: World): void {
    const total = Math.max(0.0001, world.swingTotal);
    const progress = world.swing > 0 ? 1 - world.swing / total : 0;
    arm.position.copy(restPosition);
    arm.rotation.copy(restRotation);

    // Idle sway, tied to the walk the rules already track, so the hand moves because the feet do.
    const bob = Math.sin(world.walkBob * Math.PI * 2) * 0.012;
    arm.position.y += bob;

    if (world.swing > 0) {
      if (world.swingKind === "throw") {
        // A throw is the other hand's; this one only dips out of the way.
        const dip = Math.sin(progress * Math.PI);
        arm.position.y -= dip * 0.14;
        arm.rotation.x += dip * 0.5;
        return;
      }

      const wound = Math.min(1, progress / 0.3);
      const cut = Math.max(0, Math.min(1, (progress - 0.3) / 0.35));
      const settle = Math.max(0, (progress - 0.65) / 0.35);
      arm.rotation.z += wound * 0.7 - cut * 1.5;
      arm.rotation.x += wound * 0.45 - cut * 0.9;
      arm.position.x += wound * 0.1 - cut * 0.34;
      arm.position.y += wound * 0.08 - cut * 0.12;
      arm.rotation.y += settle * 0.16;
    }
  }

  /** The authored stage, scaled onto the frame and drawn over the rendered image. */
  function drawAuthored(world: World): void {
    if (!context) {
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
        // No aim: converting a world hit into stage coordinates needs the renderer's own projection,
        // and wiring one through for a spike would answer a question nobody asked. The arc stays
        // where it was authored, which is where the lab judges it.
        connected,
        strength: connected ? 1 : 0.55,
      });
    } else {
      drawMeleeViewmodel(context, MELEE_IDLE_POSE);
    }

    context.restore();
  }
}
