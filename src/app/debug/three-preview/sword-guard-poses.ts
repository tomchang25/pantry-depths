import * as THREE from "three";

import {
  type BodyFrame,
  type BodyScale,
  frameDirectionToWorld,
  frameToWorld,
  readBodyFrame,
  readBodyScale,
} from "./body-frame";
import type { SkeletonBoneName, SkeletonSwordsman } from "./skeleton-swordsman";
import { SWORD_BLADE_AXIS, SWORD_EDGE_AXIS } from "./skeleton-swordsman";

/**
 * The fourteen essential long-sword guards, in the reference sheet's own order.
 *
 * A guard is authored as where the sword is, not as which bones rotate. The
 * previous shape of this file was four entries of raw euler triples per bone,
 * of which two were byte-identical placeholders, one was geometrically out of
 * reach and silently clamped, and two never solved their legs at all. Fourteen
 * of those would be three thousand lines that cannot be compared with each
 * other or with the drawings.
 */
export const SWORD_GUARD_POSES = [
  "middle",
  "high",
  "low",
  "backRight",
  "hangingRight",
  "insideLeft",
  "closeLeft",
  "hangingLeft",
  "insideRight",
  "closeRight",
  "short",
  "long",
  "side",
  "backLeft",
] as const;

export type SwordGuardPose = (typeof SWORD_GUARD_POSES)[number];

export type SwordGuardStance = "leftLead" | "rightLead" | "square" | "wide";

/**
 * How far apart the hands sit along the blade.
 *
 * One constant rather than a literal at the point of use, because it is what
 * makes the hand separation a measurable invariant: a pose whose hands are not
 * this far apart is stretching the sword between them, and the instrument says
 * so instead of it being visible only as a slightly wrong grip.
 */
export const SWORD_GRIP_SPAN = 0.3;

type StanceFoot = Readonly<{
  /** Ahead of the hips, in leg-lengths. Positive is toward the opponent. */
  forward: number;
  /** Away from the centre line, in leg-lengths. Positive is the character's right. */
  side: number;
  /** Degrees the sole turns outward. */
  turn: number;
}>;

type StanceDefinition = Readonly<{
  /** How far the hips sink below their rest height, in leg-lengths. */
  hipDrop: number;
  left: StanceFoot;
  right: StanceFoot;
}>;

type TorsoAttitude = Readonly<{
  /** Degrees the head pitches; positive looks down. */
  headPitch?: number;
  /** Degrees the head turns; positive toward the character's right. */
  headTurn?: number;
  /** Degrees the torso bows forward. */
  lean?: number;
  /** Degrees the torso tips sideways; positive toward the character's right. */
  tilt?: number;
  /** Degrees the shoulders turn; positive toward the character's right. */
  turn?: number;
}>;

type ElbowHint = Readonly<{
  /** Fractions of arm length the pole sits below the shoulder, per side. */
  leftDown?: number;
  leftOut?: number;
  rightDown?: number;
  rightOut?: number;
}>;

type GuardDefinition = Readonly<{
  /** Where the blade points, from the chest's frame. */
  blade: Readonly<{ pitch: number; yaw: number }>;
  /** Roll of the true edge about the blade, degrees. Zero faces the body's up. */
  edge: number;
  /** Where the leading hand grips, from the shoulder midpoint, in arm-lengths. */
  hilt: Readonly<{ forward: number; side: number; up: number }>;
  /** Only for a guard whose derived elbow reads wrong; an entry here is a signal, not a default. */
  elbows?: ElbowHint;
  stance: SwordGuardStance;
  torso?: TorsoAttitude;
}>;

/**
 * The signs, once, so that every number below reads the way the drawings do.
 *
 * This rig faces `+Z` and its anatomical right is `−X`, so none of the three
 * rotations is simply "positive about its own axis". Getting one of them
 * backwards produces a pose that looks deliberate and is mirrored, which is the
 * single hardest defect to see in a set where four of the fourteen are mirror
 * pairs.
 */
const AXIS_TURN = new THREE.Vector3(0, -1, 0);
const AXIS_LEAN = new THREE.Vector3(1, 0, 0);
const AXIS_TILT = new THREE.Vector3(0, 0, 1);

/**
 * How a torso attitude is spread down the spine.
 *
 * A turn that lives entirely in the chest reads as a broken neck; the same turn
 * spread over hips, spine and chest reads as a person. Authoring five values
 * and distributing them beats authoring fifteen and hoping they agree.
 */
