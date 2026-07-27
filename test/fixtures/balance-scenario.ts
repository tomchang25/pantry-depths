import { parseFloorSet } from "@/content/floor/floor-schema";
import { createRouteScenario, type RouteScenario } from "@/harness/route-scenario";
import type { RoutePlan } from "@/harness/route-replay";

/**
 * A frozen two-floor map built for the balance model, not for play.
 *
 * The corridor forces every upgrade door open in sequence, so the route walks the full stage
 * progression and the only combat is the goal. Authored play content may change freely without
 * moving these numbers; that separation is the whole point of this fixture.
 */
const BALANCE_TEST_FLOOR_SET = parseFloorSet({
  schemaVersion: 3,
  initial: { floorId: "T1", cell: { x: 1, y: 1 }, facing: "east" },
  goalEntityId: "t2-goal",
  floors: [
    {
      id: "T1",
      theme: "test-corridor",
      tiles: ["###############", "#.............#", "#####.#########", "#####.#########", "###############"],
      gameplayEntities: [
        { kind: "key", id: "t1-blue-key-1", cell: { x: 2, y: 1 }, color: "blue" },
        { kind: "door", id: "t1-blue-door-1", cell: { x: 3, y: 1 }, color: "blue", upgradeEffectId: "blue-door-1" },
        { kind: "key", id: "t1-yellow-key-1", cell: { x: 4, y: 1 }, color: "yellow" },
        {
          kind: "door",
          id: "t1-yellow-door-1",
          cell: { x: 6, y: 1 },
          color: "yellow",
          upgradeEffectId: "yellow-door-1",
        },
        { kind: "key", id: "t1-red-key", cell: { x: 7, y: 1 }, color: "red" },
        { kind: "door", id: "t1-red-door", cell: { x: 8, y: 1 }, color: "red" },
        { kind: "key", id: "t1-blue-key-2", cell: { x: 9, y: 1 }, color: "blue" },
        { kind: "door", id: "t1-blue-door-2", cell: { x: 10, y: 1 }, color: "blue", upgradeEffectId: "blue-door-2" },
        { kind: "key", id: "t1-yellow-key-2", cell: { x: 11, y: 1 }, color: "yellow" },
        {
          kind: "door",
          id: "t1-yellow-door-2",
          cell: { x: 12, y: 1 },
          color: "yellow",
          upgradeEffectId: "yellow-door-2",
        },
        { kind: "stair", id: "t1-down", cell: { x: 13, y: 1 }, destinationStairId: "t2-up", arrivalFacing: "east" },
        {
          kind: "breakableWall",
          id: "t1-hidden-wall",
          cell: { x: 5, y: 2 },
          health: 6,
          defense: 0,
          hintFaces: ["north", "south"],
        },
        { kind: "enemy", id: "t1-bypassable-slime", cell: { x: 5, y: 3 }, archetypeId: "greenSlime" },
      ],
      environmentFeatures: [],
    },
    {
      id: "T2",
      theme: "test-vault",
      tiles: ["#####", "#...#", "#####"],
      gameplayEntities: [
        { kind: "stair", id: "t2-up", cell: { x: 1, y: 1 }, destinationStairId: "t1-down", arrivalFacing: "east" },
        { kind: "enemy", id: "t2-goal", cell: { x: 3, y: 1 }, archetypeId: "princess" },
      ],
      environmentFeatures: [],
    },
  ],
});

const BALANCE_TEST_ROUTE: RoutePlan = {
  id: "balance-test-route",
  label: "Provisional main route",
  commands: [
    "forward",
    "interact",
    "forward",
    "forward",
    "forward",
    "interact",
    "forward",
    "forward",
    "interact",
    "forward",
    "forward",
    "interact",
    "forward",
    "forward",
    "interact",
    "forward",
    "interact",
    "forward",
    "forward",
    "forward",
    "forward",
    "forward",
    "forward",
    "forward",
  ],
  checkpoints: [
    { id: "start", label: "Run start", commandIndex: 0 },
    { id: "t1-blue-door-1", label: "First attack door", commandIndex: 2, entityId: "t1-blue-door-1" },
    { id: "t1-yellow-door-1", label: "First defense door", commandIndex: 6, entityId: "t1-yellow-door-1" },
    { id: "t1-red-key", label: "Route red key", commandIndex: 8, entityId: "t1-red-key" },
    { id: "t1-red-door", label: "Route red door", commandIndex: 9, entityId: "t1-red-door" },
    { id: "t1-blue-key-2", label: "Second blue key", commandIndex: 11, entityId: "t1-blue-key-2" },
    { id: "t1-blue-door-2", label: "Large blue door", commandIndex: 12, entityId: "t1-blue-door-2" },
    { id: "t1-yellow-door-2", label: "Large yellow door", commandIndex: 15, entityId: "t1-yellow-door-2" },
    { id: "t2-entry", label: "T2 entry", commandIndex: 17, entityId: "t1-down" },
    { id: "victory", label: "Princess defeated", commandIndex: 24, entityId: "t2-goal" },
  ],
};

export const BALANCE_TEST_SCENARIO: RouteScenario = createRouteScenario(BALANCE_TEST_FLOOR_SET, BALANCE_TEST_ROUTE);
