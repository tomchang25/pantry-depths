/**
 * Every map in the working tree, found rather than listed, with its rooms already present.
 *
 * The same reasoning as the room library: a map file dropped into the directory is playable without a
 * source edit, which is what the editor this unblocks needs. Discovery and resolution happen together
 * and eagerly, so a map that contradicts itself — or that names a room nothing answers — fails at load
 * where somebody is looking, rather than on the frame the floor was going to be built.
 */

import { resolveMap, type ResolvedMap } from "./map-resolver";
import { parseMapSource } from "./map-schema";
import { ROOM_LIBRARY } from "./room-library";

const MAP_SUFFIX = ".map.json";

const MAP_FILES = import.meta.glob<unknown>("./*.map.json", { eager: true, import: "default" });

/** What a map file's path says the map inside it should be called. */
function identityOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1, -MAP_SUFFIX.length);
}

function read(path: string, file: unknown): ResolvedMap {
  const map = parseMapSource(file);
  const identity = identityOf(path);

  // The address bar carries the name and the endpoint addresses the file, so the two have to agree.
  if (map.name !== identity) {
    throw new TypeError(
      `Map file "${identity}${MAP_SUFFIX}" declares the name "${map.name}"; a map's file is named after it.`,
    );
  }

  return resolveMap(map, ROOM_LIBRARY);
}

/** Every map a run may be pointed at, in the order the directory holds them. */
export const MAPS: readonly ResolvedMap[] = Object.entries(MAP_FILES).map(([path, file]) => read(path, file));
