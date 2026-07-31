import * as THREE from "three";

import { readBodyFrame, readBodyScale, worldDirectionToFrame, worldToFrame } from "./body-frame";
import type { SkeletonSwordsman } from "./skeleton-swordsman";
import { SWORD_BLADE_AXIS, SWORD_EDGE_AXIS } from "./skeleton-swordsman";

/**
 * What a posed guard actually measures, read off the real rig with no renderer.
 *
 * This exists because "it reads differently" is not a claim anyone can check,
 * and because the failures this set is prone to are all invisible in a
 * screenshot. An arm asked to reach further than it can comes back straight and
 * silent; a foot floating an eighth of a body above the floor looks like a
 * stance; two guards four degrees apart look like two guards until somebody
 * tries to tell them apart from across a room.
 *
 * Every length is in body units — see `BodyScale` — so a number here means the
 * same thing on a different rig, and can be read off the reference drawings.
 */
export type GuardMetrics = Readonly<{
  /**
   * Signed horizontal margin from the centre of mass to the support the feet
   * provide, in leg-lengths. Negative is inside the footprint; positive is
   * falling over. Signed rather than absolute for the same reason a hand near a
   * plank is: an unsigned distance reads the same on both sides of the line.
   */
  balance: number;
  /** Roll of the true edge about the blade axis, degrees. Zero faces the body's up. */
  edge: number;
  /** Largest distance any foot sits off the ground plane. Anything but zero is a bug. */
  footClearance: number;
  /** Distance between the hands. Constant across every guard or the sword is being stretched. */
  gripSpan: number;
  /** Hilt position from the shoulder midpoint, in arm-lengths, in the chest's frame. */
  hilt: Readonly<{ forward: number; side: number; up: number }>;
  /**
   * Shoulder-to-hand distance as a fraction of arm length.
   *
   * At or above 1 the pose is impossible and the two-bone solver is clamping
   * without saying so. Near 1 the arm is locked straight, which is reachable and
   * still reads as a mannequin. A comfortable guard sits around 0.75 to 0.90.
   */
  reachLeft: number;
  reachRight: number;
  /** Blade tip height above the ground plane, in leg-lengths, plus its pitch and yaw in the chest's frame. */
  tip: Readonly<{ height: number; pitch: number; yaw: number }>;
}>;

export type MeasuredGuard = Readonly<{
  label: string;
  metrics: GuardMetrics;
}>;

/** Two guards that measure alike, and how alike. */
export type GuardCollision = Readonly<{
  distance: number;
  left: string;
  right: string;
}>;

/** Where the solver could not honour what a guard asked for. */
export type GuardFinding = Readonly<{
  detail: string;
  guard: string;
  kind: "balance" | "folded-arm" | "foot-clearance" | "grip" | "locked-arm" | "unreachable";
}>;

/** Above this, the two-bone solver is clamping and the authored hilt is out of reach. */
const REACH_IMPOSSIBLE = 0.995;
/** Above this the arm is straight enough to read as stiff, even though it resolves. */
const REACH_LOCKED = 0.97;
/** Below this the hand is nearly at its own shoulder and the arm reads as crumpled rather than drawn in. */
const REACH_FOLDED = 0.3;
/** A foot further than this off the floor is floating rather than lifted by a stance. */
const FOOT_CLEARANCE_LIMIT = 0.01;
/** The centre of mass may sit this far outside the footprint before the pose reads as a fall. */
const BALANCE_LIMIT = 0.04;
/** How far the hands may drift from the authored grip span before the sword is being stretched. */
const GRIP_TOLERANCE = 0.01;

function footprintCorners(skeleton: SkeletonSwordsman): THREE.Vector2[] {
  const corners: THREE.Vector2[] = [];

  for (const name of ["leftFoot", "rightFoot"] as const) {
    const foot = skeleton.getBone(name);
    // The foot box is 0.52 deep, centred 0.18 ahead of the ankle: heel behind, toe well forward.
    for (const along of [-0.08, 0.44]) {
      const corner = foot.localToWorld(new THREE.Vector3(0, 0, along));
      corners.push(new THREE.Vector2(corner.x, corner.z));
    }
  }

  return corners;
}

