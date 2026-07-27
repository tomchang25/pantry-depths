import type { RunSnapshot, RunWorld, SemanticEvent, WorldEntity } from "@/core/run-state";
import { createInitialRunSnapshot } from "@/core/run-state";
import { deriveHudView } from "@/ui/hud-view";
import { describe, expect, it } from "vitest";

function createWorld(overrides: Partial<RunWorld> = {}): RunWorld {
  return {
    floors: [
      { id: "B1", width: 4, height: 3, solidCells: [{ x: 3, y: 0 }] },
      { id: "B2", width: 3, height: 3, solidCells: [] },
    ],
    player: { maxHealth: 20, attack: 3, defense: 0 },
    initialFloorId: "B1",
    initialCell: { x: 1, y: 1 },
    initialFacing: "east",
    entities: [],
    upgradeEffects: [],
    ...overrides,
  };
}

function enemy(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return {
    kind: "enemy",
    id: "enemy",
    floorId: "B1",
    cell: { x: 2, y: 1 },
    archetypeId: "greenSlime",
    movement: { blocksEntry: true },
    combat: { health: 3, attack: 2, defense: 0, retaliates: true },
    ...overrides,
  };
}

function door(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return {
    kind: "door",
    id: "door",
    floorId: "B1",
    cell: { x: 0, y: 0 },
    movement: { blocksEntry: true },
    interaction: { effects: [{ type: "deactivateSelf" }] },
    ...overrides,
  };
}

function deactivate(snapshot: RunSnapshot, entityId: string): RunSnapshot {
  return {
    ...snapshot,
    entities: snapshot.entities.map((entity) => (entity.id === entityId ? { ...entity, active: false } : entity)),
  };
}

function withPlayer(snapshot: RunSnapshot, update: Partial<RunSnapshot["player"]>): RunSnapshot {
  return { ...snapshot, player: { ...snapshot.player, ...update } };
}

function cellAt(view: ReturnType<typeof deriveHudView>, x: number, y: number) {
  const cell = view.minimap.cells.find((candidate) => candidate.x === x && candidate.y === y);

  if (!cell) {
    throw new Error(`missing minimap cell ${x},${y}`);
  }

  return cell;
}

const RETALIATED = (damage: number, entityId = "enemy"): SemanticEvent => ({
  type: "entityRetaliated",
  entityId,
  damage,
  remainingHealth: 20 - damage,
});

