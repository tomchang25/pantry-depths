/**
 * The one flight curve, shared by everything airborne.
 *
 * Geometry rather than rules: given how far something has travelled and the shape it was launched
 * with, this says how high it is. The renderer reads it for trails and shell arcs, the rules read it
 * for what a throw can pass over, and both get the same answer because there is only one curve.
 */

import type { Hazard, Projectile } from "@/core/world/world";

/** How high something is above the floor, in cells. `fall` returns the curve to ground at the range's end. */
export function flightHeight(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  return Math.max(0, flightDepth(travelled, range, arc, fall, plunge));
}

/**
 * The same curve unclamped, which is the only way to notice a throw aimed into the ground:
 * `flightHeight` clamps at zero, so a downward throw would flatten and carry on with no landing.
 */
export function flightDepth(travelled: number, range: number, arc: number, fall: number, plunge: number): number {
  const s = Math.min(1, Math.max(0, travelled / Math.max(0.0001, range)));
  return 0.5 + arc * s - fall * s ** (2 * plunge);
}

/**
 * Height of a projectile above the floor; collision reads it. Every throw leaves the hand along the
 * aim line. `plunge` bends the curve without moving either end, because the flown fraction is one at
 * the landing point: below one it descends for most of the flight, above one it drops late.
 */
export function projectileHeight(projectile: Projectile): number {
  return flightHeight(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge);
}

/** Whether this throw has reached the floor. Only a weapon that stops where it lands asks. */
export function projectileGrounded(projectile: Projectile): boolean {
  return flightDepth(projectile.travelled, projectile.range, projectile.arc, projectile.fall, projectile.plunge) <= 0;
}

/** Height of a shell above the floor. A bolt's curve is flat, so this answers its fixed carry height. */
export function hazardHeight(hazard: Hazard): number {
  return flightHeight(hazard.travelled, hazard.range, hazard.arc, hazard.fall, hazard.plunge);
}
