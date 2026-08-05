/**
 * The emplacements: hold a mark, fire, wait, pick again.
 *
 * Terrain rather than enemies, which is why the tiles decide which exist — an entry whose cell was
 * broken open leaves, and a shell already in the air completes regardless.
 */

import { DEMO_WALL_HEIGHT, tileAt } from "@/core/floor/maze";
import { nextId } from "@/core/world/ids";
import {
  MORTAR_DEAD_ZONE,
  MORTAR_IDLE_SECONDS,
  MORTAR_LOCK_SECONDS,
  SHELL_BLAST_RADIUS,
  SHELL_DAMAGE,
  type Mortar,
  type World,
} from "@/core/world/world";
import type { Cell } from "@/core/grid";
/**
 * How high a shell rises, stated as the height it reaches rather than as a launch slope, because
 * `flightHeight`'s launch term is not the peak. The launch term is solved for it below, and the floor
 * makes wall clearance a guarantee at every range. The ceiling is held by the frame: a shell at the
 * top of its curve is about half its range away, so a steeper one leaves the top of the screen.
 */
const SHELL_PEAK_PER_CELL = 0.24;
const SHELL_MIN_PEAK = DEMO_WALL_HEIGHT * 1.9;
const SHELL_MAX_PEAK = DEMO_WALL_HEIGHT * 3.4;

/**
 * How long a shell hangs in the air per cell of range, with bounds for short and long shots. The hang
 * is what the mark on the floor is for: there has to be time to look down and walk out of the circle.
 */
const SHELL_SECONDS_PER_CELL = 0.31;
const SHELL_MIN_FLIGHT_SECONDS = 1.6;
const SHELL_MAX_FLIGHT_SECONDS = 3.2;

/**
 * The launch term that puts the shared flight curve's peak at this height. The curve is
 * `0.5 + arc * s - (arc + 0.5) * s²`, whose maximum is `0.5 + arc² / (2 * (2 * arc + 1))`; setting
 * that equal to the wanted peak and solving for `arc` gives the quadratic below.
 */
function shellArc(peak: number): number {
  const rise = Math.max(0.0001, peak - 0.5);
  return 2 * rise + Math.sqrt(4 * rise * rise + 2 * rise);
}

/**
 * Picks what an emplacement shells next, from everything far enough away. The player is one candidate
 * among the enemies with no weighting, so it spends most of its time thinning them.
 */
function pickMortarTarget(world: World, centreX: number, centreY: number): Cell | undefined {
  const candidates: Cell[] = [];

  if (Math.hypot(world.player.x - centreX, world.player.y - centreY) > MORTAR_DEAD_ZONE) {
    candidates.push({ x: world.player.x, y: world.player.y });
  }

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0 || Math.hypot(enemy.x - centreX, enemy.y - centreY) <= MORTAR_DEAD_ZONE) {
      continue;
    }

    candidates.push({ x: enemy.x, y: enemy.y });
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function fireShell(world: World, mortar: Mortar, centreX: number, centreY: number): void {
  const dx = mortar.aimX - centreX;
  const dy = mortar.aimY - centreY;
  const range = Math.max(0.0001, Math.hypot(dx, dy));
  const peak = Math.min(SHELL_MAX_PEAK, Math.max(SHELL_MIN_PEAK, SHELL_PEAK_PER_CELL * range));
  const arc = shellArc(peak);
  const seconds = Math.min(
    SHELL_MAX_FLIGHT_SECONDS,
    Math.max(SHELL_MIN_FLIGHT_SECONDS, SHELL_SECONDS_PER_CELL * range),
  );
  world.hazards.push({
    id: nextId(world, "shell"),
    kind: "shell",
    x: centreX,
    y: centreY,
    directionX: dx / range,
    directionY: dy / range,
    // Ground speed derived from the hang, so a short shot is a slow high one rather than a quick flat one.
    speed: range / seconds,
    travelled: 0,
    range,
    damage: SHELL_DAMAGE,
    // A shell knocks the player about through its blast, not by arriving somewhere.
    knockback: 0,
    // Brings the curve back to the floor where the range runs out, which is where the circle is painted.
    arc,
    fall: arc + 0.5,
    plunge: 1,
    blastRadius: SHELL_BLAST_RADIUS,
  });
}

/**
 * Runs every emplacement's cycle: hold a mark, fire, wait, pick again. The tiles decide which exist,
 * so an entry whose cell was broken open leaves; a shell already in the air completes regardless.
 */
export function stepMortars(world: World, deltaSeconds: number): void {
  for (const mortar of world.mortars.slice()) {
    if (tileAt(world.maze, mortar.cellX, mortar.cellY)?.kind !== "mortar") {
      world.mortars.splice(world.mortars.indexOf(mortar), 1);
      continue;
    }

    if (world.status !== "playing") {
      continue;
    }

    mortar.seconds -= deltaSeconds;

    if (mortar.seconds > 0) {
      continue;
    }

    const centreX = mortar.cellX + 0.5;
    const centreY = mortar.cellY + 0.5;

    if (mortar.phase === "locked") {
      fireShell(world, mortar, centreX, centreY);
      mortar.phase = "idle";
      mortar.seconds = MORTAR_IDLE_SECONDS;
      continue;
    }

    const target = pickMortarTarget(world, centreX, centreY);

    if (!target) {
      // Nothing in range: stay idle and ask again next tick rather than locking onto nowhere.
      mortar.seconds = 0;
      continue;
    }

    mortar.phase = "locked";
    mortar.seconds = MORTAR_LOCK_SECONDS;
    mortar.aimX = target.x;
    mortar.aimY = target.y;
  }
}
