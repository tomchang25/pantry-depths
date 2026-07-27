import { generateFloorSet } from "../../../../../dev/tools/floor-set/generator";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { validateParsedFloorSet } from "@/content/floor/floor-validation";
import { describe, expect, it } from "vitest";

function countKind(floorSet: FloorSetSource, kind: string): number {
  return floorSet.floors.reduce(
    (total, floor) => total + floor.gameplayEntities.filter((entity) => entity.kind === kind).length,
    0,
  );
}

function countColorKind(floorSet: FloorSetSource, kind: "key" | "door", color: string): number {
  return floorSet.floors.reduce(
    (total, floor) =>
      total +
      floor.gameplayEntities.filter((entity) => entity.kind === kind && "color" in entity && entity.color === color)
        .length,
    0,
  );
}

function floorWithRedDoor(seed: number): string | undefined {
  const generated = generateFloorSet({
    seed,
    floorCount: 6,
    redKeys: 1,
    redDoors: 1,
    blueKeys: 0,
    blueDoors: 0,
    yellowKeys: 0,
    yellowDoors: 0,
    enemies: 0,
  });

  return generated.floors.find((floor) => floor.gameplayEntities.some((entity) => entity.kind === "door"))?.id;
}

describe("generateFloorSet", () => {
  it("is deterministic and yields any requested positive number of structurally valid floors", () => {
    const first = generateFloorSet({ seed: 42, floorCount: 3 });
    const second = generateFloorSet({ seed: 42, floorCount: 3 });
    const validation = validateParsedFloorSet(first);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(4);
    expect(first.floors).toHaveLength(3);
    expect(first.floors.every((floor) => floor.environmentFeatures.length === 0)).toBe(true);
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution?.at(-1)).toMatchObject({ type: "leaveExit", entityId: "B3-exit" });
  });

  it("produces a different layout for a different seed", () => {
    const first = generateFloorSet({ seed: 1, floorCount: 2 });
    const second = generateFloorSet({ seed: 2, floorCount: 2 });

    expect(first.floors.map((floor) => floor.tiles)).not.toEqual(second.floors.map((floor) => floor.tiles));
  });

  it("carves varied terrain instead of one repeated empty room", () => {
    const generated = generateFloorSet({ seed: 9, floorCount: 2 });
    const interiorRows = generated.floors.flatMap((floor) => floor.tiles.slice(1, -1));

    expect(interiorRows.some((row) => row.slice(1, -1).includes("#"))).toBe(true);
    expect(new Set(generated.floors.map((floor) => floor.tiles.join("\n"))).size).toBe(2);
  });

  it("defaults to one key and one door of each color plus one enemy for the whole candidate", () => {
    const generated = generateFloorSet({ seed: 5, floorCount: 5 });
    const validation = validateParsedFloorSet(generated);

    expect(countKind(generated, "key")).toBe(3);
    expect(countKind(generated, "door")).toBe(3);
    expect(countKind(generated, "enemy")).toBe(1);
    expect(countKind(generated, "exit")).toBe(1);
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution).toBeDefined();
  });

  it("generates at a chosen odd width and height, applied to every floor", () => {
    const generated = generateFloorSet({ seed: 3, floorCount: 2, width: 9, height: 7 });

    for (const floor of generated.floors) {
      expect(floor.tiles).toHaveLength(7);
      expect(floor.tiles.every((row) => row.length === 9)).toBe(true);
    }
  });

  it("rejects even, fractional, or too-small dimensions", () => {
    expect(() => generateFloorSet({ seed: 1, floorCount: 1, width: 8 })).toThrow(
      "width must be an odd integer of at least 5",
    );
    expect(() => generateFloorSet({ seed: 1, floorCount: 1, height: 5.5 })).toThrow(
      "height must be an odd integer of at least 5",
    );
    expect(() => generateFloorSet({ seed: 1, floorCount: 1, width: 3 })).toThrow(
      "width must be an odd integer of at least 5",
    );
  });

  it("honours independent per-color key and door totals for the whole candidate regardless of floor count", () => {
    const generated = generateFloorSet({
      seed: 11,
      floorCount: 10,
      redKeys: 2,
      redDoors: 3,
      blueKeys: 1,
      blueDoors: 1,
      yellowKeys: 0,
      yellowDoors: 0,
      enemies: 4,
    });
    const validation = validateParsedFloorSet(generated);

    expect(countColorKind(generated, "key", "red")).toBe(2);
    expect(countColorKind(generated, "door", "red")).toBe(3);
    expect(countColorKind(generated, "key", "blue")).toBe(1);
    expect(countColorKind(generated, "door", "blue")).toBe(1);
    expect(countColorKind(generated, "key", "yellow")).toBe(0);
    expect(countColorKind(generated, "door", "yellow")).toBe(0);
    expect(countKind(generated, "enemy")).toBe(4);
    expect(countKind(generated, "exit")).toBe(1);
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution).toBeDefined();
  });

  it("spreads a total smaller than the floor count across different floors depending on seed", () => {
    const placements = new Set([1, 2, 3, 4, 5].map((seed) => floorWithRedDoor(seed)));

    expect(placements.size).toBeGreaterThan(1);
  });

  it("never blocks the route with a color that has more doors than keys", () => {
    const generated = generateFloorSet({
      seed: 7,
      floorCount: 2,
      redKeys: 0,
      redDoors: 2,
      blueKeys: 0,
      blueDoors: 0,
      yellowKeys: 0,
      yellowDoors: 0,
    });
    const validation = validateParsedFloorSet(generated);

    expect(validation.solution).toBeDefined();
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("rejects non-positive or fractional requested floor counts and negative totals", () => {
    expect(() => generateFloorSet({ seed: 1, floorCount: 0 })).toThrow("floorCount must be a positive integer");
    expect(() => generateFloorSet({ seed: 1, floorCount: 1.5 })).toThrow("floorCount must be a positive integer");
    expect(() => generateFloorSet({ seed: 1, floorCount: 1, redKeys: -1 })).toThrow(
      "redKeys must be a non-negative integer",
    );
  });

  it("fails rather than silently under-placing when a total cannot fit", () => {
    expect(() =>
      generateFloorSet({ seed: 1, floorCount: 1, width: 5, height: 5, redKeys: 50, redDoors: 50 }),
    ).toThrow();
  });
});
