/**
 * The seven things on a floor, and how each one announces itself.
 *
 * Three of them are slimes and have no attack at all: what they cost the player is position, and
 * they never stop advancing. The other four are skeletons, and every attack they have is telegraphed
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
   * How hard this body shoves the player aside just by being where they want to be, in cells per
   * second at full overlap. Omitted means it is walked straight through, which is what everything did.
   *
   * The ordinary slime's whole job. Its damage is now a rounding error and its cooldown is most of a
   * fight, so what it contributes is not a threat but a body in the doorway — and that only reads if
   * the body is physically there. Deliberately a push and never a block: a crowd should drag at the
   * player and steer them somewhere they did not choose, and must never be able to seal them in.
   */
  jostle?: number;
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
 * so health, drawn size, footprint, and shove are authored per row and are monotonic on purpose —
 * the set they replace was not, and a floor where the tallest body is the second-weakest teaches the
 * player nothing about what they are looking at.
 *
 * Every one of them omits the whole attack block. That absence is the entity: a slime costs the
 * player position rather than health, and it can do that forever because it has nothing to stop for.
 */
const SLIME_GREEN: DemoEnemyArchetype = {
  id: "slimeGreen",
  name: "Green Slime",
  appearance: "greenSlime",
  health: 20,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.9,
  rushSpeed: 2.6,
  rushDistance: 5,
  body: "soft",
  footprint: 0.22,
  jostle: 0.45,
};

const SLIME_BLUE: DemoEnemyArchetype = {
  id: "slimeBlue",
  name: "Blue Slime",
  appearance: "blueSlime",
  health: 34,
  // The ordinary body, and the one every other weight is read against.
  weight: DEFAULT_BODY_WEIGHT,
  speed: 1.9,
  rushSpeed: 2.6,
  rushDistance: 5,
  body: "soft",
  footprint: 0.3,
  jostle: 0.6,
};

const SLIME_RED: DemoEnemyArchetype = {
  id: "slimeRed",
  name: "Red Slime",
  appearance: "redSlime",
  health: 52,
  weight: HEAVY_BODY_WEIGHT,
  speed: 1.9,
  rushSpeed: 2.6,
  rushDistance: 5,
  body: "soft",
  footprint: 0.38,
  // Still a push and never a block. The largest one drags hardest at a player crossing it, and three
  // of them together still cannot seal a doorway.
  jostle: 0.8,
};

const SWORDSMAN: DemoEnemyArchetype = {
  id: "swordsman",
  name: "Skeleton Swordsman",
  appearance: "skeletonSwordsman",
  health: 46,
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
  health: 58,
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
 * Neither has a contact attack, and that is not an oversight. A body whose whole threat is at four
 * to seven cells should have nothing at all at zero, so the reward for closing that distance is that
 * the thing stops being dangerous.
 */
const RANGED_BAND = { near: 4, far: 7 } as const;

const JAVELINEER: DemoEnemyArchetype = {
  id: "javelineer",
  name: "Skeleton Javelineer",
  appearance: "skeletonJavelineer",
  health: 22,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  attackCooldown: 3,
  windup: 3,
  body: "boned",
  windupIntent: "shoot",
  band: RANGED_BAND,
  turnRate: 4.4,
  shot: { speed: 6, damage: 18, range: 11, knockback: 3.5 },
};

const CROSSBOWMAN: DemoEnemyArchetype = {
  id: "crossbowman",
  name: "Skeleton Crossbowman",
  appearance: "skeletonCrossbowman",
  health: 22,
  weight: LIGHT_BODY_WEIGHT,
  speed: 1.7,
  rushSpeed: 1.7,
  rushDistance: 0,
  // One second to commit and six to come back from it. Standing exposed for most of a fight is the
  // price of a shot that lands before the player has finished reading it.
  attackCooldown: 6,
  windup: 1,
  body: "boned",
  windupIntent: "shoot",
  band: RANGED_BAND,
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
