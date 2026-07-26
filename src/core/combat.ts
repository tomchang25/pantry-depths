export type CombatStats = Readonly<{
  attack: number;
  defense: number;
}>;

export type CombatTarget = Readonly<
  CombatStats & {
    health: number;
  }
>;

export type DefeatableCombatProjection = Readonly<{
  canDefeat: true;
  playerDamage: number;
  retaliationDamage: number;
  hitsToKill: number;
  totalCost: number;
}>;

export type ImpassableCombatProjection = Readonly<{
  canDefeat: false;
  playerDamage: 0;
  retaliationDamage: number;
  hitsToKill: null;
  totalCost: null;
}>;

export type CombatProjection = DefeatableCombatProjection | ImpassableCombatProjection;

/** Returns the non-negative damage that one combatant deals to another. */
export function calculateDamage(attacker: CombatStats, defender: CombatStats): number {
  return Math.max(0, attacker.attack - defender.defense);
}

/**
 * Projects the health cost of defeating one stationary enemy through repeated direct attacks.
 * It models no run state, command validation, adjacency scan, or mutation.
 */
export function calculateCombatProjection(player: CombatStats, enemy: CombatTarget): CombatProjection {
  const playerDamage = calculateDamage(player, enemy);
  const retaliationDamage = calculateDamage(enemy, player);

  if (playerDamage === 0) {
    return {
      canDefeat: false,
      playerDamage,
      retaliationDamage,
      hitsToKill: null,
      totalCost: null,
    };
  }

  const hitsToKill = Math.ceil(enemy.health / playerDamage);

  return {
    canDefeat: true,
    playerDamage,
    retaliationDamage,
    hitsToKill,
    totalCost: (hitsToKill - 1) * retaliationDamage,
  };
}
