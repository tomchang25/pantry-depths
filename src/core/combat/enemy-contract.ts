/**
 * What an enemy is: the archetype record, its vocabulary, and the rule numbers every body obeys.
 *
 * The seven authored rows live in the content layer, typed by this contract and injected through the
 * game catalog; the rules never import the table. What lives here is what is true of every body
 * regardless of its numbers: the record shape, the material and intent vocabulary, the appearance
 * vocabulary the display tables key off, the pure accessors, and the tuning constants that are rules
 * rather than rows — sight and disengagement, the charge geometry, the cut arc, the strike hold.
 */

import type { MapCastKind } from "@/core/floor/room-contract";
import type { ThrowWeight } from "@/core/prop-contract";

/** The archetypes that own baked artwork. Retained creature archetypes borrow the matching slime. */
export type EnemyAppearanceId =
  | "greenSlime"
  | "yellowSlime"
  | "blueSlime"
  | "redSlime"
  | "purpleSlime"
  | "skeletonSwordsman"
  | "skeletonHammerman"
  | "skeletonJavelineer"
  | "skeletonCrossbowman"
  | "placeholder";

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
export type BodyKind = "soft" | "boned";

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
export type WindupIntent = "shoot" | "charge" | "melee";

export type EnemyArchetype = Readonly<{
  id: MapCastKind;
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
  weight: ThrowWeight;
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
  body: BodyKind;
  /** Whether a contact attack commits through a visible wind-up instead of landing on touch. */
  meleeWindup?: boolean;
  windupIntent?: WindupIntent;
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

/**
 * Whether the living body can be carried whole in the player's left hand.
 *
 * Derived from what the body is made of rather than declared per archetype, so a skeleton added later
 * cannot accidentally be grabbable — there is no flag to forget. The rule is the material: soft bodies
 * go in the hand, boned ones do not.
 */
export function canCarry(archetype: EnemyArchetype): boolean {
  return archetype.body === "soft";
}

/** Whether a body is drawn from authored clips rather than as a blob the scene deforms. */
export function isBoned(archetype: EnemyArchetype): boolean {
  return archetype.body === "boned";
}

/**
 * The attack numbers, answered for a body that has no attack as well as for one that does.
 *
 * Zero is not a placeholder standing in for a decision nobody made. A body with no attack block has
 * no reach to strike from, no wait between strikes, and nothing to strike for, and every branch that
 * would resolve an attack is unreachable for it — so the arithmetic is not merely safe, it is true.
 */
export function attackReach(archetype: EnemyArchetype): number {
  return archetype.contactRange ?? 0;
}

export function attackWindup(archetype: EnemyArchetype): number {
  return archetype.windup ?? 0;
}

export function attackCooldown(archetype: EnemyArchetype): number {
  return archetype.attackCooldown ?? 0;
}

export function attackDamage(archetype: EnemyArchetype): number {
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
