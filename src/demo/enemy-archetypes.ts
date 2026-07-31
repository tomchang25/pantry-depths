/**
 * The seven things on a floor, and how each one announces itself.
 *
 * Three of them are slimes and have no attack at all: what they cost the player is position, and none
 * of them is fast enough to take it from someone walking away. Its interest reaches ten cells and no
 * further, so a slime you have not gone near is a body wandering the floor on its own errand, and the
 * three colours are three answers to how much it costs to go through one rather than round it.
 *
 * The other four are skeletons, and they follow from anywhere; every attack they have is telegraphed
 * before it lands, because every attack is avoidable if you read it — a shooter can be broken
 * line-of-sight on, and a charge commits to a straight lane you can step out of, then beats itself
 * against the wall. The wind-up numbers are the whole difficulty knob; the damage barely matters
 * next to them.
 *
 * A skeleton has a front, which costs it the freedom a blob has — it must turn before it can go, and
 * it strikes at what it is looking at — and buys the only thing that makes an authored eight-way body
 * readable: where it is pointed is where it is about to be.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import { DEFAULT_BODY_WEIGHT, type DemoThrowWeight } from "@/demo/throw-weight";

export type DemoArchetypeId =
  "slimeGreen" | "slimeBlue" | "slimeRed" | "swordsman" | "hammerman" | "javelineer" | "crossbowman";

/**
 * What a body is made of, which decides most of what is true about it besides its behaviour.
 *
 * A soft body is a blob: the scene deforms it, it can be picked up and thrown, and it bursts. A boned
 * one is an authored sprite sheet: it plays clips, it comes apart into chips and drops its own bones,
 * and it cannot be carried — there is nothing to get hold of and nothing to draw in the hand.
 *
 * This exists because those facts were being asked for by name. Half a dozen places tested whether an
 * archetype was *the swordsman*, which happened to be the only boned one, so every future skeleton
 * would have had to be added to each of them by hand and would have been quietly wrong until it was.
 * Asking what the body is made of is the question all of them actually meant.
 */
export type DemoBodyKind = "soft" | "boned";

/**
 * What an archetype's wind-up commits to, declared once here rather than inferred from its numbers.
 *
 * Behaviour still decides *when* a wind-up begins — a charger needs the range and the line of sight, a
 * shooter needs its standoff band — but which of the three it will be is a fixed fact about the
 * creature, and nothing outside this file should have to work it out. A preview that guessed got it
 * wrong in the obvious way: it assumed melee, so every slime rehearsed its attack wearing the
 * skeleton's sword.
 *
 * Omitted means the archetype never winds up at all, and with the whole attack block optional beside
 * it, that is the same statement as having no attack. It is the slime, and it is the reason this is
 * optional rather than defaulted.
 */
export type DemoWindupIntent = "shoot" | "charge" | "melee";

