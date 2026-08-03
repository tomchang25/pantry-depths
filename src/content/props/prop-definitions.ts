/**
 * What can be thrown, and what it weighs: the authored rows behind `@/core/prop-contract`.
 *
 * Weight is a record rather than a number, and every field is here because something visible reads
 * from it — tuning heft is editing one row. The behaviour table is one row per prop for the same
 * reason it always was: a kind missing something is missing it visibly, in a table where the thing
 * beside it has one. Both tables reach the rules through the game catalog; nothing imports them from
 * the rules side.
 */

import type { DemoPropBehaviour, DemoPropKind, DemoThrowWeight } from "@/core/prop-contract";

/**
 * The loose props, unchanged in speed and range from when those were the only two numbers.
 *
 * They are deliberately near-weightless in the new fields: the point of this table is that a body is
 * heavy, and a body is only heavy next to the rock you throw one-handed.
 */
export const PROP_WEIGHTS: Readonly<Record<DemoPropKind, DemoThrowWeight>> = {
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
  hammer: {
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
export const PROP_BEHAVIOURS: Readonly<Record<DemoPropKind, DemoPropBehaviour>> = {
  // A sharpened stake: it runs one body through and nails it to whatever stops it. Not a javelin —
  // that is a weapon of its own further down, and the two are told apart by what they carry.
  stick: {
    use: "throw",
    counts: "objects",
    flightHit: "skewer",
    capacity: 1,
    landing: "pin",
    wallDamage: 2,
    leaves: undefined,
    form: "rod",
  },
  rock: {
    use: "throw",
    counts: "objects",
    flightHit: "stop",
    capacity: 1,
    landing: "burst",
    wallDamage: 4,
    leaves: undefined,
    form: "billboard",
  },
  bomb: {
    use: "throw",
    counts: "objects",
    flightHit: "stop",
    capacity: 1,
    landing: "detonate",
    wallDamage: 2,
    leaves: undefined,
    form: "billboard",
  },
  // The demolition tool, and the one throw bodies have no say in. It kills through however many
  // stand in its line whatever their health, and what it counts instead is masonry: three walls, one
  // each, and it is gone wherever the third one stops it. Everything it cannot break through — the
  // barricade, the emplacement, the boundary, and the floor if it was aimed down — takes the whole
  // budget at once. One number and one rule, so there is no exceptions list to keep in your head.
  hammer: {
    use: "throw",
    counts: "objects",
    flightHit: "reap",
    capacity: 3,
    landing: "spend",
    wallDamage: 4,
    leaves: undefined,
    form: "rod",
  },
  // The blade cuts through three bodies and then lies where it stopped. It does not wear out: what it
  // costs you is the walk back to it, which is a decision you make in the middle of a fight and not
  // an inventory that quietly runs down.
  skeletonSword: {
    use: "throw",
    counts: "objects",
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
    counts: "objects",
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
    counts: "objects",
    flightHit: "stop",
    capacity: 1,
    landing: "strike",
    wallDamage: 2,
    leaves: "skeletonFemurCracked",
    form: "tumbling",
  },
  skeletonFemurCracked: {
    use: "throw",
    counts: "objects",
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
    counts: "objects",
    flightHit: "skewer",
    capacity: 3,
    landing: "pin",
    wallDamage: 2,
    leaves: "skeletonJavelinCracked",
    form: "rod",
  },
  skeletonJavelinCracked: {
    use: "throw",
    counts: "objects",
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
    counts: "charges",
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
    counts: "objects",
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
    counts: "objects",
    flightHit: "stop",
    capacity: 1,
    landing: "strike",
    wallDamage: 1,
    leaves: undefined,
    form: "rod",
  },
};
