import { PROVISIONAL_FLOOR_SET } from "@/content/floor/floor-catalog";
import { parseFloorSet, type FloorSetSource } from "@/content/floor/floor-schema";
import { validateFloorSet, validateParsedFloorSet } from "@/content/floor/floor-validation";
import { describe, expect, it } from "vitest";

function cloneFloorSet(): FloorSetSource {
  return parseFloorSet(JSON.parse(JSON.stringify(PROVISIONAL_FLOOR_SET)) as unknown);
}

describe("floor validation", () => {
  it("reports duplicate entity ids after a manual JSON edit", () => {
    const source = cloneFloorSet();
    const duplicate = {
      ...source,
      floors: source.floors.map((floor) =>
        floor.id === "B1"
          ? Object.assign({}, floor, {
              entities: [
                ...floor.entities,
                { kind: "key" as const, id: "b1-red-key", cell: { x: 4, y: 1 }, color: "red" as const },
              ],
            })
          : floor,
      ),
    } satisfies FloorSetSource;

    expect(validateParsedFloorSet(duplicate).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "entity.duplicateId" }),
    );
  });

  it("returns a no-solution error when a required key is isolated behind its matching door", () => {
    const lockedHallway = {
      schemaVersion: 1,
      initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "east" },
      goalEntityId: "goal",
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#######", "#.....#", "#######"],
          entities: [
            { kind: "door", id: "red-door", cell: { x: 2, y: 1 }, color: "red" },
            { kind: "key", id: "red-key", cell: { x: 3, y: 1 }, color: "red" },
            { kind: "enemy", id: "goal", cell: { x: 5, y: 1 }, archetypeId: "princess" },
          ],
        },
      ],
    };

    expect(validateFloorSet(lockedHallway).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "topology.noSolution" }),
    );
  });

  it("still requires defeating a goal that stands on the initial cell", () => {
    const goalUnderfoot = {
      schemaVersion: 1,
      initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "east" },
      goalEntityId: "goal",
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#####", "#...#", "#####"],
          entities: [{ kind: "enemy", id: "goal", cell: { x: 1, y: 1 }, archetypeId: "princess" }],
        },
      ],
    };
    const validation = validateFloorSet(goalUnderfoot);

    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution?.at(-1)).toMatchObject({ type: "defeatEnemy", entityId: "goal" });
    expect(validation.solution?.length).toBeGreaterThan(0);
  });

  it("returns a solution that clears each enemy and breakable wall at most once", () => {
    const solution = validateParsedFloorSet(cloneFloorSet()).solution ?? [];
    const clearingSteps = solution.filter((step) => step.type === "defeatEnemy" || step.type === "breakWall");
    const clearedIds = clearingSteps.map((step) => step.entityId);

    expect(clearingSteps.length).toBeGreaterThan(0);
    expect(new Set(clearedIds).size).toBe(clearedIds.length);
  });

  it.each([
    { label: "no faces", hintFaces: [] },
    { label: "duplicate faces", hintFaces: ["east", "east"] },
    { label: "non-opposing faces", hintFaces: ["north", "east"] },
    { label: "more than two faces", hintFaces: ["north", "east", "south"] },
  ] as const)("rejects $label on a directional hidden wall", ({ hintFaces }) => {
    const source = cloneFloorSet();
    const invalid = {
      ...source,
      floors: source.floors.map((floor) =>
        floor.id === "B1"
          ? Object.assign({}, floor, {
              entities: floor.entities.map((entity) =>
                entity.kind === "breakableWall" ? { ...entity, hintFaces } : entity,
              ),
            })
          : floor,
      ),
    } satisfies FloorSetSource;

    expect(validateParsedFloorSet(invalid).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "wall.invalidHintConfiguration" }),
    );
  });

  it("rejects interactive surface glyphs as static environment tiles", () => {
    const source = cloneFloorSet();
    const invalid = {
      ...source,
      floors: source.floors.map((floor) =>
        floor.id === "B1"
          ? Object.assign({}, floor, {
              tiles: floor.tiles.map((row, index) => (index === 1 ? "#~........#" : row)),
            })
          : floor,
      ),
    };

    expect(validateFloorSet(invalid).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "schema.invalid" }),
    );
  });
});
