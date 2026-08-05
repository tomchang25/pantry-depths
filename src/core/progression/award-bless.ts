/**
 * The blessing a floor's work pays out.
 *
 * A progression grant rather than run state: it reads the catalogue, rolls what is granted, and the
 * only thing it touches on the run is the health the grant carries and the card that announces it.
 */

import { blessMaxHpGain, grantBless } from "@/core/progression/bless";
import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import type { World } from "@/core/world/world";
export function awardBless(world: World): void {
  const granted = grantBless(world.catalog, world.bless);
  const healthGain = blessMaxHpGain(world.catalog, granted);

  world.player.maxHp += healthGain;
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + healthGain);
  world.pendingCard = granted.id;
  raiseSfx(world, "rewardGain");
  announce(world, `Blessing gained: ${granted.name}`, 3);
}
