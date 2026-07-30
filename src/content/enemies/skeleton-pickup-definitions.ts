import skeletonFemurCracked from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur-cracked.png";
import skeletonFemur from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur.png";
import skeletonSkull from "@/content/enemies/assets/skeleton-swordsman/skeleton-skull.png";
import skeletonSword from "@/content/enemies/assets/skeleton-swordsman/skeleton-sword.png";

/** The detachable parts, as they lie on the floor and as they look in the left hand. */
export const SKELETON_PICKUP_ASSETS = {
  skeletonSword: { assetId: "demo.skeletonSword", url: skeletonSword },
  skeletonSkull: { assetId: "demo.skeletonSkull", url: skeletonSkull },
  skeletonFemur: { assetId: "demo.skeletonFemur", url: skeletonFemur },
  skeletonFemurCracked: { assetId: "demo.skeletonFemurCracked", url: skeletonFemurCracked },
} as const;

export const SKELETON_PICKUP_URLS = Object.fromEntries(
  Object.values(SKELETON_PICKUP_ASSETS).map((definition) => [definition.assetId, definition.url]),
) as Readonly<Record<string, string>>;
