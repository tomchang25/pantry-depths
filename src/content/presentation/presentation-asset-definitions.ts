import entityPlaceholder from "@/content/enemies/assets/entity-placeholder.png";
import slimeBlueAttack from "@/content/enemies/assets/slime-blue-attack.png";
import slimeBlueHurt from "@/content/enemies/assets/slime-blue-hurt.png";
import slimeBlueNormal from "@/content/enemies/assets/slime-blue-normal.png";
import slimeGreenAttack from "@/content/enemies/assets/slime-green-attack.png";
import slimeGreenHurt from "@/content/enemies/assets/slime-green-hurt.png";
import slimeGreenNormal from "@/content/enemies/assets/slime-green-normal.png";
import slimePurpleAttack from "@/content/enemies/assets/slime-purple-attack.png";
import slimePurpleHurt from "@/content/enemies/assets/slime-purple-hurt.png";
import slimePurpleNormal from "@/content/enemies/assets/slime-purple-normal.png";
import slimeRedAttack from "@/content/enemies/assets/slime-red-attack.png";
import slimeRedHurt from "@/content/enemies/assets/slime-red-hurt.png";
import slimeRedNormal from "@/content/enemies/assets/slime-red-normal.png";
import slimeYellowAttack from "@/content/enemies/assets/slime-yellow-attack.png";
import slimeYellowHurt from "@/content/enemies/assets/slime-yellow-hurt.png";
import slimeYellowNormal from "@/content/enemies/assets/slime-yellow-normal.png";
import skeletonSwordsmanAttack from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-attack.png";
import skeletonSwordsmanHurt from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-hurt.png";
import skeletonSwordsmanNormal from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-normal.png";
import type { EnemyAppearanceId } from "@/content/combat/enemies";
import blockPlaceholder from "@/content/presentation/assets/block-placeholder.png";
import bones from "@/content/presentation/assets/bones.png";
import hotSpring from "@/content/presentation/assets/hot-spring.png";
import keyBlue from "@/content/presentation/assets/key-blue.png";
import keyRed from "@/content/presentation/assets/key-red.png";
import keyYellow from "@/content/presentation/assets/key-yellow.png";
import stair from "@/content/presentation/assets/stair.png";
import wallSpikes from "@/content/presentation/assets/wall-spikes.png";
import wallTorch from "@/content/presentation/assets/wall-torch.png";
export type EnemySpriteState = "normal" | "attack" | "hurt";

/**
 * The three colours a key sprite comes in.
 *
 * Owned here since the run-state module went with the floor-set tooling: these assets are the one place
 * the vocabulary still means anything, and a shared type with a single consumer is a dependency wearing
 * a contract's clothes.
 */
export type KeyColor = "red" | "blue" | "yellow";

export const ENEMY_SPRITE_URLS = {
  greenSlime: { normal: slimeGreenNormal, attack: slimeGreenAttack, hurt: slimeGreenHurt },
  yellowSlime: { normal: slimeYellowNormal, attack: slimeYellowAttack, hurt: slimeYellowHurt },
  blueSlime: { normal: slimeBlueNormal, attack: slimeBlueAttack, hurt: slimeBlueHurt },
  redSlime: { normal: slimeRedNormal, attack: slimeRedAttack, hurt: slimeRedHurt },
  purpleSlime: { normal: slimePurpleNormal, attack: slimePurpleAttack, hurt: slimePurpleHurt },
  skeletonSwordsman: {
    normal: skeletonSwordsmanNormal,
    attack: skeletonSwordsmanAttack,
    hurt: skeletonSwordsmanHurt,
  },
  // The three later skeletons bake no single-image stills. Nothing draws them from here — a boned
  // body is drawn from its atlases — so the honest entry is the placeholder rather than the
  // swordsman's stills, which would put the wrong weapon in the hand of whatever did read them.
  skeletonHammerman: { normal: entityPlaceholder, attack: entityPlaceholder, hurt: entityPlaceholder },
  skeletonJavelineer: { normal: entityPlaceholder, attack: entityPlaceholder, hurt: entityPlaceholder },
  skeletonCrossbowman: { normal: entityPlaceholder, attack: entityPlaceholder, hurt: entityPlaceholder },
  // Stands in for the retained creature archetypes until their own artwork is authored.
  placeholder: { normal: entityPlaceholder, attack: entityPlaceholder, hurt: entityPlaceholder },
} as const satisfies Readonly<Record<EnemyAppearanceId, Readonly<Record<EnemySpriteState, string>>>>;

export const KEY_SPRITE_URLS = {
  red: keyRed,
  blue: keyBlue,
  yellow: keyYellow,
} as const satisfies Readonly<Record<KeyColor, string>>;

export const PRESENTATION_SPRITE_URLS = {
  stair,
  // Stands in for authored exit artwork; deliberately not the stair sprite so the two never read alike.
  exit: blockPlaceholder,
  hotSpring,
  bones,
  wallTorch,
  wallSpikes,
} as const;

export const REQUIRED_PRESENTATION_ASSETS = {
  ...Object.fromEntries(
    Object.entries(ENEMY_SPRITE_URLS).flatMap(([enemyId, states]) =>
      Object.entries(states).map(([state, url]) => [`enemy.${enemyId}.${state}`, url]),
    ),
  ),
  ...Object.fromEntries(Object.entries(KEY_SPRITE_URLS).map(([color, url]) => [`key.${color}`, url])),
  ...Object.fromEntries(Object.entries(PRESENTATION_SPRITE_URLS).map(([name, url]) => [`presentation.${name}`, url])),
} as Readonly<Record<string, string>>;
