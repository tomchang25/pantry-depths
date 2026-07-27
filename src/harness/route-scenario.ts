import { createRunWorldFromFloorSet } from "@/content/floor/floor-catalog";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import { validateParsedFloorSet, type FloorValidationResult } from "@/content/floor/floor-validation";
import type { RunWorld } from "@/core/run-state";
import { replayRoute, type RoutePlan, type RouteReplay } from "@/harness/route-replay";
import { GameSession } from "@/runtime/game-session";

export type RouteScenario = Readonly<{
  floorSet: FloorSetSource;
  validation: FloorValidationResult;
  world: RunWorld;
  route: RoutePlan;
}>;

/**
 * Binds a floor set to the route authored against it.
 *
 * Every replay and balance measurement takes one of these rather than reaching for canonical content,
 * so authored play content can change without invalidating a measurement written against a fixed map.
 */
export function createRouteScenario(floorSet: FloorSetSource, route: RoutePlan): RouteScenario {
  return {
    floorSet,
    validation: validateParsedFloorSet(floorSet),
    world: createRunWorldFromFloorSet(floorSet),
    route,
  };
}

/** Replays a scenario's route from a fresh session, so repeated calls stay independent. */
export function replayScenarioRoute(scenario: RouteScenario): RouteReplay {
  return replayRoute(new GameSession(scenario.world), scenario.route);
}
