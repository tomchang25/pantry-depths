/**
 * Which module answers for which attack.
 *
 * One table, so the chassis dispatches by lookup rather than by branching on intent in two places, and
 * total over the intent vocabulary — adding a fourth family without registering it does not compile.
 * That is the same guarantee the two inline dispatch sites used to get from their exhaustiveness
 * checks, in a form that survives the families living in modules of their own.
 */

import type { WindupIntent } from "@/core/combat/enemy-contract";
import type { EnemyBehavior } from "@/core/enemy/behaviors/contract";
import { CHARGE_BEHAVIOR } from "@/core/enemy/behaviors/charge";
import { MELEE_BEHAVIOR } from "@/core/enemy/behaviors/melee";
import { SHOOT_BEHAVIOR } from "@/core/enemy/behaviors/shoot";

export const ENEMY_BEHAVIORS: Readonly<Record<WindupIntent, EnemyBehavior>> = {
  shoot: SHOOT_BEHAVIOR,
  charge: CHARGE_BEHAVIOR,
  melee: MELEE_BEHAVIOR,
};
