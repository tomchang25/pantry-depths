/**
 * What a room is, on its own.
 *
 * A room is the unit that gets reused — a boss room, an arena, a corridor — so it is a file rather than
 * a passage inside the one map that happens to want it. A room locked inside a map has to be copied to
 * be used twice, and every later edit is then two edits.
 *
 * Everything here is decidable by looking at the room alone: its extent, the business it holds, the
 * crowd it keeps if it keeps one, and how its cells come to exist. Whether it fits the slot some map
 * could drop it into is not — that needs the map, and it lives with the resolver.
 *
 * This module is the vocabulary half: what a room *is*. Reading one from a file, and refusing a file
 * that lies, stays in the content layer, which parses authored JSON into these contracts. The rules
 * assemble floors from them, and the two halves cannot disagree about a kind because there is one
 * list, here.
 */

import type { PropKind } from "@/core/prop-kinds";

export const MAP_TILE_KINDS = [
  "open",
  "border",
  "stone",
  "wood",
  "water",
  "barricade",
  "filled",
  "mortar",
  "trench",
] as const;

export type MapTileKind = (typeof MAP_TILE_KINDS)[number];

/**
 * Ground a walk cannot cross and the floor cannot give back.
 *
 * Water is here because closing one cell costs three bodies and a floor early in a run may not have
 * three to spend; the trench is here because nothing closes it at all. Masonry, caltrops and
 * emplacements are deliberately absent — every one of them comes down to a weapon, so ground behind
 * them is the player's problem rather than the floor's.
 *
 * The one list both refusals read: the check on an author's own cells, and the check on a built
 * floor. They ask the same question at two moments and must not be able to disagree about it.
 */
export const UNFILLABLE_GROUND: readonly MapTileKind[] = ["water", "trench"];

export const MAP_ROOM_ROLES = ["cursedAltar", "blessingAltar", "hotSpring", "extraction"] as const;

export type MapRoomRole = (typeof MAP_ROOM_ROLES)[number];

/**
 * The bodies a room may stand in itself.
 *
 * The content archetype table is keyed by an alias of this union, so the two lists are equal by
 * construction rather than by anybody remembering: a body added to either half without the other
 * fails to compile rather than failing to appear.
 *
 * Deliberately not the appearance list beside the archetype table. That one names ways a body can
 * look, some of which nothing here can be, and looking a certain way is not the same statement as
 * being a certain thing.
 */
export const MAP_CAST_KINDS = [
  "slimeGreen",
  "slimeBlue",
  "slimeRed",
  "swordsman",
  "hammerman",
  "javelineer",
  "crossbowman",
] as const;

export type MapCastKind = (typeof MAP_CAST_KINDS)[number];

/**
 * One body a room stands where it says, rather than wherever a draw puts it.
 *
 * The cell is the room's own, in the same coordinate space its authored cells use: the wall ring is
 * row and column zero, so the first interior cell is 1,1. Sharing that space with the cells is the
 * point — an editor paints both on one grid, and a cast cell and a tile cell at the same place carry
 * the same pair of numbers.
 *
 * Room-local rather than a coordinate on the floor, because a room is the unit that gets reused: a
 * cast written against the floor would be a statement about the one map that happened to place it.
 */
export type MapCastMember = Readonly<{ kind: MapCastKind; x: number; y: number }>;

/**
 * A number a room states, which may be one value or two ends to choose between.
 *
 * The bare number stays legal and stays the common case, because most quantities have one right value
 * and a range around it would be noise. What the range buys is the quantities that should not be
 * identical on every floor.
 *
 * The two forms are kept as written rather than normalised into one, because the authoring endpoint
 * writes a validator's return value verbatim into the file it validated — a reader that helpfully
 * turned every number into a range would rewrite every file it touched.
 */
export type MapRange = Readonly<{ minimum: number; maximum: number }>;

export type MapQuantity = number | MapRange;

/**
 * What is scattered into a room, beyond the bodies walking in it.
 *
 * Optional throughout, and absent means none of that thing — the same rule the crowd follows, for the
 * same reason: a room meant to hold nothing needs a way to say so, and a count of zero is a different
 * statement from an absence.
 *
 * Loose kit is the odd one out and deliberately so. The other three are placed inside one room's own
 * block; kit is scattered across the whole floor from one pool of cells, side rooms included. It is
 * therefore declared by whichever room stands in a map's main slot and applies to the floor, not to
 * that room — making it per-room would move every piece of kit on every floor a seed has ever drawn.
 */
