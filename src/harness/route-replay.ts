import type { GameCommand, RunSnapshot, SemanticEvent } from "@/core/run-state";
import type { GameSession } from "@/runtime/game-session";

export type RouteCheckpoint = Readonly<{
  id: string;
  label: string;
  commandIndex: number;
  entityId?: string;
}>;

export type RoutePlan = Readonly<{
  id: string;
  label: string;
  commands: readonly GameCommand[];
  checkpoints: readonly RouteCheckpoint[];
}>;

export type RouteReplayStep = Readonly<{
  command: GameCommand;
  before: RunSnapshot;
  after: RunSnapshot;
  accepted: boolean;
  events: readonly SemanticEvent[];
  rejectionReason?: string;
}>;

export type RouteReplay = Readonly<{
  plan: RoutePlan;
  initialSnapshot: RunSnapshot;
  steps: readonly RouteReplayStep[];
}>;

export type RouteCheckpointResult = Readonly<{
  checkpoint: RouteCheckpoint;
  snapshot: RunSnapshot;
  events: readonly SemanticEvent[];
  reached: boolean;
}>;

/** Replays authored commands through the canonical session boundary until a route can no longer continue. */
export function replayRoute(session: GameSession, plan: RoutePlan): RouteReplay {
  const initialSnapshot = session.getSnapshot();
  const steps: RouteReplayStep[] = [];

  for (const command of plan.commands) {
    const before = session.getSnapshot();
    const result = session.dispatch(command);
    const after = session.getSnapshot();

    steps.push({
      command,
      before,
      after,
      accepted: result.accepted,
      events: result.events,
      ...(result.accepted ? {} : { rejectionReason: result.reason }),
    });

    if (!result.accepted || result.snapshot.outcome !== "active") {
      break;
    }
  }

  return { plan, initialSnapshot, steps };
}

/** Returns the observed state after one named replay position without inventing progress after a stopped trace. */
export function getRouteCheckpoint(replay: RouteReplay, checkpoint: RouteCheckpoint): RouteCheckpointResult {
  if (checkpoint.commandIndex === 0) {
    return { checkpoint, snapshot: replay.initialSnapshot, events: [], reached: true };
  }

  const step = replay.steps[checkpoint.commandIndex - 1];

  if (!step) {
    const lastStep = replay.steps.at(-1);
    return {
      checkpoint,
      snapshot: lastStep?.after ?? replay.initialSnapshot,
      events: lastStep?.events ?? [],
      reached: false,
    };
  }

  return { checkpoint, snapshot: step.after, events: step.events, reached: true };
}

/** Reports whether an authored route fully consumed its fixture without a rejection. */
export function routeCompleted(replay: RouteReplay): boolean {
  return replay.steps.length === replay.plan.commands.length && replay.steps.every((step) => step.accepted);
}
