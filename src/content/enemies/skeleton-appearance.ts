import type { EnemyAppearanceId } from "@/content/enemies/enemy-appearances";
import {
  SKELETON_ACTIONS,
  type SkeletonActionId,
  type SkeletonTypeId,
} from "@/content/enemies/skeleton-action-definitions";
import type { SkeletonClipDefinition } from "@/content/enemies/skeleton-death-definitions";

export type { SkeletonActionId, SkeletonTypeId };

/**
 * Which authored body an appearance draws from.
 *
 * The two are separate lists on purpose. An appearance is how an entity looks to everything that
 * places and tints it; a skeleton type is which weapon is modelled into the sheets, and that is the
 * only thing the clips differ by. Keeping the mapping here means a new appearance that happens to
 * carry a sword costs one row rather than a fifth set of atlases.
 */
const SKELETON_TYPES: Readonly<Partial<Record<EnemyAppearanceId, SkeletonTypeId>>> = {
  skeletonSwordsman: "swordsman",
  skeletonHammerman: "hammerman",
  skeletonJavelineer: "javelineer",
  skeletonCrossbowman: "crossbowman",
};

/**
 * The private action set this body plays, falling back on the swordsman's.
 *
 * The fallback is deliberate and loud in the only place it matters: a boned appearance with no row
 * here draws a swordsman, which is visibly the wrong weapon rather than an empty frame. A missing
 * sheet is a mistake worth seeing, and a body that vanishes is not something a player can report.
 */
export function skeletonActions(
  appearance: EnemyAppearanceId,
): Readonly<Record<SkeletonActionId, SkeletonClipDefinition>> {
  return SKELETON_ACTIONS[SKELETON_TYPES[appearance] ?? "swordsman"];
}
