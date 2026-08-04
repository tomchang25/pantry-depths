/**
 * Turning a map's names into the rooms the runtime is handed.
 *
 * Reading a map and resolving one are two operations, and the split is not a matter of taste. The
 * authoring endpoint writes a validator's return value verbatim into the file it validated, so the
 * function that validates a map file must answer names. This one answers rooms, and runs when a floor
 * is about to be built rather than when a file is about to be saved.
 *
 * It is also the first place an extent is visible, which makes it the only place two refusals can live:
 * a name nothing in the library answers, and a room that does not fit a slot it could land in. A map
 * reader holding either of those would be guessing about a room it cannot see.
 */

import { SIDE_SLOTS, type MapSlot, type ResolvedMap } from "@/core/floor/map-contract";
import type { MapRoom } from "@/core/floor/room-contract";
import type { MapSource } from "./map-schema";

/** Every room a map may name, by the identity it names it with. */
export type MapRoomLibrary = ReadonlyMap<string, MapRoom>;

/**
 * Checks a side room against the region it hangs off.
 *
 * The assembly places the main region centred in the grid and each side room flush against its own
 * grid edge, centred on the other axis. Both of those are whole-cell placements or they are nothing,
 * so the leftover space has to divide in two — a room half a cell off centre is a room whose drawn
 * extent and walked extent disagree, which is the class of bug this validation exists to make loud.
 */
function checkSideFit(map: MapSource, main: MapRoom, room: MapRoom, slot: MapSlot): void {
  const vertical = slot === "north" || slot === "south";
  const along = vertical ? room.height : room.width;
  const across = vertical ? room.width : room.height;
  const mainAlong = vertical ? main.height : main.width;
  const mainAcross = vertical ? main.width : main.height;
  const gridAlong = vertical ? map.height : map.width;
  const margin = (gridAlong - mainAlong) / 2;

  if (!Number.isInteger(margin) || margin < 0) {
    throw new TypeError(
      `Map "${map.name}" cannot centre its main region: ${gridAlong} cells with a ${mainAlong}-cell region leaves ${gridAlong - mainAlong} to split in two.`,
    );
  }

  if (along > margin) {
    throw new TypeError(
      `Map "${map.name}" room "${room.id}" is ${along} cells deep and the ${slot} slot has room for ${margin}.`,
    );
  }

  if (across > mainAcross || !Number.isInteger((mainAcross - across) / 2)) {
    throw new TypeError(
      `Map "${map.name}" room "${room.id}" is ${across} cells across and cannot sit centred on a ${mainAcross}-cell region.`,
    );
  }
}

/**
 * Whether the main region fits inside the grid at all.
 *
 * Separate from the side-room check above and asked of every map, because until now nothing asked it:
 * that check is only reached when a side room exists, so a map holding nothing but a main region was
 * never told its region was too big. The assembly then painted outside the grid — the rows before it
 * written to negative indices and silently lost, the rows past it extending the tile array beyond the
 * extent — while the assembled room still recorded the bounds the room asked for. A body placed from
 * those bounds stands in masonry, which is a floor arrived on stuck.
 *
 * Only the fit is checked here, not whether the leftover space divides in two. An odd margin merely
 * puts the region half a cell off centre, which the assembly floors and nothing else notices; it is a
 * problem for a side room hanging off that region, and it stays refused where that is decided.
 */
function checkMainFit(map: MapSource, main: MapRoom): void {
  for (const [along, extent, region] of [
    ["wide", map.width, main.width],
    ["tall", map.height, main.height],
  ] as const) {
    if (region > extent) {
      throw new TypeError(
        `Map "${map.name}" is ${extent} cells ${along} and its main region "${main.id}" is ${region}, so the region cannot be built inside it.`,
      );
    }
  }
}

function roomFor(map: MapSource, rooms: MapRoomLibrary, name: string): MapRoom {
  const room = rooms.get(name);

  if (!room) {
    throw new TypeError(`Map "${map.name}" names a room "${name}", and no room by that name exists.`);
  }

  return room;
}

/**
 * Resolves a map against the library, and refuses one whose rooms cannot stand where it puts them.
 *
 * The library is handed in rather than reached for, which is what lets how rooms are found change
 * without this function knowing.
 */
export function resolveMap(map: MapSource, rooms: MapRoomLibrary): ResolvedMap {
  const fixed = map.fixed.map((placement) => ({ slot: placement.slot, room: roomFor(map, rooms, placement.room) }));
  const pool = map.pool.map((name) => roomFor(map, rooms, name));
  const main = fixed.find((placement) => placement.slot === "main")?.room;

  if (!main) {
    throw new TypeError(
      `Map "${map.name}" has no main region, so it has nothing to hang a room off and nowhere to arrive.`,
    );
  }

  checkMainFit(map, main);

  const takenSlots = new Set(fixed.map((placement) => placement.slot));
  const freeSideSlots = SIDE_SLOTS.filter((slot) => !takenSlots.has(slot));

  // Every room that could land in a side slot is checked against every slot it could land in: which
  // one it gets is drawn, so a fit that holds for three of the four is a floor that fails at random.
  for (const placement of fixed) {
    if (placement.slot !== "main") {
      checkSideFit(map, main, placement.room, placement.slot);
    }
  }

  for (const room of pool) {
    for (const slot of freeSideSlots) {
      checkSideFit(map, main, room, slot);
    }
  }

  return { name: map.name, width: map.width, height: map.height, fixed, pool, draw: map.draw };
}
