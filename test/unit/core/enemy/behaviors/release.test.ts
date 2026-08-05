import { CHARGE_BEHAVIOR } from "@/core/enemy/behaviors/charge";
import { SHOOT_BEHAVIOR } from "@/core/enemy/behaviors/shoot";
import type { EnemyAttackSelf, EnemyView } from "@/core/enemy/behaviors/contract";
import type { EnemyArchetype } from "@/core/combat/enemy-contract";
import type { Maze, Tile } from "@/core/floor/maze";
import { describe, expect, it } from "vitest";

/** An open square of floor, which is all a charge needs to travel across. */
function openMaze(size = 16): Maze {
  const tiles: Tile[] = Array.from({ length: size * size }, () => ({ kind: "open", hp: 0, maxHp: 0, bodies: 0 }));
  return { width: size, height: size, tiles } as unknown as Maze;
}

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

describe("a charge in flight", () => {
  /** A charger mid-lane, running east across open floor. */
  function charger(): EnemyAttackSelf {
    return { ...selfOf(archetypeOf()), x: 4, y: 4, intent: "charge", chargeX: 1, chargeY: 0, chargeSeconds: 1 };
  }

  it("probes the ground, then hits and shoves the player it caught", () => {
    const view: EnemyView = { playerX: 4.2, playerY: 4, maze: openMaze() };
    const effects = CHARGE_BEHAVIOR.liveStep(charger(), view, 0.016);

    expect(effects.map((effect) => effect.kind)).toEqual(["hazardProbe", "playerHit", "playerShove"]);
  });

  it("spends the wall before the stun that punishes the miss", () => {
    // Nowhere to travel: the charge covers none of the ground it meant to, which is a stall.
    const stuck: EnemyView = { playerX: 40, playerY: 40, maze: openMaze() };
    const self = charger();
    self.chargeX = 0;
    self.chargeY = 0;
    const effects = CHARGE_BEHAVIOR.liveStep(self, stuck, 0.016);

    expect(effects.map((effect) => effect.kind)).toEqual(["hazardProbe", "structureHit", "sparks", "stunSelf"]);
  });
});
