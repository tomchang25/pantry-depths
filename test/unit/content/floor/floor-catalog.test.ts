import {
  createRunWorldFromFloorSet,
  PROVISIONAL_FLOOR_SET,
  PROVISIONAL_FLOOR_VALIDATION,
  PROVISIONAL_RUN_WORLD,
} from "@/content/floor/floor-catalog";
import { parseFloorSet, type FloorSetSource } from "@/content/floor/floor-schema";
import { describe, expect, it } from "vitest";

describe("provisional floor catalog", () => {
  it("assembles five authored floors with a topology-validated path to the goal", () => {
    const errors = PROVISIONAL_FLOOR_VALIDATION.findings.filter((finding) => finding.severity === "error");

    expect(PROVISIONAL_FLOOR_SET.floors).toHaveLength(5);
    expect(errors).toEqual([]);
    expect(PROVISIONAL_FLOOR_VALIDATION.solution?.at(-1)).toMatchObject({
      type: "defeatEnemy",
      entityId: "B5-goal",
    });
  });

  it("keeps directional hidden-wall hints as entity metadata rather than a command rule", () => {
    const floorSet = parseFloorSet({
      schemaVersion: 3,
      initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "east" },
      goalEntityId: "goal",
      floors: [
        {
          id: "F1",
          theme: "test",
          tiles: ["#####", "#...#", "#####"],
          gameplayEntities: [
            {
              kind: "breakableWall",
              id: "f1-hidden-wall",
              cell: { x: 2, y: 1 },
              health: 1,
              defense: 0,
              hintFaces: ["east", "west"],
            },
            { kind: "enemy", id: "goal", cell: { x: 3, y: 1 }, archetypeId: "princess" },
          ],
          environmentFeatures: [],
        },
      ],
    });
    const wall = createRunWorldFromFloorSet(floorSet).entities.find((entity) => entity.id === "f1-hidden-wall");

    expect(wall).toMatchObject({
      kind: "breakableWall",
      directionalHint: { faces: ["east", "west"] },
      combat: { retaliates: false },
    });
  });

  it("keeps presentation-only environment features out of the gameplay world", () => {
    const withoutEnvironment = {
      ...PROVISIONAL_FLOOR_SET,
      floors: PROVISIONAL_FLOOR_SET.floors.map((floor) => ({ ...floor, environmentFeatures: [] })),
    };

    expect(PROVISIONAL_FLOOR_SET.floors[0]?.environmentFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "tileDecoration", decorationPresetId: "bones" }),
        expect.objectContaining({
          kind: "wallDecoration",
          decorationPresetId: "wallTorch",
          lightPresetId: "warmTorch",
        }),
        expect.objectContaining({ kind: "wallDecoration", decorationPresetId: "wallSpikes" }),
        expect.objectContaining({ kind: "ambientLight", lightPresetId: "warmSpring" }),
        expect.objectContaining({ kind: "effectEmitter", effectPresetId: "steam" }),
      ]),
    );
    expect(createRunWorldFromFloorSet(withoutEnvironment)).toEqual(PROVISIONAL_RUN_WORLD);
    expect(PROVISIONAL_RUN_WORLD.entities.map((entity) => entity.id)).not.toContain("b1-spikes-8-1-west");
  });

  it("resolves location and arrival facing from a shared destination stair", () => {
    const floorSet = {
      ...PROVISIONAL_FLOOR_SET,
      floors: PROVISIONAL_FLOOR_SET.floors.map((floor) =>
        Object.assign({}, floor, {
          gameplayEntities: floor.gameplayEntities.map((entity) => {
            if (entity.id === "B1-down" && entity.kind === "stair") {
              return Object.assign({}, entity, { arrivalFacing: "south" as const });
            }

            if (entity.id === "B3-up" && entity.kind === "stair") {
              return Object.assign({}, entity, { destinationStairId: "B1-down" });
            }

            return entity;
          }),
        }),
      ),
    } satisfies FloorSetSource;
    const world = createRunWorldFromFloorSet(floorSet);
    const expectedTransition = {
      interaction: {
        effects: [{ type: "transition", floorId: "B1", cell: { x: 1, y: 11 }, facing: "south" }],
      },
    };

    expect(world.entities.find((entity) => entity.id === "B2-up")).toMatchObject(expectedTransition);
    expect(world.entities.find((entity) => entity.id === "B3-up")).toMatchObject(expectedTransition);
  });
});
