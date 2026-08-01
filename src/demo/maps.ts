/**
 * Which maps the game can be pointed at, and the rooms they are built from.
 *
 * One map today, and the list rather than a single import because the address bar names a map and a
 * name has to resolve to something. Read and resolved at module load, in that order: a map file that
 * contradicts itself, or that names a room nothing answers, should fail where somebody is looking
 * rather than on the frame it is needed.
 */

import { resolveMap, type MapRoomLibrary, type ResolvedMap } from "@/content/maps/map-resolver";
import { parseMapSource } from "@/content/maps/map-schema";
import { parseRoomSource } from "@/content/maps/room-schema";
import pantryDepthsMap from "@/content/maps/pantry-depths.map.json";
import blessingAltarRoom from "@/content/rooms/blessing-altar.room.json";
import cursedAltarRoom from "@/content/rooms/cursed-altar.room.json";
import extractionRoom from "@/content/rooms/extraction.room.json";
import hotSpringRoom from "@/content/rooms/hot-spring.room.json";
import mainRegionRoom from "@/content/rooms/main-region.room.json";

const ROOM_FILES: readonly unknown[] = [
  mainRegionRoom,
  cursedAltarRoom,
  blessingAltarRoom,
  hotSpringRoom,
  extractionRoom,
];

const ROOMS: MapRoomLibrary = new Map(ROOM_FILES.map((file) => parseRoomSource(file)).map((room) => [room.id, room]));

const MAPS: readonly ResolvedMap[] = [resolveMap(parseMapSource(pantryDepthsMap), ROOMS)];

/** What a run plays when the address names nothing. */
export const DEFAULT_MAP: ResolvedMap = MAPS[0] as ResolvedMap;

/**
 * The map that name refers to, or the default.
 *
 * A name nobody recognises falls back rather than failing: a mistyped address should start the game
 * and say so, because the alternative is a blank screen that looks like the build is broken.
 */
export function mapNamed(name: string | undefined): ResolvedMap {
  if (name === undefined || name.length === 0) {
    return DEFAULT_MAP;
  }

  const found = MAPS.find((map) => map.name === name);

  if (!found) {
    console.warn(`No map named "${name}"; playing "${DEFAULT_MAP.name}" instead.`);
    return DEFAULT_MAP;
  }

  return found;
}
