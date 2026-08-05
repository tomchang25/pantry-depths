/**
 * The single writer for enemy health, and the one exit an enemy leaves the world through.
 *
 * Every kill route arrives at `killEnemy` — drowning, a thrown weapon, a blast, a swing — so the drop
 * roll, the lifesteal payout, the pool interaction and the corpse record cannot apply to some routes
 * and not others. `damageEnemy` comes with it rather than living elsewhere, because a hit that kills
 * is the ordinary way in and splitting the two would put one subject in two modules.
 *
 * The hostage entry at the bottom is the other way an enemy takes damage: absorbed on the player's
 * behalf while carried. It lives here for the same single-writer reason, and player damage composes
 * it through the returned outcome rather than reaching these fields itself.
 */

import { DISENGAGE_RANGE, isBoned, type EnemyAppearanceId } from "@/core/combat/enemy-contract";
import { announce, raiseSfx, stainFloor } from "@/core/feedback/run-feedback";
import { burst, shatterBones } from "@/core/combat/particles";
import { blocksWalk, isWaterCell, sinkBody } from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import { hasBless } from "@/core/progression/bless";
import type { PropKind } from "@/core/prop-kinds";
import type { Enemy } from "@/core/enemy/enemy-state";

import { nextId } from "@/core/world/ids";
import { randomAmmo, type DeathCause, type World } from "@/core/world/world";

/**
 * What a boned enemy leaves besides its own bones.
 *
 * The bones themselves are guaranteed and picked by how it died; this is the roll on top, and it is
 * what makes crossing a room for a skeleton worth the trip. It is also the only such table left: a
 * slime carries no armoury and drops nothing, which leaves two sources of weapons on a floor — the
 * things that were holding them, and the walls.
 */
const BONE_DROPS: readonly Readonly<{ kind: PropKind; count: number; upTo: number }>[] = [
  { kind: "skeletonSkull", count: 1, upTo: 0.3 },
  { kind: "skeletonFemur", count: 1, upTo: 0.5 },
];

/**
 * The armoury half of the same roll: what this enemy was carrying, on the tenth of the table above it.
 *
 * Per appearance rather than per behaviour, because what an enemy drops is what it is holding and the
 * artwork is the only place that is true. A crossbow arrives with three shots in it and then the stock
 * itself is throwable, which is the behaviour it already has at a different count.
 */
const SKELETON_ARMOURY: Readonly<Partial<Record<EnemyAppearanceId, Readonly<{ kind: PropKind; count: number }>>>> = {
  skeletonSwordsman: { kind: "skeletonSword", count: 1 },
  skeletonHammerman: { kind: "hammer", count: 1 },
  skeletonJavelineer: { kind: "skeletonJavelin", count: 1 },
  skeletonCrossbowman: { kind: "crossbow", count: 3 },
};

/** Above this the roll leaves nothing, which is what four in every ten corpses do. */
const ARMOURY_UP_TO = 0.6;
const LIFESTEAL_HEAL = 12;

/** How much health the held enemy loses per flinch, and how long the flinch reads for. */
const HOSTAGE_FLINCH_SECONDS = 0.3;

/**
 * An enemy ending its flight in open water, and what the pool does with it.
 *
 * Hung off the single kill exit rather than off drowning, because how it got into the water is not
 * the pool's business: one shoved in and left to sink, one that died of the landing, and one a bomb
 * dropped in are the same enemy in the same water. Every one shows on the surface, and the third
 * fills the cell in.
 */
function swallowIntoPool(world: World, enemy: Enemy): void {
  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);

  if (!isWaterCell(world.maze, cellX, cellY)) {
    return;
  }

  const closed = sinkBody(world.maze, cellX, cellY);
  // Every corpse changes the surface, not only the one that fills it, so the terrain the scene is
  // built from is stale after each of them.
  world.terrainVersion += 1;

  if (closed) {
    announce(world, "The bodies close the pool over - it can be crossed now", 2.6);
  }
}

/**
 * How hard a death threw the corpse apart, from a quiet collapse to a blast.
 *
 * The two ways of going under are never asked any more — nothing comes off an enemy that sank, so the
 * caller does not reach this for them. They keep an answer because the exhaustive check wants one from
 * every cause, and zero is the honest one: bones thrown off would arrive above the water or the cut it
 * disappeared into.
 */
function deathViolence(cause: DeathCause): number {
  if (cause === "blasted") {
    return 1;
  }

  if (cause === "cleaved" || cause === "splattered") {
    return 0.65;
  }

  if (cause === "impaled") {
    return 0.3;
  }

  if (cause === "drowned" || cause === "swallowed") {
    return 0;
  }

  if (cause === "slain") {
    return 0.25;
  }

  cause satisfies never;
  throw new Error("unknown skeleton death cause");
}

/**
 * The single exit every enemy leaves the world through.
 *
 * A death that went under is the one that leaves nothing behind, which is the whole of what `sank`
 * decides. The enemy has already spent a second sinking by the time this runs, so a corpse, its
 * scatter and its impact sound would all land on a surface it is no longer on. What is left instead is
 * the entry splash or the dust off the rim, and then the floor as it was.
 *
 * Everything that is not a mark on the floor still happens: it counts, it pays lifesteal, and a pool
 * still takes its third corpse and closes over.
 */
