import { calculateDamage, type CombatStats } from "@/core/combat";
import { areEdgeAdjacent, areSameCell, moveForward, turnLeft, turnRight, type Cell, type Facing } from "@/core/grid";

export type KeyColor = "red" | "blue" | "yellow";

export type KeyInventory = Readonly<Record<KeyColor, number>>;

export type PlayerDefinition = Readonly<
  CombatStats & {
    maxHealth: number;
  }
>;

export type FloorDefinition = Readonly<{
  id: string;
  width: number;
  height: number;
  solidCells: readonly Cell[];
}>;

export type UpgradeEffect = Readonly<{
  id: string;
  attackDelta: number;
  defenseDelta: number;
}>;

export type EntityKind = "enemy" | "key" | "door" | "stair" | "breakableWall" | "hotSpring";

export type MovementCapability = Readonly<{
  blocksEntry: true;
}>;

export type InteractionRequirement = Readonly<{
  type: "key";
  color: KeyColor;
  amount: number;
}>;

export type EntityEffect =
  | Readonly<{ type: "grantKey"; color: KeyColor; amount: number }>
  | Readonly<{ type: "consumeKey"; color: KeyColor; amount: number }>
  | Readonly<{ type: "deactivateSelf" }>
  | Readonly<{ type: "applyUpgrade"; effectId: string }>
  | Readonly<{
      type: "transition";
      floorId: string;
      cell: Cell;
      facing: Facing;
    }>
  | Readonly<{ type: "restoreHealth" }>;

export type PickupCapability = Readonly<{
  effects: readonly EntityEffect[];
}>;

export type InteractionCapability = Readonly<{
  requirements?: readonly InteractionRequirement[];
  effects: readonly EntityEffect[];
}>;

export type CombatCapability = Readonly<
  CombatStats & {
    health: number;
    retaliates: boolean;
    defeatOutcome?: "victory";
  }
>;

export type DirectionalHintCapability = Readonly<{
  faces: readonly Facing[];
}>;

export type WorldEntity = Readonly<{
  id: string;
  kind: EntityKind;
  floorId: string;
  cell: Cell;
  appearanceId?: string;
  directionalHint?: DirectionalHintCapability;
  movement?: MovementCapability;
  pickup?: PickupCapability;
  interaction?: InteractionCapability;
  combat?: CombatCapability;
}>;

export type RunWorld = Readonly<{
  floors: readonly FloorDefinition[];
  player: PlayerDefinition;
  initialFloorId: string;
  initialCell: Cell;
  initialFacing: Facing;
  entities: readonly WorldEntity[];
  upgradeEffects: readonly UpgradeEffect[];
}>;

export type PlayerSnapshot = Readonly<{
  floorId: string;
  cell: Cell;
  facing: Facing;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  keys: KeyInventory;
}>;

export type EntitySnapshot = Readonly<{
  id: string;
  active: boolean;
  health?: number;
}>;

export type RunOutcome = "active" | "dead" | "victory";

export type RunSnapshot = Readonly<{
  player: PlayerSnapshot;
  entities: readonly EntitySnapshot[];
  outcome: RunOutcome;
}>;

export type GameCommand = "forward" | "turnLeft" | "turnRight" | "interact" | "backward";

export type CommandRejectionReason = "backwardNotAllowed" | "blockedForward" | "noInteractionTarget" | "terminal";

export type SemanticEvent =
  | Readonly<{ type: "playerMoved"; cell: Cell }>
  | Readonly<{ type: "playerTurned"; facing: Facing }>
  | Readonly<{ type: "entityDamaged"; entityId: string; damage: number; remainingHealth: number }>
  | Readonly<{ type: "entityDefeated"; entityId: string }>
  | Readonly<{ type: "keyCollected"; entityId: string; color: KeyColor; amount: number }>
  | Readonly<{ type: "keySpent"; entityId: string; color: KeyColor; amount: number }>
  | Readonly<{ type: "entityDeactivated"; entityId: string }>
  | Readonly<{ type: "playerStatsChanged"; entityId: string; attack: number; defense: number }>
  | Readonly<{ type: "playerTransitioned"; entityId: string; floorId: string; cell: Cell }>
  | Readonly<{ type: "playerHealthRestored"; entityId: string; health: number }>
  | Readonly<{ type: "entityRetaliated"; entityId: string; damage: number; remainingHealth: number }>
  | Readonly<{ type: "playerDied" }>
  | Readonly<{ type: "victoryReached"; entityId: string }>;

export type RejectedCommandResult = Readonly<{
  accepted: false;
  reason: CommandRejectionReason;
  snapshot: RunSnapshot;
  events: readonly [];
}>;

