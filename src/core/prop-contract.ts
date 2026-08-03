/**
 * What a prop is: the record shapes for weight and behaviour, and the lookups the rules resolve
 * throws through.
 *
 * The authored rows — thirteen weights and thirteen behaviours — live in the content layer and
 * arrive through the game catalog; the lookups here take that catalog, so the rules can answer what
 * a throw does without importing the table that says so.
 */

import type { GameCatalog } from "@/core/catalog";
import type { PropKind } from "@/core/prop-kinds";

export type DemoPropKind = PropKind;
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
 * What a throw does to the bodies it reaches while it is still in the air.
 *
 * `reap` is the one that spends nothing on them: it kills whatever it touches whatever that thing
 * had left, and none of it ends the flight. A weapon that bodies cannot stop has to be counting
 * something else, which is why the capacity below reads as masonry for exactly this value.
 */
export type DemoPropFlightHit = "stop" | "skewer" | "cleave" | "reap";

/** What it does where it stops, whether that is a wall, a body, or the end of its range. */
export type DemoPropLanding = "spend" | "burst" | "detonate" | "pin" | "strike";

/**
 * What the left hand does with it: opens, or pulls a trigger.
 *
 * Everything in the demo was thrown, and the button that throws was the same button that swings —
 * hands full meant throw, hands empty meant cut. A shooter is the third case, and it is a different
 * kind of object rather than a different kind of throw: what leaves the hand is not the thing being
 * held, and the thing being held is still there afterwards until its uses run out.
 */
export type DemoPropUse = "throw" | "shoot";

/**
 * What the number on a stack counts.
 *
 * Three stakes are three objects; a crossbow holding three shots is one object with three uses in
 * it. Both arrive as `count: 3`, and every reader of that number used to work out which it was for
 * itself — the floor drew three crossbows, and it was right by accident for everything else.
 *
 * Declared rather than derived. It happens to line up exactly with `use` today, because the only
 * thing holding charges is the only thing that is aimed; that is a coincidence of a table with one
 * shooter in it, not a rule. A thrown weapon with uses in it, or a shooter picked up one shot at a
 * time, would each break the guess silently — and this is a fact about the object rather than about
 * how it is drawn, which is why it lives here and not in the authored display table where somebody
 * could tune a crossbow into three of them.
 */
export type DemoPropCount = "objects" | "charges";

/** How it is drawn on the way there. */
export type DemoPropForm = "billboard" | "tumbling" | "rod";

export type DemoPropBehaviour = Readonly<{
  use: DemoPropUse;
  counts: DemoPropCount;
  /**
   * What the hand is left holding once a shooter's uses run out. Only shooters set it.
   *
   * Distinct from `leaves`, which is what a *thrown* prop drops where it landed. This one never
   * touches the floor: the weapon is spent in the hand and what remains is still in it.
   */
  spends?: DemoPropKind;
  flightHit: DemoPropFlightHit;
  /**
   * How much this throw is allowed to spend before it is full and comes down.
   *
   * On the prop rather than a constant per verb, which is what it used to be: one number for every
   * skewer and one for every cleave, so two weapons could not disagree about how many they take. A
   * stake takes one because the single body lifted off its feet and nailed to the far wall is the
   * whole picture; a proper javelin runs three through and they arrive in a heap.
   *
   * Counted in bodies, except for a `reap`, which bodies do not cost at all — there it is walls.
   * Ignored by anything that stops at the first thing it touches.
   */
  capacity: number;
  landing: DemoPropLanding;
  /** Against the hit points in `@/demo/maze`: a bare swing is one, and a rock opens either wall. */
  wallDamage: number;
  /**
   * What lies on the floor where it stopped, or nothing if the throw spent it.
   *
   * A kind rather than a flag, so wear is a thing you can see. A femur comes back cracked and the
   * cracked one comes back as nothing, which is a two-use weapon expressed entirely in this column —
   * no counter on the prop, no durability field, and the picture in your hand is the count.
   */
  leaves: DemoPropKind | undefined;
  form: DemoPropForm;
}>;

export function propBehaviour(catalog: GameCatalog, kind: DemoPropKind): DemoPropBehaviour {
  return catalog.propBehaviours[kind];
}

export function propWeight(catalog: GameCatalog, kind: DemoPropKind): DemoThrowWeight {
  return catalog.propWeights[kind];
}

/**
 * How many bodies this throw takes before it is full, for anything that pierces or cleaves.
 *
 * Tolerates a thrown body the way `throwWeight` and the wall-damage lookup already do: a body does
 * neither of those things, so the number is never consulted for one, and answering rather than
 * refusing keeps the flight step from having to know which kinds are props.
 */
export function throwCapacity(catalog: GameCatalog, kind: DemoThrowKind): number {
  return kind === "enemy" ? 1 : catalog.propBehaviours[kind].capacity;
}

/**
 * Whether masonry is something this throw spends rather than something that stops it.
 *
 * Read off the flight rule instead of being declared again beside it, because they are one statement:
 * a weapon nothing alive can stop is the same weapon that opens the wall behind them.
 */
export function breaksThroughWalls(catalog: GameCatalog, kind: DemoThrowKind): boolean {
  return kind !== "enemy" && catalog.propBehaviours[kind].flightHit === "reap";
}

/**
 * What is in flight, or about to be.
 *
 * The body's weight is passed in rather than looked up here: whose body it is stays the caller's
 * business, which is what keeps this module from having to know that enemies exist.
 */
export function throwWeight(
  catalog: GameCatalog,
  kind: DemoThrowKind,
  body: DemoThrowWeight | undefined,
): DemoThrowWeight {
  if (kind === "enemy") {
    return body ?? catalog.defaultBodyWeight;
  }

  return catalog.propWeights[kind];
}
