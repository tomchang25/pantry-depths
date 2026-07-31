/**
 * Which maps the game can be pointed at.
 *
 * One today, and the list rather than a single import because the address bar names a map and a name
 * has to resolve to something. Parsed at module load: a map that cannot produce a legal floor should
 * fail where somebody is looking rather than on the frame it is needed.
 */

import { parseMapSource, type MapSource } from "@/content/maps/map-schema";
import pantryDepthsMap from "@/content/maps/pantry-depths.map.json";

const MAPS: readonly MapSource[] = [parseMapSource(pantryDepthsMap)];

/** What a run plays when the address names nothing. */
export const DEFAULT_MAP: MapSource = MAPS[0] as MapSource;

/**
 * The map that name refers to, or the default.
 *
 * A name nobody recognises falls back rather than failing: a mistyped address should start the game
 * and say so, because the alternative is a blank screen that looks like the build is broken.
 */
export function mapNamed(name: string | undefined): MapSource {
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
