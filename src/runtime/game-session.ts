import {
  createInitialRunSnapshot,
  findInteractionTarget,
  resolveCommand,
  type CommandResult,
  type GameCommand,
  type RunSnapshot,
  type RunWorld,
} from "@/core/run-state";

/** Owns one active run snapshot and exposes the canonical stateful command boundary. */
export class GameSession {
  #snapshot: RunSnapshot;

  constructor(
    readonly world: RunWorld,
    initialSnapshot: RunSnapshot = createInitialRunSnapshot(world),
  ) {
    this.#snapshot = initialSnapshot;
  }

  getSnapshot(): RunSnapshot {
    return this.#snapshot;
  }

  /** Whether the facing cell holds something `interact` would use, rather than something to walk into. */
  hasInteractionTargetAhead(): boolean {
    return findInteractionTarget(this.world, this.#snapshot) !== undefined;
  }

  dispatch(command: GameCommand): CommandResult {
    const result = resolveCommand(this.world, this.#snapshot, command);

    if (result.accepted) {
      this.#snapshot = result.snapshot;
    }

    return result;
  }
}
