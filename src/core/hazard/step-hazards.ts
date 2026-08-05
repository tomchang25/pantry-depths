/**
 * Enemy fire in flight: bolts, which stop at what they touch, and shells, which are airborne until
 * they land.
 *
 * A shell skips the obstacle checks entirely. Those would stop it in the first wall between the
 * emplacement and its mark, which is what an arc exists to clear.
 */

import { hurtPlayer } from "@/core/damage/player-damage";
import { shellImpact } from "@/core/damage/area";
import { blocksProjectile } from "@/core/floor/maze";
import type { World } from "@/core/world/world";
export function stepHazards(world: World, deltaSeconds: number): void {
  for (const hazard of world.hazards.slice()) {
    const distance = hazard.speed * deltaSeconds;
    const steps = Math.max(1, Math.ceil(distance / 0.15));
    let finished = false;

    // A shell is airborne and matters only where it lands. The checks below would stop it in the
    // first wall between the emplacement and its mark, which is what an arc exists to clear.
    if (hazard.kind === "shell") {
      hazard.x += hazard.directionX * distance;
      hazard.y += hazard.directionY * distance;
      hazard.travelled += distance;

      if (hazard.travelled >= hazard.range) {
        shellImpact(world, hazard.x, hazard.y, hazard.damage, hazard.blastRadius);
        world.hazards.splice(world.hazards.indexOf(hazard), 1);
      }

      continue;
    }

    for (let step = 0; step < steps && !finished; step += 1) {
      const advance = distance / steps;
      hazard.x += hazard.directionX * advance;
      hazard.y += hazard.directionY * advance;
      hazard.travelled += advance;

      // Enemy fire stops at a barricade without wearing it down, so shooters cannot clear the floor's
      // hazards for the player.
      if (blocksProjectile(world.maze, Math.floor(hazard.x), Math.floor(hazard.y))) {
        finished = true;
        break;
      }

      if (Math.hypot(world.player.x - hazard.x, world.player.y - hazard.y) <= 0.42) {
        hurtPlayer(world, hazard.damage, hazard.x, hazard.y);
        // Along the line of travel, not away from where it stopped. A bolt carries none of this.
        world.player.pushX += hazard.directionX * hazard.knockback;
        world.player.pushY += hazard.directionY * hazard.knockback;
        finished = true;
        break;
      }

      if (hazard.travelled >= hazard.range) {
        finished = true;
      }
    }

    if (finished) {
      world.hazards.splice(world.hazards.indexOf(hazard), 1);
    }
  }
}
