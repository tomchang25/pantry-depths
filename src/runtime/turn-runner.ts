import { BLOCKED_MOVE_TEXT } from "@/content/presentation/action-timings";
import type { CommandResult, GameCommand, RunSnapshot, SemanticEvent } from "@/core/run-state";
import type { PresentationIntent } from "@/presentation/game-presentation";
import type { GameSession } from "@/runtime/game-session";

export type PresentationPort = Readonly<{
  present(snapshot: RunSnapshot, events: readonly SemanticEvent[], intent: PresentationIntent): Promise<void>;
}>;

export type TurnRunnerCallbacks = Readonly<{
  onRejectionMessage?: (text: string) => void;
}>;

const MOVE_INTENTS: Readonly<Partial<Record<GameCommand, PresentationIntent>>> = {
  forward: { kind: "move" },
  backward: { kind: "move" },
  strafeLeft: { kind: "move" },
  strafeRight: { kind: "move" },
};

function intentForResult(command: GameCommand, result: CommandResult): PresentationIntent {
  if (!result.accepted) {
    return result.reason === "blockedMove" ? { kind: "rejectBlocked" } : { kind: "settle" };
  }

  if (command === "forward" && result.events.some((event) => event.type === "entityDamaged")) {
    return { kind: "attack" };
  }

  if (command === "turnLeft" || command === "turnRight") {
    return { kind: "turn", direction: command === "turnLeft" ? "left" : "right" };
  }

  return MOVE_INTENTS[command] ?? { kind: "settle" };
}

function hasDuration(intent: PresentationIntent): boolean {
  return intent.kind !== "settle";
}

/**
 * The single command seam: input lock, one-slot buffer, and held-forward repeat. Presentation only
 * reports when its animation completes; this class is the sole authority for what resolves next,
 * so animation timing never becomes gameplay authority. It touches no DOM or browser global so its
 * ordering guarantees are provable in a plain Node test environment.
 */
export class TurnRunner {
  #locked = false;
  #buffered: GameCommand | undefined;
  #heldForwardActive = false;
  #lastForwardMoved = true;

  constructor(
    private readonly session: GameSession,
    private readonly presentation: PresentationPort,
    private readonly callbacks: TurnRunnerCallbacks = {},
  ) {}

  /** The single entry point for A, D, E, and S, and for the first step of a held forward press. */
  submit(command: GameCommand): void {
    if (this.session.getSnapshot().outcome !== "active") {
      return;
    }

    if (this.#locked) {
      this.#buffered = command;
      return;
    }

    this.#resolve(command);
  }

  /** Begins held-direction repeat for forward; the first step fires immediately. */
  startHeldForward(): void {
    if (this.#heldForwardActive) {
      return;
    }

    this.#heldForwardActive = true;
    this.submit("forward");
  }

  /** Releases the held key, or the window losing focus or visibility; never interrupts a step in flight. */
  stopHeldForward(): void {
    this.#heldForwardActive = false;
  }

  #resolve(command: GameCommand): void {
    const result = this.session.dispatch(command);
    const intent = intentForResult(command, result);

    if (command === "forward") {
      this.#lastForwardMoved = intent.kind === "move";
    }

    if (intent.kind === "rejectBlocked") {
      this.callbacks.onRejectionMessage?.(BLOCKED_MOVE_TEXT);
    }

    const presented = this.presentation.present(result.snapshot, result.events, intent);

    if (!hasDuration(intent)) {
      return;
    }

    this.#locked = true;
    void presented.then(() => {
      this.#locked = false;
      this.#onSettled();
    });
  }

  #onSettled(): void {
    const buffered = this.#buffered;
    this.#buffered = undefined;

    if (buffered !== undefined) {
      this.#resolve(buffered);
      return;
    }

    if (this.#heldForwardActive && this.#lastForwardMoved) {
      this.#resolve("forward");
    }
  }
}
