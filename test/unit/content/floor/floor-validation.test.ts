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
              gameplayEntities: [
                ...floor.gameplayEntities,
                { kind: "key" as const, id: "b1-key-1-5", cell: { x: 4, y: 1 }, color: "red" as const },
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
      schemaVersion: 4,
      initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "east" },
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#######", "#.....#", "#######"],
          gameplayEntities: [
            { kind: "door", id: "red-door", cell: { x: 2, y: 1 }, color: "red" },
            { kind: "key", id: "red-key", cell: { x: 3, y: 1 }, color: "red" },
            { kind: "exit", id: "exit", cell: { x: 5, y: 1 } },
          ],
          environmentFeatures: [],
        },
      ],
    };

    expect(validateFloorSet(lockedHallway).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "topology.noSolution" }),
    );
  });

  it.each([
    { label: "no exit", exits: [] },
    {
      label: "two exits",
      exits: [
        { kind: "exit", id: "exit-a", cell: { x: 1, y: 1 } },
        { kind: "exit", id: "exit-b", cell: { x: 3, y: 1 } },
      ],
    },
  ])("rejects a floor set with $label", ({ exits }) => {
    const candidate = {
      schemaVersion: 4,
      initial: { floorId: "F1", cell: { x: 2, y: 1 }, facing: "east" },
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#####", "#...#", "#####"],
          gameplayEntities: exits,
          environmentFeatures: [],
        },
      ],
    };

    expect(validateFloorSet(candidate).findings).toContainEqual(
      expect.objectContaining({ severity: "error", code: "exit.invalidCount" }),
    );
  });

  it("completes a route by leaving through the exit rather than by defeating an enemy", () => {
    const guardedExit = {
      schemaVersion: 4,
      initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "east" },
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#####", "#...#", "#####"],
          gameplayEntities: [
            { kind: "enemy", id: "blocker", cell: { x: 2, y: 1 }, archetypeId: "purpleSlime" },
            { kind: "exit", id: "exit", cell: { x: 3, y: 1 } },
          ],
          environmentFeatures: [],
        },
      ],
    };
    const validation = validateFloorSet(guardedExit);

    expect(validation.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validation.solution?.at(-1)).toMatchObject({ type: "leaveExit", entityId: "exit" });
    expect(validation.solution?.some((step) => step.type === "defeatEnemy" && step.entityId === "blocker")).toBe(true);
  });

  it("returns a solution that clears each enemy and breakable wall at most once", () => {
    const solution = validateParsedFloorSet(cloneFloorSet()).solution ?? [];
    const clearingSteps = solution.filter((step) => step.type === "defeatEnemy" || step.type === "breakWall");
    const clearedIds = clearingSteps.map((step) => step.entityId);

    expect(clearingSteps.length).toBeGreaterThan(0);
    expect(new Set(clearedIds).size).toBe(clearedIds.length);
  });

  it("allows multiple source stairs to share one destination stair", () => {
    const source = cloneFloorSet();
    const directed = {
      ...source,
      floors: source.floors.map((floor) =>
        Object.assign({}, floor, {
          gameplayEntities: floor.gameplayEntities.map((entity) =>
            entity.id === "b3-up" && entity.kind === "stair"
              ? Object.assign({}, entity, { destinationStairId: "b1-down" })
              : entity,
          ),
        }),
      ),
    } satisfies FloorSetSource;

    expect(validateParsedFloorSet(directed).findings.filter((finding) => finding.severity === "error")).toEqual([]);
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
              gameplayEntities: [
                ...floor.gameplayEntities,
                {
                  kind: "breakableWall" as const,
                  id: "b1-hint-config-wall",
                  cell: { x: 4, y: 1 },
                  health: 1,
                  defense: 0,
                  hintFaces,
                },
              ],
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

  it("rejects invalid environment anchors without changing topology ownership", () => {
    const source = cloneFloorSet();
    const invalid = {
      ...source,
      floors: source.floors.map((floor) =>
        floor.id === "B1"
          ? Object.assign({}, floor, {
              environmentFeatures: [
                ...floor.environmentFeatures,
                {
                  kind: "tileDecoration" as const,
                  id: "invalid-floor-decoration",
                  cell: { x: 0, y: 0 },
                  decorationPresetId: "bones",
                },
                {
                  kind: "wallDecoration" as const,
                  id: "invalid-wall-decoration",
                  wallCell: { x: 1, y: 1 },
                  face: "east" as const,
                  decorationPresetId: "wallSpikes",
                },
              ],
            })
          : floor,
      ),
    } satisfies FloorSetSource;

    expect(validateParsedFloorSet(invalid).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: "environment.invalidFloorPosition" }),
        expect.objectContaining({ severity: "error", code: "environment.invalidWallDecorationCell" }),
      ]),
    );
  });
});