const TURN_SHARE: Readonly<Partial<Record<SkeletonBoneName, number>>> = { chest: 0.5, hips: 0.2, spine: 0.3 };
const LEAN_SHARE: Readonly<Partial<Record<SkeletonBoneName, number>>> = { chest: 0.5, hips: 0.15, spine: 0.35 };
const TILT_SHARE: Readonly<Partial<Record<SkeletonBoneName, number>>> = { chest: 0.6, spine: 0.4 };
const HEAD_SHARE: Readonly<Partial<Record<SkeletonBoneName, number>>> = { head: 0.6, neck: 0.4 };

/**
 * Where the elbow is pushed.
 *
 * The first version of this was two constants — down and outward from the
 * shoulder — applied whatever the guard was doing, and it is the reason the
 * first fourteen read as a body with its forearms knotted across its own ribs.
 * A fixed outward push is only right while the hands are in front of their own
 * shoulder; the moment a guard takes the hilt across the body, that same push
 * drives the elbow the wrong way round and the forearm crosses the chest.
 *
 * So the sideways part follows the hands: `ELBOW_FOLLOW` swings the pole toward
 * whichever side the hilt has gone to, and `ELBOW_SPLAY` is the small
 * per-side push that survives, which is what keeps the two elbows from
 * collapsing into each other when the hilt is on the centre line.
 */
const ELBOW_DOWN = 0.55;
const ELBOW_FOLLOW = 0.55;
const ELBOW_SPLAY = 0.3;
/**
 * Barely behind the shoulder.
 *
 * At a quarter of an arm this drove the elbow back to the hip, and with the
 * hilt already near the ribs the whole arm folded up inside the ribcage and
 * disappeared: three guards rendered with no visible arms at all, which no
 * measurement noticed because a hidden arm reaches exactly as far as a visible
 * one.
 */
const ELBOW_BACK = 0.06;
/** …and the knee, forward and down, so it always bends the way a knee bends. */
const KNEE_FORWARD = 0.75;
const KNEE_DOWN = 0.45;

/**
 * Foot placements, read off the plate rather than guessed.
 *
 * The first version sank the hips up to a fifth of a leg and set the feet more
 * than half a leg apart, which put every guard into a lunge. The figures on the
 * plate stand: knees soft, weight settled, a stride's worth of separation and
 * no more. `hipDrop` is now small enough that the knee bend it produces is the
 * bend a standing person has.
 */
const STANCES: Readonly<Record<SwordGuardStance, StanceDefinition>> = {
  rightLead: {
    hipDrop: 0.045,
    left: { forward: -0.2, side: -0.13, turn: -30 },
    right: { forward: 0.22, side: 0.11, turn: 6 },
  },
  leftLead: {
    hipDrop: 0.045,
    left: { forward: 0.22, side: -0.11, turn: -6 },
    right: { forward: -0.2, side: 0.13, turn: 30 },
  },
  square: {
    hipDrop: 0.035,
    left: { forward: 0.02, side: -0.14, turn: -14 },
    right: { forward: -0.02, side: 0.14, turn: 14 },
  },
  wide: {
    hipDrop: 0.085,
    left: { forward: -0.3, side: -0.15, turn: -34 },
    right: { forward: 0.32, side: 0.13, turn: 8 },
  },
};

/**
 * The fourteen.
 *
 * Read against the reference sheet, which is drawn in profile with the opponent
 * to the left of each figure. That direction is this rig's `forward`, so a
 * blade drawn pointing at the opponent is authored at yaw zero rather than at
 * the ninety degrees the previous three carried — those were matched to the
 * preview camera's view rather than to the body, which is why the old middle
 * guard measured as pointing sideways.
 */
