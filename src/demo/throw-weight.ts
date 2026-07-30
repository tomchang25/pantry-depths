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

export type DemoPropKind =
  | "stick"
  | "rock"
  | "bomb"
  | "axe"
  | "skeletonSword"
  | "skeletonSkull"
  | "skeletonFemur"
  | "skeletonFemurCracked"
  | "skeletonJavelin"
  | "skeletonJavelinCracked"
  | "crossbow"
  | "crossbowSpent"
  | "crossbowBolt";
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
  // The javelin flies exactly as the stake does — same speed, same range, same flat line. What sets
  // it apart is what it does when it arrives, not how it gets there.
  skeletonJavelin: {
    speed: 22,
    range: 40,
    lobbed: false,
    drag: 0,
    plunge: 1,
    recoil: 0.16,
    thud: 0.14,
    carrySlow: 1,
  },
  skeletonJavelinCracked: {
    speed: 22,
    range: 40,
    lobbed: false,
    drag: 0,
    plunge: 1,
    recoil: 0.16,
    thud: 0.14,
    carrySlow: 1,
  },
  // Flat and fast, and further than an arm can throw anything: a bolt is the player's answer to the
  // spitters at their own range.
  crossbowBolt: {
    speed: 30,
    range: 40,
    lobbed: false,
    drag: 0,
    plunge: 1,
    recoil: 0.1,
    thud: 0.08,
    carrySlow: 1,
  },
  // The stock in the hand: heavy enough to be felt while it is carried, and it barely flies at all
  // once there is nothing left to shoot.
  crossbow: {
    speed: 12,
    range: 6,
    lobbed: true,
    drag: 0.5,
    plunge: 0.9,
    recoil: 0.5,
    thud: 0.6,
    carrySlow: 0.92,
  },
  crossbowSpent: {
    speed: 14,
    range: 7,
    lobbed: false,
    drag: 0.2,
    plunge: 1,
    recoil: 0.5,
    thud: 0.6,
    carrySlow: 0.92,
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
  skeletonSword: {
    // Thrown flat, but it is a sword rather than a tracer round: the drag is what stops it reading as
    // a straight line drawn instantly across the room, which is all the first pass at these numbers
    // ever managed.
    speed: 15,
    range: 8.5,
    lobbed: false,
    drag: 0.22,
    plunge: 1,
    recoil: 0.2,
    thud: 0.32,
    carrySlow: 0.97,
  },
  skeletonSkull: {
    speed: 12,
    range: 7,
    lobbed: true,
    drag: 0.18,
    plunge: 1.05,
    recoil: 0.24,
    thud: 0.42,
    carrySlow: 0.98,
  },
  skeletonFemur: {
    speed: 17,
    range: 10,
    lobbed: true,
    drag: 0.08,
    plunge: 0.98,
    recoil: 0.18,
    thud: 0.28,
    carrySlow: 0.98,
  },
  // Half a bone throws like half a bone: shorter, and it sheds what speed it has faster.
  skeletonFemurCracked: {
    speed: 15,
    range: 7,
    lobbed: true,
    drag: 0.16,
    plunge: 0.98,
    recoil: 0.14,
    thud: 0.22,
    carrySlow: 0.99,
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

/** What a throw does to the bodies it reaches while it is still in the air. */
export type DemoPropFlightHit = "stop" | "skewer" | "cleave";

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

/** How it is drawn on the way there. */
export type DemoPropForm = "billboard" | "tumbling" | "rod";

export type DemoPropBehaviour = Readonly<{
  use: DemoPropUse;
  /**
   * What the hand is left holding once a shooter's uses run out. Only shooters set it.
   *
   * Distinct from `leaves`, which is what a *thrown* prop drops where it landed. This one never
   * touches the floor: the weapon is spent in the hand and what remains is still in it.
   */
  spends?: DemoPropKind;
  flightHit: DemoPropFlightHit;
  /**
   * How many bodies a piercing throw takes before it is full and comes down.
   *
   * On the prop rather than a constant per verb, which is what it used to be: one number for every
   * skewer and one for every cleave, so two weapons could not disagree about how many they take. A
   * stake takes one because the single body lifted off its feet and nailed to the far wall is the
   * whole picture; a proper javelin runs three through and they arrive in a heap.
   *
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

/**
 * What each throw does, in one place, because it used to be in three.
 *
 * Flight behaviour was a branch chain in the projectile step, landing behaviour was a second chain in
 * `finishProjectile`, and how the thing was drawn on the way was a third in the scene. Adding the
 * skeleton's three props meant adding a case to each — and the sword got a case in only two of them,
 * so a thrown sword passed the hit test, ended its flight, and then did nothing at all: no damage, no
 * impact, no object left on the floor. It was a weapon that deleted itself on contact.
 *
 * A row per prop is the fix. A kind that is missing something is now missing it visibly, in a table
 * where the thing beside it has one.
 */
const PROP_BEHAVIOURS: Readonly<Record<DemoPropKind, DemoPropBehaviour>> = {
  // A sharpened stake: it runs one body through and nails it to whatever stops it. Not a javelin —
  // that is a weapon of its own further down, and the two are told apart by what they carry.
  stick: {
    use: "throw",
    flightHit: "skewer",
    capacity: 1,
    landing: "pin",
    wallDamage: 2,
    leaves: undefined,
    form: "rod",
  },
  rock: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "burst",
    wallDamage: 4,
    leaves: undefined,
    form: "billboard",
  },
  bomb: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "detonate",
    wallDamage: 2,
    leaves: undefined,
    form: "billboard",
  },
  // The two blades cut through three bodies and then lie where they stopped. Neither wears out: what
  // they cost you is the walk back to them, which is a decision you make in the middle of a fight and
  // not an inventory that quietly runs down.
  axe: { use: "throw", flightHit: "cleave", capacity: 3, landing: "spend", wallDamage: 2, leaves: "axe", form: "rod" },
  skeletonSword: {
    use: "throw",
    flightHit: "cleave",
    capacity: 3,
    landing: "spend",
    wallDamage: 3,
    leaves: "skeletonSword",
    form: "rod",
  },
  // The skull is the skeleton's rock: one throw, and it is a mess on the floor.
  skeletonSkull: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "burst",
    wallDamage: 2,
    leaves: undefined,
    form: "tumbling",
  },
  // The femur is the one that wears. It comes back cracked, and the cracked one does not come back.
  skeletonFemur: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "strike",
    wallDamage: 2,
    leaves: "skeletonFemurCracked",
    form: "tumbling",
  },
  skeletonFemurCracked: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "strike",
    wallDamage: 1,
    leaves: undefined,
    form: "tumbling",
  },
  // The javelin, and the one throw that takes a crowd off its feet at once: three bodies run through
  // and pinned wherever the shaft finally stops. It wears out the way the femur does — two throws, the
  // second from a shaft that comes back visibly bent and does not come back again.
  skeletonJavelin: {
    use: "throw",
    flightHit: "skewer",
    capacity: 3,
    landing: "pin",
    wallDamage: 2,
    leaves: "skeletonJavelinCracked",
    form: "rod",
  },
  skeletonJavelinCracked: {
    use: "throw",
    flightHit: "skewer",
    capacity: 3,
    landing: "pin",
    wallDamage: 1,
    leaves: undefined,
    form: "rod",
  },
  // The only thing in the demo that is aimed rather than thrown. Three bolts, and then the stock
  // itself is a weapon: what is left in the hand is a spent crossbow, and a spent crossbow flies.
  crossbow: {
    use: "shoot",
    spends: "crossbowSpent",
    flightHit: "stop",
    capacity: 1,
    landing: "spend",
    wallDamage: 1,
    leaves: undefined,
    form: "billboard",
  },
  crossbowSpent: {
    use: "throw",
    flightHit: "cleave",
    capacity: 3,
    landing: "spend",
    wallDamage: 2,
    leaves: undefined,
    form: "rod",
  },
  // Never picked up and never dropped: it exists only between the trigger and whatever it reaches.
  //
  // It stops at the first body rather than running it through, which is the difference between a bolt
  // and a javelin: the shaft is what carries a crowd, and a bolt is one hard hit on one thing. The
  // strike landing is the femur's, so all of a bolt goes into whatever it stopped against.
  crossbowBolt: {
    use: "throw",
    flightHit: "stop",
    capacity: 1,
    landing: "strike",
    wallDamage: 1,
    leaves: undefined,
    form: "rod",
  },
};

export function propBehaviour(kind: DemoPropKind): DemoPropBehaviour {
  return PROP_BEHAVIOURS[kind];
}

export function propWeight(kind: DemoPropKind): DemoThrowWeight {
  return PROP_WEIGHTS[kind];
}

/**
 * How many bodies this throw takes before it is full, for anything that pierces or cleaves.
 *
 * Tolerates a thrown body the way `throwWeight` and the wall-damage lookup already do: a body does
 * neither of those things, so the number is never consulted for one, and answering rather than
 * refusing keeps the flight step from having to know which kinds are props.
 */
export function throwCapacity(kind: DemoThrowKind): number {
  return kind === "enemy" ? 1 : PROP_BEHAVIOURS[kind].capacity;
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