export type AcceptedCommandResult = Readonly<{
  accepted: true;
  snapshot: RunSnapshot;
  events: readonly SemanticEvent[];
}>;

export type CommandResult = RejectedCommandResult | AcceptedCommandResult;

const EMPTY_KEYS: KeyInventory = { red: 0, blue: 0, yellow: 0 };

function findFloor(world: RunWorld, floorId: string): FloorDefinition {
  const floor = world.floors.find((candidate) => candidate.id === floorId);

  if (!floor) {
    throw new Error(`unknown floor: ${floorId}`);
  }

  return floor;
}

function findEntity(world: RunWorld, entityId: string): WorldEntity {
  const entity = world.entities.find((candidate) => candidate.id === entityId);

  if (!entity) {
    throw new Error(`unknown entity: ${entityId}`);
  }

  return entity;
}

function findEntitySnapshot(snapshot: RunSnapshot, entityId: string): EntitySnapshot {
  const entity = snapshot.entities.find((candidate) => candidate.id === entityId);

  if (!entity) {
    throw new Error(`unknown entity snapshot: ${entityId}`);
  }

  return entity;
}

function isInsideFloor(floor: FloorDefinition, cell: Cell): boolean {
  return cell.x >= 0 && cell.x < floor.width && cell.y >= 0 && cell.y < floor.height;
}

function isAt(floorId: string, cell: Cell, candidate: Readonly<{ floorId: string; cell: Cell }>): boolean {
  return candidate.floorId === floorId && areSameCell(candidate.cell, cell);
}

function isEntityActive(snapshot: RunSnapshot, entityId: string): boolean {
  return findEntitySnapshot(snapshot, entityId).active;
}

function findActiveEntitiesAt(world: RunWorld, snapshot: RunSnapshot, floorId: string, cell: Cell): WorldEntity[] {
  return world.entities.filter((entity) => isAt(floorId, cell, entity) && isEntityActive(snapshot, entity.id));
}

function rejected(snapshot: RunSnapshot, reason: CommandRejectionReason): RejectedCommandResult {
  return { accepted: false, reason, snapshot, events: [] };
}

function assertNever(value: never): never {
  throw new Error(`unsupported value: ${String(value)}`);
}

function updateSnapshot(snapshot: RunSnapshot, update: Partial<RunSnapshot>): RunSnapshot {
  return { ...snapshot, ...update };
}

function updatePlayer(snapshot: RunSnapshot, update: Partial<PlayerSnapshot>): RunSnapshot {
  return updateSnapshot(snapshot, { player: { ...snapshot.player, ...update } });
}

function updateEntity(snapshot: RunSnapshot, entityId: string, update: Partial<EntitySnapshot>): RunSnapshot {
  return updateSnapshot(snapshot, {
    entities: snapshot.entities.map((entity) => (entity.id === entityId ? { ...entity, ...update } : entity)),
  });
}

function captureAdjacentAttackers(world: RunWorld, snapshot: RunSnapshot): readonly string[] {
  return world.entities
    .filter(
      (entity) =>
        entity.combat?.retaliates === true &&
        isEntityActive(snapshot, entity.id) &&
        entity.floorId === snapshot.player.floorId &&
        areEdgeAdjacent(entity.cell, snapshot.player.cell),
    )
    .map((entity) => entity.id);
}

function applyPostTickRetaliation(
  world: RunWorld,
  snapshot: RunSnapshot,
  capturedEntityIds: readonly string[],
  events: SemanticEvent[],
): RunSnapshot {
  let nextSnapshot = snapshot;

  for (const entityId of capturedEntityIds) {
    const entity = findEntity(world, entityId);

    if (
      !isEntityActive(nextSnapshot, entityId) ||
      !entity.combat?.retaliates ||
      entity.floorId !== nextSnapshot.player.floorId ||
      !areEdgeAdjacent(entity.cell, nextSnapshot.player.cell)
    ) {
      continue;
    }

    const damage = calculateDamage(entity.combat, nextSnapshot.player);
    const health = Math.max(0, nextSnapshot.player.health - damage);
    nextSnapshot = updatePlayer(nextSnapshot, { health });
    events.push({ type: "entityRetaliated", entityId, damage, remainingHealth: health });
  }

  return nextSnapshot;
}

function resolveTerminalOutcome(
  snapshot: RunSnapshot,
  victoryEntityId: string | undefined,
  events: SemanticEvent[],
): RunSnapshot {
  if (snapshot.player.health === 0) {
    events.push({ type: "playerDied" });
    return updateSnapshot(snapshot, { outcome: "dead" });
  }

  if (victoryEntityId) {
    events.push({ type: "victoryReached", entityId: victoryEntityId });
    return updateSnapshot(snapshot, { outcome: "victory" });
  }

  return snapshot;
}

