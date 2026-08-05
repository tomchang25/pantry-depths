/**
 * One swing, decided.
 *
 * A pure function of its snapshot: it reads no state, writes nothing, and returns the ordered effects
 * a swing produces. Every rule a swing is tuned by lives here — the arc, the order targets are taken
 * in, how many the blade carries through, what it falls back to, and where the arc is drawn.
 */

import {
  MELEE_ARC,
  type MeleeCandidate,
  type MeleeEffect,
  type MeleeFloorView,
  type MeleePose,
  type MeleeSnapshot,
} from "@/core/player/melee/contract";
import type { Cell } from "@/core/grid";

/** How high on a target the arc is drawn, per kind of thing it met. */
const ENEMY_LANDING_HEIGHT = 0.34;
const ALTAR_LANDING_HEIGHT = 0.6;
const STRUCTURE_LANDING_HEIGHT = 0.55;
const EMPTY_LANDING_HEIGHT = 0.5;

function facing(actor: MeleePose): Readonly<{ x: number; y: number }> {
  return { x: Math.cos(actor.angle), y: Math.sin(actor.angle) };
}

/** Whether a point is inside the given reach and roughly ahead of the player, and how far off it is. */
function inFront(actor: MeleePose, x: number, y: number, reach: number, arc: number): number | undefined {
  const toX = x - actor.x;
  const toY = y - actor.y;
  const distance = Math.hypot(toX, toY);

  if (distance > reach || distance < 0.0001) {
    return undefined;
  }

  const direction = facing(actor);

  return (toX / distance) * direction.x + (toY / distance) * direction.y >= arc ? distance : undefined;
}

/**
 * Everything one swing sweeps through, nearest first.
 *
 * The blade does not stop at the first enemy it meets. A sword swung through a doorway full of slimes
 * that killed exactly one of them was the prototype's most reliable disappointment: the arc visibly
 * passes through all of them, so hitting one makes the drawing disagree with the rules.
 *
 * Nearest ends up at the front without a sort — each strictly closer find is moved there — because
 * that one is what the arc is drawn through. The order of the rest is arbitrary and nothing reads it.
 */
function sweepAhead(actor: MeleePose, candidates: readonly MeleeCandidate[], reach: number): readonly MeleeCandidate[] {
  const struck: MeleeCandidate[] = [];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.drowning) {
      continue;
    }

    const distance = inFront(actor, candidate.x, candidate.y, reach, MELEE_ARC);

    if (distance === undefined) {
      continue;
    }

    if (distance < nearestDistance) {
      nearestDistance = distance;
      struck.unshift(candidate);
    } else {
      struck.push(candidate);
    }
  }

  return struck;
}

/**
 * The breakable thing the player is looking at within arm's length.
 *
 * Barricades count even though you can see over them: the same predicate that stops a thrown rock
 * decides what a swing lands on, so the two can never disagree.
 */
function wallAhead(actor: MeleePose, floor: MeleeFloorView, reach: number): Cell | undefined {
  const direction = facing(actor);
  const steps = Math.max(4, Math.round(reach * 4));

  for (let step = 1; step <= steps; step += 1) {
    const along = (step / steps) * reach;
    const x = Math.floor(actor.x + direction.x * along);
    const y = Math.floor(actor.y + direction.y * along);

    if (floor.blocksProjectile(x, y)) {
      return { x, y };
    }
  }

  return undefined;
}

/**
 * What one swing does, in the order it is applied.
 *
 * Priority is enemies, then the altar, then a breakable cell, then nothing. A rubble pile is not a
 * target: swinging through one reaches whatever is behind it, so the only way a pile leaves the floor
 * is by being carried away three pieces at a time.
 */
export function resolveMelee(snapshot: MeleeSnapshot): readonly MeleeEffect[] {
  const { actor, stats, floor } = snapshot;
  const direction = facing(actor);
  const struck = sweepAhead(actor, snapshot.candidates, stats.reach);
  const nearest = struck[0];

  if (nearest) {
    const effects: MeleeEffect[] = struck.map((candidate) => ({
      kind: "enemyHit",
      targetId: candidate.id,
      damage: stats.damage,
      pushX: direction.x * stats.knockback,
      pushY: direction.y * stats.knockback,
      boned: candidate.boned,
      directionX: direction.x,
      directionY: direction.y,
    }));

    // The arc is drawn through where the swing actually went, taken from the snapshot so a target that
    // dies to an earlier effect cannot move it.
    effects.push({ kind: "landing", x: nearest.x, y: nearest.y, z: ENEMY_LANDING_HEIGHT, connected: true });

    if (struck.length > 1) {
      effects.push({ kind: "cleave", count: struck.length });
    }

    return effects;
  }

  const altar = snapshot.altar;

  if (altar && altar.hp > 0 && inFront(actor, altar.x, altar.y, stats.reach, MELEE_ARC) !== undefined) {
    return [
      { kind: "altarHit" },
      { kind: "landing", x: altar.x, y: altar.y, z: ALTAR_LANDING_HEIGHT, connected: true },
    ];
  }

  const cell = wallAhead(actor, floor, stats.reach);

  if (cell) {
    return [
      { kind: "structureHit", cell },
      {
        kind: "landing",
        x: cell.x + 0.5,
        y: cell.y + 0.5,
        z: STRUCTURE_LANDING_HEIGHT,
        connected: true,
      },
    ];
  }

  // Swung at nothing: the arc still plays, aimed straight ahead at arm's length.
  return [
    {
      kind: "landing",
      x: actor.x + direction.x * stats.reach,
      y: actor.y + direction.y * stats.reach,
      z: EMPTY_LANDING_HEIGHT,
      connected: false,
    },
  ];
}
