/**
 * Which of the discovered maps a run is pointed at.
 *
 * Finding the maps and resolving their rooms belongs to the content layer; what is left here is the
 * only question the address bar asks — which name plays, and what happens to a name nobody recognises.
 */

import { MAPS } from "@/content/maps/map-library";
import type { ResolvedMap } from "@/core/map-contract";

/**
 * What a run plays when the address names nothing.
 *
 * Named rather than taken as the first map found, because the directory's order is alphabetical and a
 * map added later would otherwise silently become the one the game opens on.
 */
const DEFAULT_MAP_NAME = "pantry-depths";

function defaultMap(): ResolvedMap {
  const found = MAPS.find((map) => map.name === DEFAULT_MAP_NAME);

  if (!found) {
    throw new TypeError(`No map named "${DEFAULT_MAP_NAME}", which is the one a run plays when nothing else is named.`);
  }

  return found;
}

export const DEFAULT_MAP: ResolvedMap = defaultMap();

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
