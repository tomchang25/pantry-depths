import type { CombatStats } from "@/core/combat";

export type PlayerStats = Readonly<
  CombatStats & {
    maxHealth: number;
  }
>;

export type UpgradeEffect = Readonly<{
  id: string;
  label: string;
  attackDelta: number;
  defenseDelta: number;
}>;

export type PlayerStage = Readonly<{
  id: number;
  label: string;
  stats: PlayerStats;
  appliedUpgradeIds: readonly string[];
}>;

export const PLAYER_BASELINE = {
  maxHealth: 120,
  attack: 3,
  defense: 0,
} as const satisfies PlayerStats;

export const PLAYER_UPGRADES = [
  {
    id: "blue-door-1",
    label: "Blue Door: Attack +2",
    attackDelta: 2,
    defenseDelta: 0,
  },
  {
    id: "yellow-door-1",
    label: "Yellow Door: Defense +2",
    attackDelta: 0,
    defenseDelta: 2,
  },
  {
    id: "blue-door-2",
    label: "Large Blue Door: Attack +5",
    attackDelta: 5,
    defenseDelta: 0,
  },
  {
    id: "yellow-door-2",
    label: "Large Yellow Door: Defense +4",
    attackDelta: 0,
    defenseDelta: 4,
  },
] as const satisfies readonly UpgradeEffect[];

function applyUpgrade(stats: PlayerStats, upgrade: UpgradeEffect): PlayerStats {
  return {
    maxHealth: stats.maxHealth,
    attack: stats.attack + upgrade.attackDelta,
    defense: stats.defense + upgrade.defenseDelta,
  };
}

function createPlayerStages(): readonly PlayerStage[] {
  const stages: PlayerStage[] = [
    {
      id: 0,
      label: "Stage 0",
      stats: PLAYER_BASELINE,
      appliedUpgradeIds: [],
    },
  ];

  for (const upgrade of PLAYER_UPGRADES) {
    const previousStage = stages.at(-1);

    if (!previousStage) {
      throw new Error("player stages require an initial baseline");
    }

    stages.push({
      id: previousStage.id + 1,
      label: `Stage ${previousStage.id + 1}`,
      stats: applyUpgrade(previousStage.stats, upgrade),
      appliedUpgradeIds: [...previousStage.appliedUpgradeIds, upgrade.id],
    });
  }

  return stages;
}

export const PLAYER_STAGES = createPlayerStages();

export function getPlayerStage(id: number): PlayerStage {
  const stage = PLAYER_STAGES.find((candidate) => candidate.id === id);

  if (!stage) {
    throw new Error(`unknown player stage: ${id}`);
  }

  return stage;
}