export function killEnemy(world: World, enemy: Enemy, cause: DeathCause = "slain", direction?: Cell): void {
  const index = world.enemies.indexOf(enemy);

  if (index >= 0) {
    world.enemies.splice(index, 1);
  }

  world.kills += 1;
  const sank = cause === "drowned" || cause === "swallowed";

  if (!sank) {
    world.deaths.push({
      id: enemy.id,
      appearance: enemy.appearance,
      x: enemy.x,
      y: enemy.y,
      progress: 0,
      cause,
      directionX: direction?.x ?? 0,
      directionY: direction?.y ?? 0,
      archetypeId: enemy.archetype.id,
      facingAngle: enemy.facingAngle,
    });
    // The material rather than the cause: a skeleton comes apart in bone whatever took it apart, and
    // per-cause death voices are deferred until somebody wants to author them. Raised here rather than
    // from each cause, so no route out of the world can be the one that forgot to.
    raiseSfx(world, isBoned(enemy.archetype) ? "meleeHitBone" : "meleeHitFlesh", { x: enemy.x, y: enemy.y });

    if (isBoned(enemy.archetype)) {
      // Called here rather than from each cause, so every route out scatters the same bones and none
      // can be forgotten. How hard is the cause's business; what comes off the corpse is not.
      shatterBones(world.particles, enemy.x, enemy.y, deathViolence(cause));
      burst(world.particles, "dust", enemy.x, enemy.y, 0.55, 5, {
        speed: 1.1,
        spreadZ: 1.4,
        gravity: 2,
        drag: 2,
        size: 0.12,
        life: 0.8,
      });
    } else {
      burst(world.particles, "blood", enemy.x, enemy.y, 0.34, 18, {
        speed: 2.6,
        spreadZ: 2.9,
        gravity: 11,
        drag: 1.1,
        size: 0.07,
        life: 1.4,
      });
      // A pool directly underneath as well as the spray, so a kill always marks the spot even when
      // every droplet happens to fly off somewhere else.
      stainFloor(world, enemy.x, enemy.y, 0.5);
    }
  }

  swallowIntoPool(world, enemy);

  if (hasBless(world.bless, "lifesteal")) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + LIFESTEAL_HEAL);
  }

  if (!isBoned(enemy.archetype) || blocksWalk(world.maze, Math.floor(enemy.x), Math.floor(enemy.y))) {
    return;
  }

  const roll = Math.random();
  const armoury = SKELETON_ARMOURY[enemy.appearance];
  const drop = BONE_DROPS.find((entry) => roll < entry.upTo) ?? (armoury && roll < ARMOURY_UP_TO ? armoury : undefined);

  if (drop) {
    world.props.push({ id: nextId(world, "prop"), kind: drop.kind, count: drop.count, x: enemy.x, y: enemy.y });
  }
}

export function damageEnemy(
  world: World,
  enemy: Enemy,
  amount: number,
  cause: DeathCause = "slain",
  direction?: Cell,
): void {
  if (enemy.drowningSeconds > 0) {
    return;
  }

  enemy.hp -= amount;
  enemy.hurtSeconds = 0.28;
  provoke(world, enemy);

  if (enemy.hp <= 0) {
    killEnemy(world, enemy, cause, direction);
  }
}

/**
 * Turns an enemy that has just been hit onto the player, if the player is close enough to be blamed.
 *
 * Being shot has to reach an enemy regardless of what it was doing, because the alternative is one
 * standing in the open taking hits and continuing its errand, which reads as broken however defensible
 * the distance rule behind it is.
 *
 * Bounded by the same distance that ends a chase, so the rule composes with itself: an enemy will not
 * be provoked into a pursuit it would abandon on the next frame. Past that it genuinely does not
 * respond, which is what makes softening something across a floor a real option rather than a way of
 * summoning it.
 */
function provoke(world: World, enemy: Enemy): void {
  if (Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y) > DISENGAGE_RANGE) {
    return;
  }

  enemy.mind = "chase";
  // The errand is off. Keeping it would have the enemy resume a walk to somewhere it chose before it
  // was attacked, the moment the player stepped away.
  enemy.wanderCell = undefined;
}

/** What absorbing a hit did to the carried enemy. `killed` carries what the burst leaves in the hand. */
export type HostageOutcome = Readonly<{ kind: "survived" }> | Readonly<{ kind: "killed"; salvage: PropKind }>;

/**
 * A hit the carried enemy takes on the player's behalf.
 *
 * Deliberately not routed through `killEnemy`: a carried enemy is not in the world list, leaves its
 * corpse at the player's position rather than its own, and pays no drop roll, no lifesteal and no pool
 * interaction — the salvage below is its drop. Rerouting it through the ordinary exit would change all
 * of that, so the statements stay as they were and only their owner moved.
 *
 * The hand itself is not written here. It belongs to the player, so the outcome is returned and player
 * damage puts the salvage in the hand.
 */
export function damageHeldHostage(world: World, hostage: Enemy, amount: number): HostageOutcome {
  hostage.hp -= amount;
  hostage.hurtSeconds = HOSTAGE_FLINCH_SECONDS;

  if (hostage.hp > 0) {
    return { kind: "survived" };
  }

  const salvage = randomAmmo();
  world.deaths.push({
    id: hostage.id,
    appearance: hostage.appearance,
    x: world.player.x,
    y: world.player.y,
    progress: 0,
    cause: "slain",
    directionX: 0,
    directionY: 0,
    archetypeId: hostage.archetype.id,
    facingAngle: hostage.facingAngle,
  });
  world.kills += 1;
  return { kind: "killed", salvage };
}
