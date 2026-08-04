/**
 * How an enemy leaves the world, and everything that happens on the way out.
 *
 * One exit, and now one owner for it. The exit itself was always single — every kill in the game
 * comes through `killEnemy`, which is what keeps the drop roll and the blessing payout from applying
 * to some routes and not others — but it lived in the middle of the world's state module, so every
 * change to what dying *does* was an edit to the container that holds the run. Four modules called
 * in and the knowledge of a death was split across three: how a body dies here, what each cause
 * looks like in `impacts.ts`, and how long the corpse lasts in `simulation.ts`.
 *
 * What this owns is the whole of the outcome: the record, the count, the scatter, the pool it may
 * close, the drop it may leave, and the blessing it may pay. `damageEnemy` and `stunEnemy` come with
 * it rather than staying behind, because a hit that kills is the ordinary way into this file and
 * splitting the two would put the same subject back in two places.
 *
 * What stays with the world is the vocabulary: `DeathCause` and the `Death` record are the shape of
 * `world.deaths`, which is state. That is also what keeps the direction clean — this module reads
 * the world, the world knows nothing about this module.
 */

import { DISENGAGE_RANGE, isBoned, type EnemyAppearanceId } from "@/core/combat/enemy-contract";
import { burst, shatterBones } from "@/core/combat/particles";
import { blocksWalk, isWaterCell, sinkBody } from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import { hasBless } from "@/core/progression/bless";
import type { PropKind } from "@/core/prop-kinds";

import { announce, nextId, raiseSfx, stainFloor, type DeathCause, type Enemy, type World } from "@/core/world/world";

/**
 * What a boned body leaves besides its own bones.
 *
 * The bones themselves are guaranteed and picked by how it died; this is the roll on top of that, and
 * it is what makes crossing a room for a skeleton worth the trip. It is also the only such table
 * left. A slime carries no armoury and now drops nothing at all, which leaves two sources of weapons
 * on a floor: the things that were holding them, and the walls.
 */
const BONE_DROPS: readonly Readonly<{ kind: PropKind; count: number; upTo: number }>[] = [
  { kind: "skeletonSkull", count: 1, upTo: 0.3 },
  { kind: "skeletonFemur", count: 1, upTo: 0.5 },
];

/**
 * The armoury half of the same roll: what this body was carrying, on the tenth of the table above it.
 *
 * Per appearance rather than per behaviour, because what a body drops is what it is holding and the
 * artwork is the only place that is true. A crossbow arrives with three shots in it and then the
 * stock itself is throwable, which is the behaviour it already has at a different count.
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

/**
 * A body ending its flight in open water, and what the pool does with it.
 *
 * Hung off the single kill exit rather than off drowning, because how the body got into the water is
 * not the pool's business: one shoved in and left to sink, one that died of the landing, and one a
 * bomb dropped in are all the same body in the same water. Every one of them shows on the surface,
 * and the third fills the cell in.
 */
function swallowIntoPool(world: World, enemy: Enemy): void {
  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);

  if (!isWaterCell(world.maze, cellX, cellY)) {
    return;
  }

  const closed = sinkBody(world.maze, cellX, cellY);
  // Every body changes the surface, not only the one that fills it, so the terrain the scene is
  // built from is stale after each of them.
  world.terrainVersion += 1;

  if (closed) {
    announce(world, "The bodies close the pool over - it can be crossed now", 2.6);
  }
}

/**
 * How hard a death threw the body apart, from a quiet collapse to a bomb.
 *
 * The two ways of going under are never asked any more — nothing comes off a body that sank, so the
 * caller does not reach this at all for them. They keep their answer because the exhaustive check
 * below wants one from every cause, and zero is the honest one to leave: a body that sinks does not
 * come apart, and bones thrown off it would arrive above the water or the cut it disappeared into.
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
 * Drowning, a stick through the chest, a bomb — all of them come here, so the drop chance and the
 * blessing payout cannot end up applying to some kill routes and not others.
 *
 * A death that went under is the one that leaves nothing behind, and it is the whole of what `sank`
 * below decides. The body has already spent a second sinking by the time this runs, so the corpse,
 * the scatter and the hit that ends the sound were all landing on a surface the body was no longer
 * on: a skeleton disappeared under the water and then bobbed back up as a corpse for three quarters
 * of a second, with a puff of dust and a bone-hit over the top of it. What is left instead is the
 * entry — the splash or the dust off the rim — and then the floor as it was.
 *
 * Everything that is not a mark on the floor still happens: it counts, it pays lifesteal, and a pool
 * still takes its third body and closes over.
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
    // The body's material rather than the cause: a skeleton comes apart in bone whatever took it
    // apart, and per-cause death voices are a decision deferred until somebody wants to author them.
    // Raised here rather than from each cause, so no route out of the world can be the one that
    // forgot to.
    raiseSfx(world, isBoned(enemy.archetype) ? "meleeHitBone" : "meleeHitFlesh", { x: enemy.x, y: enemy.y });

    if (isBoned(enemy.archetype)) {
      // Called here rather than from each cause, so every route out of the world scatters the same
      // bones and none of them can be forgotten. How hard is the cause's business; what comes off the
      // body is not.
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
      // A pool directly under the body as well as the spray, so a kill always marks the spot even
      // when every droplet happens to fly off somewhere else.
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

/**
 * Puts a body out for a while, and takes whatever it was committing to away from it.
 *
 * The commitment is the point. A stun used to set the timer and nothing else, and because the step
 * loop skips a stunned body before it reaches the wind-up, the wind-up did not run down — it froze.
 * So a skeleton clubbed mid-swing kept its telegraph painted on the floor, waited out the stun, and
 * then finished the attack at the spot the player had been standing when they threw the thing. The
 * interruption cost it time and nothing else, which is the opposite of what landing a hit should
 * buy.
 *
 * Clearing the intent here is also what makes every warning disappear on its own: the head marker,
 * the cut arc, the sight line and the charge lane all read the wind-up directly, so none of them
 * needs to know what a stun is.
 *
 * Longest wins. A body already lying down from a worse hit is not stood back up by a lesser one.
 */
export function stunEnemy(enemy: Enemy, seconds: number): void {
  enemy.stunSeconds = Math.max(enemy.stunSeconds, seconds);
  enemy.windupSeconds = 0;
  enemy.intent = "none";
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
 * Turns a body that has just been hit onto the player, if the player is close enough to be blamed.
 *
 * Being shot is the one thing that has to reach a body regardless of what it was doing, because the
 * alternative is a creature standing in the open taking hits and going about its errand — which reads
 * as broken however defensible the distance rule behind it is.
 *
 * Bounded by the same distance that ends a chase, so the rule composes with itself: a body will not be
 * provoked into a pursuit it would abandon on the very next frame. Past that it genuinely does not
 * respond, which is what makes reaching across a floor to soften something a real option rather than
 * a way of summoning it.
 */
function provoke(world: World, enemy: Enemy): void {
  if (Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y) > DISENGAGE_RANGE) {
    return;
  }

  enemy.mind = "chase";
  // The errand is off. Keeping it would have the body resume a walk to somewhere it chose before it
  // was attacked, the moment the player stepped away.
  enemy.wanderCell = undefined;
}
