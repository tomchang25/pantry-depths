import * as THREE from "three";

import type { SkeletonSwordsman } from "./skeleton-swordsman";

/**
 * The body's own coordinate system and its own ruler.
 *
 * Every length a guard authors or reports is a fraction of one of these two
 * bone chains rather than a raw world unit. The skeleton's units are arbitrary
 * — it stands about four units tall — so an absolute distance means nothing to
 * a reader and nothing to the reference drawings, which were made from a human.
 * A hilt "0.57 arm-lengths above the shoulders" transfers in both directions;
 * `3.82` does not.
 *
 * It also survives the rig changing. This skeleton's arm is 32.6% of its
 * shoulder height against roughly 36% for a human, so it is already a body the
 * reference does not quite fit; if that ratio is ever adjusted, guards authored
 * in these units move with it instead of silently going out of reach.
 */
export type BodyScale = Readonly<{
  /** Shoulder to wrist, following the bones rather than the straight line. */
  arm: number;
  /** The height every foot is placed at, taken from the rest pose. */
  groundY: number;
  /** Hip to ankle. */
  leg: number;
  /** Rest shoulder height above `groundY`, for reporting proportions. */
  shoulderHeight: number;
}>;

/**
 * The chest's frame, resolved after the torso has been posed.
 *
 * `origin` is the midpoint between the shoulders, which is where a guard's hilt
 * is measured from: the reference sheet places a high guard high relative to
 * the head, not relative to the floor. Anchoring here means the hilt follows
 * the torso's turn and the stance's hip drop without either being restated.
 *
 * `right` is the character's own right, which is world `−X` on this rig: it
 * faces `+Z`, and `rightShoulder` is authored at negative x. Authoring a guard
 * as "hilt to the right" therefore means the same thing as it does in the
 * drawing, not the mirror of it.
 */
export type BodyFrame = Readonly<{
  forward: THREE.Vector3;
  origin: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}>;

const CHEST_RIGHT = new THREE.Vector3(-1, 0, 0);
const CHEST_UP = new THREE.Vector3(0, 1, 0);
const CHEST_FORWARD = new THREE.Vector3(0, 0, 1);

export function readBodyScale(skeleton: SkeletonSwordsman): BodyScale {
  const arm = skeleton.getBone("rightElbow").position.length() + skeleton.getBone("rightHand").position.length();
  const leg = skeleton.getBone("leftKnee").position.length() + skeleton.getBone("leftFoot").position.length();
  const hipsRest = skeleton.restPosition("hips").y;
  const groundY = hipsRest - leg;
  const shoulderRest =
    hipsRest +
    skeleton.restPosition("spine").y +
    skeleton.restPosition("chest").y +
    skeleton.restPosition("rightShoulder").y;

  return { arm, groundY, leg, shoulderHeight: shoulderRest - groundY };
}

export function readBodyFrame(skeleton: SkeletonSwordsman): BodyFrame {
  const chest = skeleton.getBone("chest");
  const left = skeleton.getBone("leftShoulder").getWorldPosition(new THREE.Vector3());
  const right = skeleton.getBone("rightShoulder").getWorldPosition(new THREE.Vector3());

  return {
    forward: CHEST_FORWARD.clone().transformDirection(chest.matrixWorld).normalize(),
    origin: left.add(right).multiplyScalar(0.5),
    right: CHEST_RIGHT.clone().transformDirection(chest.matrixWorld).normalize(),
    up: CHEST_UP.clone().transformDirection(chest.matrixWorld).normalize(),
  };
}

/** A point given as up / forward / sideways offsets from the shoulder midpoint, in arm-lengths. */
export function frameToWorld(
  frame: BodyFrame,
  scale: BodyScale,
  offset: Readonly<{ forward: number; side: number; up: number }>,
): THREE.Vector3 {
  return frame.origin
    .clone()
    .addScaledVector(frame.up, offset.up * scale.arm)
    .addScaledVector(frame.forward, offset.forward * scale.arm)
    .addScaledVector(frame.right, offset.side * scale.arm);
}

export function worldToFrame(
  frame: BodyFrame,
  scale: BodyScale,
  point: THREE.Vector3,
): Readonly<{ forward: number; side: number; up: number }> {
  const local = point.clone().sub(frame.origin);
  return {
    forward: local.dot(frame.forward) / scale.arm,
    side: local.dot(frame.right) / scale.arm,
    up: local.dot(frame.up) / scale.arm,
  };
}

/**
 * A direction given as a pitch above horizontal and a yaw off forward, degrees.
 *
 * Two angles rather than a vector because a reader can take them off the
 * drawing — "the blade points fifty degrees up and eighty to his left" — and a
 * normalized triple cannot be read at all. Positive yaw is toward the
 * character's right, matching `BodyFrame.right`.
 */
export function frameDirectionToWorld(
  frame: BodyFrame,
  direction: Readonly<{ pitch: number; yaw: number }>,
): THREE.Vector3 {
  const pitch = THREE.MathUtils.degToRad(direction.pitch);
  const yaw = THREE.MathUtils.degToRad(direction.yaw);
  const horizontal = Math.cos(pitch);

  return new THREE.Vector3()
    .addScaledVector(frame.up, Math.sin(pitch))
    .addScaledVector(frame.forward, horizontal * Math.cos(yaw))
    .addScaledVector(frame.right, horizontal * Math.sin(yaw))
    .normalize();
}

export function worldDirectionToFrame(
  frame: BodyFrame,
  direction: THREE.Vector3,
): Readonly<{ pitch: number; yaw: number }> {
  const up = direction.dot(frame.up);
  const forward = direction.dot(frame.forward);
  const side = direction.dot(frame.right);

  return {
    pitch: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(up, -1, 1))),
    yaw: THREE.MathUtils.radToDeg(Math.atan2(side, forward)),
  };
}
