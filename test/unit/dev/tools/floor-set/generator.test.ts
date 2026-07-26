import { generateFloorSet } from "../../../../../dev/tools/floor-set/generator";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { validateParsedFloorSet } from "@/content/floor/floor-validation";
import { describe, expect, it } from "vitest";

function countKind(floorSet: FloorSetSource, kind: string): number {
  return floorSet.floors.reduce(
    (total, floor) => total + floor.entities.filter((entity) => entity.kind === kind).length,
    0,
  );
}

describe("generateFloorSet", () => {
  it("is deterministic and yields any requested positive number of structurally valid floors", () => {
    const first = generateFloorSet({ seed: 42, floorCount: 3 });
    const second = generateFloorSet({ seed: 42, floorCount: 3 });
    const validation = validateParsedFloorSet(first);

    expect(first).toEqual(second);
    expect(first.floors).toHaveLength(3);
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution?.at(-1)).toMatchObject({ type: "defeatEnemy", entityId: "B3-goal" });
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

  it("honours separate per-floor key, door, and enemy counts and stays solvable", () => {
    const generated = generateFloorSet({
      seed: 11,
      floorCount: 3,
      keysPerFloor: 2,
      doorsPerFloor: 3,
      enemiesPerFloor: 2,
    });
    const validation = validateParsedFloorSet(generated);

    expect(countKind(generated, "key")).toBe(6);
    expect(countKind(generated, "door")).toBe(9);
    expect(countKind(generated, "enemy")).toBe(3 * 2 + 1);
    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution).toBeDefined();
  });

  it("rejects non-positive or fractional requested floor counts and negative entity counts", () => {
    expect(() => generateFloorSet({ seed: 1, floorCount: 0 })).toThrow("floorCount must be a positive integer");
    expect(() => generateFloorSet({ seed: 1, floorCount: 1.5 })).toThrow("floorCount must be a positive integer");
    expect(() => generateFloorSet({ seed: 1, floorCount: 1, keysPerFloor: -1 })).toThrow(
      "keysPerFloor must be a non-negative integer",
    );
  });
});
