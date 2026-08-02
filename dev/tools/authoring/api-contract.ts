/** The single development-only namespace for every authored-content target. */
export const AUTHORING_API_ROOT = "/__debug/authoring";

/**
 * Every file the endpoint may touch, in the only two shapes an authored target comes in.
 *
 * Most targets are one file: there is exactly one melee-attack table and exactly one prop-display table,
 * so a path is all the whitelist has to carry. Maps and rooms are a library — a directory the editor adds
 * files to — so their entry names the directory and the suffix a file in it wears, and the request has
 * to say which one it means. Nothing else becomes directory-shaped just for symmetry: a target that has
 * one file is honestly described by one path.
 *
 * This module deliberately holds paths and nothing else. `vite.config.ts` imports it to decide what the
 * dev server must not watch, and that file is bundled without the `@/` alias, so a rule imported from
 * `src/` here would break the development server rather than the tooling.
 */
export const CANONICAL_AUTHORING_PATHS = {
  entityDisplay: { file: "src/content/enemies/entity-display.json" },
  map: { directory: "src/content/maps", suffix: ".map.json" },
  meleeAttacks: { file: "src/content/viewmodel/melee-attacks.json" },
  propDisplay: { file: "src/content/presentation/prop-display.json" },
  room: { directory: "src/content/rooms", suffix: ".room.json" },
  sfx: { file: "src/content/sfx/sfx-cues.json" },
  sfxReview: { file: "src/content/sfx/sfx-review.json" },
} as const;

export type AuthoringTargetId = keyof typeof CANONICAL_AUTHORING_PATHS;

/** A target, plus which file in it when the target is a directory of them. */
export type AuthoringFile = Readonly<{ target: AuthoringTargetId; name?: string }>;
