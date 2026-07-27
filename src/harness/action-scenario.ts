import { getEnemyArchetype } from "@/content/combat/enemies";
import { PLAYER_BASELINE, PLAYER_UPGRADES } from "@/content/combat/player-stages";
import type { RunWorld } from "@/core/run-state";
import { GameSession } from "@/runtime/game-session";

const ACTION_SCENARIO_WORLD: RunWorld = {
  floors: [
    {
      id: "B1",
      width: 9,
      height: 7,
      solidCells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 1 },
        { x: 8, y: 1 },
        { x: 0, y: 2 },
        { x: 8, y: 2 },
        { x: 0, y: 3 },
        { x: 8, y: 3 },
        { x: 0, y: 4 },
        { x: 8, y: 4 },
        { x: 0, y: 5 },
        { x: 8, y: 5 },
        { x: 0, y: 6 },
        { x: 1, y: 6 },
        { x: 2, y: 6 },
        { x: 3, y: 6 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 7, y: 6 },
        { x: 8, y: 6 },
      ],
    },
    {
      id: "B2",
      width: 5,
      height: 5,
      solidCells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 0, y: 2 },
        { x: 4, y: 2 },
        { x: 0, y: 3 },
        { x: 4, y: 3 },
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ],
    },
  ],
  player: PLAYER_BASELINE,
  initialFloorId: "B1",
  initialCell: { x: 1, y: 1 },
  initialFacing: "east",
  entities: [
    {
      kind: "enemy",
      id: "goblin-guard",
      floorId: "B1",
      cell: { x: 3, y: 1 },
      appearanceId: getEnemyArchetype("goblin").appearanceId,
      movement: { blocksEntry: true },
      combat: { ...getEnemyArchetype("goblin"), retaliates: true },
    },
    {
      kind: "enemy",
      id: "purpleSlime",
      floorId: "B2",
      cell: { x: 3, y: 1 },
      appearanceId: getEnemyArchetype("purpleSlime").appearanceId,
      movement: { blocksEntry: true },
      combat: { ...getEnemyArchetype("purpleSlime"), retaliates: true },
    },
    {
      kind: "exit",
      id: "exit",
      floorId: "B2",
      cell: { x: 3, y: 3 },
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "completeRun" }] },
    },
    {
      kind: "key",
      id: "blue-key",
      floorId: "B1",
      cell: { x: 1, y: 2 },
      pickup: {
        effects: [{ type: "grantKey", color: "blue", amount: 1 }, { type: "deactivateSelf" }],
      },
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
    {
      kind: "stair",
      id: "down-stair",
      floorId: "B1",
      cell: { x: 1, y: 3 },
      movement: { blocksEntry: true },
      interaction: {
        effects: [{ type: "transition", floorId: "B2", cell: { x: 1, y: 1 }, facing: "east" }],
      },
    },
    {
      kind: "hotSpring",
      id: "hot-spring",
      floorId: "B1",
      cell: { x: 6, y: 1 },
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "restoreHealth" }] },
    },
    {
      kind: "breakableWall",
      id: "hidden-wall",
      floorId: "B1",
      cell: { x: 5, y: 1 },
      movement: { blocksEntry: true },
      combat: { health: 6, attack: 0, defense: 0, retaliates: false },
    },
  ],
  upgradeEffects: PLAYER_UPGRADES,
};

export type ActionScenario = Readonly<{
  world: RunWorld;
  session: GameSession;
}>;

/** Creates a fresh deterministic scenario for command inspection. */
export function createActionScenario(): ActionScenario {
  return { world: ACTION_SCENARIO_WORLD, session: new GameSession(ACTION_SCENARIO_WORLD) };
}
