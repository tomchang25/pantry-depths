/**
 * What a map resolves to, and the refusals only a built floor can be asked.
 *
 * A map file holds names; the content layer parses it and resolves those names into rooms. What
 * arrives here is the other end of that pipeline: the resolved map assembly is handed, and the
 * contract a drawn floor — one run's particular draw — has to satisfy before anybody stands on it.
 * The refusals live beside the contract because they are rules about floors, not about files: no
 * stranded ground a generator produced, and a route from the arrival to the way out.
 */

import { UNFILLABLE_GROUND, type MapRoom, type MapTileKind } from "@/core/room-contract";

/**
 * Where a room stands on the map.
 *
 * `main` is the region every other room hangs off; the four others hang off it, one per side. A slot
 * with no room in it is simply not built and reads as boundary brick, the same as the corners the
 * assembly has always left over.
 */
export const MAP_SLOTS = ["main", "north", "south", "west", "east"] as const;

export type MapSlot = (typeof MAP_SLOTS)[number];

export const SIDE_SLOTS: readonly MapSlot[] = ["north", "south", "west", "east"];

export type ResolvedPlacement = Readonly<{ slot: MapSlot; room: MapRoom }>;

/**
 * A map with its rooms present, which is what assembles a floor.
 *
 * Structurally what a map has always been handed over as. The rooms arrive from the library rather than
 * from the file, and nothing downstream of here can tell the difference — deliberately, because the
 * whole of this change should be invisible to the floor builder.
 */
export type ResolvedMap = Readonly<{
  name: string;
  width: number;
  height: number;
  fixed: readonly ResolvedPlacement[];
  pool: readonly MapRoom[];
  draw: number;
}>;

/** One run's floor, as far as the refusals below need to see it. */
export type DrawnFloor = Readonly<{
  /** The map it came from, so a refusal says which file to open. */
  mapName: string;
  width: number;
  height: number;
  /** Row-major, one entry per cell. */
  tiles: readonly MapTileKind[];
  entrance: Readonly<{ x: number; y: number }>;
  exit: Readonly<{ x: number; y: number }>;
  /** The rooms this draw put on the floor, so a refusal names the combination that failed. */
  drawnRoomIds: readonly string[];
  /**
   * Cells an author placed by hand, as indices into `tiles`.
   *
   * The one thing that separates a floor shape somebody meant from one nobody did. Ground an author
   * sealed off is a design that costs bodies to reach; the same shape a generator arrived at is a
   * defect. Only the second is repaired, and only the second is refused.
   */
  authoredCells: readonly number[];
}>;

/**
 * Ground the run cannot walk to from where it arrives.
 *
 * Masonry does not stop the search, because masonry is the player's business: ground behind a wall is
 * reachable and this says nothing about it. Water does not come down reliably — closing one cell costs
 * three bodies, and a floor early in a run may not have three to spend — so ground behind water is cut
 * off, and that is the whole of what this finds.
 *
 * The same rule a room's authored cells are already held to, asked of a floor a generator built —
 * and it reads the same list, so the two cannot come to different answers about a kind.
 */
export function strandedGround(floor: DrawnFloor): readonly Readonly<{ x: number; y: number }>[] {
  const { width, height, tiles } = floor;
  const index = (x: number, y: number): number => y * width + x;
  const crossable = (x: number, y: number): boolean => {
    const kind = tiles[index(x, y)];
    return kind !== undefined && kind !== "border" && !UNFILLABLE_GROUND.includes(kind);
  };

  const start = index(floor.entrance.x, floor.entrance.y);
  const queue: number[] = [start];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;
    const currentX = current % width;
    const currentY = Math.floor(current / width);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (
        nextX < 0 ||
        nextY < 0 ||
        nextX >= width ||
        nextY >= height ||
        seen.has(index(nextX, nextY)) ||
        !crossable(nextX, nextY)
      ) {
        continue;
      }

      seen.add(index(nextX, nextY));
      queue.push(index(nextX, nextY));
    }
  }

  const stranded: Readonly<{ x: number; y: number }>[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const kind = tiles[index(x, y)];

      // Only ground somebody stands on. A cell holding a caltrop or an emplacement is not that, and
      // neither is the boundary or a corner no room ever painted.
      if ((kind === "open" || kind === "filled") && !seen.has(index(x, y))) {
        stranded.push({ x, y });
      }
    }
  }

  return stranded;
}

/**
 * Refuses a floor holding ground nothing can walk to, unless an author put it there.
 *
 * Runs after the assembly has had its chance to repair one, which is what makes this a check on the
 * repair rather than a coin toss on whether a run starts. A floor reaching here with generated ground
 * cut off is a bug in whatever built it.
 *
 * **An author's cells are exempt, and that is the whole of the exemption.** A room painted cell by cell
 * may hold an island in a pool, which is a floor that costs three bodies a cell to reach rather than a
 * floor nobody can finish. Nothing a generator produced is exempt, so the guarantee this was written
 * for still holds everywhere it was written for.
 */
export function validateDrawnWalk(floor: DrawnFloor): void {
  const authored = new Set(floor.authoredCells);
  const stranded = strandedGround(floor).filter((cell) => !authored.has(cell.y * floor.width + cell.x));
  const first = stranded[0];

  if (first) {
    throw new TypeError(
      `Map "${floor.mapName}" drew a floor with ${stranded.length} cells of ground nothing can walk to, the first at ${first.x},${first.y}.`,
    );
  }
}

/**
 * Refuses a floor one particular draw has produced.
 *
 * The declarations were checked when the file was saved and nothing here re-checks them. What is only
 * visible now is whether this combination of rooms happens to leave a route from where the run arrives
 * to the way out — a route that may have to be broken through, because masonry is the player's
 * business and there are four ways to open one. Only the boundary stops this search, which is the same
 * thing that stops the player.
 */
export function validateDrawnFloor(floor: DrawnFloor): void {
  const { width, height, tiles } = floor;
  const drawn = floor.drawnRoomIds.length > 0 ? floor.drawnRoomIds.join(", ") : "no drawn rooms";
  const index = (x: number, y: number): number => y * width + x;
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && tiles[index(x, y)] !== "border";

  if (!passable(floor.entrance.x, floor.entrance.y)) {
    throw new TypeError(`Map "${floor.mapName}" drew a floor whose arrival stands in the boundary (${drawn}).`);
  }

  const goal = index(floor.exit.x, floor.exit.y);
  const queue: number[] = [index(floor.entrance.x, floor.entrance.y)];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;

    if (current === goal) {
      return;
    }

    const currentX = current % width;
    const currentY = Math.floor(current / width);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!passable(nextX, nextY) || seen.has(index(nextX, nextY))) {
        continue;
      }

      seen.add(index(nextX, nextY));
      queue.push(index(nextX, nextY));
    }
  }

  throw new TypeError(`Map "${floor.mapName}" drew a floor with no route to the way out (${drawn}).`);
}
