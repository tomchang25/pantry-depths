/**
 * The single writer for what a blow does to the floor's standing structures: masonry, barricade iron,
 * and emplacements.
 *
 * One owner because every route reaches the same tiles — a swing, a thrown weapon, a charge that
 * stalled, a bomb, a shell — and a second writer would mean a route that broke a wall without
 * dropping its rubble or bumping the terrain version the scene rebuilds from.
 */

import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import { burst } from "@/core/combat/particles";
import { tileAt, type Tile } from "@/core/floor/maze";
import type { Cell } from "@/core/grid";
import { nextId } from "@/core/world/ids";
import type { World } from "@/core/world/world";

/**
 * What each way of hitting a wall costs it, against the hit points in the maze.
 *
 * A bare swing is the unit: two for wood, four for stone. What a thrown prop is worth is its own row
 * in the prop table; a thrown enemy is the one throw with no such row, so its number is here.
 */
export const MELEE_WALL_DAMAGE = 1;
export const THROWN_WALL_DAMAGE = 2;
export const BLAST_WALL_DAMAGE = 4;

/** How often a broken wall drops a stack of its own material as ammunition. */
const WALL_DROP_CHANCE = 0.2;

/** Iron sparks rather than splinters, and the cell opens up when the last spike goes. */
function damageBarricade(world: World, cell: Cell, tile: Tile, damage: number, quiet: boolean): void {
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  burst(world.particles, "ember", cell.x + 0.5, cell.y + 0.5, 0.45, 7, {
    speed: 2.6,
    spreadZ: 1.8,
    size: 0.045,
    life: 0.55,
  });

  if (tile.hp > 0) {
    if (!quiet) {
      announce(world, `Barricade HP ${tile.hp}/${tile.maxHp}`, 1.1);
    }

    return;
  }

  tile.kind = "open";
  tile.maxHp = 0;
  raiseSfx(world, "wallBreakStone", { x: cell.x + 0.5, y: cell.y + 0.5 });
  burst(world.particles, "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.5, 18, {
    speed: 3,
    spreadZ: 2.6,
    size: 0.06,
    life: 1.2,
  });
  if (!quiet) {
    announce(world, "The barricade is torn down!");
  }
}

/**
 * Breaking down the floor's own artillery.
 *
 * Iron and timber rather than masonry, and it leaves nothing behind: ammunition already comes off
 * walls and enemies, and a hazard that paid out would turn a decision to go and smash one into an
 * errand. Its own branch rather than the masonry one below, which would give it stone chips, a wall's
 * debris direction, and the wall-broken message.
 */
function damageMortar(world: World, cell: Cell, tile: Tile, damage: number, quiet: boolean): void {
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  burst(world.particles, "ember", cell.x + 0.5, cell.y + 0.5, 0.5, 8, {
    speed: 2.4,
    spreadZ: 2,
    size: 0.05,
    life: 0.6,
  });

  if (tile.hp > 0) {
    if (!quiet) {
      announce(world, `Mortar HP ${tile.hp}/${tile.maxHp}`, 1.1);
    }

    return;
  }

  tile.kind = "open";
  tile.maxHp = 0;
  raiseSfx(world, "wallBreakStone", { x: cell.x + 0.5, y: cell.y + 0.5 });
  burst(world.particles, "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.55, 20, {
    speed: 3.2,
    spreadZ: 2.8,
    size: 0.06,
    life: 1.3,
  });
  burst(world.particles, "woodChip", cell.x + 0.5, cell.y + 0.5, 0.5, 12, {
    speed: 2.6,
    spreadZ: 2.2,
    size: 0.07,
    life: 1.1,
  });
  if (!quiet) {
    announce(world, "The mortar is wrecked - it fires no more");
  }
}

