import { SHOOT_BEHAVIOR } from "@/core/enemy/behaviors/shoot";
import type { EnemyAttackSelf, EnemyView } from "@/core/enemy/behaviors/contract";
import type { EnemyArchetype } from "@/core/combat/enemy-contract";
import type { Maze } from "@/core/floor/maze";
import { describe, expect, it } from "vitest";

const SHOT = { speed: 7, damage: 12, range: 9, knockback: 2 };

function archetypeOf(overrides: Partial<EnemyArchetype> = {}): EnemyArchetype {
  return {
    id: "javelineer",
    name: "test",
    appearance: "placeholder",
    health: 10,
    weight: {},
    speed: 1,
    body: "boned",
    ...overrides,
  } as EnemyArchetype;
}

/** An enemy at the origin, committed to an attack aimed four cells east. */
function selfOf(archetype: EnemyArchetype): EnemyAttackSelf {
  return {
    x: 0,
    y: 0,
    facingAngle: 0,
    intent: "shoot",
    windupSeconds: 0,
    windupTotal: 1,
    aimX: 4,
    aimY: 0,
    attackPoseSeconds: 0,
    attackCooldown: 0,
    chargeX: 0,
    chargeY: 0,
    chargeSeconds: 0,
    archetype,
  };
}

const VIEW: EnemyView = { playerX: 4, playerY: 0, maze: {} as Maze };

describe("enemy attack release", () => {
  it("sends exactly one shot along the line the wind-up locked in", () => {
    const effects = SHOOT_BEHAVIOR.release(selfOf(archetypeOf({ shot: SHOT })), VIEW);

    expect(effects).toEqual([
      expect.objectContaining({ kind: "spawnShot", x: 0, y: 0, directionX: 1, directionY: 0, damage: 12 }),
    ]);
  });

  it("sends nothing when the row carries no shot", () => {
    expect(SHOOT_BEHAVIOR.release(selfOf(archetypeOf()), VIEW)).toEqual([]);
  });
});
