import { projectAuthoredFloorCell } from "@/app/debug/floor-map";
import type { FloorSource } from "@/content/floor/floor-schema";
import { describe, expect, it } from "vitest";

const FLOOR: FloorSource = {
  id: "authoring-test",
  theme: "test",
  tiles: ["#=+", "..."],
  gameplayEntities: [
    {
      kind: "breakableWall",
      id: "hidden-wall",
      cell: { x: 0, y: 1 },
      health: 10,
      defense: 2,
      hintFaces: ["east", "west"],
    },
  ],
  environmentFeatures: [
    { kind: "tileDecoration", id: "bones", cell: { x: 0, y: 1 }, decorationPresetId: "bones" },
    {
      kind: "wallDecoration",
      id: "torch",
      wallCell: { x: 0, y: 0 },
      face: "south",
      decorationPresetId: "wallTorch",
      lightPresetId: "warmTorch",
    },
    { kind: "ambientLight", id: "spring-light", cell: { x: 0, y: 1 }, lightPresetId: "warmSpring" },
    { kind: "effectEmitter", id: "steam", cell: { x: 0, y: 1 }, effectPresetId: "steam" },
  ],
};

describe("projectAuthoredFloorCell", () => {
  it("keeps every permanent wall material distinguishable", () => {
    expect(projectAuthoredFloorCell(FLOOR, { x: 0, y: 0 }).terrain).toMatchObject({
      symbol: "▦",
      label: "Stone wall",
    });
    expect(projectAuthoredFloorCell(FLOOR, { x: 1, y: 0 }).terrain).toMatchObject({
      symbol: "▤",
      label: "Old brick wall",
    });
    expect(projectAuthoredFloorCell(FLOOR, { x: 2, y: 0 }).terrain).toMatchObject({
      symbol: "╫",
      label: "Iron-bar wall",
    });
  });

  it("keeps breakable-wall hints, environment records, and solution membership in separate layers", () => {
    const projection = projectAuthoredFloorCell(FLOOR, { x: 0, y: 1 }, [{ x: 0, y: 1 }]);

    expect(projection.primary).toMatchObject({ symbol: "◫" });
    expect(projection.gameplayEntity).toMatchObject({
      kind: "breakableWall",
      hintFaces: ["east", "west"],
    });
    expect(projection.environmentFeatures.map((feature) => feature.id)).toEqual(["bones", "spring-light", "steam"]);
    expect(projection.environmentBadges).toEqual([
      { symbol: "✦", label: "Tile decoration" },
      { symbol: "☼", label: "Ambient light" },
      { symbol: "≈", label: "Effect emitter" },
    ]);
    expect(projection.isSolutionCell).toBe(true);
  });

  it("retains wall-face decorations on their solid anchor cell", () => {
    const projection = projectAuthoredFloorCell(FLOOR, { x: 0, y: 0 });

    expect(projection.environmentBadges).toEqual([{ symbol: "↟", label: "Wall-face decoration" }]);
    expect(projection.environmentFeatures).toEqual([
      expect.objectContaining({ id: "torch", kind: "wallDecoration", face: "south" }),
    ]);
  });
});
