/**
 * The right button: taking something up, and putting it down again.
 */

import { canCarry } from "@/core/combat/enemy-contract";
import { announce } from "@/core/feedback/run-feedback";
import { stunEnemy, type Enemy } from "@/core/enemy/enemy-state";
import { facing, inFront } from "@/core/player/aim";
import type { PropKind } from "@/core/prop-kinds";
import { nextId } from "@/core/world/ids";
import { REACH, type Prop, type World } from "@/core/world/world";

/** How wide a reach the grab has, as a dot-product threshold. Wider than a swing: it is not an attack. */
const GRAB_ARC = Math.cos(1);

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
