import { PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { createInitialRunSnapshot } from "@/core/run-state";
import { cameraPoseFromSnapshot, createRenderScene } from "@/presentation/render-scene";
import { describe, expect, it } from "vitest";

describe("render scene projection", () => {
  it("centers the camera on settled cardinal player truth", () => {
    const snapshot = createInitialRunSnapshot(PROVISIONAL_RUN_WORLD);

    expect(cameraPoseFromSnapshot(snapshot)).toEqual({ x: 1.5, y: 1.5, angle: 0 });
  });

  it("projects active blockers and authored presentation annotations without HUD data", () => {
    const snapshot = createInitialRunSnapshot(PROVISIONAL_RUN_WORLD);
    const scene = createRenderScene(PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD, snapshot);

    expect(scene.surfaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ cell: { x: 7, y: 6 }, material: "doorBlue" })]),
    );
    expect(scene.sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "B1-gate-key-1", assetId: "key.blue", placement: "billboard" }),
        expect.objectContaining({ id: "B1-down", assetId: "presentation.stair", placement: "ground" }),
        expect.objectContaining({ id: "b1-bones-4-3", assetId: "presentation.bones", placement: "ground" }),
        expect.objectContaining({
          id: "b1-torch-3-2-north",
          assetId: "presentation.wallTorch",
          placement: "wall",
          wallFace: "north",
        }),
      ]),
    );
    expect(scene.lights).toHaveLength(4);
    expect(scene.emitters.map((emitter) => emitter.kind)).toEqual(["embers", "embers", "steam"]);
    expect(scene).not.toHaveProperty("hud");
    expect(scene).not.toHaveProperty("minimap");
  });

  it("opens inactive blockers visually and selects the authored purple princess sprite", () => {
    const initial = createInitialRunSnapshot(PROVISIONAL_RUN_WORLD);
    const snapshot = {
      ...initial,
      entities: initial.entities.map((entity) =>
        entity.id === "B1-gate-door-1" ? Object.assign({}, entity, { active: false }) : entity,
      ),
    };
    const b1Scene = createRenderScene(PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD, snapshot);
    const b5Scene = createRenderScene(PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD, {
      ...snapshot,
      player: { ...snapshot.player, floorId: "B5", cell: { x: 2, y: 1 } },
    });

    expect(b1Scene.surfaces).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cell: { x: 7, y: 6 }, material: "doorBlue" })]),
    );
    expect(b5Scene.sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "B5-goal",
          enemyId: "princess",
          assetId: "enemy.princess.normal",
          scale: 1.3,
        }),
      ]),
    );
  });

  it("carries directional hint faces on an active breakable wall surface", () => {
    const initial = createInitialRunSnapshot(PROVISIONAL_RUN_WORLD);
    const breakable = {
      kind: "breakableWall",
      id: "b1-render-hidden-wall",
      cell: { x: 5, y: 5 },
      health: 1,
      defense: 0,
      hintFaces: ["east", "west"],
    } as const;
    const floorSet = {
      ...PROVISIONAL_FLOOR_SET,
      floors: PROVISIONAL_FLOOR_SET.floors.map((floor) =>
        floor.id === "B1" ? { ...floor, gameplayEntities: [...floor.gameplayEntities, breakable] } : floor,
      ),
    } satisfies FloorSetSource;
    const snapshot = { ...initial, entities: [...initial.entities, { id: breakable.id, active: true }] };

    expect(createRenderScene(floorSet, PROVISIONAL_RUN_WORLD, snapshot).surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cell: { x: 5, y: 5 },
          material: "breakableWall",
          hintFaces: ["east", "west"],
        }),
      ]),
    );
  });
});