function completeAcceptedTick(
  world: RunWorld,
  snapshot: RunSnapshot,
  capturedEntityIds: readonly string[],
  events: SemanticEvent[],
  victoryEntityId?: string,
): AcceptedCommandResult {
  const retaliatedSnapshot = applyPostTickRetaliation(world, snapshot, capturedEntityIds, events);
  const completedSnapshot = resolveTerminalOutcome(retaliatedSnapshot, victoryEntityId, events);
  return { accepted: true, snapshot: completedSnapshot, events };
}

function requirementsAreMet(snapshot: RunSnapshot, requirements: readonly InteractionRequirement[]): boolean {
  return requirements.every((requirement) => {
    if (requirement.type === "key") {
      return snapshot.player.keys[requirement.color] >= requirement.amount;
    }

    return assertNever(requirement.type);
  });
}

function applyEntityEffects(
  world: RunWorld,
  snapshot: RunSnapshot,
  sourceEntityId: string,
  effects: readonly EntityEffect[],
  events: SemanticEvent[],
): RunSnapshot {
  let nextSnapshot = snapshot;

  for (const effect of effects) {
    if (effect.type === "grantKey") {
      const keys = {
        ...nextSnapshot.player.keys,
        [effect.color]: nextSnapshot.player.keys[effect.color] + effect.amount,
      };
      nextSnapshot = updatePlayer(nextSnapshot, { keys });
      events.push({ type: "keyCollected", entityId: sourceEntityId, color: effect.color, amount: effect.amount });
      continue;
    }

    if (effect.type === "consumeKey") {
      const keys = {
        ...nextSnapshot.player.keys,
        [effect.color]: nextSnapshot.player.keys[effect.color] - effect.amount,
      };
      nextSnapshot = updatePlayer(nextSnapshot, { keys });
      events.push({ type: "keySpent", entityId: sourceEntityId, color: effect.color, amount: effect.amount });
      continue;
    }

    if (effect.type === "deactivateSelf") {
      nextSnapshot = updateEntity(nextSnapshot, sourceEntityId, { active: false });
      events.push({ type: "entityDeactivated", entityId: sourceEntityId });
      continue;
    }

    if (effect.type === "applyUpgrade") {
      const upgrade = world.upgradeEffects.find((candidate) => candidate.id === effect.effectId);

      if (!upgrade) {
        throw new Error(`unknown upgrade effect: ${effect.effectId}`);
      }

      nextSnapshot = updatePlayer(nextSnapshot, {
        attack: nextSnapshot.player.attack + upgrade.attackDelta,
        defense: nextSnapshot.player.defense + upgrade.defenseDelta,
      });
      events.push({
        type: "playerStatsChanged",
        entityId: sourceEntityId,
        attack: nextSnapshot.player.attack,
        defense: nextSnapshot.player.defense,
      });
      continue;
    }

    if (effect.type === "transition") {
      nextSnapshot = updatePlayer(nextSnapshot, {
        floorId: effect.floorId,
        cell: effect.cell,
        facing: effect.facing,
      });
      events.push({
        type: "playerTransitioned",
        entityId: sourceEntityId,
        floorId: effect.floorId,
        cell: effect.cell,
      });
      continue;
    }

    if (effect.type === "restoreHealth") {
      nextSnapshot = updatePlayer(nextSnapshot, { health: nextSnapshot.player.maxHealth });
      events.push({
        type: "playerHealthRestored",
        entityId: sourceEntityId,
        health: nextSnapshot.player.health,
      });
      continue;
    }

    assertNever(effect);
  }

  return nextSnapshot;
}

function applyPickupsAtPlayer(world: RunWorld, snapshot: RunSnapshot, events: SemanticEvent[]): RunSnapshot {
  let nextSnapshot = snapshot;
  const pickups = findActiveEntitiesAt(world, snapshot, snapshot.player.floorId, snapshot.player.cell).filter(
    (entity) => entity.pickup,
  );

  for (const pickup of pickups) {
    nextSnapshot = applyEntityEffects(world, nextSnapshot, pickup.id, pickup.pickup?.effects ?? [], events);
  }

  return nextSnapshot;
}

type ForwardTarget =
  | Readonly<{ kind: "blocked" }>
  | Readonly<{ kind: "attack"; entity: WorldEntity; snapshot: EntitySnapshot }>
  | Readonly<{ kind: "open"; cell: Cell }>;

