import type { CombatTarget } from "@/core/combat";

export type EnemyId = "bat" | "goblin" | "skeleton" | "guard" | "princess";

export type SlimeColor = "green" | "yellow" | "blue" | "red" | "purple";

export type EnemyArchetype = Readonly<
  CombatTarget & {
    id: EnemyId;
    name: string;
    appearanceId: EnemyId;
    slimeColor: SlimeColor;
    displayScale: number;
    verticalAnchor: number;
  }
>;

export const ENEMY_ARCHETYPES = [
  {
    id: "bat",
    name: "Bat",
    health: 3,
    attack: 2,
    defense: 0,
    appearanceId: "bat",
    slimeColor: "green",
    displayScale: 0.4,
    verticalAnchor: -0.25,
  },
  {
    id: "goblin",
    name: "Goblin",
    health: 6,
    attack: 4,
    defense: 0,
    appearanceId: "goblin",
    slimeColor: "yellow",
    displayScale: 0.7,
    verticalAnchor: 0,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    health: 10,
    attack: 6,
    defense: 1,
    appearanceId: "skeleton",
    slimeColor: "blue",
    displayScale: 0.85,
    verticalAnchor: 0,
  },
  {
    id: "guard",
    name: "Guard",
    health: 20,
    attack: 10,
    defense: 3,
    appearanceId: "guard",
    slimeColor: "red",
    displayScale: 1.05,
    verticalAnchor: 0,
  },
  {
    id: "princess",
    name: "Princess",
    health: 30,
    attack: 14,
    defense: 5,
    appearanceId: "princess",
    slimeColor: "purple",
    displayScale: 1.3,
    verticalAnchor: 0,
  },
] as const satisfies readonly EnemyArchetype[];

export function getEnemyArchetype(id: EnemyId): EnemyArchetype {
  const enemy = ENEMY_ARCHETYPES.find((candidate) => candidate.id === id);

  if (!enemy) {
    throw new Error(`unknown enemy archetype: ${id}`);
  }

  return enemy;
}
