/**
 * The seven things on a floor, and how each one announces itself.
 *
 * Three of them are slimes and have no attack at all: what they cost the player is position, and none
 * of them is fast enough to take it from someone walking away. The three colours are three answers to
 * how much it costs to go through one rather than round it.
 *
 * The other four are skeletons, and what tells them apart is the distance each one wants. Every body
 * on the floor notices the player at the same range and gives up at the same range; what differs is
 * where it stops once it has closed, and that is the attack range on the row. A crossbowman is content
 * six cells out, a swordsman is not content until it is at arm's length, and everything either of them
 * does follows from that one pair of numbers.
 *
 * Every attack they have is telegraphed before it lands, because every attack is avoidable if you read
 * it — a shot is aimed at a spot you can leave, and a charge commits to a straight lane you can step
 * out of, then beats itself against the wall. Breaking line of sight does not shake anything off; it
 * only means the body has to walk the grid to reach you rather than run straight. The wind-up numbers
 * are the whole difficulty knob; the damage barely matters next to them.
 *
 * A skeleton has a front, which costs it the freedom a blob has — it must turn before it can go, and
 * it strikes at what it is looking at — and buys the only thing that makes an authored eight-way body
 * readable: where it is pointed is where it is about to be.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import type { MapCastKind } from "@/content/maps/room-schema";
import { DEFAULT_BODY_WEIGHT, type DemoThrowWeight } from "@/demo/throw-weight";

/**
 * What this file's rows are called, taken from the content layer rather than declared here.
 *
 * A room may now stand a named body at a named cell, which means the seven names are content: they
 * are written into room files and read back out of them. Content may not reach this half, so it
 * declares the list and this alias adopts it — and the table below is keyed by the alias, so a body
 * added to either half without the other fails to compile rather than failing to appear.
 */
export type DemoArchetypeId = MapCastKind;

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
 * Behaviour still decides *when* a wind-up begins — the body has to be inside its attack range with a
 * line of sight along it — but which of the three it will be is a fixed fact about the
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
  /**
   * How fast this body travels, and the only speed it has.
   *
   * There used to be a second one for the last few cells of a chase. What killed it is that closing
   * is no longer a distance: a body runs straight when it can see the player and walks the grid when
   * it cannot, so "beelining" stopped being a phase with an edge to change speed at. Two numbers
   * either had to key off sight — making every sighted body permanently the faster one, which is the
   * same as having one number — or off a distance nothing else read any more.
   */
  speed: number;
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
   * The distance this body attacks from: it closes beyond `max`, backs away inside `min`, and strikes
   * between them.
   *
   * One pair of numbers where there used to be two, and the consolidation is the point. A standoff
   * band said where a body wanted to stand and a separate trigger said when it would attack, so the
   * charger wanted to stand at arm's length and opened fire from five cells — two answers to one
   * question, and the body obeyed whichever was asked first. Saying it once means where it stops is
   * where it strikes from, always.
   *
   * `min` above zero is what makes a body back off rather than be crowded, so it is the two shooters
   * and nothing else: a swordsman has no distance it dislikes being at. Omitted altogether means the
   * body has no attack, and therefore no distance it wants at all — see `hold`.
   */
  attack?: Readonly<{ min: number; max: number }>;
  /**
   * How close a body with no attack presses, in cells.
   *
   * The slime's version of an attack range, and the only reason it is a separate field: a body that
   * has somewhere it wants to be but nothing to do when it arrives is not the same shape as one that
   * strikes on arrival, and giving slimes an attack range with no attack behind it would mean every
   * reader of that field has to ask whether the attack is real.
   */
  hold?: number;
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
}>;

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
  body: "soft",
  footprint: 0.22,
  hold: SLIME_HOLD,
  // Three quarters of pace: the one you barge through, and the reason the other two read as heavy.
  drag: 0.25,
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
  body: "soft",
  footprint: 0.3,
  hold: SLIME_HOLD,
  // Half of pace. Crossing one is a decision now rather than a texture.
  drag: 0.5,
};

const SLIME_RED: DemoEnemyArchetype = {
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
const HAMMERMAN: DemoEnemyArchetype = {
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
const JAVELINEER: DemoEnemyArchetype = {
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

const CROSSBOWMAN: DemoEnemyArchetype = {
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

export const ENEMY_ARCHETYPES: Readonly<Record<DemoArchetypeId, DemoEnemyArchetype>> = {
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

/**
 * How far from the player a body takes an interest, in cells, and how far out it gives up again.
 *
 * One pair for every body on the floor rather than a number per row, because what a creature is is
 * the distance it fights at — the range at which it notices you is a fact about the dungeon. Making
 * it per-archetype produced rooms where the same doorway woke half its occupants.
 *
 * A straight line through walls both ways, and that is the whole trick. Losing sight of a body does
 * not shake it: it just means the body has to walk the grid to reach you instead of running straight,
 * so cover buys time and never buys escape. Escaping is the twelve, and the gap between the two is
 * wide on purpose — a body noticed at eight has to be pulled four cells further before it forgets, so
 * standing on the edge of a room cannot flicker it between minding you and minding its own business.
 */
export const SIGHT_RANGE = 8;
export const DISENGAGE_RANGE = 12;

/**
 * How long a body stands about before deciding where to go next.
 *
 * A range, rolled per body per pause. The point of the pause is that a floor reads as somewhere
 * creatures live rather than a set of patrols, and a fixed length would defeat that on its own: bodies
 * created in one pass stay in phase forever, so the whole room would stop and start together.
 */
export function rollIdleSeconds(): number {
  return 2 + Math.random() * 2;
}

export const CHARGE_SPEED = 9;
/**
 * How far a charge runs, which is deliberately the charger's own attack range.
 *
 * The two being one number is what makes the lane readable. A charger launches from somewhere inside
 * its range and always runs the same length, so how far it carries past the player is exactly how far
 * inside that range it was — nothing when it fired from the edge, most of the lane when it fired from
 * your face. There is no separate overshoot to tune, and the strip painted on the floor during the
 * wind-up is the true extent of the thing every time.
 */
export const CHARGE_DISTANCE = 4;
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
