import {
  createInitialRunSnapshot,
  resolveCommand,
  type RunSnapshot,
  type RunWorld,
  type WorldEntity,
} from "@/core/run-state";
import { describe, expect, it } from "vitest";

function createWorld(overrides: Partial<RunWorld> = {}): RunWorld {
  return {
    floors: [
      { id: "B1", width: 5, height: 5, solidCells: [] },
      { id: "B2", width: 5, height: 5, solidCells: [] },
    ],
    player: { maxHealth: 20, attack: 3, defense: 0 },
    initialFloorId: "B1",
    initialCell: { x: 1, y: 1 },
    initialFacing: "east",
    entities: [],
    upgradeEffects: [{ id: "blue-door-1", attackDelta: 2, defenseDelta: 0 }],
    ...overrides,
  };
}

function enemy(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return {
    kind: "enemy",
    id: "enemy",
    floorId: "B1",
    cell: { x: 2, y: 1 },
    appearanceId: "goblin",
    movement: { blocksEntry: true },
    combat: { health: 6, attack: 4, defense: 0, retaliates: true },
    ...overrides,
  };
}

function withPlayer(snapshot: RunSnapshot, update: Partial<RunSnapshot["player"]>): RunSnapshot {
  return { ...snapshot, player: { ...snapshot.player, ...update } };
}

function entityState(snapshot: RunSnapshot, entityId: string): RunSnapshot["entities"][number] {
  const state = snapshot.entities.find((entity) => entity.id === entityId);

  if (!state) {
    throw new Error(`missing entity state: ${entityId}`);
  }

  return state;
}

