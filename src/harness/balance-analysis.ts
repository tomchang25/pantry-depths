import { ENEMY_ARCHETYPES, type EnemyArchetype } from "@/content/combat/enemies";
import { PLAYER_STAGES, type PlayerStage } from "@/content/combat/player-stages";
import { PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION } from "@/content/floor/floor-catalog";
import type { TopologyFinding } from "@/content/floor/floor-validation";
import { calculateCombatProjection, type CombatProjection } from "@/core/combat";
import type { Cell } from "@/core/grid";
import type { EntityKind, KeyInventory, RunOutcome, RunSnapshot } from "@/core/run-state";
import { PROVISIONAL_ROUTE, replayProvisionalRoute } from "@/harness/provisional-route";
import { getRouteCheckpoint, routeCompleted } from "@/harness/route-replay";

export type BalanceEnemyRow = Readonly<{
  enemy: EnemyArchetype;
  floorIds: readonly string[];
  projections: readonly CombatProjection[];
}>;

export type BalanceRouteCheckpoint = Readonly<{
  id: string;
  label: string;
  reached: boolean;
  stage: PlayerStage | undefined;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  keys: KeyInventory;
  accumulatedCost: number;
  openedDoorIds: readonly string[];
  eventTypes: readonly string[];
}>;

export type BalanceRoute = Readonly<{
  id: string;
  label: string;
  completed: boolean;
  succeeded: boolean;
  outcome: RunOutcome;
  commandCount: number;
  executedCommandCount: number;
  maxHealth: number;
  finalHealth: number;
  totalCost: number;
  checkpoints: readonly BalanceRouteCheckpoint[];
}>;

export type BalanceTopology = Readonly<{
  passed: boolean;
  findings: readonly TopologyFinding[];
  solutionSteps: number;
}>;

export type BalancePlacement = Readonly<{
  floorId: string;
  kind: EntityKind;
  entityId: string;
  cell: Cell;
  onForcedRoute: boolean;
  archetypeId?: string;
}>;

export type BalanceAnalysis = Readonly<{
  stages: readonly PlayerStage[];
  enemies: readonly BalanceEnemyRow[];
  route: BalanceRoute;
  topology: BalanceTopology;
  placements: readonly BalancePlacement[];
  bypassableEnemies: readonly BalancePlacement[];
}>;

function findStage(snapshot: RunSnapshot): PlayerStage | undefined {
  return PLAYER_STAGES.find(
    (candidate) =>
      candidate.stats.attack === snapshot.player.attack &&
      candidate.stats.defense === snapshot.player.defense &&
      candidate.stats.maxHealth === snapshot.player.maxHealth,
  );
}

/**
 * Derives the structured balance model from the canonical replay, content catalog, and core projections.
 *
 * This is the single owner of stage identity, accumulated health cost, opened-door state, and route
 * membership. Consumers render this model; none of them recompute a field from a snapshot.
 */
export function createBalanceAnalysis(): BalanceAnalysis {
  const replay = replayProvisionalRoute();
  const initialSnapshot = replay.initialSnapshot;
  const finalSnapshot = replay.steps.at(-1)?.after ?? initialSnapshot;
  const routeEntityIds = new Set(PROVISIONAL_ROUTE.checkpoints.flatMap((checkpoint) => checkpoint.entityId ?? []));
  const placedEntities = PROVISIONAL_FLOOR_SET.floors.flatMap((floor) =>
    floor.gameplayEntities.map((entity) => ({ floorId: floor.id, entity })),
  );
  const doorIds = placedEntities.filter((entry) => entry.entity.kind === "door").map((entry) => entry.entity.id);

  const enemies = ENEMY_ARCHETYPES.map((enemy) => ({
    enemy,
    floorIds: placedEntities
      .filter((entry) => entry.entity.kind === "enemy" && entry.entity.archetypeId === enemy.id)
      .map((entry) => entry.floorId),
    projections: PLAYER_STAGES.map((stage) => calculateCombatProjection(stage.stats, enemy)),
  }));

  const checkpoints = PROVISIONAL_ROUTE.checkpoints.map((checkpoint) => {
    const observed = getRouteCheckpoint(replay, checkpoint);
    const snapshot = observed.snapshot;

    return {
      id: checkpoint.id,
      label: checkpoint.label,
      reached: observed.reached,
      stage: findStage(snapshot),
      health: snapshot.player.health,
      maxHealth: snapshot.player.maxHealth,
      attack: snapshot.player.attack,
      defense: snapshot.player.defense,
      keys: snapshot.player.keys,
      accumulatedCost: initialSnapshot.player.health - snapshot.player.health,
      openedDoorIds: doorIds.filter((id) => !snapshot.entities.find((state) => state.id === id)?.active),
      eventTypes: observed.events.map((event) => event.type),
    };
  });

  const placements = placedEntities.map(({ floorId, entity }) => ({
    floorId,
    kind: entity.kind,
    entityId: entity.id,
    cell: entity.cell,
    onForcedRoute: routeEntityIds.has(entity.id),
    ...(entity.kind === "enemy" ? { archetypeId: entity.archetypeId } : {}),
  }));

  const completed = routeCompleted(replay);

  return {
    stages: PLAYER_STAGES,
    enemies,
    route: {
      id: PROVISIONAL_ROUTE.id,
      label: PROVISIONAL_ROUTE.label,
      completed,
      succeeded: completed && finalSnapshot.outcome === "victory",
      outcome: finalSnapshot.outcome,
      commandCount: PROVISIONAL_ROUTE.commands.length,
      executedCommandCount: replay.steps.length,
      maxHealth: initialSnapshot.player.maxHealth,
      finalHealth: finalSnapshot.player.health,
      totalCost: initialSnapshot.player.health - finalSnapshot.player.health,
      checkpoints,
    },
    topology: {
      passed:
        !PROVISIONAL_FLOOR_VALIDATION.findings.some((finding) => finding.severity === "error") &&
        Boolean(PROVISIONAL_FLOOR_VALIDATION.solution),
      findings: PROVISIONAL_FLOOR_VALIDATION.findings,
      solutionSteps: PROVISIONAL_FLOOR_VALIDATION.solution?.length ?? 0,
    },
    placements,
    bypassableEnemies: placements.filter((placement) => placement.kind === "enemy" && !placement.onForcedRoute),
  };
}
