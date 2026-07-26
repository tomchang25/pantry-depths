import type { CombatTarget } from "@/core/combat";

export type EnemyId = "bat" | "goblin" | "skeleton" | "guard" | "princess";

export type EnemyArchetype = Readonly<
  CombatTarget & {
    id: EnemyId;
    name: string;
    appearanceId: EnemyId;
  }
>;

export const ENEMY_ARCHETYPES = [
  { id: "bat", name: "Bat", health: 3, attack: 2, defense: 0, appearanceId: "bat" },
  { id: "goblin", name: "Goblin", health: 6, attack: 4, defense: 0, appearanceId: "goblin" },
  { id: "skeleton", name: "Skeleton", health: 10, attack: 6, defense: 1, appearanceId: "skeleton" },
  { id: "guard", name: "Guard", health: 20, attack: 10, defense: 3, appearanceId: "guard" },
  { id: "princess", name: "Princess", health: 30, attack: 14, defense: 5, appearanceId: "princess" },
] as const satisfies readonly EnemyArchetype[];

export function getEnemyArchetype(id: EnemyId): EnemyArchetype {
  const enemy = ENEMY_ARCHETYPES.find((candidate) => candidate.id === id);

  if (!enemy) {
    throw new Error(`unknown enemy archetype: ${id}`);
  }

  return enemy;
}