export type DemoEnemyArchetype = Readonly<{
  id: DemoArchetypeId;
  name: string;
  appearance: EnemyAppearanceId;
  health: number;
  /**
   * What this body weighs in the hand and in the air.
   *
   * Its own property rather than something read off `health`: how heavy a slime is and how much of
   * it there is to kill are two different statements about it, and tying them together would mean
   * never being able to move one without moving the other.
   */
  weight: DemoThrowWeight;
  /** Ordinary movement, used while pathing toward the player. */
  speed: number;
  /** Speed while beelining inside the charge distance; the charger's dash is separate. */
  rushSpeed: number;
  /** Grid distance at which pathing is abandoned for a straight line at the player. */
  rushDistance: number;
  /**
   * Everything about having an attack, and every one of them optional together.
   *
   * A body that omits them has no attack — not a disabled one, not one with a damage of zero, but no
   * such thing at all, so nothing exists that could put it into an attack state and stop it walking.
   * That is what a slime is, and it is why there is no boolean saying so: a flag can be set on a body
   * that still carries a reach and a cooldown, and then two things disagree about what it is.
   */
  attackCooldown?: number;
  /** Seconds of visible wind-up before the attack resolves. */
  windup?: number;
  contactDamage?: number;
  contactRange?: number;
  body: DemoBodyKind;
  /** Whether a contact attack commits through a visible wind-up instead of landing on touch. */
  meleeWindup?: boolean;
  windupIntent?: DemoWindupIntent;
  /**
   * How much floor this body takes up, in cells: the size of its drawn blob, the reach of the shove
   * it gives the player, and the target a thrown object has to hit.
   *
   * Deliberately not wall clearance, which stays one number for every body on the floor. A large
   * slime with a large clearance wedges in corridor corners, and a body that cannot get through a
   * doorway cannot block one either — so the circle that decides what fits and the circle that
   * decides what is in the way are different circles on purpose.
   */
  footprint?: number;
  /**
   * What this body's shot is, for a type that has one.
   *
   * On the row rather than shared constants, because the numbers describing a shot are what tell two
   * ranged types apart once their behaviour is identical. A javelin is slower and heavier, hits
   * harder, and shoves the player slightly — enough to cost them the ground they were standing on,
   * and nowhere near enough to take control away, which is what makes a three-second telegraph worth
   * respecting rather than merely surviving. A bolt is fast, flat, and cheaper.
   */
  shot?: Readonly<{ speed: number; damage: number; range: number; knockback: number }>;
  /**
   * The distance band this body tries to hold while pursuing: it backs off inside `near`, closes
   * beyond `far`, and stands still between them.
   *
   * Pursuit reads nothing else, which is what lets one routine steer a swordsman and a shooter. A
   * melee body's band is its own reach, so it stops exactly where it can hit; a shooter's is the
   * standoff it wants. Omitted means the body holds no distance at all and walks into the player
   * forever — that is the slime, and it is the reason this is optional rather than defaulted.
   */
  band?: Readonly<{ near: number; far: number }>;
  /**
   * Radians per second the body may swing its facing, for a body that has a front.
   *
   * Omitted means the body has no front and moves freely in any direction, which is what a blob does
   * — it is drawn identically from every angle, so a turn would cost it pace and show nothing for it.
   * Set it and the archetype steers instead: `walk` turns toward its heading at this rate and travels
   * along its facing, which is what keeps an eight-way sprite's feet pointed at where it is going.
   */
  turnRate?: number;
  /**
   * How much this body slows the player who is pushing through it, at full overlap. Omitted means it
   * costs nothing to walk past, which is true of everything that is not a slime.
   *
   * The fraction subtracted, so what a player wading a single body keeps is `1 - drag`: the three
   * slimes are authored as three quarters, a half, and a third of pace, which is the scale they are
   * meant to be read on and the reason those are the numbers below rather than round ones.
   *
   * The slime's whole job, and a speed penalty rather than a shove. Shoving the player produced a
   * force pulling against their own input every frame, which read as a body twitching in place
   * rather than as a crowd being in the way. Slowing them fights nothing: the player still goes
   * exactly where they pointed, it just costs them the time it should cost to wade through a body.
   *
   * It only applies while the player is genuinely inside the drawn body — a slime holds station
   * short of that on its own — so standing near a crowd is free and pushing into one is not.
   */
  drag?: number;
  /**
   * How far from the player this body stays interested, in cells. Omitted means it never loses
   * interest and walks the whole floor to reach them, which is what every skeleton does.
   *
   * Set it and the body stops being a homing missile: past this distance it goes about its own
   * business — see the wander in the behaviour module — and takes the player up again only when they
   * come back inside. That is what a slime is now, and the difference it makes is that a room is
   * somewhere with bodies moving around in it rather than a room with a line of bodies pointed at
   * you: what you run into, you ran into.
   */
  leash?: number;
}>;

/**
 * The band a body with a contact attack holds: just inside its own reach.
 *
 * Derived from the reach rather than authored beside it, because the two can never disagree without
 * producing a body that walks to a spot it cannot strike from.
 */
function meleeBand(contactRange: number): Readonly<{ near: number; far: number }> {
  return { near: contactRange * 0.85, far: contactRange };
}

const CHARGER_REACH = 0.86;
const SWORDSMAN_REACH = 0.95;

/**
 * Where a slime stops, which is just short of the player rather than inside them.
 *
 * A near edge of zero is deliberate: a slime never backs off from anything, it only stops advancing.
 * Walking into the player was what put the two bodies on top of each other in the first place, and
 * everything that was wrong about the contact followed from that.
 */
const SLIME_BAND = { near: 0, far: 0.8 } as const;

/**
 * How far a slime will follow, in cells.
 *
 * Ten is most of a room away: far enough that a slime which has seen you is a commitment you have to
 * answer rather than something you stroll out of, short enough that the far half of a floor is still
 * going about its own business. What it buys is that the slimes on a floor are not all facing you —
 * the ones that come are the ones you got near, and there is somewhere on the floor that is not that.
 */
const SLIME_LEASH = 10;

