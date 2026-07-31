/**
 * What a floor owes, and what it pays.
 *
 * One main task and three secondaries. Meeting the main task is what opens the descent and reveals
 * where it is, and it pays nothing on its own — a reward for descending is a reward for skipping the
 * floor, which is the behaviour this whole loop exists to remove. Each secondary pays a blessing the
 * moment it is met, on the spot, and never again.
 *
 * Every condition is a total the simulation already keeps: bodies, broken masonry, rooms set foot in,
 * pools closed over. Nothing here adds a signal, which is why nothing here has to be observed from
 * inside the systems that produce one.
 *
 * The HUD owns how a newly arrived floor briefs these tasks. This module only establishes and settles
 * their counters, so the message line stays available for events that actually happened in play.
 */

import { takeSealed } from "@/demo/extraction";
import { roomAt, type DemoFloorProgress, type DemoTask, type DemoTaskKind } from "@/demo/maze";
import { announce, awardBless, type DemoWorld } from "@/demo/world";

/** How each task reads on the message line and in the panel. Second person, because it is being asked of the player. */
export const TASK_LABELS: Readonly<Record<DemoTaskKind, string>> = {
  kills: "bodies down",
  wallsBroken: "walls broken",
  roomsVisited: "side rooms entered",
  poolsFilled: "pool closed over with bodies",
};

/** Far enough out that the refusal arrives before the stairs would have taken you. */
const DESCENT_WARN_RADIUS = 2.2;

function describe(task: DemoTask): string {
  return `${task.done}/${task.target} ${TASK_LABELS[task.kind]}`;
}

function currentDone(world: DemoWorld, progress: DemoFloorProgress, kind: DemoTaskKind): number {
  if (kind === "kills") {
    return world.kills - (progress.killsAtArrival ?? world.kills);
  }

  if (kind === "wallsBroken") {
    return world.wallsBroken - (progress.wallsBrokenAtArrival ?? world.wallsBroken);
  }

  if (kind === "roomsVisited") {
    return progress.roomsVisited.length;
  }

  if (kind === "poolsFilled") {
    return progress.poolsFilled;
  }

  return kind satisfies never;
}

// Side rooms only. The main region is a room like the others now, and it is the one the player starts
// standing in — counting it would hand over a quarter of this task before the floor had been walked.
function noteRoom(world: DemoWorld): void {
  const room = roomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));

  if (room?.side && !world.maze.progress.roomsVisited.includes(room.side)) {
    world.maze.progress.roomsVisited.push(room.side);
  }
}

/**
 * Brings one task up to date and reports whether this is the step it was met on.
 *
 * Met is sticky. A task whose counter could fall — none can today — would otherwise pay twice.
 */
function settle(world: DemoWorld, progress: DemoFloorProgress, task: DemoTask): boolean {
  task.done = Math.min(task.target, Math.max(task.done, currentDone(world, progress, task.kind)));

  if (task.met || task.done < task.target) {
    return false;
  }

  task.met = true;
  return true;
}

export function stepTasks(world: DemoWorld): void {
  const progress = world.maze.progress;

  if (progress.killsAtArrival === undefined || progress.wallsBrokenAtArrival === undefined) {
    progress.killsAtArrival = world.kills;
    progress.wallsBrokenAtArrival = world.wallsBroken;
    return;
  }

  noteRoom(world);

  for (const task of progress.secondary) {
    if (settle(world, progress, task)) {
      awardBless(world);
    }
  }

  if (settle(world, progress, progress.main)) {
    takeSealed(world, "clean");
    // The stairs stand sealed until this moment and are built as a different thing while they are, so
    // the floor's structures have to be rebuilt on the frame the lock comes off. Geometry is cached
    // against this counter; without the bump the slab stays over the steps for the rest of the floor.
    world.terrainVersion += 1;
    announce(world, "The seal breaks - the way down is open, and now you can see where it is", 4);
    return;
  }

  if (progress.main.met) {
    return;
  }

  const toExit = Math.hypot(world.player.x - (world.maze.exit.x + 0.5), world.player.y - (world.maze.exit.y + 0.5));

  if (toExit < DESCENT_WARN_RADIUS) {
    announce(world, `The stairs will not open yet - ${describe(progress.main)}`, 0.6);
  }
}