describe("resolveCommand", () => {
  it("cancels forward movement into a solid cell before a tick begins", () => {
    const world = createWorld({ floors: [{ id: "B1", width: 5, height: 5, solidCells: [{ x: 2, y: 1 }] }] });
    const snapshot = createInitialRunSnapshot(world);
    const result = resolveCommand(world, snapshot, "forward");

    expect(result).toEqual({ accepted: false, reason: "blockedForward", snapshot, events: [] });
  });

  it.each(["door", "stair", "hotSpring"] as const)(
    "uses the movement capability to block a %s without type-specific movement rules",
    (kind) => {
      const world = createWorld({
        entities: [
          {
            kind,
            id: "blocker",
            floorId: "B1",
            cell: { x: 2, y: 1 },
            movement: { blocksEntry: true },
          },
        ],
      });
      const snapshot = createInitialRunSnapshot(world);
      const result = resolveCommand(world, snapshot, "forward");

      expect(result).toEqual({ accepted: false, reason: "blockedForward", snapshot, events: [] });
    },
  );

  it("retaliates after an in-place turn from every attacker adjacent at both tick boundaries", () => {
    const world = createWorld({
      entities: [
        enemy(),
        enemy({
          id: "second-enemy",
          cell: { x: 1, y: 2 },
          combat: { health: 6, attack: 2, defense: 0, retaliates: true },
        }),
      ],
    });
    const result = resolveCommand(world, createInitialRunSnapshot(world), "turnLeft");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(result.snapshot.player.facing).toBe("north");
      expect(result.snapshot.player.health).toBe(14);
      expect(result.events).toMatchObject([
        { type: "playerTurned", facing: "north" },
        { type: "entityRetaliated", entityId: "enemy", damage: 4, remainingHealth: 16 },
        { type: "entityRetaliated", entityId: "second-enemy", damage: 2, remainingHealth: 14 },
      ]);
    }
  });

  it("does not retaliate when successful forward movement enters or leaves adjacency", () => {
    const world = createWorld({ entities: [enemy({ cell: { x: 3, y: 1 } })] });
    const initial = createInitialRunSnapshot(world);
    const enteredAdjacency = resolveCommand(world, initial, "forward");

    if (!enteredAdjacency.accepted) {
      throw new Error("forward movement should be accepted");
    }

    expect(enteredAdjacency.snapshot.player.health).toBe(20);
    const turnedSouth = resolveCommand(world, enteredAdjacency.snapshot, "turnRight");

    if (!turnedSouth.accepted) {
      throw new Error("turn should be accepted");
    }

    const movedAway = resolveCommand(world, turnedSouth.snapshot, "forward");

    expect(movedAway.accepted).toBe(true);

    if (movedAway.accepted) {
      expect(movedAway.snapshot.player.health).toBe(16);
      expect(movedAway.events.some((event) => event.type === "entityRetaliated")).toBe(false);
    }
  });

  it("deactivates a defeated combat entity before retaliation", () => {
    const world = createWorld({
      entities: [enemy({ combat: { health: 3, attack: 4, defense: 0, retaliates: true } })],
    });
    const result = resolveCommand(world, createInitialRunSnapshot(world), "forward");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(entityState(result.snapshot, "enemy")).toEqual({ id: "enemy", active: false, health: 0 });
      expect(result.snapshot.player.health).toBe(20);
      expect(result.events).toMatchObject([
        { type: "entityDamaged", entityId: "enemy", damage: 3, remainingHealth: 0 },
        { type: "entityDefeated", entityId: "enemy" },
      ]);
    }
  });

  it("accepts an attack that deals zero damage and applies eligible retaliation", () => {
    const world = createWorld({
      entities: [enemy({ combat: { health: 6, attack: 4, defense: 3, retaliates: true } })],
    });
    const result = resolveCommand(world, createInitialRunSnapshot(world), "forward");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(entityState(result.snapshot, "enemy")).toEqual({ id: "enemy", active: true, health: 6 });
      expect(result.snapshot.player.health).toBe(16);
      expect(result.events).toMatchObject([
        { type: "entityDamaged", entityId: "enemy", damage: 0, remainingHealth: 6 },
        { type: "entityRetaliated", entityId: "enemy", damage: 4, remainingHealth: 16 },
      ]);
    }
  });

  it("collects a pickup and applies an interaction's declared effects exactly once", () => {
    const world = createWorld({
      entities: [
        {
          kind: "key",
          id: "blue-key",
          floorId: "B1",
          cell: { x: 2, y: 1 },
          pickup: { effects: [{ type: "grantKey", color: "blue", amount: 1 }, { type: "deactivateSelf" }] },
        },
        {
          kind: "door",
          id: "blue-door",
          floorId: "B1",
          cell: { x: 2, y: 2 },
          movement: { blocksEntry: true },
          interaction: {
            requirements: [{ type: "key", color: "blue", amount: 1 }],
            effects: [
              { type: "consumeKey", color: "blue", amount: 1 },
              { type: "applyUpgrade", effectId: "blue-door-1" },
              { type: "deactivateSelf" },
            ],
          },
        },
      ],
    });
    const moved = resolveCommand(world, createInitialRunSnapshot(world), "forward");

    if (!moved.accepted) {
      throw new Error("forward movement should be accepted");
    }

    expect(moved.snapshot.player.keys.blue).toBe(1);
    expect(entityState(moved.snapshot, "blue-key").active).toBe(false);
    const facingDoor = resolveCommand(world, moved.snapshot, "turnRight");

    if (!facingDoor.accepted) {
      throw new Error("turn should be accepted");
    }

    const opened = resolveCommand(world, facingDoor.snapshot, "interact");

    expect(opened.accepted).toBe(true);

    if (opened.accepted) {
      expect(opened.snapshot.player.keys.blue).toBe(0);
      expect(opened.snapshot.player.attack).toBe(5);
      expect(entityState(opened.snapshot, "blue-door").active).toBe(false);
      expect(opened.events).toMatchObject([
        { type: "keySpent", entityId: "blue-door", color: "blue", amount: 1 },
        { type: "playerStatsChanged", entityId: "blue-door", attack: 5, defense: 0 },
        { type: "entityDeactivated", entityId: "blue-door" },
      ]);
    }
  });

  it("treats unmet interaction requirements as an accepted tick", () => {
    const door: WorldEntity = {
      kind: "door",
      id: "red-door",
      floorId: "B1",
      cell: { x: 2, y: 1 },
      movement: { blocksEntry: true },
      interaction: {
        requirements: [{ type: "key", color: "red", amount: 1 }],
        effects: [{ type: "consumeKey", color: "red", amount: 1 }, { type: "deactivateSelf" }],
      },
    };
    const world = createWorld({ entities: [door, enemy({ id: "guard", cell: { x: 1, y: 2 } })] });
    const result = resolveCommand(world, createInitialRunSnapshot(world), "interact");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(entityState(result.snapshot, "red-door").active).toBe(true);
      expect(result.snapshot.player.health).toBe(16);
      expect(result.events).toMatchObject([
        { type: "entityRetaliated", entityId: "guard", damage: 4, remainingHealth: 16 },
      ]);
    }
  });

  it("applies a transition effect while preserving run progress and excluding source-floor retaliation", () => {
    const stair: WorldEntity = {
      kind: "stair",
      id: "down-stair",
      floorId: "B1",
      cell: { x: 2, y: 1 },
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "transition", floorId: "B2", cell: { x: 1, y: 1 }, facing: "south" }] },
    };
    const world = createWorld({ entities: [stair, enemy({ id: "guard", cell: { x: 1, y: 2 } })] });
    const snapshot = withPlayer(createInitialRunSnapshot(world), { health: 7, keys: { red: 1, blue: 0, yellow: 0 } });
    const result = resolveCommand(world, snapshot, "interact");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(result.snapshot.player).toMatchObject({
        floorId: "B2",
        cell: { x: 1, y: 1 },
        facing: "south",
        health: 7,
        keys: { red: 1, blue: 0, yellow: 0 },
      });
      expect(result.events).toMatchObject([
        { type: "playerTransitioned", entityId: "down-stair", floorId: "B2", cell: { x: 1, y: 1 } },
      ]);
    }
  });

  it("uses the same combat capability for a non-retaliating breakable wall", () => {
    const wall: WorldEntity = {
      kind: "breakableWall",
      id: "wall",
      floorId: "B1",
      cell: { x: 2, y: 1 },
      movement: { blocksEntry: true },
      combat: { health: 6, attack: 0, defense: 0, retaliates: false },
    };
    const world = createWorld({ entities: [wall] });
    const firstHit = resolveCommand(world, createInitialRunSnapshot(world), "forward");

    if (!firstHit.accepted) {
      throw new Error("wall attack should be accepted");
    }

    expect(entityState(firstHit.snapshot, "wall")).toEqual({ id: "wall", active: true, health: 3 });
    const secondHit = resolveCommand(world, firstHit.snapshot, "forward");

    if (!secondHit.accepted) {
      throw new Error("wall attack should be accepted");
    }

    expect(entityState(secondHit.snapshot, "wall")).toEqual({ id: "wall", active: false, health: 0 });
    const moved = resolveCommand(world, secondHit.snapshot, "forward");

    expect(moved.accepted).toBe(true);

    if (moved.accepted) {
      expect(moved.snapshot.player.cell).toEqual({ x: 2, y: 1 });
    }
  });

  it("applies a reusable restore-health effect before eligible retaliation", () => {
    const spring: WorldEntity = {
      kind: "hotSpring",
      id: "spring",
      floorId: "B1",
      cell: { x: 2, y: 1 },
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "restoreHealth" }] },
    };
    const world = createWorld({ entities: [spring, enemy({ id: "guard", cell: { x: 1, y: 2 } })] });
    const snapshot = withPlayer(createInitialRunSnapshot(world), { health: 5 });
    const result = resolveCommand(world, snapshot, "interact");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(result.snapshot.player.health).toBe(16);
      expect(result.events).toMatchObject([
        { type: "playerHealthRestored", entityId: "spring", health: 20 },
        { type: "entityRetaliated", entityId: "guard", damage: 4, remainingHealth: 16 },
      ]);
      expect(entityState(result.snapshot, "spring").active).toBe(true);
    }
  });

  it("records death over completion when a surviving attacker retaliates lethally at the exit", () => {
    const world = createWorld({
      entities: [
        {
          kind: "exit",
          id: "exit",
          floorId: "B1",
          cell: { x: 2, y: 1 },
          movement: { blocksEntry: true },
          interaction: { effects: [{ type: "completeRun" }] },
        },
        enemy({
          id: "guard",
          cell: { x: 1, y: 2 },
          combat: { health: 20, attack: 20, defense: 3, retaliates: true },
        }),
      ],
    });
    const result = resolveCommand(world, createInitialRunSnapshot(world), "interact");

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(result.snapshot.outcome).toBe("dead");
      expect(result.events.some((event) => event.type === "runCompleted")).toBe(false);
      expect(result.events.some((event) => event.type === "playerDied")).toBe(true);

      const terminal = resolveCommand(world, result.snapshot, "turnLeft");
      expect(terminal).toEqual({ accepted: false, reason: "terminal", snapshot: result.snapshot, events: [] });
    }
  });

  it("cancels backward and empty interaction requests without retaliation", () => {
    const world = createWorld({ entities: [enemy({ cell: { x: 1, y: 2 } })] });
    const snapshot = createInitialRunSnapshot(world);

    expect(resolveCommand(world, snapshot, "backward")).toEqual({
      accepted: false,
      reason: "backwardNotAllowed",
      snapshot,
      events: [],
    });
    expect(resolveCommand(world, snapshot, "interact")).toEqual({
      accepted: false,
      reason: "noInteractionTarget",
      snapshot,
      events: [],
    });
  });
});
