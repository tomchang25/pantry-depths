/**
 * Every room in the working tree, found rather than listed.
 *
 * A library that needs a source edit to notice a file is a library nothing but a person can add to, and
 * the editor this unblocks creates files. So the rooms are globbed: dropping one into the directory is
 * the whole of adding it, and deleting one is the whole of removing it.
 *
 * Read eagerly at module load, because a room that cannot be parsed should fail where somebody is
 * looking rather than on the frame a floor wanted it. A room no map names is not an error — a library
 * holds what it holds.
 */

import type { MapRoom } from "@/core/floor/room-contract";
import { parseRoomSource } from "./room-schema";

const ROOM_SUFFIX = ".room.json";

const ROOM_FILES = import.meta.glob<unknown>("./*.room.json", { eager: true, import: "default" });

/** What a room file's path says the room inside it should be called. */
function identityOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1, -ROOM_SUFFIX.length);
}

function read(path: string, file: unknown): readonly [string, MapRoom] {
  const room = parseRoomSource(file);
  const identity = identityOf(path);

  // A room is addressed by name — by a map, and by the authoring endpoint — and a file whose contents
  // disagree with its own name is a room those two would reach different answers about.
  if (room.id !== identity) {
    throw new TypeError(
      `Room file "${identity}${ROOM_SUFFIX}" declares the id "${room.id}"; a room's file is named after it.`,
    );
  }

  return [room.id, room];
}

/** Every room any map may name, by the identity it names it with. */
export const ROOM_LIBRARY: ReadonlyMap<string, MapRoom> = new Map(
  Object.entries(ROOM_FILES).map(([path, file]) => read(path, file)),
);