/**
 * Wears down whatever occupies a cell, by whatever hit it.
 *
 * `quiet` is for a blast. The messages below are written for a wall the player is standing in front
 * of hitting it, and a shell landing across the floor breaks two or three cells at once — so the
 * banner filled with hit points belonging to walls nobody could see, and displaced the lines that
 * were about the player. The debris and the break sound still play; those are local by nature.
 */
export function damageWall(world: World, cell: Cell, damage: number, quiet = false): void {
  const tile = tileAt(world.maze, cell.x, cell.y);

  // A trench belongs here rather than below: it has no hit points, so without this it would fall
  // through to the masonry path and break under the first swing that touched it.
  if (!tile || tile.kind === "open" || tile.kind === "water" || tile.kind === "trench" || tile.kind === "filled") {
    return;
  }

  if (tile.kind === "border") {
    if (!quiet) {
      announce(world, "The boundary brick will not break");
    }

    return;
  }

  if (tile.kind === "barricade") {
    damageBarricade(world, cell, tile, damage, quiet);
    return;
  }

  if (tile.kind === "mortar") {
    damageMortar(world, cell, tile, damage, quiet);
    return;
  }

  const wasWood = tile.kind === "wood";
  tile.hp = Math.max(0, tile.hp - damage);
  world.terrainVersion += 1;
  // Thrown outward from the face the blow came from, so the debris leaves the wall towards whoever
  // hit it rather than spraying evenly out of the middle of a solid block.
  const towardX = world.player.x - (cell.x + 0.5);
  const towardY = world.player.y - (cell.y + 0.5);
  const reach = Math.max(0.0001, Math.hypot(towardX, towardY));
  const faceX = cell.x + 0.5 + (towardX / reach) * 0.5;
  const faceY = cell.y + 0.5 + (towardY / reach) * 0.5;

  if (tile.hp > 0) {
    burst(world.particles, wasWood ? "woodChip" : "stoneChip", faceX, faceY, 0.55, 9, {
      speed: 2.4,
      spreadZ: 1.6,
      directionX: towardX / reach,
      directionY: towardY / reach,
      focus: 0.55,
      size: wasWood ? 0.07 : 0.055,
      life: 0.9,
    });
    burst(world.particles, "dust", faceX, faceY, 0.6, 5, {
      speed: 0.8,
      spreadZ: 0.9,
      gravity: 1.4,
      drag: 2.4,
      size: 0.15,
      life: 0.8,
    });
    if (!quiet) {
      announce(world, `${wasWood ? "Wood wall" : "Stone wall"} HP ${tile.hp}/${tile.maxHp}`, 1.1);
    }

    return;
  }

  // The wall coming down: the whole cell's worth of material, not a face's worth.
  raiseSfx(world, wasWood ? "wallBreakWood" : "wallBreakStone", { x: cell.x + 0.5, y: cell.y + 0.5 });
  burst(world.particles, wasWood ? "woodChip" : "stoneChip", cell.x + 0.5, cell.y + 0.5, 0.6, 26, {
    speed: 3.4,
    spreadZ: 3,
    size: wasWood ? 0.1 : 0.085,
    life: 1.5,
  });
  burst(world.particles, "dust", cell.x + 0.5, cell.y + 0.5, 0.7, 16, {
    speed: 1.7,
    spreadZ: 1.5,
    gravity: 1.1,
    drag: 2,
    size: 0.28,
    life: 1.6,
  });

  world.wallsBroken += 1;
  tile.kind = "open";
  tile.hp = 0;
  tile.maxHp = 0;

  // A broken wall sometimes yields its own material as ammunition — sticks are timber, rocks are
  // masonry. This is the only source of either, so demolition is what keeps the throwing arm supplied
  // while corpses supply the special tools.
  if (Math.random() < WALL_DROP_CHANCE) {
    world.props.push({
      id: nextId(world, "prop"),
      kind: wasWood ? "stick" : "rock",
      count: 3,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
    });
  }

  if (!quiet) {
    announce(world, wasWood ? "The wood wall splinters!" : "The stone wall shatters!");
  }
}
