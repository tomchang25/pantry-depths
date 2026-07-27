import { SCENE_FLOOR_SET } from "../../fixtures/scene-floor-set";
import { createRunWorldFromFloorSet } from "@/content/floor/floor-catalog";
import { createInitialRunSnapshot } from "@/core/run-state";
import { cameraPoseFromSnapshot, createRenderScene } from "@/presentation/render-scene";
import { describe, expect, it } from "vitest";

const SCENE_WORLD = createRunWorldFromFloorSet(SCENE_FLOOR_SET);

function sceneAt(deactivatedIds: readonly string[] = []) {
  const initial = createInitialRunSnapshot(SCENE_WORLD);
  const snapshot = {
    ...initial,
    entities: initial.entities.map((entity) =>
      deactivatedIds.includes(entity.id) ? Object.assign({}, entity, { active: false }) : entity,
    ),
  };

  return createRenderScene(SCENE_FLOOR_SET, SCENE_WORLD, snapshot);
}

describe("render scene projection", () => {
  it("centers the camera on settled cardinal player truth", () => {
    expect(cameraPoseFromSnapshot(createInitialRunSnapshot(SCENE_WORLD))).toEqual({ x: 1.5, y: 1.5, angle: 0 });
  });

  it("projects active blockers and authored presentation annotations without HUD data", () => {
    const scene = sceneAt();

    expect(scene.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: { x: 3, y: 1 }, material: "doorBlue" }),
        expect.objectContaining({
          cell: { x: 3, y: 3 },
          material: "breakableWall",
          hintFaces: ["east", "west"],
        }),
      ]),
    );
    expect(scene.sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "s1-blue-key", assetId: "key.blue", placement: "billboard" }),
        expect.objectContaining({ id: "s1-down", assetId: "presentation.stair", placement: "ground" }),
        expect.objectContaining({ id: "s1-bones", assetId: "presentation.bones", placement: "ground" }),
        expect.objectContaining({
          id: "s1-torch",
          assetId: "presentation.wallTorch",
          placement: "wall",
          wallFace: "north",
        }),
        expect.objectContaining({ id: "s1-spikes", assetId: "presentation.wallSpikes", placement: "wall" }),
      ]),
    );
    expect(scene.lights).toHaveLength(2);
    expect(scene.emitters.map((emitter) => emitter.kind)).toEqual(["embers", "steam"]);
    expect(scene).not.toHaveProperty("hud");
    expect(scene).not.toHaveProperty("minimap");
  });

  it("selects the authored purple princess sprite from its archetype placement", () => {
    expect(sceneAt().sprites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "s1-goal",
          enemyId: "princess",
          assetId: "enemy.princess.normal",
          scale: 1.3,
        }),
      ]),
    );
  });

  it("opens inactive blockers visually while keeping the rest of the scene", () => {
    const opened = sceneAt(["s1-blue-door", "s1-hidden-wall"]);

    expect(opened.surfaces).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: { x: 3, y: 1 }, material: "doorBlue" }),
        expect.objectContaining({ cell: { x: 3, y: 3 }, material: "breakableWall" }),
      ]),
    );
    expect(opened.sprites).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "s1-torch", placement: "wall" })]),
    );
  });
});
