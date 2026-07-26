import { ENEMY_ARCHETYPES, type EnemyId } from "@/content/combat/enemies";
import { PLAYER_STAGES } from "@/content/combat/player-stages";
import { calculateCombatProjection, calculateDamage } from "@/core/combat";
import { describe, expect, it } from "vitest";

type ExpectedProjection = Readonly<{
  playerDamage: number;
  retaliationDamage: number;
  hitsToKill: number | null;
  totalCost: number | null;
}>;

const EXPECTED_MATRIX: Readonly<Record<EnemyId, readonly ExpectedProjection[]>> = {
  bat: [
    { playerDamage: 3, retaliationDamage: 2, hitsToKill: 1, totalCost: 0 },
    { playerDamage: 5, retaliationDamage: 2, hitsToKill: 1, totalCost: 0 },
    { playerDamage: 5, retaliationDamage: 0, hitsToKill: 1, totalCost: 0 },
    { playerDamage: 10, retaliationDamage: 0, hitsToKill: 1, totalCost: 0 },
    { playerDamage: 10, retaliationDamage: 0, hitsToKill: 1, totalCost: 0 },
  ],
  goblin: [
    { playerDamage: 3, retaliationDamage: 4, hitsToKill: 2, totalCost: 4 },
    { playerDamage: 5, retaliationDamage: 4, hitsToKill: 2, totalCost: 4 },
    { playerDamage: 5, retaliationDamage: 2, hitsToKill: 2, totalCost: 2 },
    { playerDamage: 10, retaliationDamage: 2, hitsToKill: 1, totalCost: 0 },
    { playerDamage: 10, retaliationDamage: 0, hitsToKill: 1, totalCost: 0 },
  ],
  skeleton: [
    { playerDamage: 2, retaliationDamage: 6, hitsToKill: 5, totalCost: 24 },
    { playerDamage: 4, retaliationDamage: 6, hitsToKill: 3, totalCost: 12 },
    { playerDamage: 4, retaliationDamage: 4, hitsToKill: 3, totalCost: 8 },
    { playerDamage: 9, retaliationDamage: 4, hitsToKill: 2, totalCost: 4 },
    { playerDamage: 9, retaliationDamage: 0, hitsToKill: 2, totalCost: 0 },
  ],
  guard: [
    { playerDamage: 0, retaliationDamage: 10, hitsToKill: null, totalCost: null },
    { playerDamage: 2, retaliationDamage: 10, hitsToKill: 10, totalCost: 90 },
    { playerDamage: 2, retaliationDamage: 8, hitsToKill: 10, totalCost: 72 },
    { playerDamage: 7, retaliationDamage: 8, hitsToKill: 3, totalCost: 16 },
    { playerDamage: 7, retaliationDamage: 4, hitsToKill: 3, totalCost: 8 },
  ],
  princess: [
    { playerDamage: 0, retaliationDamage: 14, hitsToKill: null, totalCost: null },
    { playerDamage: 0, retaliationDamage: 14, hitsToKill: null, totalCost: null },
    { playerDamage: 0, retaliationDamage: 12, hitsToKill: null, totalCost: null },
    { playerDamage: 5, retaliationDamage: 12, hitsToKill: 6, totalCost: 60 },
    { playerDamage: 5, retaliationDamage: 8, hitsToKill: 6, totalCost: 40 },
  ],
};

describe("calculateDamage", () => {
  it("clamps damage at zero when attack does not exceed defense", () => {
    expect(calculateDamage({ attack: 3, defense: 0 }, { attack: 0, defense: 3 })).toBe(0);
  });
});

describe("calculateCombatProjection", () => {
  for (const enemy of ENEMY_ARCHETYPES) {
    const expectedStages = EXPECTED_MATRIX[enemy.id];

    for (const [stageIndex, expected] of expectedStages.entries()) {
      const stage = PLAYER_STAGES[stageIndex];

      if (!stage) {
        throw new Error(`missing player stage: ${stageIndex}`);
      }

      it(`${stage.label} against ${enemy.name} matches the authored combat matrix`, () => {
        const projection = calculateCombatProjection(stage.stats, enemy);

        expect(projection.playerDamage).toBe(expected.playerDamage);
        expect(projection.retaliationDamage).toBe(expected.retaliationDamage);
        expect(projection.hitsToKill).toBe(expected.hitsToKill);
        expect(projection.totalCost).toBe(expected.totalCost);
        expect(projection.canDefeat).toBe(expected.hitsToKill !== null);
      });
    }
  }
});