const GUARDS: Readonly<Record<SwordGuardPose, GuardDefinition>> = {
  // The three the plate leads with. Their hilts sit far enough from the chest
  // that both arms are visible from the side, which on a body whose arm is only
  // a third of its shoulder height is most of what decides these three: a
  // two-handed grip on the centre line spends half the arm just reaching the
  // centre, so a hilt authored close to the body has no arm left to show.
  middle: {
    blade: { pitch: 18, yaw: -6 },
    edge: 0,
    hilt: { forward: 0.62, side: 0.04, up: -0.32 },
    stance: "rightLead",
    torso: { headTurn: -6, lean: 6, turn: -14 },
  },
  high: {
    blade: { pitch: 58, yaw: -18 },
    edge: 0,
    hilt: { forward: 0.22, side: 0.1, up: 0.8 },
    stance: "rightLead",
    torso: { headPitch: -6, lean: 2, turn: -10 },
  },
  // The lean is doing real work here, not decorating. The plate holds Low's
  // hands at the waist, and on this rig a hand on the centre line that far down
  // is already past full extension before it reaches forward at all — the
  // shoulder sits half an arm off centre, so `hypot(0.49, 0.88)` is 1.01 of an
  // arm with nothing left over. Bowing the torso carries the shoulders down and
  // forward over the grip, which is what the figure in the plate is doing.
  low: {
    blade: { pitch: -42, yaw: -6 },
    edge: 0,
    hilt: { forward: 0.48, side: 0.06, up: -0.62 },
    stance: "wide",
    torso: { headPitch: -4, lean: 26, turn: -12 },
  },
  backRight: {
    blade: { pitch: -30, yaw: 150 },
    edge: 20,
    hilt: { forward: 0.22, side: 0.3, up: 0.34 },
    stance: "square",
    torso: { headTurn: -20, tilt: 6, turn: 20 },
  },
  hangingRight: {
    blade: { pitch: -40, yaw: -14 },
    edge: 90,
    hilt: { forward: 0.26, side: 0.2, up: 0.34 },
    stance: "rightLead",
    torso: { headPitch: 6, lean: 4, turn: 10 },
  },
  insideLeft: {
    blade: { pitch: 56, yaw: -34 },
    edge: -30,
    hilt: { forward: 0.48, side: 0.02, up: -0.14 },
    stance: "square",
    torso: { headTurn: -10, lean: 4, turn: -8 },
  },
  closeLeft: {
    blade: { pitch: 80, yaw: -72 },
    edge: -50,
    hilt: { forward: 0.02, side: -0.2, up: 0.16 },
    stance: "square",
    torso: { headTurn: -14, tilt: -6, turn: -16 },
  },
  hangingLeft: {
    blade: { pitch: -40, yaw: 14 },
    edge: -90,
    hilt: { forward: 0.26, side: -0.2, up: 0.34 },
    stance: "leftLead",
    torso: { headPitch: 6, lean: 4, turn: -10 },
  },
  insideRight: {
    blade: { pitch: 56, yaw: 34 },
    edge: 30,
    hilt: { forward: 0.48, side: 0.06, up: -0.14 },
    stance: "square",
    torso: { headTurn: 8, lean: 4, turn: 8 },
  },
  closeRight: {
    blade: { pitch: 80, yaw: 72 },
    edge: 50,
    hilt: { forward: 0.02, side: 0.24, up: 0.16 },
    stance: "square",
    torso: { headTurn: 12, tilt: 6, turn: 16 },
  },
  short: {
    blade: { pitch: -8, yaw: -4 },
    edge: 0,
    hilt: { forward: 0.06, side: 0.14, up: 0.34 },
    stance: "rightLead",
    torso: { headPitch: 4, lean: 4, turn: -18 },
  },
  long: {
    blade: { pitch: -10, yaw: -4 },
    edge: 0,
    hilt: { forward: 0.8, side: 0.02, up: -0.22 },
    stance: "wide",
    torso: { headPitch: 4, lean: 10, turn: -18 },
  },
  side: {
    blade: { pitch: -16, yaw: 154 },
    edge: 0,
    hilt: { forward: 0.2, side: 0.34, up: -0.44 },
    stance: "rightLead",
    torso: { headTurn: -24, lean: 8, turn: 22 },
  },
  backLeft: {
    blade: { pitch: -30, yaw: -150 },
    edge: -20,
    hilt: { forward: 0.22, side: -0.28, up: 0.34 },
    stance: "square",
    torso: { headTurn: 16, tilt: -6, turn: -20 },
  },
};

export function guardStance(pose: SwordGuardPose): SwordGuardStance {
  return GUARDS[pose].stance;
}

function axisQuaternion(axis: THREE.Vector3, degrees: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees));
}

function applyTorso(skeleton: SkeletonSwordsman, torso: TorsoAttitude | undefined): void {
  const turn = torso?.turn ?? 0;
  const lean = torso?.lean ?? 0;
  const tilt = torso?.tilt ?? 0;

  for (const name of ["hips", "spine", "chest"] as const) {
    const rotation = axisQuaternion(AXIS_TURN, turn * (TURN_SHARE[name] ?? 0))
      .multiply(axisQuaternion(AXIS_LEAN, lean * (LEAN_SHARE[name] ?? 0)))
      .multiply(axisQuaternion(AXIS_TILT, tilt * (TILT_SHARE[name] ?? 0)));
    skeleton.getBone(name).quaternion.copy(rotation);
  }

  for (const name of ["neck", "head"] as const) {
    const share = HEAD_SHARE[name] ?? 0;
    skeleton
      .getBone(name)
      .quaternion.copy(
        axisQuaternion(AXIS_TURN, (torso?.headTurn ?? 0) * share).multiply(
          axisQuaternion(AXIS_LEAN, (torso?.headPitch ?? 0) * share),
        ),
      );
  }
}

