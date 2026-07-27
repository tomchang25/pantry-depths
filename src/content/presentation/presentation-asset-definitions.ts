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
import type { EnemyId } from "@/content/combat/enemies";
import bones from "@/content/presentation/assets/bones.png";
import hotSpring from "@/content/presentation/assets/hot-spring.png";
import keyBlue from "@/content/presentation/assets/key-blue.png";
import keyRed from "@/content/presentation/assets/key-red.png";
import keyYellow from "@/content/presentation/assets/key-yellow.png";
import playerViewmodel from "@/content/presentation/assets/player-viewmodel.png";
import stair from "@/content/presentation/assets/stair.png";
import swordSlash from "@/content/presentation/assets/sword-slash.png";
import wallSpikes from "@/content/presentation/assets/wall-spikes.png";
import wallTorch from "@/content/presentation/assets/wall-torch.png";
import type { KeyColor } from "@/core/run-state";

export type EnemySpriteState = "normal" | "attack" | "hurt";

export const ENEMY_SPRITE_URLS = {
  bat: { normal: slimeGreenNormal, attack: slimeGreenAttack, hurt: slimeGreenHurt },
  goblin: { normal: slimeYellowNormal, attack: slimeYellowAttack, hurt: slimeYellowHurt },
  skeleton: { normal: slimeBlueNormal, attack: slimeBlueAttack, hurt: slimeBlueHurt },
  guard: { normal: slimeRedNormal, attack: slimeRedAttack, hurt: slimeRedHurt },
  princess: { normal: slimePurpleNormal, attack: slimePurpleAttack, hurt: slimePurpleHurt },
} as const satisfies Readonly<Record<EnemyId, Readonly<Record<EnemySpriteState, string>>>>;

export const KEY_SPRITE_URLS = {
  red: keyRed,
  blue: keyBlue,
  yellow: keyYellow,
} as const satisfies Readonly<Record<KeyColor, string>>;

export const PRESENTATION_SPRITE_URLS = {
  stair,
  hotSpring,
  bones,
  wallTorch,
  wallSpikes,
  playerViewmodel,
  swordSlash,
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
