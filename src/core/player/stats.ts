/**
 * The player's numbers, with every modifier already folded in.
 *
 * One accessor per axis, because the modifier layer has to be consulted somewhere and one place per
 * axis is the only arrangement where a new source of modifiers reaches every axis at once. It is also
 * what lets the decision modules take plain numbers: by the time a resolver sees a reach, the base
 * value, the blessings and the equipped reward have already been added together, so progression is
 * absent from everything downstream.
 */

import { blessBonus, hasBless } from "@/core/progression/bless";
import { coreBase, coreBonus } from "@/core/progression/sealed";
import { propBehaviour, propWeight, type ThrowKind, type ThrowWeight } from "@/core/prop-contract";
import { THROWN_WALL_DAMAGE } from "@/core/damage/structure-damage";
import { PLAYER_SPEED, REACH, type Held, type World } from "@/core/world/world";

const BASE_MELEE_DAMAGE = 25;
const HEAVY_MELEE_DAMAGE = 45;
const HEAVY_MELEE_REACH = 2.1;
const HEAVY_MELEE_KNOCKBACK = 9;
/** What an ordinary swing shoves with, before the blessing that makes it heavy. */
const BASE_MELEE_KNOCKBACK = 3;

export function meleeReach(world: World): number {
  const base = coreBase(world.catalog)?.meleeReach ?? REACH;
  return (
    (hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_REACH : base) +
    blessBonus(world.bless, "meleeReach") +
    coreBonus("meleeReach")
  );
}

export function meleeDamage(world: World): number {
  const base = coreBase(world.catalog)?.meleeDamage ?? BASE_MELEE_DAMAGE;
  return (
    (hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_DAMAGE : base) +
    blessBonus(world.bless, "meleeDamage") +
    coreBonus("meleeDamage")
  );
}

/** How hard a swing shoves what it lands on. The heavy blessing is the only thing that moves it. */
export function meleeKnockback(world: World): number {
  return hasBless(world.bless, "heavyStrike") ? HEAVY_MELEE_KNOCKBACK : BASE_MELEE_KNOCKBACK;
}

/** How fast the player walks, before whatever they are carrying slows them down. */
export function playerSpeed(world: World): number {
  return PLAYER_SPEED + blessBonus(world.bless, "moveSpeed");
}

/** The damage a thrown object does on contact — the same as a bare swing, blessings aside. */
export function thrownImpactDamage(world: World): number {
  return meleeDamage(world);
}

export function thrownWallDamage(world: World, kind: ThrowKind): number {
  return kind === "enemy" ? THROWN_WALL_DAMAGE : propBehaviour(world.catalog, kind).wallDamage;
}

/** What the hands are currently carrying weighs, for whatever wants to charge the player for it. */
export function heldWeight(world: World, held: Held): ThrowWeight | undefined {
  if (!held) {
    return undefined;
  }

  return held.kind === "enemy" ? held.enemy.archetype.weight : propWeight(world.catalog, held.prop);
}