export type MapScatter = Readonly<{
  /**
   * How much of the room is water, and how many cells one pool grows to.
   *
   * A share of the room's interior rather than a number of pools, because water is terrain and a room
   * describing itself says how wet it is. The share is a plain fraction while the size stays a range:
   * pools of varying size adding up to a fixed total already give a different number of pools in
   * different shapes on every floor, which is the variety a range of shares would have bought.
   *
   * **This is what gets poured, not what survives.** A floor guarantees a walk from where the run
   * arrives to every room hanging off it, and that guarantee opens whatever stands on those routes
   * afterwards — so a region with four rooms attached keeps around two thirds of what it asked for.
   * Measured on the shipped region: eighteen cells poured, roughly thirteen left. The same has always
   * been true of the caltrops and the emplacements; stating water as a share is what made it visible.
   */
  pools?: Readonly<{ share: number; size: MapQuantity }>;
  barricades?: MapQuantity;
  mortars?: MapQuantity;
  /** How much of each kind lies on the floor. Read only from a map's main room. */
  props?: Readonly<Partial<Record<PropKind, MapQuantity>>>;
}>;

/**
 * How bodies keep coming, when they do.
 *
 * Optional on the crowd, and the absence is a statement an author can mean: a room whose bodies stand
 * once and are never replaced. Both numbers are rolled at each arrival rather than once per floor, so a
 * range here reads as "somewhere between four and six seconds" rather than "this floor's rate".
 */
export type MapReinforcement = Readonly<{
  /** Seconds between arrivals. */
  every: MapQuantity;
  /** How many arrive at once. Fewer come if the cap has no room for them. */
  count: MapQuantity;
}>;

export type MapCrowd = Readonly<{
  /**
   * The most bodies walking in this room at once.
   *
   * Exact rather than a quantity, deliberately: a cap is a promise about the room, and a promise that
   * is rolled for is not one.
   */
  cap: number;
  /** How many are standing there when the floor is built, before depth adds to it. */
  starting: MapQuantity;
  reinforcement?: MapReinforcement;
}>;

/**
 * What a room's walls are made of, as a ratio between the two masonries.
 *
 * Normalised rather than required to sum to one, so an author may write 20 and 20, or 58 and 42, or a
 * half and a half. Refusing one spelling of the same intent buys nothing.
 */
export type MapWallMix = Readonly<{ stone: number; wood: number }>;

/**
 * How a room's cells come to exist.
 *
 * Generation belongs to a room and not to a map, which is what lets one map carry an authored room
 * beside a generated one without either knowing the other exists. `carved` is a backtracker run and
 * then opened up to the share the room asked for; `open` is floor throughout, which is what a room
 * holding one piece of business wants; `authored` is the cells themselves, row by row — and it is the
 * only way ground that cannot be filled ever reaches a floor.
 */
export type MapRoomStructure =
  | Readonly<{
      generated: "carved";
      /**
       * How much of the room's interior is floor when the walls are done.
       *
       * **A floor the carve is worked up towards, never a ceiling it is cut down to.** The backtracker
       * leaves connected corridors and those are already the tightest the room can be — closing one to
       * meet a smaller number would sever the room it just guaranteed was whole. So a room asking for
       * less than its own corridors give simply gets its corridors.
       */
      openShare: number;
      walls: MapWallMix;
    }>
  | Readonly<{ generated: "open" }>
  | Readonly<{ authored: readonly (readonly MapTileKind[])[] }>;

export type MapRoom = Readonly<{
  /**
   * Names this room across the whole library, and is what its file is called.
   *
   * A slug rather than any string, because a map names it and the authoring endpoint addresses it: an
   * id that cannot be a filename is a room nothing could ever open.
   */
  id: string;
  /** What business it holds, when it holds any. */
  role?: MapRoomRole;
  /** Its extent in cells, wall ring included. */
  width: number;
  height: number;
  /**
   * How many bodies live here, when any do.
   *
   * Optional, and the omission is the point: a room that holds nobody has no honest way to say so with
   * three required numbers. A cap of zero paired with a respawn interval still declares a rate for
   * something that never happens, which is a different statement from "nothing lives here".
   */
  crowd?: MapCrowd;
  /**
   * Bodies this room stands at named cells, as distinct from the crowd it draws.
   *
   * Optional, and absent is not the same as empty: a room that never declared one is not rewritten
   * with an empty list by anything that reads and writes it back.
   */
  cast?: readonly MapCastMember[];
  /** What is put on its floor beyond the bodies. Absent means nothing is. */
  scatter?: MapScatter;
  structure: MapRoomStructure;
}>;