/**
 * Where the middle joint of a two-bone chain lands, given both ends and a pole.
 *
 * The clamp is deliberate and is the reason the instrument exists: an
 * unreachable target has to resolve to something, and what it resolves to is a
 * dead-straight limb that looks like a badly authored pose rather than an
 * impossible one. Nothing here reports that — `guardFindings` measures the
 * result and names it, which is a stronger check than trusting the solver's own
 * account of what it did.
 */
function solveMiddleJoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  pole: THREE.Vector3,
  upperLength: number,
  lowerLength: number,
): THREE.Vector3 {
  const direction = end.clone().sub(start);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    Math.abs(upperLength - lowerLength) + 0.001,
    upperLength + lowerLength - 0.001,
  );
  direction.normalize();

  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const bend = pole.clone().sub(start);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 0.0001) {
    bend.set(0, 0, 1);
  }
  bend.normalize();

  return start.clone().addScaledVector(direction, along).addScaledVector(bend, height);
}

function pointBoneAt(bone: THREE.Bone, child: THREE.Bone, worldTarget: THREE.Vector3): void {
  const parent = bone.parent;
  if (!parent) {
    throw new Error(`Cannot pose detached bone: ${bone.name}`);
  }

  const targetInParent = parent.worldToLocal(worldTarget.clone());
  const targetDirection = targetInParent.sub(bone.position).normalize();
  bone.quaternion.setFromUnitVectors(child.position.clone().normalize(), targetDirection);
}

function solveLimb(
  skeleton: SkeletonSwordsman,
  bones: readonly [SkeletonBoneName, SkeletonBoneName, SkeletonBoneName],
  target: THREE.Vector3,
  pole: THREE.Vector3,
): void {
  const [rootName, middleName, endName] = bones;
  const rootBone = skeleton.getBone(rootName);
  const middleBone = skeleton.getBone(middleName);
  const endBone = skeleton.getBone(endName);
  const rootWorld = rootBone.getWorldPosition(new THREE.Vector3());
  const middleTarget = solveMiddleJoint(
    rootWorld,
    target,
    pole,
    middleBone.position.length(),
    endBone.position.length(),
  );

  pointBoneAt(rootBone, middleBone, middleTarget);
  skeleton.root.updateMatrixWorld(true);
  pointBoneAt(middleBone, endBone, target);
  skeleton.root.updateMatrixWorld(true);
}

/**
 * Turn a bone so that two of its local axes land on two world directions.
 *
 * Aiming one axis is what `setFromUnitVectors` does, and it leaves the rotation
 * about that axis to whichever arc happened to be shortest. For a sword that
 * roll is the edge, and several of the fourteen share a hilt and a blade
 * direction and are separated by nothing else — so both axes are pinned here
 * and the roll becomes an authored value rather than a side effect.
 */
function orientToBasis(bone: THREE.Bone, blade: THREE.Vector3, edge: THREE.Vector3): void {
  const parent = bone.parent;
  if (!parent) {
    throw new Error(`Cannot orient detached bone: ${bone.name}`);
  }

  const worldEdge = edge.clone().addScaledVector(blade, -edge.dot(blade)).normalize();
  const worldBasis = new THREE.Matrix4().makeBasis(blade, worldEdge, blade.clone().cross(worldEdge));
  const localBasis = new THREE.Matrix4()
    .makeBasis(SWORD_BLADE_AXIS, SWORD_EDGE_AXIS, SWORD_BLADE_AXIS.clone().cross(SWORD_EDGE_AXIS))
    .transpose();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(worldBasis.multiply(localBasis));

  bone.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
}

function placeFoot(skeleton: SkeletonSwordsman, scale: BodyScale, foot: StanceFoot): THREE.Vector3 {
  return skeleton.root.localToWorld(new THREE.Vector3(-foot.side * scale.leg, scale.groundY, foot.forward * scale.leg));
}

