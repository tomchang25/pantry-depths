/**
 * The seven things on a floor, and how each one announces itself.
 *
 * These are the authored rows behind `@/core/enemy-contract`: statistics, distances, and rhythms an
 * author owns, typed by the contract and delivered to the rules through the game catalog. The rules
 * never import this table — whoever creates a world passes it in.
 *
 * Three of them are slimes and have no attack at all: what they cost the player is position. The
 * other four are skeletons, told apart by the distance each one wants; the wind-up numbers are the
 * whole difficulty knob, and the damage barely matters next to them.
 */

import type { EnemyArchetype } from "@/core/combat/enemy-contract";
import type { MapCastKind } from "@/core/floor/room-contract";
import type { ThrowWeight } from "@/core/prop-contract";
import { DEFAULT_BODY_WEIGHT } from "@/content/props/prop-definitions";

const CHARGER_REACH = 0.86;
const SWORDSMAN_REACH = 0.95;

/**
 * Where a slime stops, which is just short of the player rather than inside them.
 *
 * Walking into the player was what put the two bodies on top of each other in the first place, and
 * everything that was wrong about the contact followed from that.
 */
const SLIME_HOLD = 0.8;

/** The small one: it goes further out of the hand and lands lighter than the other two. */
const LIGHT_BODY_WEIGHT: ThrowWeight = {
  speed: 10,
  range: 5.2,
  lobbed: true,
  drag: 0.42,
  plunge: 0.88,
  recoil: 0.68,
  thud: 0.8,
  carrySlow: 0.88,
};

/**
 * A slab of a thing. Picking one up is a commitment, throwing it barely clears the room in front of
 * you, and every part of doing it is felt.
 */
const HEAVY_BODY_WEIGHT: ThrowWeight = {
  speed: 7.5,
  range: 3.6,
  lobbed: true,
  drag: 0.7,
  plunge: 0.74,
  recoil: 1.15,
  thud: 1.25,
  carrySlow: 0.74,
};

/**
 * The three slimes: one behaviour, three sets of numbers, and nothing else between them.
 *
 * Not one entity with three appearances. A colour is something to tune rather than a tier to derive,
 * so health, drawn size, footprint, pace, and drag are authored per row and are monotonic on purpose —
 * the set they replace was not, and a floor where the tallest body is the second-weakest teaches the
 * player nothing about what they are looking at.
 *
 * The axis runs one way for all five numbers, and the trade is the point: bigger is tougher, harder
 * to wade through, and slower to the point that the biggest one barely travels. Colour tells the
 * player which cost they are being offered before they are close enough to pay it.
 *
 * Every one of them omits the whole attack block. That absence is the entity: a slime costs the
 * player position rather than health, and it can do that forever because it has nothing to stop for.
 */
const SLIME_GREEN: EnemyArchetype = {
  id: "slimeGreen",
  name: "Green Slime",
  appearance: "greenSlime",
  health: 40,
  weight: LIGHT_BODY_WEIGHT,
  // Three quarters of what a slime used to move at, and the fastest of the three. Still well under
  // the player, so outrunning a green one is free and the cost of one is where it stands.
  speed: 1.425,
  body: "soft",
  footprint: 0.22,
  hold: SLIME_HOLD,
  // Three quarters of pace: the one you barge through, and the reason the other two read as heavy.
  drag: 0.25,
};

const SLIME_BLUE: EnemyArchetype = {
  id: "slimeBlue",
  name: "Blue Slime",
  appearance: "blueSlime",
  health: 60,
  // The ordinary body, and the one every other weight is read against.
  weight: DEFAULT_BODY_WEIGHT,
  // Half. A blue slime no longer arrives anywhere — it is somewhere, and the question is whether you
  // are going through it.
  speed: 0.95,
  body: "soft",
  footprint: 0.3,
  hold: SLIME_HOLD,
  // Half of pace. Crossing one is a decision now rather than a texture.
  drag: 0.5,
};

const SLIME_RED: EnemyArchetype = {
  id: "slimeRed",
  name: "Red Slime",
  appearance: "redSlime",
  health: 80,
  weight: HEAVY_BODY_WEIGHT,
  // A quarter, which at an eighth of the player's pace stops being pursuit at all. A red slime is
  // terrain: it holds the ground it is on, it drags hardest at whoever crosses it, and it will never
  // reach anybody who does not walk back to it. Losing interest and wandering are what keep it from
  // being scenery — it is slowly going somewhere, and where it ends up is not where you left it.
  speed: 0.475,
  body: "soft",
  footprint: 0.38,
  hold: SLIME_HOLD,
  // A third of pace, which is the hardest single body on the floor to get past — and three of them
  // together still cannot seal a doorway, because the crowd slowdown is floored well above a
  // standstill. Walking through a red one is meant to be a thing you notice you decided to do.
  drag: 2 / 3,
};

