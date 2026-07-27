import {
  addEnvironmentFeature,
  addGameplayEntity,
  collectPresetSuggestions,
  createDefaultEnvironmentFeature,
  createDefaultGameplayEntity,
  legalEnvironmentFeatureKinds,
  moveGameplayEntity,
  paintTerrain,
  removeEnvironmentFeature,
  removeGameplayEntity,
  resizeFloor,
  updateEnvironmentFeature,
  updateGameplayEntity,
} from "@/app/debug/floor-authoring";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { describe, expect, it } from "vitest";

const FLOOR_SET: FloorSetSource = {
  schemaVersion: 3,
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
        {
          kind: "stair",
          id: "f1-arrival",
          cell: { x: 3, y: 3 },
          destinationStairId: "to-f1",
          arrivalFacing: "south",
        },
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
          destinationStairId: "f1-arrival",
          arrivalFacing: "north",
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

    expect(entity).toMatchObject({ kind: "enemy", id: "f1-enemy-3-2", archetypeId: "greenSlime" });
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
      destinationStairId: "f1-arrival",
      arrivalFacing: "north",
    });
  });

  it("rewrites inbound links when a stair ID changes and protects referenced stairs from removal", () => {
    const destination = FLOOR_SET.floors[0]?.gameplayEntities.find((entity) => entity.id === "f1-arrival");

    if (!destination || destination.kind !== "stair") {
      throw new Error("expected destination stair");
    }

    expect(removeGameplayEntity(FLOOR_SET, "F1", destination.id)).toMatchObject({ ok: false });

    const updated = updateGameplayEntity(FLOOR_SET, "F1", destination.id, {
      ...destination,
      id: "f1-arrival-renamed",
    });

    expect(updated).toMatchObject({ ok: true });
    expect(
      updated.ok && updated.floorSet.floors[1]?.gameplayEntities.find((entity) => entity.id === "to-f1"),
    ).toMatchObject({ destinationStairId: "f1-arrival-renamed" });
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

describe("environment feature authoring", () => {
  const floor = FLOOR_SET.floors[0];

  if (!floor) {
    throw new Error("expected floor F1");
  }

  it("reports only the environment-feature kinds legal at the selected cell", () => {
    expect(legalEnvironmentFeatureKinds(floor, { x: 2, y: 2 })).toEqual([
      "tileDecoration",
      "ambientLight",
      "effectEmitter",
    ]);
    expect(legalEnvironmentFeatureKinds(floor, { x: 0, y: 2 })).toEqual(["wallDecoration"]);
    expect(legalEnvironmentFeatureKinds(floor, { x: 1, y: 2 })).toEqual(["ambientLight", "effectEmitter"]);
    expect(legalEnvironmentFeatureKinds(floor, { x: 0, y: 0 })).toEqual([]);
  });

  it("collects deduplicated, sorted preset suggestions from the whole draft", () => {
    expect(collectPresetSuggestions(FLOOR_SET)).toEqual({
      decoration: ["bones", "torch"],
      light: [],
      effect: [],
    });
  });

  it("creates complete default records and refuses illegal cells", () => {
    const tile = createDefaultEnvironmentFeature(FLOOR_SET, "F1", { x: 2, y: 2 }, "tileDecoration");
    expect(tile).toMatchObject({ kind: "tileDecoration", decorationPresetId: "bones" });

    const wall = createDefaultEnvironmentFeature(FLOOR_SET, "F1", { x: 0, y: 2 }, "wallDecoration");
    expect(wall).toMatchObject({ kind: "wallDecoration", wallCell: { x: 0, y: 2 }, face: "east" });

    const light = createDefaultEnvironmentFeature(FLOOR_SET, "F1", { x: 2, y: 2 }, "ambientLight");
    expect(light).toMatchObject({ kind: "ambientLight", lightPresetId: "unspecified" });

    expect(createDefaultEnvironmentFeature(FLOOR_SET, "F1", { x: 2, y: 2 }, "wallDecoration")).toBeUndefined();
    expect(createDefaultEnvironmentFeature(FLOOR_SET, "F1", { x: 1, y: 2 }, "tileDecoration")).toBeUndefined();
  });

  it("adds an environment feature immutably and rejects a duplicate ID", () => {
    const added = addEnvironmentFeature(FLOOR_SET, "F1", {
      kind: "ambientLight",
      id: "new-light",
      cell: { x: 2, y: 2 },
      lightPresetId: "warm",
    });

    expect(added).toMatchObject({ ok: true });
    expect(added.ok && added.floorSet.floors[0]?.environmentFeatures).toHaveLength(3);
    expect(FLOOR_SET.floors[0]?.environmentFeatures).toHaveLength(2);
    expect(
      addEnvironmentFeature(FLOOR_SET, "F1", {
        kind: "ambientLight",
        id: "bones",
        cell: { x: 2, y: 2 },
        lightPresetId: "warm",
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects a wall decoration with a non-solid anchor, a blocked face, or an occupied anchor and face", () => {
    expect(
      addEnvironmentFeature(FLOOR_SET, "F1", {
        kind: "wallDecoration",
        id: "bad-anchor",
        wallCell: { x: 2, y: 2 },
        face: "north",
        decorationPresetId: "sconce",
      }),
    ).toMatchObject({ ok: false });
    expect(
      addEnvironmentFeature(FLOOR_SET, "F1", {
        kind: "wallDecoration",
        id: "bad-face",
        wallCell: { x: 0, y: 0 },
        face: "north",
        decorationPresetId: "sconce",
      }),
    ).toMatchObject({ ok: false });
    expect(
      addEnvironmentFeature(FLOOR_SET, "F1", {
        kind: "wallDecoration",
        id: "duplicate-anchor",
        wallCell: { x: 0, y: 1 },
        face: "east",
        decorationPresetId: "sconce",
      }),
    ).toMatchObject({ ok: false });
  });

  it("updates a feature's preset fields, rejects a kind change, and omits a cleared optional preset", () => {
    const withLight = addEnvironmentFeature(FLOOR_SET, "F1", {
      kind: "wallDecoration",
      id: "sconce",
      wallCell: { x: 0, y: 2 },
      face: "east",
      decorationPresetId: "sconce",
      lightPresetId: "dim",
    });

    if (!withLight.ok) {
      throw new Error(withLight.message);
    }

    const relabeled = updateEnvironmentFeature(withLight.floorSet, "F1", "sconce", {
      kind: "wallDecoration",
      id: "sconce",
      wallCell: { x: 0, y: 2 },
      face: "east",
      decorationPresetId: "sconce-bright",
      lightPresetId: "  ",
    });

    expect(relabeled).toMatchObject({ ok: true });
    const relabeledFeature =
      relabeled.ok && relabeled.floorSet.floors[0]?.environmentFeatures.find((feature) => feature.id === "sconce");
    expect(relabeledFeature).toMatchObject({ decorationPresetId: "sconce-bright" });
    expect(relabeledFeature).not.toHaveProperty("lightPresetId");

    expect(
      updateEnvironmentFeature(withLight.floorSet, "F1", "sconce", {
        kind: "tileDecoration",
        id: "sconce",
        cell: { x: 2, y: 2 },
        decorationPresetId: "sconce",
      }),
    ).toMatchObject({ ok: false });
  });

  it("removes a feature while leaving co-located records and other authored data untouched", () => {
    const removed = removeEnvironmentFeature(FLOOR_SET, "F1", "bones");

    expect(removed).toMatchObject({ ok: true });
    expect(removed.ok && removed.floorSet.floors[0]?.environmentFeatures.map((feature) => feature.id)).toEqual([
      "torch",
    ]);
    expect(FLOOR_SET.floors[0]?.environmentFeatures).toHaveLength(2);
    expect(removeEnvironmentFeature(FLOOR_SET, "F1", "missing")).toMatchObject({ ok: false });
  });
});
