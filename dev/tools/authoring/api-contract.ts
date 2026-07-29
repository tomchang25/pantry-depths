/** The single development-only namespace for every authored-content target. */
export const AUTHORING_API_ROOT = "/__debug/authoring";

export const CANONICAL_AUTHORING_PATHS = {
  floorSet: "src/content/floors/provisional-floor-set.json",
  meleeAttacks: "src/content/viewmodel/melee-attacks.json",
} as const;

export type AuthoringTargetId = keyof typeof CANONICAL_AUTHORING_PATHS;