const SWORDSMAN: EnemyArchetype = {
  id: "swordsman",
  name: "Skeleton Swordsman",
  appearance: "skeletonSwordsman",
  health: 120,
  weight: {
    speed: 7.2,
    range: 3.4,
    lobbed: true,
    drag: 0.72,
    plunge: 0.76,
    recoil: 1.2,
    thud: 1.3,
    carrySlow: 0.7,
  },
  // The fastest thing on the floor that is not the player, and it has to be: everything it does
  // happens at arm's length, so a swordsman that cannot get there is not an enemy. It used to keep a
  // second, higher speed for the last few cells; folding the two into one means the number the row
  // states is the number you are outrun by.
  speed: 2.2,
  attackCooldown: 1.8,
  // A full second, standing still and pointed where it decided to point. That is a long time to be a
  // statue at arm's reach, and it is meant to be: the swing is now a cone rather than a circle and
  // the body cannot turn inside it, so one step to either side is a clean answer. What the second
  // buys is that the step is a decision rather than a reflex.
  windup: 1,
  // Raised with the wind-up, because those two numbers are one decision. An attack that can be read
  // and walked out of should cost something when it does land, or it is only a slower way of being
  // harmless.
  contactDamage: 16,
  contactRange: SWORDSMAN_REACH,
  body: "boned",
  meleeWindup: true,
  windupIntent: "melee",
  turnRate: 4.4,
  // No minimum, so it is never crowded off the player: a swordsman has nothing it can do at range and
  // therefore no distance it would rather be at than as close as it can get.
  attack: { min: 0, max: SWORDSMAN_REACH },
};

/**
 * A hammer-bearer, which is the charger's whole arrangement with a skeleton in it.
 *
 * It paints its lane, burns while it gathers, damages what it fails to get through, and lies stunned
 * for five seconds if it stalls. None of that changes; what changes is that it stops being a slime,
 * so it is a body you cannot pick up, that plays authored clips, and that drops the hammer it was
 * swinging.
 */
const HAMMERMAN: EnemyArchetype = {
  id: "hammerman",
  name: "Skeleton Hammer-bearer",
  appearance: "skeletonHammerman",
  health: 120,
  weight: HEAVY_BODY_WEIGHT,
  speed: 2.1,
  attackCooldown: 3.5,
  windup: 3,
  contactDamage: 6,
  contactRange: CHARGER_REACH,
  body: "boned",
  meleeWindup: false,
  windupIntent: "charge",
  // Four cells out, which is where it stops walking and starts gathering — and it is also the length
  // of the charge, so the two together are the whole geometry. A charge launched from the far edge
  // spends itself exactly where the player was standing; one launched from closer than that carries
  // the difference past them and into whatever is behind. That is why a hammer-bearer is dangerous in
  // a corridor and merely loud in a hall: the wall you are standing in front of is its weapon and its
  // punishment at once.
  attack: { min: 0, max: 4 },
  turnRate: 3.2,
};

/**
 * The two ranged types: one behaviour, two rhythms.
 *
 * The javelineer is a long, obvious commitment that repeats often; the crossbowman is a short one
 * that rarely comes again. Which of the two is standing in a room changes how the player crosses it
 * without changing a line of how it thinks.
 *
 * Neither has a contact attack, and that is not an oversight. A body whose whole threat is at range
 * should have nothing at all at zero, so the reward for closing that distance is that the thing stops
 * being dangerous. They are also the only two rows with a minimum, which is the other half of the
 * same statement: crowded inside it, a shooter walks backwards until it has its distance again rather
 * than standing there holding a weapon it cannot use.
 *
 * Neither has a cooldown either. What paces a shooter is how long it takes to aim, and a second
 * timer after the shot was a pause with nothing to look at. The rhythm is the wind-up repeating, and
 * the range is what the two are balanced against: a javelin has to come close enough to be answered.
 */
const JAVELINEER: EnemyArchetype = {
  id: "javelineer",
  name: "Skeleton Javelineer",
  appearance: "skeletonJavelineer",
  health: 60,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  attackCooldown: 0,
  windup: 3,
  body: "boned",
  windupIntent: "shoot",
  // Four cells is close enough to walk to, which is the point of the longer telegraph: it is the
  // shooter you answer by closing, and it backs away below two rather than letting you arrive.
  attack: { min: 2, max: 4 },
  turnRate: 4.4,
  // Half again the attack range, so a javelin loosed at the far edge still reaches a player who
  // stepped back rather than dying in the air exactly where they had been standing.
  shot: { speed: 6, damage: 18, range: 6, knockback: 3.5 },
};

const CROSSBOWMAN: EnemyArchetype = {
  id: "crossbowman",
  name: "Skeleton Crossbowman",
  appearance: "skeletonCrossbowman",
  health: 60,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  // The same three seconds the javelineer takes, and nothing afterwards. What separates the two is
  // not the rhythm but the two cells between where each stops: a javelineer is standing at the far
  // end of the room you are in, a crossbowman is standing in the next one, and the walk between those
  // two facts is what you spend the telegraph on.
  attackCooldown: 0,
  windup: 3,
  body: "boned",
  windupIntent: "shoot",
  attack: { min: 2, max: 6 },
  turnRate: 4.4,
  shot: { speed: 8, damage: 12, range: 12, knockback: 0 },
};

export const ENEMY_ARCHETYPES: Readonly<Record<MapCastKind, EnemyArchetype>> = {
  slimeGreen: SLIME_GREEN,
  slimeBlue: SLIME_BLUE,
  slimeRed: SLIME_RED,
  swordsman: SWORDSMAN,
  hammerman: HAMMERMAN,
  javelineer: JAVELINEER,
  crossbowman: CROSSBOWMAN,
} as const;