function turnsRight(origin: THREE.Vector2, first: THREE.Vector2, second: THREE.Vector2): number {
  return (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
}

function hullChain(source: readonly THREE.Vector2[]): THREE.Vector2[] {
  const chain: THREE.Vector2[] = [];

  for (const point of source) {
    while (chain.length >= 2 && turnsRight(chain[chain.length - 2]!, chain[chain.length - 1]!, point) <= 0) {
      chain.pop();
    }
    chain.push(point);
  }
  chain.pop();

  return chain;
}

function convexHull(points: readonly THREE.Vector2[]): THREE.Vector2[] {
  // Copied before sorting; the linter's mutation warning here is on the copy.
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  return [...hullChain(sorted), ...hullChain([...sorted].reverse())];
}

/**
 * Signed distance from a point to a convex footprint: negative inside, positive
 * outside. Taken as the largest outward distance to any edge, which is the
 * amount by which the pose has crossed the line it crossed furthest.
 */
function supportMargin(point: THREE.Vector2, hull: readonly THREE.Vector2[]): number {
  if (hull.length < 3) {
    return Number.POSITIVE_INFINITY;
  }

  let margin = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < hull.length; index += 1) {
    const from = hull[index]!;
    const to = hull[(index + 1) % hull.length]!;
    const edge = new THREE.Vector2().subVectors(to, from);
    const length = edge.length();
    if (length < 1e-6) {
      continue;
    }
    // Hull winding is counter-clockwise, so the outward normal is the edge turned right.
    const outward = new THREE.Vector2(edge.y, -edge.x).divideScalar(length);
    margin = Math.max(margin, new THREE.Vector2().subVectors(point, from).dot(outward));
  }

  return margin;
}

/**
 * Centre of mass, weighted by each visible part's own bulk.
 *
 * The parts already carry a radius for the destruction showcases, so cubing it
 * gives a mass proxy that follows the model rather than a table of guesses that
 * would drift away from it.
 */
function centreOfMass(skeleton: SkeletonSwordsman): THREE.Vector3 {
  const total = new THREE.Vector3();
  let mass = 0;

  for (const part of skeleton.parts) {
    const weight = part.radius ** 3;
    total.addScaledVector(part.node.getWorldPosition(new THREE.Vector3()), weight);
    mass += weight;
  }

  return mass > 0 ? total.divideScalar(mass) : total;
}

export function measureGuard(skeleton: SkeletonSwordsman): GuardMetrics {
  skeleton.root.updateMatrixWorld(true);
  const scale = readBodyScale(skeleton);
  const frame = readBodyFrame(skeleton);

  const leftShoulder = skeleton.getBone("leftShoulder").getWorldPosition(new THREE.Vector3());
  const rightShoulder = skeleton.getBone("rightShoulder").getWorldPosition(new THREE.Vector3());
  const leftHand = skeleton.getBone("leftHand").getWorldPosition(new THREE.Vector3());
  const rightHand = skeleton.getBone("rightHand").getWorldPosition(new THREE.Vector3());

  const handRotation = skeleton.getBone("rightHand").getWorldQuaternion(new THREE.Quaternion());
  const blade = SWORD_BLADE_AXIS.clone().applyQuaternion(handRotation).normalize();
  const edge = SWORD_EDGE_AXIS.clone().applyQuaternion(handRotation).normalize();
  const tip = skeleton.swordTipWorld(new THREE.Vector3());

  // Roll is measured against the body's up projected across the blade; when the
  // blade is near-vertical that reference collapses, so forward stands in.
  const reference = frame.up.clone().addScaledVector(blade, -frame.up.dot(blade));
  if (reference.lengthSq() < 1e-4) {
    reference.copy(frame.forward).addScaledVector(blade, -frame.forward.dot(blade));
  }
  reference.normalize();
  const rollSign = Math.sign(reference.clone().cross(edge).dot(blade)) || 1;
  const roll = Math.acos(THREE.MathUtils.clamp(reference.dot(edge), -1, 1)) * rollSign;

  const footClearance = Math.max(
    Math.abs(skeleton.getBone("leftFoot").getWorldPosition(new THREE.Vector3()).y - scale.groundY),
    Math.abs(skeleton.getBone("rightFoot").getWorldPosition(new THREE.Vector3()).y - scale.groundY),
  );

  const mass = centreOfMass(skeleton);
  const margin = supportMargin(new THREE.Vector2(mass.x, mass.z), convexHull(footprintCorners(skeleton)));

  return {
    balance: margin / scale.leg,
    edge: THREE.MathUtils.radToDeg(roll),
    footClearance,
    gripSpan: leftHand.distanceTo(rightHand),
    hilt: worldToFrame(frame, scale, rightHand),
    reachLeft: leftShoulder.distanceTo(leftHand) / scale.arm,
    reachRight: rightShoulder.distanceTo(rightHand) / scale.arm,
    tip: {
      height: (tip.y - scale.groundY) / scale.leg,
      ...worldDirectionToFrame(frame, blade),
    },
  };
}

