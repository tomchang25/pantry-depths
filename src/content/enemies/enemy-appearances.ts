/**
 * The appearance vocabulary: which baked artwork a body wears.
 *
 * This union is the contract between everything that names an appearance — the demo's archetype
 * table, the display records, the asset manifests — and the artwork that exists on disk. It is the
 * one survivor of the retired turn-based enemy table, kept because ten modules across four layers
 * type themselves against it.
 */

/** The archetypes that own baked artwork. Retained creature archetypes borrow the matching slime. */
export type EnemyAppearanceId =
  | "greenSlime"
  | "yellowSlime"
  | "blueSlime"
  | "redSlime"
  | "purpleSlime"
  | "skeletonSwordsman"
  | "skeletonHammerman"
  | "skeletonJavelineer"
  | "skeletonCrossbowman"
  | "placeholder";
