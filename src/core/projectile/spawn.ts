/**
 * A throw leaving the hand.
 *
 * Separate from what happens to it afterwards: launching reads the player's aim, their pitch and the
 * recoil it costs them, and the flight that follows reads none of those. Two modules for that reason.
 */

import { raiseSfx } from "@/core/feedback/run-feedback";
import type { Enemy } from "@/core/enemy/enemy-state";
import { facing } from "@/core/player/aim";
import { throwWeight, type ThrowKind } from "@/core/prop-contract";
import { nextId } from "@/core/world/ids";
import type { World } from "@/core/world/world";

/** How far ahead a projectile leaves the hand; the aim cap subtracts it so the landing matches. */
const THROW_SPAWN_AHEAD = 0.4;

/**
 * What one point of recoil is worth, in cells per second of backward shove and in view jolt.
 *
 * Both are deliberately tiny. An early version moved the player the better part of half a cell
 * backwards on every throw, which does not read as effort — it reads as being shoved by something you
 * cannot see. Recoil says a weight left the hands; it must never take a step for you.
 */
const RECOIL_SHOVE = 0.8;
const RECOIL_SHAKE = 0.22;

/** Every throw aimed at the floor stops where the crosshair meets it, lobbed or straight. */
function throwRange(world: World, base: number): number {
  if (world.player.pitch > 0) {
    return base;
  }

  // Where the crosshair ray meets the floor: the horizon sits at `0.49 + pitch` of the screen and the
  // eye half a cell up, so the centre of the view lands `0.5 / (0.01 - pitch)` cells out. Level looks
  // resolve far beyond any base range and change nothing.
  const aimDistance = 0.5 / (0.01 - world.player.pitch);
  return Math.min(base, Math.max(THROW_SPAWN_AHEAD, aimDistance - THROW_SPAWN_AHEAD));
}
export function spawnProjectile(world: World, kind: ThrowKind, payload: Enemy | undefined): void {
  const direction = facing(world);
  const weight = throwWeight(world.catalog, kind, payload?.archetype.weight);
  const range = throwRange(world, weight.range);
  // Every throw departs along the aim line: the unbent rise is the aim slope times the distance.
  // Lobbed kinds hand that rise back to gravity so they land at the end of the range; straight kinds
  // keep the slope the whole way. Weight is not allowed in this line — a heavy thing leaves the hand
  // exactly where it was pointed, and only what happens to it afterwards is its own.
  const arc = (world.player.pitch - 0.01) * range;
  world.projectiles.push({
    id: nextId(world, "shot"),
    kind,
    x: world.player.x + direction.x * THROW_SPAWN_AHEAD,
    y: world.player.y + direction.y * THROW_SPAWN_AHEAD,
    directionX: direction.x,
    directionY: direction.y,
    travelled: 0,
    range,
    speed: weight.speed,
    drag: weight.drag,
    plunge: weight.plunge,
    thud: weight.thud,
    arc,
    fall: weight.lobbed ? 0.5 + arc : 0,
    payload,
    struck: new Set<string>(),
    trail: [],
    skewered: [],
    cleaved: 0,
    broke: 0,
  });

  // What it cost to get rid of: a shove backwards along the throw and a jolt of the view. Nothing
  // else in the demo moves the player without an enemy doing it, which is exactly why heaving a
  // body registers. One release sound for every throw — the arm moving is the same arm the swing
  // uses — and a bolt is a trigger rather than an open hand, so it stays silent here.
  if (kind !== "crossbowBolt") {
    raiseSfx(world, "throw");
  }

  world.player.pushX -= direction.x * weight.recoil * RECOIL_SHOVE;
  world.player.pushY -= direction.y * weight.recoil * RECOIL_SHOVE;
  world.shake = Math.max(world.shake, weight.recoil * RECOIL_SHAKE);
}
