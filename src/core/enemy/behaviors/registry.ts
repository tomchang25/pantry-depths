/**
 * Which module answers for which attack.
 *
 * One table, so the chassis dispatches by lookup rather than by branching on intent in two places. It
 * is partial while the families are still being extracted — the chassis keeps an inline branch for
 * every intent with no row yet — and becomes total over the intent vocabulary once the last family
 * lands, at which point a missing row stops compiling.
 */

import type { WindupIntent } from "@/core/combat/enemy-contract";
import type { EnemyBehavior } from "@/core/enemy/behaviors/contract";
import { SHOOT_BEHAVIOR } from "@/core/enemy/behaviors/shoot";

export const ENEMY_BEHAVIORS: Readonly<Partial<Record<WindupIntent, EnemyBehavior>>> = {
  shoot: SHOOT_BEHAVIOR,
};