function inspectForwardTarget(world: RunWorld, snapshot: RunSnapshot): ForwardTarget {
  const cell = moveForward(snapshot.player.cell, snapshot.player.facing);
  const floor = findFloor(world, snapshot.player.floorId);
  const blockedByTerrain = !isInsideFloor(floor, cell) || floor.solidCells.some((solid) => areSameCell(solid, cell));

  if (blockedByTerrain) {
    return { kind: "blocked" };
  }

  const occupants = findActiveEntitiesAt(world, snapshot, snapshot.player.floorId, cell);
  const attackable = occupants.find((entity) => entity.combat);

  if (attackable) {
    return { kind: "attack", entity: attackable, snapshot: findEntitySnapshot(snapshot, attackable.id) };
  }

  if (occupants.some((entity) => entity.movement?.blocksEntry)) {
    return { kind: "blocked" };
  }

  return { kind: "open", cell };
}

function resolveForward(world: RunWorld, snapshot: RunSnapshot, capturedEntityIds: readonly string[]): CommandResult {
  const target = inspectForwardTarget(world, snapshot);

  if (target.kind === "blocked") {
    return rejected(snapshot, "blockedForward");
  }

  const events: SemanticEvent[] = [];

  if (target.kind === "attack") {
    if (!target.entity.combat || target.snapshot.health === undefined) {
      throw new Error(`invalid combat entity: ${target.entity.id}`);
    }

    const damage = calculateDamage(snapshot.player, target.entity.combat);
    const health = Math.max(0, target.snapshot.health - damage);
    const nextSnapshot = updateEntity(snapshot, target.entity.id, { health, active: health > 0 });
    events.push({ type: "entityDamaged", entityId: target.entity.id, damage, remainingHealth: health });

    if (health === 0) {
      events.push({ type: "entityDefeated", entityId: target.entity.id });
    }

    return completeAcceptedTick(
      world,
      nextSnapshot,
      capturedEntityIds,
      events,
      health === 0 && target.entity.combat.defeatOutcome === "victory" ? target.entity.id : undefined,
    );
  }

  const movedSnapshot = updatePlayer(snapshot, { cell: target.cell });
  events.push({ type: "playerMoved", cell: target.cell });
  return completeAcceptedTick(world, applyPickupsAtPlayer(world, movedSnapshot, events), capturedEntityIds, events);
}

function resolveInteract(world: RunWorld, snapshot: RunSnapshot, capturedEntityIds: readonly string[]): CommandResult {
  const targetCell = moveForward(snapshot.player.cell, snapshot.player.facing);
  const entity = findActiveEntitiesAt(world, snapshot, snapshot.player.floorId, targetCell).find(
    (candidate) => candidate.interaction,
  );
  const events: SemanticEvent[] = [];

  if (!entity?.interaction) {
    return rejected(snapshot, "noInteractionTarget");
  }

  if (!requirementsAreMet(snapshot, entity.interaction.requirements ?? [])) {
    return completeAcceptedTick(world, snapshot, capturedEntityIds, events);
  }

  const nextSnapshot = applyEntityEffects(world, snapshot, entity.id, entity.interaction.effects, events);
  return completeAcceptedTick(world, nextSnapshot, capturedEntityIds, events);
}

/** Creates a fresh mutable-progress snapshot from immutable authored world input. */
export function createInitialRunSnapshot(world: RunWorld): RunSnapshot {
  findFloor(world, world.initialFloorId);

  return {
    player: {
      floorId: world.initialFloorId,
      cell: world.initialCell,
      facing: world.initialFacing,
      health: world.player.maxHealth,
      maxHealth: world.player.maxHealth,
      attack: world.player.attack,
      defense: world.player.defense,
      keys: EMPTY_KEYS,
    },
    entities: world.entities.map((entity) => ({
      id: entity.id,
      active: true,
      ...(entity.combat ? { health: entity.combat.health } : {}),
    })),
    outcome: "active",
  };
}

/** Resolves one command without mutating the input world or input snapshot. */
export function resolveCommand(world: RunWorld, snapshot: RunSnapshot, command: GameCommand): CommandResult {
  if (snapshot.outcome !== "active") {
    return rejected(snapshot, "terminal");
  }

  if (command === "backward") {
    return rejected(snapshot, "backwardNotAllowed");
  }

  const capturedEntityIds = captureAdjacentAttackers(world, snapshot);

  if (command === "forward") {
    return resolveForward(world, snapshot, capturedEntityIds);
  }

  if (command === "interact") {
    return resolveInteract(world, snapshot, capturedEntityIds);
  }

  const facing = command === "turnLeft" ? turnLeft(snapshot.player.facing) : turnRight(snapshot.player.facing);
  const nextSnapshot = updatePlayer(snapshot, { facing });
  return completeAcceptedTick(world, nextSnapshot, capturedEntityIds, [{ type: "playerTurned", facing }]);
}
