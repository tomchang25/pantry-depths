/**
 * Player actions: the left button and the right button, and everything they can land on.
 *
 * Left is attack-or-throw, right is grab-or-drop. Which of those two a press resolves to depends
 * only on whether the hands are full, so neither button ever needs a modifier.
 */

import { chooseMeleeAttackId } from "@/core/combat/melee-contract";
import { canCarry } from "@/core/combat/enemy-contract";
import type { PropKind } from "@/core/prop-kinds";
import { burst } from "@/core/combat/particles";
import { propBehaviour, throwWeight, type ThrowKind } from "@/core/prop-contract";
import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import { executeMelee } from "@/core/player/melee/execute-melee";
import { stunEnemy, type Enemy } from "@/core/enemy/enemy-state";
import { nextId } from "@/core/world/ids";
import { REACH, SWING_SECONDS, THROW_SWING_SECONDS, type Prop, type World } from "@/core/world/world";

const GRAB_ARC = Math.cos(1);

/** How far ahead a projectile leaves the hand; the aim cap subtracts it so the landing matches. */
const THROW_SPAWN_AHEAD = 0.4;

/**
 * What one point of recoil is worth, in cells per second of backward shove and in view jolt.
 *
 * Both are deliberately tiny. The first version of these moved the player the better part of half a
 * cell backwards on every throw, which does not read as effort — it reads as being shoved by
 * something you cannot see. Recoil says a weight left the hands; it must never take a step for you.
 */
const RECOIL_SHOVE = 0.8;
const RECOIL_SHAKE = 0.22;

/** Every throw aimed at the floor stops where the crosshair meets it, lobbed or straight. */
function throwRange(world: World, base: number): number {
  if (world.player.pitch > 0) {
    return base;
  }

  // Where the crosshair ray meets the floor: the horizon sits at `0.49 + pitch` of the screen and
  // the eye half a cell up, so the centre of the view lands `0.5 / (0.01 - pitch)` cells out.
  // Level looks resolve far beyond any base range and change nothing.
  const aimDistance = 0.5 / (0.01 - world.player.pitch);
  return Math.min(base, Math.max(THROW_SPAWN_AHEAD, aimDistance - THROW_SPAWN_AHEAD));
}

export const PROP_LABELS: Readonly<Record<PropKind, string>> = {
  stick: "Stakes",
  rock: "Rocks",
  bomb: "Bombs",
  hammer: "Hammer",
  skeletonSword: "Skeleton Sword",
  skeletonSkull: "Skull",
  skeletonFemur: "Femur",
  skeletonFemurCracked: "Cracked Femur",
  skeletonJavelin: "Skeleton Javelin",
  skeletonJavelinCracked: "Bent Javelin",
  crossbow: "Bone Crossbow",
  crossbowSpent: "Spent Crossbow",
  crossbowBolt: "Bolt",
};

const THROW_CALLS: Readonly<Record<PropKind, string>> = {
  stick: "Stake away!",
  rock: "Rock away!",
  bomb: "Bomb away!",
  hammer: "Hammer away!",
  skeletonSword: "Sword away!",
  skeletonSkull: "Skull away!",
  skeletonFemur: "Bone away!",
  skeletonFemurCracked: "Last of the bone!",
  skeletonJavelin: "Javelin away!",
  skeletonJavelinCracked: "Last of the shaft!",
  crossbow: "Bolt away!",
  crossbowSpent: "Threw the stock!",
  crossbowBolt: "Bolt away!",
};
function facing(world: World): Readonly<{ x: number; y: number }> {
  return { x: Math.cos(world.player.angle), y: Math.sin(world.player.angle) };
}

/** Whether a point is inside the given reach and roughly ahead of the player. */
function inFront(world: World, x: number, y: number, reach: number, arc: number): number | undefined {
  const toX = x - world.player.x;
  const toY = y - world.player.y;
  const distance = Math.hypot(toX, toY);

  if (distance > reach || distance < 0.0001) {
    return undefined;
  }

  const direction = facing(world);

  return (toX / distance) * direction.x + (toY / distance) * direction.y >= arc ? distance : undefined;
}

function nearestEnemyAhead(
  world: World,
  reach: number,
  arc: number,
  accepts: (enemy: Enemy) => boolean = () => true,
): Enemy | undefined {
  let best: Enemy | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of world.enemies) {
    if (enemy.drowningSeconds > 0 || !accepts(enemy)) {
      continue;
    }

    const distance = inFront(world, enemy.x, enemy.y, reach, arc);

    if (distance !== undefined && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  return best;
}
function nearestPropAhead(world: World): Prop | undefined {
  let best: Prop | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const prop of world.props) {
    const distance = inFront(world, prop.x, prop.y, REACH, GRAB_ARC);

    if (distance !== undefined && distance < bestDistance) {
      best = prop;
      bestDistance = distance;
    }
  }

  return best;
}

