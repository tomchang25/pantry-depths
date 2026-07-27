import { parseFloorSet } from "@/content/floor/floor-schema";

/**
 * A frozen single-floor map carrying one of every shape the scene projection has to handle.
 *
 * Projection and world-mapping behaviour is a property of the code, not of the level that happens to
 * be shipped, so these tests own their map instead of borrowing authored play content.
 */
export const SCENE_FLOOR_SET = parseFloorSet({
  schemaVersion: 4,
  initial: { floorId: "S1", cell: { x: 1, y: 1 }, facing: "east" },
  floors: [
    {
      id: "S1",
      theme: "test-vault",
      tiles: ["#######", "#.....#", "#.###.#", "#.....#", "#######"],
      gameplayEntities: [
        { kind: "key", id: "s1-blue-key", cell: { x: 2, y: 1 }, color: "blue" },
        { kind: "door", id: "s1-blue-door", cell: { x: 3, y: 1 }, color: "blue" },
        { kind: "stair", id: "s1-down", cell: { x: 5, y: 1 }, destinationStairId: "s2-up", arrivalFacing: "east" },
        {
          kind: "breakableWall",
          id: "s1-hidden-wall",
          cell: { x: 3, y: 3 },
          health: 6,
          defense: 0,
          hintFaces: ["east", "west"],
        },
        { kind: "enemy", id: "s1-hardest", cell: { x: 1, y: 3 }, archetypeId: "purpleSlime" },
        { kind: "exit", id: "s1-exit", cell: { x: 5, y: 3 } },
      ],
      environmentFeatures: [
        {
          kind: "wallDecoration",
          id: "s1-torch",
          wallCell: { x: 2, y: 2 },
          face: "north",
          decorationPresetId: "wallTorch",
          lightPresetId: "warmTorch",
          effectPresetId: "torchEmbers",
        },
        {
          kind: "wallDecoration",
          id: "s1-spikes",
          wallCell: { x: 3, y: 2 },
          face: "north",
          decorationPresetId: "wallSpikes",
        },
        { kind: "tileDecoration", id: "s1-bones", cell: { x: 4, y: 1 }, decorationPresetId: "bones" },
        { kind: "ambientLight", id: "s1-glow", cell: { x: 4, y: 3 }, lightPresetId: "warmSpring" },
        { kind: "effectEmitter", id: "s1-steam", cell: { x: 2, y: 3 }, effectPresetId: "steam" },
      ],
    },
    {
      id: "S2",
      theme: "test-landing",
      tiles: ["###", "#.#", "###"],
      gameplayEntities: [
        { kind: "stair", id: "s2-up", cell: { x: 1, y: 1 }, destinationStairId: "s1-down", arrivalFacing: "east" },
      ],
      environmentFeatures: [],
    },
  ],
});