/** The small one: it goes further out of the hand and lands lighter than the other two. */
const LIGHT_BODY_WEIGHT: DemoThrowWeight = {
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
const HEAVY_BODY_WEIGHT: DemoThrowWeight = {
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
const SLIME_GREEN: DemoEnemyArchetype = {
  id: "slimeGreen",
  name: "Green Slime",
  appearance: "greenSlime",
  health: 40,
  weight: LIGHT_BODY_WEIGHT,
  // Three quarters of what a slime used to move at, and the fastest of the three. Still well under
  // the player, so outrunning a green one is free and the cost of one is where it stands.
  speed: 1.425,
  rushSpeed: 1.95,
  rushDistance: 5,
  body: "soft",
  footprint: 0.22,
  band: SLIME_BAND,
  // Three quarters of pace: the one you barge through, and the reason the other two read as heavy.
  drag: 0.25,
  leash: SLIME_LEASH,
};

const SLIME_BLUE: DemoEnemyArchetype = {
  id: "slimeBlue",
  name: "Blue Slime",
  appearance: "blueSlime",
  health: 60,
  // The ordinary body, and the one every other weight is read against.
  weight: DEFAULT_BODY_WEIGHT,
  // Half. A blue slime no longer arrives anywhere — it is somewhere, and the question is whether you
  // are going through it.
  speed: 0.95,
  rushSpeed: 1.3,
  rushDistance: 5,
  body: "soft",
  footprint: 0.3,
  band: SLIME_BAND,
  // Half of pace. Crossing one is a decision now rather than a texture.
  drag: 0.5,
  leash: SLIME_LEASH,
};

const SLIME_RED: DemoEnemyArchetype = {
  id: "slimeRed",
  name: "Red Slime",
  appearance: "redSlime",
  health: 80,
  weight: HEAVY_BODY_WEIGHT,
  // A quarter, which at an eighth of the player's pace stops being pursuit at all. A red slime is
  // terrain: it holds the ground it is on, it drags hardest at whoever crosses it, and it will never
  // reach anybody who does not walk back to it. The leash and the wander are what keep it from being
  // scenery — it is slowly going somewhere, and where it ends up is not where you left it.
  speed: 0.475,
  rushSpeed: 0.65,
  rushDistance: 5,
  body: "soft",
  footprint: 0.38,
  band: SLIME_BAND,
  // A third of pace, which is the hardest single body on the floor to get past — and three of them
  // together still cannot seal a doorway, because the crowd slowdown is floored well above a
  // standstill. Walking through a red one is meant to be a thing you notice you decided to do.
  drag: 2 / 3,
  leash: SLIME_LEASH,
};

const SWORDSMAN: DemoEnemyArchetype = {
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
  speed: 1.65,
  rushSpeed: 2.35,
  rushDistance: 4.5,
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
  band: meleeBand(SWORDSMAN_REACH),
};

/**
 * A hammer-bearer, which is the charger's whole arrangement with a skeleton in it.
 *
 * It paints its lane, burns while it gathers, damages what it fails to get through, and lies stunned
 * for five seconds if it stalls. None of that changes; what changes is that it stops being a slime,
 * so it is a body you cannot pick up, that plays authored clips, and that drops the hammer it was
 * swinging.
 */
const HAMMERMAN: DemoEnemyArchetype = {
  id: "hammerman",
  name: "Skeleton Hammer-bearer",
  appearance: "skeletonHammerman",
  health: 120,
  weight: HEAVY_BODY_WEIGHT,
  speed: 1.8,
  rushSpeed: 2.2,
  rushDistance: 5,
  attackCooldown: 3.5,
  windup: 3,
  contactDamage: 6,
  contactRange: CHARGER_REACH,
  body: "boned",
  meleeWindup: false,
  windupIntent: "charge",
  band: meleeBand(CHARGER_REACH),
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
 * should have nothing at all at zero, so the reward for closing that distance is that the thing
 * stops being dangerous — and its own band then walks it back out of your reach.
 *
 * Neither has a cooldown either. What paces a shooter is how long it takes to aim, and a second
 * timer after the shot was a pause with nothing to look at. The rhythm is the wind-up repeating, and
 * the range is what the two are balanced against: a javelin has to come close enough to be answered.
 */
const JAVELINEER: DemoEnemyArchetype = {
  id: "javelineer",
  name: "Skeleton Javelineer",
  appearance: "skeletonJavelineer",
  health: 60,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  attackCooldown: 0,
  windup: 3,
  body: "boned",
  windupIntent: "shoot",
  // Four cells is close enough to walk to, which is the point of the longer telegraph: it is the
  // shooter you answer by closing, and it backs away below two rather than letting you arrive.
  band: { near: 2, far: 4 },
  turnRate: 4.4,
  // Half again the band, so a shot loosed at the far edge still reaches a player who stepped back.
  shot: { speed: 6, damage: 18, range: 6, knockback: 3.5 },
};

const CROSSBOWMAN: DemoEnemyArchetype = {
  id: "crossbowman",
  name: "Skeleton Crossbowman",
  appearance: "skeletonCrossbowman",
  health: 60,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  // The same three seconds the javelineer takes, and nothing afterwards. What separates the two is
  // not the rhythm any more but the ground: eight cells is a room away, so the answer to this one is
  // cover or the walk, and the answer to the other is that you can reach it.
  attackCooldown: 0,
  windup: 3,
  body: "boned",
  windupIntent: "shoot",
  band: { near: 4, far: 8 },
  turnRate: 4.4,
  shot: { speed: 8, damage: 12, range: 12, knockback: 0 },
};

export const ENEMY_ARCHETYPES = {
  slimeGreen: SLIME_GREEN,
  slimeBlue: SLIME_BLUE,
  slimeRed: SLIME_RED,
  swordsman: SWORDSMAN,
  hammerman: HAMMERMAN,
  javelineer: JAVELINEER,
  crossbowman: CROSSBOWMAN,
} as const;

/**
 * Whether the living body can be carried whole in the player's left hand.
 *
 * Derived from what the body is made of rather than declared per archetype, so a skeleton added later
 * cannot accidentally be grabbable — there is no flag to forget. The rule is the material: soft bodies
 * go in the hand, boned ones do not.
 */
export function canCarry(archetype: DemoEnemyArchetype): boolean {
  return archetype.body === "soft";
}

/** Whether a body is drawn from authored clips rather than as a blob the scene deforms. */
export function isBoned(archetype: DemoEnemyArchetype): boolean {
  return archetype.body === "boned";
}

/**
 * The attack numbers, answered for a body that has no attack as well as for one that does.
 *
 * Zero is not a placeholder standing in for a decision nobody made. A body with no attack block has
 * no reach to strike from, no wait between strikes, and nothing to strike for, and every branch that
 * would resolve an attack is unreachable for it — so the arithmetic is not merely safe, it is true.
 */
export function attackReach(archetype: DemoEnemyArchetype): number {
  return archetype.contactRange ?? 0;
}

export function attackWindup(archetype: DemoEnemyArchetype): number {
  return archetype.windup ?? 0;
}

export function attackCooldown(archetype: DemoEnemyArchetype): number {
  return archetype.attackCooldown ?? 0;
}

export function attackDamage(archetype: DemoEnemyArchetype): number {
  return archetype.contactDamage ?? 0;
}

/**
 * Half the arc a committed sword cut covers, either side of where the body is pointed.
 *
 * One number, read by three things that have to agree: the damage check, the mark painted on the
 * floor, and the arc drawn at blade height. A cut used to resolve as a plain distance test — a full
 * circle, so a swordsman struck whatever was near it including whatever was behind it — while the
 * comment beside it claimed that stepping around one was an answer. It is now.
 */
export const MELEE_CUT_HALF_ANGLE = 0.75;

/**
 * How long a released attack holds its strike pose before the cooldown takes over.
 *
 * One number for every attack while every clip is the same length. It becomes the strike clip's own
 * duration once a clip carries one, which is what stops a fast swing and a heavy one from being
 * forced to land in the same fifth of a second.
 */
export const STRIKE_SECONDS = 0.22;

export const CHARGE_TRIGGER_DISTANCE = 5;
export const CHARGE_SPEED = 9;
export const CHARGE_DISTANCE = 6;
export const CHARGE_DAMAGE = 18;
export const CHARGE_KNOCKBACK = 11;
/** What a charger costs itself for missing: the window the whole attack is balanced around. */
export const CHARGE_WALL_STUN = 5;
/**
 * What a charge does to the masonry it fails against.
 *
 * Stone takes four and wood two, so one charge is half a stone wall and a whole wooden one — worth
 * baiting, and still well short of a bomb, which flattens stone in a single throw. This is the half
 * of the charger's rework that makes the three-second wind-up a gift rather than a subtraction: the
 * player lines it up on a wall they want gone and steps aside.
 */
export const CHARGE_WALL_DAMAGE = 2;
