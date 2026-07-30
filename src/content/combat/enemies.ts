import type { CombatTarget } from "@/core/combat";

export type EnemyId =
  "bat" | "goblin" | "skeleton" | "guard" | "purpleSlime" | "greenSlime" | "yellowSlime" | "blueSlime" | "redSlime";

/** The archetypes that own baked artwork. Retained creature archetypes borrow the matching slime. */
export type EnemyAppearanceId =
  | "greenSlime"
  | "yellowSlime"
  | "blueSlime"
  | "redSlime"
  | "purpleSlime"
  | "skeletonSwordsman"
  | "skeletonHammerman"
  | "skeletonJavelineer"
  | "skeletonCrossbowman"
  | "placeholder";

export type EnemyArchetype = Readonly<
  CombatTarget & {
    id: EnemyId;
    name: string;
    appearanceId: EnemyAppearanceId;
    displayScale: number;
    verticalAnchor: number;
  }
>;

export const ENEMY_ARCHETYPES = [
  {
    id: "greenSlime",
    name: "Green Slime",
    health: 3,
    attack: 2,
    defense: 0,
    appearanceId: "greenSlime",
    displayScale: 0.4,
    verticalAnchor: 0,
  },
  {
    id: "yellowSlime",
    name: "Yellow Slime",
    health: 6,
    attack: 4,
    defense: 0,
    appearanceId: "yellowSlime",
    displayScale: 0.7,
    verticalAnchor: 0,
  },
  {
    id: "blueSlime",
    name: "Blue Slime",
    health: 10,
    attack: 6,
    defense: 1,
    appearanceId: "blueSlime",
    displayScale: 0.85,
    verticalAnchor: 0,
  },
  {
    id: "redSlime",
    name: "Red Slime",
    health: 20,
    attack: 10,
    defense: 3,
    appearanceId: "redSlime",
    displayScale: 1.05,
    verticalAnchor: 0,
  },
  {
    id: "purpleSlime",
    name: "Purple Slime",
    health: 30,
    attack: 14,
    defense: 5,
    appearanceId: "purpleSlime",
    displayScale: 1.3,
    verticalAnchor: 0,
  },
  {
    id: "bat",
    name: "Bat",
    health: 3,
    attack: 2,
    defense: 0,
    appearanceId: "placeholder",
    displayScale: 0.4,
    verticalAnchor: -0.25,
  },
  {
    id: "goblin",
    name: "Goblin",
    health: 6,
    attack: 4,
    defense: 0,
    appearanceId: "placeholder",
    displayScale: 0.7,
    verticalAnchor: 0,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    health: 10,
    attack: 6,
    defense: 1,
    appearanceId: "skeletonSwordsman",
    displayScale: 0.85,
    verticalAnchor: 0,
  },
  {
    id: "guard",
    name: "Guard",
    health: 20,
    attack: 10,
    defense: 3,
    appearanceId: "placeholder",
    displayScale: 1.05,
    verticalAnchor: 0,
  },
] as const satisfies readonly EnemyArchetype[];

/**
 * Lookup for an identifier arriving untyped from world data, where a miss is an ordinary answer
 * rather than a fault: `WorldEntity` stores the archetype as a plain string because the rules layer
 * cannot depend on this table.
 */
export function findEnemyArchetype(id: string | undefined): EnemyArchetype | undefined {
  return ENEMY_ARCHETYPES.find((candidate) => candidate.id === id);
}

export function getEnemyArchetype(id: EnemyId): EnemyArchetype {
  const enemy = findEnemyArchetype(id);

  if (!enemy) {
    throw new Error(`unknown enemy archetype: ${id}`);
  }

  return enemy;
}
