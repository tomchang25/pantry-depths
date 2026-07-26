import {
  PROVISIONAL_FLOOR_SET,
  PROVISIONAL_FLOOR_VALIDATION,
  PROVISIONAL_RUN_WORLD,
} from "@/content/floor/floor-catalog";
import { describe, expect, it } from "vitest";

describe("provisional floor catalog", () => {
  it("assembles five authored floors with a topology-validated path to the goal", () => {
    const errors = PROVISIONAL_FLOOR_VALIDATION.findings.filter((finding) => finding.severity === "error");

    expect(PROVISIONAL_FLOOR_SET.floors).toHaveLength(5);
    expect(errors).toEqual([]);
    expect(PROVISIONAL_FLOOR_VALIDATION.solution?.at(-1)).toMatchObject({
      type: "defeatEnemy",
      entityId: "b5-princess",
    });
  });

  it("keeps directional hidden-wall hints as entity metadata rather than a command rule", () => {
    const wall = PROVISIONAL_RUN_WORLD.entities.find((entity) => entity.id === "b1-hidden-wall");

    expect(wall).toMatchObject({
      kind: "breakableWall",
      directionalHint: { faces: ["east", "west"] },
      combat: { retaliates: false },
    });
  });
});