function solveLeg(skeleton: SkeletonSwordsman, scale: BodyScale, side: "left" | "right", foot: StanceFoot): void {
  const hip = skeleton.getBone(`${side}Hip`);
  const hipWorld = hip.getWorldPosition(new THREE.Vector3());
  const target = placeFoot(skeleton, scale, foot);
  const pole = hipWorld
    .clone()
    .add(new THREE.Vector3(0, 0, KNEE_FORWARD * scale.leg).transformDirection(skeleton.root.matrixWorld))
    .addScaledVector(new THREE.Vector3(0, 1, 0), -KNEE_DOWN * scale.leg);

  solveLimb(skeleton, [`${side}Hip`, `${side}Knee`, `${side}Foot`], target, pole);

  // The sole stays flat on the floor whatever the leg above it did, then turns
  // out by the stance's own angle. A foot that inherits the shin's rotation is
  // the usual reason a wide stance reads as tiptoeing.
  const footBone = skeleton.getBone(`${side}Foot`);
  const parent = footBone.parent;
  if (!parent) {
    throw new Error(`Cannot orient detached foot: ${footBone.name}`);
  }
  const level = skeleton.root.getWorldQuaternion(new THREE.Quaternion()).multiply(axisQuaternion(AXIS_TURN, foot.turn));
  footBone.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(level));
  skeleton.root.updateMatrixWorld(true);
}

function solveArm(
  skeleton: SkeletonSwordsman,
  scale: BodyScale,
  frame: BodyFrame,
  side: "left" | "right",
  target: THREE.Vector3,
  hint: ElbowHint | undefined,
): void {
  const down = (side === "left" ? hint?.leftDown : hint?.rightDown) ?? ELBOW_DOWN;
  const splay = (side === "left" ? hint?.leftOut : hint?.rightOut) ?? ELBOW_SPLAY;
  const shoulder = skeleton.getBone(`${side}Shoulder`).getWorldPosition(new THREE.Vector3());

  // Which way the elbow leans is the hands' business, not the shoulder's: the
  // pole follows the hilt across the body so the forearm always arrives at the
  // grip from outside it, and only a small fixed splay is left to keep the two
  // elbows apart when the hilt is on the centre line.
  const acrossBody = THREE.MathUtils.clamp(target.clone().sub(frame.origin).dot(frame.right) / scale.arm, -1, 1);
  const lateral = acrossBody * ELBOW_FOLLOW + (side === "right" ? splay : -splay);
  const pole = shoulder
    .clone()
    .addScaledVector(frame.up, -down * scale.arm)
    .addScaledVector(frame.right, lateral * scale.arm)
    .addScaledVector(frame.forward, -ELBOW_BACK * scale.arm);

  solveLimb(skeleton, [`${side}Shoulder`, `${side}Elbow`, `${side}Hand`], target, pole);
}

export function applySwordGuardPose(skeleton: SkeletonSwordsman, pose: SwordGuardPose): void {
  const definition = GUARDS[pose];
  const stance = STANCES[definition.stance];
  const scale = readBodyScale(skeleton);

  skeleton.resetPose();
  applyTorso(skeleton, definition.torso);
  skeleton.getBone("hips").position.y = skeleton.restPosition("hips").y - stance.hipDrop * scale.leg;
  skeleton.root.updateMatrixWorld(true);

  solveLeg(skeleton, scale, "left", stance.left);
  solveLeg(skeleton, scale, "right", stance.right);

  // The sword's placement is resolved from the chest only after the torso and
  // the legs have settled, so a guard's hilt follows the turn and the hip drop
  // without either being restated. Nothing after this point re-reads anything
  // before it, which is what keeps the torso and the hilt from chasing.
  const frame = readBodyFrame(skeleton);
  const hilt = frameToWorld(frame, scale, definition.hilt);
  const blade = frameDirectionToWorld(frame, definition.blade);
  const reference = frame.up.clone().addScaledVector(blade, -frame.up.dot(blade));
  if (reference.lengthSq() < 1e-4) {
    reference.copy(frame.forward).addScaledVector(blade, -frame.forward.dot(blade));
  }
  const edge = reference.normalize().applyAxisAngle(blade, THREE.MathUtils.degToRad(definition.edge));

  solveArm(skeleton, scale, frame, "right", hilt, definition.elbows);
  solveArm(skeleton, scale, frame, "left", hilt.clone().addScaledVector(blade, -SWORD_GRIP_SPAN), definition.elbows);
  orientToBasis(skeleton.getBone("rightHand"), blade, edge);
  orientToBasis(skeleton.getBone("leftHand"), blade, edge);
  skeleton.root.updateMatrixWorld(true);
}
