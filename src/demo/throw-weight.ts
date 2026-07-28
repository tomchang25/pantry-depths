/**
 * What can be thrown, and what it weighs.
 *
 * Weight used to be two numbers — a speed and a range — and neither of them could make anything feel
 * heavy, because the flight curve ignored both: every throw left the hand along the aim line and came
 * down on the landing point in a symmetric arc, so a body and a pebble drew the same shape at
 * different speeds. Slowing a body down only ever made it a slow pebble.
 *
 * So weight is a record rather than a number, and every field is here because something visible reads
 * from it. Tuning heft is editing one row.
 *
 * Each row lives where the thing does. The loose props are named below; a slime's weight is its own
 * property on its archetype, beside its health and its speed. That split is deliberate — how heavy a
 * body is has nothing to do with how much of it there is to kill, and deriving one from the other
 * would tie two knobs together that want to move separately.
 *
 * This module imports nothing. It is the vocabulary both the props and the bodies speak, so it must
 * not depend on either of them.
 */

export type DemoPropKind = "stick" | "rock" | "bomb" | "axe";
export type DemoThrowKind = DemoPropKind | "enemy";

export type DemoThrowWeight = Readonly<{
  /** Cells per second it leaves the hand at. */
  speed: number;
  /** Cells it covers before it is spent, before the crosshair-to-floor cap shortens it. */
  range: number;
  /** Whether gravity brings it down on its landing point, or it flies the line it was pointed along. */
  lobbed: boolean;
  /** Fraction of forward speed shed per second in flight. Zero flies at a constant speed. */
  drag: number;
  /**
   * Where the flight spends its height, as the power the fall term is raised to — one is the
   * symmetric parabola every throw used to draw.
   *
   * Below one peaks early and spends the rest of the throw coming down, which is a body. Above one
   * carries flat and then drops away at the very end, which is a stone skipping out to its range.
   *
   * It is the one shape knob weight is allowed, because it is the only one that leaves the aim
   * intact: the throw still departs along the aim line and still lands where the crosshair met the
   * floor. A knob that scaled the launch angle instead would make heavy things fly somewhere other
   * than where they were pointed, and pointing is not negotiable. See `projectileHeight`.
   */
  plunge: number;
  /** What the throw costs the thrower: a shove backwards and a jolt of the view. */
  recoil: number;
  /** How hard the arrival lands — dust off the floor, the same jolt, and how hard it barges through. */
  thud: number;
  /** Movement speed multiplier while it is being carried. One is a hand that costs nothing. */
  carrySlow: number;
}>;

/**
 * The loose props, unchanged in speed and range from when those were the only two numbers.
 *
 * They are deliberately near-weightless in the new fields: the point of this table is that a body is
 * heavy, and a body is only heavy next to the rock you throw one-handed.
 */
const PROP_WEIGHTS: Readonly<Record<DemoPropKind, DemoThrowWeight>> = {
  stick: {
    speed: 22,
    range: 40,
    lobbed: false,
    drag: 0,
    plunge: 1,
    recoil: 0.12,
    thud: 0.1,
    carrySlow: 1,
  },
  rock: {
    speed: 14,
    range: 8,
    lobbed: true,
    drag: 0.1,
    plunge: 1.15,
    recoil: 0.2,
    thud: 0.35,
    carrySlow: 1,
  },
  bomb: {
    speed: 12,
    range: 9,
    lobbed: true,
    drag: 0.08,
    plunge: 1.1,
    recoil: 0.15,
    thud: 0.2,
    carrySlow: 1,
  },
  axe: {
    speed: 16,
    range: 10,
    lobbed: false,
    drag: 0.04,
    plunge: 1,
    recoil: 0.22,
    thud: 0.25,
    carrySlow: 0.96,
  },
};

/**
 * A body, when nothing better is known about whose it was.
 *
 * Every archetype carries its own row, so this is only reached by a throw that has lost its payload —
 * and it is the plain slime's weight, because that is the body the demo throws most.
 */
export const DEFAULT_BODY_WEIGHT: DemoThrowWeight = {
  speed: 9,
  // Four and a half cells, against a rock's eight. A body is thrown across a fight, not across the
  // room: what came back from the first pass at this was that a slime still flew like a stone, and
  // the range was most of the reason.
  range: 4.5,
  lobbed: true,
  drag: 0.55,
  plunge: 0.82,
  recoil: 0.9,
  thud: 1,
  carrySlow: 0.82,
};

export function propWeight(kind: DemoPropKind): DemoThrowWeight {
  return PROP_WEIGHTS[kind];
}

/**
 * What is in flight, or about to be.
 *
 * The body's weight is passed in rather than looked up here: whose body it is stays the caller's
 * business, which is what keeps this module from having to know that enemies exist.
 */
export function throwWeight(kind: DemoThrowKind, body: DemoThrowWeight | undefined): DemoThrowWeight {
  if (kind === "enemy") {
    return body ?? DEFAULT_BODY_WEIGHT;
  }

  return PROP_WEIGHTS[kind];
}