function spawnProjectile(world: World, kind: ThrowKind, payload: Enemy | undefined): void {
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

function throwHeld(world: World): void {
  const held = world.held;

  if (!held) {
    return;
  }

  if (held.kind === "enemy") {
    world.held = undefined;
    spawnProjectile(world, "enemy", held.enemy);
    announce(world, "Threw the enemy!");
    return;
  }

  // One use off the stack, not the whole hand. The hand only empties on the last one.
  const left = held.count - 1;
  world.held = left > 0 ? { kind: "prop", prop: held.prop, count: left } : undefined;
  spawnProjectile(world, held.prop, undefined);
  announce(world, left > 0 ? `${THROW_CALLS[held.prop]} (${left} left)` : THROW_CALLS[held.prop]);
}

/**
 * Pulling a trigger rather than opening a hand.
 *
 * What leaves is a bolt; what stays is the crossbow, one use lighter. When the last use goes the stock
 * remains in the hand as its own throwable, so the weapon ends by being flung at somebody rather than
 * by quietly disappearing — the same "spend the last of it" shape the femur has, arrived at from the
 * other direction.
 *
 * A shot is not a throw and must not read as one: it keeps the arm's dip so the press has weight, but
 * the object stays put, so nothing is handed to the viewmodel to animate leaving.
 */
function shootHeld(world: World): void {
  const held = world.held;

  if (!held || held.kind !== "prop") {
    return;
  }

  const behaviour = propBehaviour(world.catalog, held.prop);
  const left = held.count - 1;
  world.held =
    left > 0
      ? { kind: "prop", prop: held.prop, count: left }
      : behaviour.spends
        ? { kind: "prop", prop: behaviour.spends, count: 1 }
        : undefined;
  spawnProjectile(world, "crossbowBolt", undefined);
  burst(world.particles, "ember", world.player.x, world.player.y, 0.5, 4, {
    speed: 2.2,
    spreadZ: 1.2,
    size: 0.035,
    life: 0.22,
  });
  announce(world, left > 0 ? `Bolt away! (${left} left)` : "Last bolt — only the stock now");
}

/**
 * Left button: one of the eight cuts, or a throw of whatever is in the hand.
 *
 * A press during a swing is ignored outright — not queued, not buffered. That is the prototype's own
 * rule and it is the whole of the input model: there is no chain to be early for, so a dropped press
 * costs the player nothing but the swing they were already watching. What it buys is that a swing is
 * one hit. Mashing used to be a whole extra hit per click, which made the animation decoration over
 * damage that had already been dealt.
 */
export function primaryAction(world: World): void {
  if (world.status !== "playing" || world.swing > 0) {
    return;
  }

  world.swingTarget = undefined;

  if (world.held) {
    world.swingKind = "throw";
    world.swing = THROW_SWING_SECONDS;
    world.swingTotal = THROW_SWING_SECONDS;
    // A throw is over the moment the hand opens; there is no blade travelling anywhere to wait for.
    world.swingResolved = true;

    // A shooter keeps what it is holding and sends something else. Everything else opens the hand.
    if (world.held.kind === "prop" && propBehaviour(world.catalog, world.held.prop).use === "shoot") {
      shootHeld(world);
      return;
    }

    throwHeld(world);
    return;
  }

  // Never the cut just played, so consecutive swings always differ — the one repetition the eye
  // catches when there is no chain to give the sequence a shape.
  world.swingKind = chooseMeleeAttackId(world.swingKind === "throw" ? undefined : world.swingKind);
  // On the press rather than on the hit, because the whoosh is the arm moving and that starts now.
  raiseSfx(world, "meleeSwing");
  world.swing = SWING_SECONDS;
  world.swingTotal = SWING_SECONDS;
  world.swingResolved = false;
}

/** The blade arrives. What it lands on is decided by the attack slice; this is only the gate. */
export function resolveSwing(world: World): void {
  if (world.status !== "playing") {
    return;
  }

  executeMelee(world);
}

function dropHeld(world: World): void {
  const held = world.held;

  if (!held) {
    return;
  }

  const direction = facing(world);
  const x = world.player.x + direction.x * 0.6;
  const y = world.player.y + direction.y * 0.6;
  world.held = undefined;

  if (held.kind === "enemy") {
    held.enemy.x = x;
    held.enemy.y = y;
    stunEnemy(held.enemy, 0.4);
    world.enemies.push(held.enemy);
    announce(world, "Dropped the enemy");
    return;
  }

  // Whatever is left of the stack goes back on the floor as one pickup, so putting something down
  // and taking it again is never a way to lose or gain uses.
  world.props.push({ id: nextId(world, "prop"), kind: held.prop, count: held.count, x, y });
  announce(world, `Dropped ${PROP_LABELS[held.prop]} x${held.count}`);
}

/** Right button: grab an enemy or a stack of ammunition — or put down what is held. */
export function grabAction(world: World): void {
  if (world.status !== "playing") {
    return;
  }

  if (world.held) {
    dropHeld(world);
    return;
  }

  const enemy = nearestEnemyAhead(world, REACH, GRAB_ARC, (candidate) => canCarry(candidate.archetype));

  if (enemy) {
    world.enemies.splice(world.enemies.indexOf(enemy), 1);
    world.held = { kind: "enemy", enemy };
    announce(world, "Grabbed an enemy!");
    return;
  }

  const prop = nearestPropAhead(world);

  if (prop) {
    world.props.splice(world.props.indexOf(prop), 1);
    world.held = { kind: "prop", prop: prop.kind, count: prop.count };
    announce(world, `Picked up ${PROP_LABELS[prop.kind]} x${prop.count}`);
    return;
  }

  announce(world, "Nothing here to grab", 1.1);
}
