import * as THREE from "three";

import type { SkeletonBoneName } from "./skeleton-swordsman";
import { SkeletonSwordsman } from "./skeleton-swordsman";

type RotationPose = Partial<Record<SkeletonBoneName, THREE.Vector3Tuple>>;

type AttackKeyframe = Readonly<{
  at: number;
  root: THREE.Vector3Tuple;
  rotations: RotationPose;
}>;

export type AttackSample = Readonly<{
  finished: boolean;
  normalizedTime: number;
  phase: string;
}>;

export const ATTACK_DURATION_SECONDS = 3.65;

const KEYFRAMES: readonly AttackKeyframe[] = [
  {
    at: 0,
    root: [0, 0, 0],
    rotations: {
      chest: [0, -0.22, 0],
      leftShoulder: [0.08, 0.14, -0.42],
      leftElbow: [0, 0.12, -0.24],
      rightShoulder: [-0.18, -0.4, 0.38],
      rightElbow: [0, -0.08, 0.72],
      rightHand: [0.15, 0, 0.18],
      leftHip: [0.1, 0, -0.04],
      rightHip: [-0.08, 0, 0.04],
    },
  },
  {
    at: 0.19,
    root: [-0.06, -0.04, 0.08],
    rotations: {
      hips: [0, -0.18, 0],
      chest: [0.08, -0.74, -0.08],
      head: [0, 0.45, 0],
      leftShoulder: [0.12, 0.18, -0.62],
      leftElbow: [0, 0.1, -0.35],
      rightShoulder: [-0.48, -1.08, 0.68],
      rightElbow: [-0.25, -0.2, 1.12],
      rightHand: [0.28, -0.15, 0.24],
      leftHip: [0.28, 0, -0.18],
      leftKnee: [-0.32, 0, 0.08],
      rightHip: [-0.16, 0, 0.12],
      rightKnee: [0.18, 0, 0],
    },
  },
  {
    at: 0.36,
    root: [0.04, -0.08, 0.38],
    rotations: {
      hips: [0, -0.05, 0],
      chest: [0.06, -0.82, -0.1],
      head: [0, 0.62, 0],
      leftShoulder: [0.18, 0.35, -0.56],
      rightShoulder: [-0.52, -1.22, 0.74],
      rightElbow: [-0.26, -0.25, 1.2],
      rightHand: [0.3, -0.2, 0.28],
      leftHip: [0.45, 0, -0.12],
      leftKnee: [-0.6, 0, 0.08],
      rightHip: [-0.34, 0, 0.08],
    },
  },
  {
    at: 0.5,
    root: [0.18, -0.02, 0.82],
    rotations: {
      hips: [0, 0.42, 0],
      chest: [-0.12, 0.92, 0.12],
      head: [0, -0.48, 0],
      leftShoulder: [-0.12, -0.45, -0.34],
      leftElbow: [0, 0, -0.5],
      rightShoulder: [0.46, 0.86, -0.72],
      rightElbow: [0.2, 0.22, 0.4],
      rightHand: [-0.2, 0.28, -0.1],
      leftHip: [0.22, 0, 0.1],
      leftKnee: [-0.25, 0, 0],
      rightHip: [-0.48, 0, -0.08],
      rightKnee: [0.42, 0, 0],
    },
  },
  {
    at: 0.68,
    root: [0.22, -0.08, 0.98],
    rotations: {
      hips: [0, 0.34, 0],
      chest: [0.16, 0.62, 0.16],
      head: [-0.08, -0.28, 0],
      leftShoulder: [0.1, -0.25, -0.5],
      rightShoulder: [0.34, 0.62, -0.58],
      rightElbow: [0.1, 0.16, 0.62],
      leftHip: [0.34, 0, 0.08],
      rightHip: [-0.34, 0, -0.04],
    },
  },
  {
    at: 1,
    root: [0, 0, 0],
    rotations: {
      chest: [0, -0.22, 0],
      leftShoulder: [0.08, 0.14, -0.42],
      leftElbow: [0, 0.12, -0.24],
      rightShoulder: [-0.18, -0.4, 0.38],
      rightElbow: [0, -0.08, 0.72],
      rightHand: [0.15, 0, 0.18],
    },
  },
];

function quaternionFromEuler(rotation: THREE.Vector3Tuple): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, "XYZ"));
}

function easeInOut(value: number): number {
  return value * value * (3 - 2 * value);
}

function phaseAt(normalizedTime: number): string {
  if (normalizedTime < 0.19) return "idle / anticipation";
  if (normalizedTime < 0.36) return "wind-up";
  if (normalizedTime < 0.45) return "forward step";
  if (normalizedTime < 0.55) return "slash";
  if (normalizedTime < 0.72) return "follow-through";
  if (normalizedTime < 0.96) return "recovery";
  return "idle";
}

export function sampleSwordAttack(skeleton: SkeletonSwordsman, elapsedSeconds: number): AttackSample {
  const rawNormalized = elapsedSeconds / ATTACK_DURATION_SECONDS;
  const normalizedTime = THREE.MathUtils.clamp(rawNormalized, 0, 1);
  let from = KEYFRAMES[0];
  let to = KEYFRAMES.at(-1);

  for (let index = 1; index < KEYFRAMES.length; index += 1) {
    const candidate = KEYFRAMES[index];
    if (candidate && candidate.at >= normalizedTime) {
      from = KEYFRAMES[index - 1];
      to = candidate;
      break;
    }
  }

  if (!from || !to) {
    throw new Error("Sword attack keyframes are incomplete.");
  }

  const frameSpan = Math.max(0.0001, to.at - from.at);
  const blend = easeInOut((normalizedTime - from.at) / frameSpan);
  skeleton.resetPose();
  skeleton.root.position.fromArray(from.root).lerp(new THREE.Vector3().fromArray(to.root), blend);

  for (const [name, bone] of skeleton.bones) {
    const fromRotation = from.rotations[name] ?? [0, 0, 0];
    const toRotation = to.rotations[name] ?? [0, 0, 0];
    bone.quaternion.copy(quaternionFromEuler(fromRotation)).slerp(quaternionFromEuler(toRotation), blend);
  }

  skeleton.root.updateMatrixWorld(true);
  return {
    finished: rawNormalized >= 1,
    normalizedTime,
    phase: phaseAt(normalizedTime),
  };
}