/**
 * How far apart two guards read.
 *
 * Hilt offsets are already in arm-lengths, reach is already a fraction of one,
 * and the angles are divided by a right angle, so the four terms arrive at
 * comparable size and no weighting table is needed. Edge counts for half,
 * because a roll separates two guards less than a blade pointing somewhere else
 * does.
 *
 * Extension is in here because hilt position alone cannot see it. Two guards
 * whose hands sit in nearly the same place with one arm bent and the other
 * locked out are different silhouettes from across a room, and that is the pair
 * this set kept producing.
 */
export function guardDistance(left: GuardMetrics, right: GuardMetrics): number {
  const hilt = Math.hypot(
    left.hilt.up - right.hilt.up,
    left.hilt.forward - right.hilt.forward,
    left.hilt.side - right.hilt.side,
  );
  const aim = Math.hypot(left.tip.pitch - right.tip.pitch, left.tip.yaw - right.tip.yaw) / 90;
  const edge = Math.abs(left.edge - right.edge) / 90;
  const extension = Math.abs((left.reachLeft + left.reachRight) / 2 - (right.reachLeft + right.reachRight) / 2);

  return hilt + aim + extension + edge * 0.5;
}

/** Every pair, closest first. With fourteen poses the risk is not one looking wrong but four looking alike. */
export function guardRegister(guards: readonly MeasuredGuard[]): GuardCollision[] {
  const collisions: GuardCollision[] = [];

  for (let index = 0; index < guards.length; index += 1) {
    for (let other = index + 1; other < guards.length; other += 1) {
      const left = guards[index]!;
      const right = guards[other]!;
      collisions.push({ distance: guardDistance(left.metrics, right.metrics), left: left.label, right: right.label });
    }
  }

  return collisions.sort((a, b) => a.distance - b.distance);
}

/**
 * Everything the solver could not honour, named.
 *
 * The point of the whole instrument: the two-bone solver clamps an impossible
 * reach and returns a straight arm with no signal, which is why an unreachable
 * guard has always looked like a badly authored one.
 */
export function guardFindings(guards: readonly MeasuredGuard[], gripSpan: number): GuardFinding[] {
  const findings: GuardFinding[] = [];

  for (const { label, metrics } of guards) {
    for (const [side, reach] of [
      ["right", metrics.reachRight],
      ["left", metrics.reachLeft],
    ] as const) {
      if (reach >= REACH_IMPOSSIBLE) {
        findings.push({
          detail: `${side} arm at ${reach.toFixed(3)} of its length — the hilt is out of reach and the solver is clamping`,
          guard: label,
          kind: "unreachable",
        });
      } else if (reach >= REACH_LOCKED) {
        findings.push({
          detail: `${side} arm at ${reach.toFixed(3)} of its length — reachable, but straight enough to read as stiff`,
          guard: label,
          kind: "locked-arm",
        });
      } else if (reach <= REACH_FOLDED) {
        findings.push({
          detail: `${side} arm at ${reach.toFixed(3)} of its length — the hand is almost at its own shoulder`,
          guard: label,
          kind: "folded-arm",
        });
      }
    }

    if (metrics.footClearance > FOOT_CLEARANCE_LIMIT) {
      findings.push({
        detail: `a foot sits ${metrics.footClearance.toFixed(3)} off the floor`,
        guard: label,
        kind: "foot-clearance",
      });
    }

    if (metrics.balance > BALANCE_LIMIT) {
      findings.push({
        detail: `centre of mass ${metrics.balance.toFixed(3)} leg-lengths outside the footprint`,
        guard: label,
        kind: "balance",
      });
    }

    if (Math.abs(metrics.gripSpan - gripSpan) > GRIP_TOLERANCE) {
      findings.push({
        detail: `hands ${metrics.gripSpan.toFixed(3)} apart against a grip of ${gripSpan.toFixed(3)}`,
        guard: label,
        kind: "grip",
      });
    }
  }

  return findings;
}
