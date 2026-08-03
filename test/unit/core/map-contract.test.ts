import { strandedGround, validateDrawnFloor, validateDrawnWalk, type DrawnFloor } from "@/core/map-contract";
import type { MapTileKind } from "@/core/room-contract";
import { describe, expect, it } from "vitest";

/**
 * The drawn-floor refusals, named in the rules-move spec: the checks only a built floor can be
 * asked, exercised on the smallest floors that can ask them.
 */

function floor(rows: readonly string[], authoredCells: readonly number[] = []): DrawnFloor {
  const legend: Readonly<Record<string, MapTileKind>> = {
    ".": "open",
    "#": "border",
    S: "stone",
    "~": "water",
    E: "open",
    X: "open",
  };
  const width = rows[0]?.length ?? 0;
  const tiles = rows.flatMap((row) => [...row].map((cell) => legend[cell] ?? "open"));
  const find = (mark: string): { x: number; y: number } => {
    const index = rows.join("").indexOf(mark);
    return { x: index % width, y: Math.floor(index / width) };
  };

  return {
    mapName: "fixture",
    width,
    height: rows.length,
    tiles,
    entrance: find("E"),
    exit: find("X"),
    drawnRoomIds: [],
    authoredCells,
  };
}

describe("the drawn-floor refusals", () => {
  it("accepts a floor with a route and no stranded ground, and finds ground sealed behind water", () => {
    const open = floor(["#####", "#E.X#", "#####"]);
    expect(() => validateDrawnFloor(open)).not.toThrow();
    expect(() => validateDrawnWalk(open)).not.toThrow();
    expect(strandedGround(open)).toEqual([]);

    const sealed = floor(["#####", "#E~.#", "#####"]);
    expect(strandedGround(sealed)).toEqual([{ x: 3, y: 1 }]);
    expect(() => validateDrawnWalk(sealed)).toThrow(/ground nothing can walk to/);
  });

  it("exempts an author's own sealed cells and nothing else", () => {
    const rows = ["#####", "#E~.#", "#####"] as const;
    const islandIndex = 1 * 5 + 3;
    expect(() => validateDrawnWalk(floor(rows, [islandIndex]))).not.toThrow();
    expect(() => validateDrawnWalk(floor(rows, [islandIndex + 1]))).toThrow(/ground nothing can walk to/);
  });

  it("stops the route search only at the boundary, because masonry is the player's business", () => {
    // A stone wall between arrival and exit is a route the player can open, so it passes; the same
    // gap sealed with boundary brick is a floor with no way out, so it refuses.
    const walled = floor(["#####", "#ESX#", "#####"]);
    expect(() => validateDrawnFloor(walled)).not.toThrow();

    const tiles = [...walled.tiles];
    tiles[1 * 5 + 2] = "border";
    expect(() => validateDrawnFloor({ ...walled, tiles })).toThrow(/no route to the way out/);
  });
});