describe("deriveHudView", () => {
  it("projects the player readout straight from the settled snapshot", () => {
    const world = createWorld();
    const snapshot = withPlayer(createInitialRunSnapshot(world), { health: 15, attack: 5, defense: 2 });
    const view = deriveHudView(world, snapshot, [], "B1");

    expect(view.player).toMatchObject({
      health: 15,
      maxHealth: 20,
      healthFraction: 0.75,
      attack: 5,
      defense: 2,
      floorId: "B1",
      keys: { red: 0, blue: 0, yellow: 0 },
    });
  });

  it("names the faced enemy from the archetype table and prices the exchange", () => {
    const world = createWorld({ entities: [enemy()] });
    const view = deriveHudView(world, createInitialRunSnapshot(world), [], "B1");

    expect(view.facedEnemy).toMatchObject({
      name: "Green Slime",
      health: 3,
      maxHealth: 3,
      healthFraction: 1,
      attack: 2,
      defense: 0,
      canPenetrate: true,
      damageTakenPerHit: 2,
    });
  });

  it("reports an impenetrable target rather than omitting the panel", () => {
    const world = createWorld({
      entities: [enemy({ combat: { health: 3, attack: 2, defense: 9, retaliates: true } })],
    });
    const view = deriveHudView(world, createInitialRunSnapshot(world), [], "B1");

    expect(view.facedEnemy?.canPenetrate).toBe(false);
  });

  it("falls back to a readable label for a combat target that is not an archetype", () => {
    const world = createWorld({
      entities: [
        {
          kind: "breakableWall",
          id: "hidden-wall",
          floorId: "B1",
          cell: { x: 2, y: 1 },
          movement: { blocksEntry: true },
          combat: { health: 4, attack: 0, defense: 0, retaliates: false },
        },
      ],
    });
    const view = deriveHudView(world, createInitialRunSnapshot(world), [], "B1");

    expect(view.facedEnemy?.name).toBe("Cracked Wall");
  });

  it("shows no enemy panel when the faced cell holds nothing to fight", () => {
    const world = createWorld();

    expect(deriveHudView(world, createInitialRunSnapshot(world), [], "B1").facedEnemy).toBeUndefined();
  });

  it("sums a whole tick of retaliation instead of reporting only the last", () => {
    const world = createWorld();
    const view = deriveHudView(world, createInitialRunSnapshot(world), [RETALIATED(4), RETALIATED(2, "second")], "B1");

    expect(view.damage).toEqual({ kind: "damaged", amount: 6 });
  });

  it("keeps a fully absorbed exchange visible as blocked rather than silent", () => {
    const world = createWorld();
    const view = deriveHudView(world, createInitialRunSnapshot(world), [RETALIATED(0)], "B1");

    expect(view.damage).toEqual({ kind: "blocked" });
  });

  it("reports no damage feedback for a tick that had no retaliation", () => {
    const world = createWorld();

    expect(deriveHudView(world, createInitialRunSnapshot(world), [], "B1").damage).toBeUndefined();
  });

  it("marks terrain, contents, and the player on the current floor only", () => {
    const world = createWorld({
      entities: [enemy(), door(), { ...enemy({ id: "other-floor", floorId: "B2", cell: { x: 0, y: 0 } }) }],
    });
    const view = deriveHudView(world, createInitialRunSnapshot(world), [], "B1");

    expect(view.minimap).toMatchObject({ width: 4, height: 3, facing: "east" });
    expect(cellAt(view, 3, 0).solid).toBe(true);
    expect(cellAt(view, 2, 1).content).toBe("enemy");
    expect(cellAt(view, 0, 0).content).toBe("door");
    expect(cellAt(view, 1, 1).player).toBe(true);
    // The B2 enemy sits at 0,0 of its own floor and must not bleed into this one.
    expect(cellAt(view, 0, 0).content).not.toBe("enemy");
  });

  it("drops defeated enemies and opened doors from the map with no separate bookkeeping", () => {
    const world = createWorld({ entities: [enemy(), door()] });
    const snapshot = deactivate(deactivate(createInitialRunSnapshot(world), "enemy"), "door");
    const view = deriveHudView(world, snapshot, [], "B1");

    expect(cellAt(view, 2, 1).content).toBe("empty");
    expect(cellAt(view, 0, 0).content).toBe("empty");
  });

  it("keeps an intact breakable wall indistinguishable from stone and reveals the cell once broken", () => {
    const wall: WorldEntity = {
      kind: "breakableWall",
      id: "hidden-wall",
      floorId: "B1",
      cell: { x: 2, y: 2 },
      movement: { blocksEntry: true },
      combat: { health: 4, attack: 0, defense: 0, retaliates: false },
    };
    const world = createWorld({ entities: [wall] });
    const intact = deriveHudView(world, createInitialRunSnapshot(world), [], "B1");
    const broken = deriveHudView(world, deactivate(createInitialRunSnapshot(world), "hidden-wall"), [], "B1");

    expect(cellAt(intact, 2, 2)).toMatchObject({ solid: true, content: "empty" });
    expect(cellAt(broken, 2, 2)).toMatchObject({ solid: false, content: "empty" });
  });

  it("withholds the summary while the run is active", () => {
    const world = createWorld();

    expect(deriveHudView(world, createInitialRunSnapshot(world), [], "B1").summary).toBeUndefined();
  });

  it("summarizes a finished run with the deepest floor rather than the ending floor", () => {
    const world = createWorld({ entities: [door(), door({ id: "second-door", cell: { x: 0, y: 2 } })] });
    const dead: RunSnapshot = {
      ...deactivate(createInitialRunSnapshot(world), "door"),
      outcome: "dead",
    };
    const view = deriveHudView(world, withPlayer(dead, { health: 0, attack: 10, defense: 6 }), [], "B2");

    expect(view.summary).toEqual({
      outcome: "dead",
      deepestFloorId: "B2",
      health: 0,
      maxHealth: 20,
      attack: 10,
      defense: 6,
      doorsOpened: 1,
    });
  });
});
