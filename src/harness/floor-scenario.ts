import { PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import type { ActionScenario } from "@/harness/action-scenario";
import { GameSession } from "@/runtime/game-session";

/** Creates a fresh session for inspecting the authored provisional floor set. */
export function createFloorScenario(): ActionScenario {
  return { world: PROVISIONAL_RUN_WORLD, session: new GameSession(PROVISIONAL_RUN_WORLD) };
}
