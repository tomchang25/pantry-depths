import { PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import type { ActionScenario } from "@/harness/action-scenario";
import type { RunWorld } from "@/core/run-state";
import { GameSession } from "@/runtime/game-session";

/** Creates a fresh session for inspecting an authored floor set, defaulting to canonical content. */
export function createFloorScenario(world: RunWorld = PROVISIONAL_RUN_WORLD): ActionScenario {
  return { world, session: new GameSession(world) };
}
