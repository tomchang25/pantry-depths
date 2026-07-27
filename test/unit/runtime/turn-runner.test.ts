import type { PresentationIntent } from "@/presentation/game-presentation";
import type { RunSnapshot, RunWorld, SemanticEvent, WorldEntity } from "@/core/run-state";
import { GameSession } from "@/runtime/game-session";
import { TurnRunner, type PresentationPort } from "@/runtime/turn-runner";
import { describe, expect, it } from "vitest";

function createWorld(overrides: Partial<RunWorld> = {}): RunWorld {
  return {
    floors: [{ id: "B1", width: 6, height: 1, solidCells: [] }],
    player: { maxHealth: 20, attack: 5, defense: 0 },
    initialFloorId: "B1",
    initialCell: { x: 0, y: 0 },
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
    cell: { x: 3, y: 0 },
    combat: { health: 10, attack: 2, defense: 0, retaliates: false },
    ...overrides,
  };
}

type PresentationCall = Readonly<{
  snapshot: RunSnapshot;
  events: readonly SemanticEvent[];
  intent: PresentationIntent;
}>;

/** Records every `present()` call and lets the test resolve them in order, like a real animation completing. */
class FakePresentation implements PresentationPort {
  readonly calls: PresentationCall[] = [];
  readonly #pendingResolvers: Array<() => void> = [];

  present(snapshot: RunSnapshot, events: readonly SemanticEvent[], intent: PresentationIntent): Promise<void> {
    this.calls.push({ snapshot, events, intent });
    return new Promise((resolve) => {
      this.#pendingResolvers.push(resolve);
    });
  }

  resolveNext(): void {
    const resolve = this.#pendingResolvers.shift();

    if (!resolve) {
      throw new Error("no pending presentation call to resolve");
    }

    resolve();
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("TurnRunner", () => {
  it("holds forward across open floor and stops the moment it meets an enemy", async () => {
    const world = createWorld({ entities: [enemy()] });
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const runner = new TurnRunner(session, presentation);

    runner.startHeldForward();
    expect(presentation.calls).toHaveLength(1);
    presentation.resolveNext();
    await flush();

    expect(presentation.calls).toHaveLength(2);
    presentation.resolveNext();
    await flush();

    expect(presentation.calls).toHaveLength(3);
    expect(presentation.calls[2]?.intent).toEqual({ kind: "attack" });
    expect(session.getSnapshot().player.cell).toEqual({ x: 2, y: 0 });

    presentation.resolveNext();
    await flush();
    expect(presentation.calls).toHaveLength(3);
  });

  it("holds forward and stops the moment it meets a solid cell", async () => {
    const world = createWorld({ floors: [{ id: "B1", width: 3, height: 1, solidCells: [{ x: 2, y: 0 }] }] });
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const runner = new TurnRunner(session, presentation);

    runner.startHeldForward();
    presentation.resolveNext();
    await flush();

    expect(presentation.calls).toHaveLength(2);
    expect(presentation.calls[1]?.intent).toEqual({ kind: "settle" });
    expect(session.getSnapshot().player.cell).toEqual({ x: 1, y: 0 });
  });

  it("keeps only the last command buffered while an animation is locked", async () => {
    const world = createWorld();
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const runner = new TurnRunner(session, presentation);

    runner.submit("forward");
    expect(presentation.calls).toHaveLength(1);

    runner.submit("turnLeft");
    runner.submit("interact");
    runner.submit("turnRight");

    presentation.resolveNext();
    await flush();

    expect(presentation.calls).toHaveLength(2);
    expect(presentation.calls[1]?.intent).toEqual({ kind: "turn", direction: "right" });

    presentation.resolveNext();
    await flush();
    expect(session.getSnapshot().player.facing).toBe("south");
  });

  it("never blocks the next command behind an accepted interact", () => {
    const world = createWorld();
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const runner = new TurnRunner(session, presentation);

    runner.submit("interact");
    expect(presentation.calls).toHaveLength(1);
    expect(presentation.calls[0]?.intent).toEqual({ kind: "settle" });

    runner.submit("turnLeft");
    expect(presentation.calls).toHaveLength(2);
    expect(presentation.calls[1]?.intent).toEqual({ kind: "turn", direction: "left" });
  });

  it("reports the backward rejection line on every refusal", async () => {
    const world = createWorld();
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const messages: string[] = [];
    const runner = new TurnRunner(session, presentation, { onRejectionMessage: (text) => messages.push(text) });

    async function rejectOnce(): Promise<void> {
      runner.submit("backward");
      presentation.resolveNext();
      await flush();
    }

    await rejectOnce();
    await rejectOnce();
    await rejectOnce();
    await rejectOnce();

    expect(presentation.calls).toHaveLength(4);
    expect(presentation.calls.every((call) => call.intent.kind === "rejectBackward")).toBe(true);
    expect(messages).toHaveLength(4);
  });

  it("stops accepting commands once the run reaches a terminal outcome", async () => {
    const world = createWorld({
      floors: [{ id: "B1", width: 3, height: 1, solidCells: [] }],
      entities: [
        enemy({
          cell: { x: 1, y: 0 },
          combat: { health: 1, attack: 0, defense: 0, retaliates: false, defeatOutcome: "victory" },
        }),
      ],
    });
    const session = new GameSession(world);
    const presentation = new FakePresentation();
    const runner = new TurnRunner(session, presentation);

    runner.submit("forward");
    presentation.resolveNext();
    await flush();

    expect(session.getSnapshot().outcome).toBe("victory");
    expect(presentation.calls).toHaveLength(1);

    runner.submit("turnLeft");
    expect(presentation.calls).toHaveLength(1);
    expect(session.getSnapshot().player.facing).toBe("east");
  });
});
