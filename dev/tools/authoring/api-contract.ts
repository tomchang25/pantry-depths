/** The single development-only namespace for every authored-content target. */
export const AUTHORING_API_ROOT = "/__debug/authoring";

export const CANONICAL_AUTHORING_PATHS = {
  decor: "src/content/presentation/decor-presets.json",
  entityDisplay: "src/content/enemies/entity-display.json",
  floorSet: "src/content/floors/provisional-floor-set.json",
  meleeAttacks: "src/content/viewmodel/melee-attacks.json",
  propDisplay: "src/content/presentation/prop-display.json",
} as const;

export type AuthoringTargetId = keyof typeof CANONICAL_AUTHORING_PATHS;
