import {
  addGameplayEntity,
  createDefaultGameplayEntity,
  moveGameplayEntity,
  paintTerrain,
  resizeFloor,
  updateGameplayEntity,
} from "@/app/debug/floor-authoring";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { describe, expect, it } from "vitest";

const FLOOR_SET: FloorSetSource = {
  schemaVersion: 2,
  initial: { floorId: "F1", cell: { x: 1, y: 1 }, facing: "north" },
  goalEntityId: "goal",
  floors: [
    {
      id: "F1",
      theme: "test",
      tiles: ["#####", "#...#", "#...#", "#...#", "#####"],
      gameplayEntities: [
        { kind: "enemy", id: "goal", cell: { x: 1, y: 1 }, archetypeId: "bat" },
        { kind: "key", id: "key", cell: { x: 2, y: 1 }, color: "red" },
      ],
      environmentFeatures: [
        { kind: "tileDecoration", id: "bones", cell: { x: 1, y: 2 }, decorationPresetId: "bones" },
        { kind: "wallDecoration", id: "torch", wallCell: { x: 0, y: 1 }, face: "east", decorationPresetId: "torch" },
      ],
    },
    {
      id: "F2",
      theme: "test",
      tiles: ["#####", "#...#", "#...#", "#...#", "#####"],
      gameplayEntities: [
        {
          kind: "stair",
          id: "to-f1",
          cell: { x: 1, y: 1 },
          destinationFloorId: "F1",
          destinationCell: { x: 3, y: 3 },
          destinationFacing: "north",
        },
      ],
      environmentFeatures: [],
    },
  ],
};

describe("floor authoring mutations", () => {
  it("paints terrain immutably while refusing to destroy a gameplay or environment placement", () => {
    const painted = paintTerrain(FLOOR_SET, "F1", { x: 3, y: 2 }, "=");

    expect(painted).toMatchObject({ ok: true });
    expect(painted.ok && painted.floorSet.floors[0]?.tiles[2]).toBe("#..=#");
    expect(FLOOR_SET.floors[0]?.tiles[2]).toBe("#...#");
    expect(paintTerrain(FLOOR_SET, "F1", { x: 2, y: 1 }, "#")).toMatchObject({ ok: false });
    expect(paintTerrain(FLOOR_SET, "F1", { x: 1, y: 2 }, "#")).toMatchObject({ ok: false });
    expect(paintTerrain(FLOOR_SET, "F1", { x: 1, y: 1 }, "#")).toMatchObject({ ok: false });
  });

  it("creates unique complete entities and rejects duplicate IDs or invalid destinations", () => {
    const entity = createDefaultGameplayEntity(FLOOR_SET, "F1", { x: 3, y: 2 }, "enemy");

    expect(entity).toMatchObject({ kind: "enemy", id: "f1-enemy-3-2", archetypeId: "bat" });
    expect(entity).toBeDefined();

    if (!entity) {
      throw new Error("expected a default entity");
    }

    const added = addGameplayEntity(FLOOR_SET, "F1", entity);
    expect(added).toMatchObject({ ok: true });
    expect(addGameplayEntity(FLOOR_SET, "F1", { ...entity, id: "goal" })).toMatchObject({ ok: false });
    expect(moveGameplayEntity(FLOOR_SET, "F1", "key", { x: 1, y: 1 })).toMatchObject({ ok: false });
  });

  it("creates stairs from an existing destination stair instead of a hand-entered coordinate", () => {
    const stair = createDefaultGameplayEntity(FLOOR_SET, "F1", { x: 3, y: 2 }, "stair");

    expect(stair).toMatchObject({
      kind: "stair",
      destinationFloorId: "F2",
      destinationCell: { x: 1, y: 1 },
      destinationFacing: "north",
    });
  });

  it("validates breakable-wall hints before replacing an entity", () => {
    const wall = createDefaultGameplayEntity(FLOOR_SET, "F1", { x: 3, y: 2 }, "breakableWall");

    expect(wall).toMatchObject({ kind: "breakableWall", hintFaces: ["north"] });

    if (!wall || wall.kind !== "breakableWall") {
      throw new Error("expected a default breakable wall");
    }

    const added = addGameplayEntity(FLOOR_SET, "F1", wall);

    if (!added.ok) {
      throw new Error(added.message);
    }

    expect(
      updateGameplayEntity(added.floorSet, "F1", wall.id, { ...wall, hintFaces: ["north", "east"] }),
    ).toMatchObject({ ok: false });
  });

  it("grows from the top-left origin and rejects every destructive shrink reference", () => {
    const grown = resizeFloor(FLOOR_SET, "F1", 7, 6);

    expect(grown).toMatchObject({ ok: true });
    expect(grown.ok && grown.floorSet.floors[0]?.tiles).toEqual([
      "#######",
      "#...###",
      "#...###",
      "#...###",
      "#######",
      "#######",
    ]);
    expect(resizeFloor(FLOOR_SET, "F1", 3, 3)).toMatchObject({ ok: false });
    expect(resizeFloor(FLOOR_SET, "F1", 4, 3)).toMatchObject({ ok: false });
  });
});
