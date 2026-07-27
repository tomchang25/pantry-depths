import { PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
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
      expect.arrayContaining([
        expect.objectContaining({ cell: { x: 3, y: 1 }, material: "doorRed" }),
        expect.objectContaining({
          cell: { x: 5, y: 5 },
          material: "breakableWall",
          hintFaces: ["east", "west"],
        }),
      ]),
    );
    expect(scene.sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "b1-red-key", assetId: "key.red", placement: "billboard" }),
        expect.objectContaining({ id: "b1-down", assetId: "presentation.stair", placement: "ground" }),
        expect.objectContaining({ id: "b1-bones", assetId: "presentation.bones", placement: "ground" }),
        expect.objectContaining({ id: "b1-wall-torch", assetId: "presentation.wallTorch", placement: "wall" }),
      ]),
    );
    expect(scene.lights).toHaveLength(2);
    expect(scene.emitters.map((emitter) => emitter.kind)).toEqual(["embers", "steam"]);
    expect(scene).not.toHaveProperty("hud");
    expect(scene).not.toHaveProperty("minimap");
  });

  it("opens inactive blockers visually and selects the authored purple princess sprite", () => {
    const initial = createInitialRunSnapshot(PROVISIONAL_RUN_WORLD);
    const snapshot = {
      ...initial,
      player: { ...initial.player, floorId: "B5", cell: { x: 7, y: 8 } },
      entities: initial.entities.map((entity) =>
        entity.id === "b1-red-door" || entity.id === "b1-hidden-wall"
          ? Object.assign({}, entity, { active: false })
          : entity,
      ),
    };
    const b1Scene = createRenderScene(PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD, {
      ...snapshot,
      player: { ...snapshot.player, floorId: "B1" },
    });
    const b5Scene = createRenderScene(PROVISIONAL_FLOOR_SET, PROVISIONAL_RUN_WORLD, snapshot);

    expect(b1Scene.surfaces).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: { x: 3, y: 1 }, material: "doorRed" }),
        expect.objectContaining({ cell: { x: 5, y: 5 }, material: "breakableWall" }),
      ]),
    );
    expect(b5Scene.sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "b5-princess",
          enemyId: "princess",
          assetId: "enemy.princess.normal",
          scale: 1.3,
        }),
      ]),
    );
  });
});
