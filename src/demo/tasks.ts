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
 * A floor's task list is announced rather than listed, because the only channel from here to the
 * screen that a concurrent rewrite does not own is the message line.
 */

import { roomAt, type DemoFloorProgress, type DemoTask, type DemoTaskKind } from "@/demo/maze";
import { announce, awardBless, type DemoWorld } from "@/demo/world";

/** How each task reads on the message line. Second person, because it is being asked of the player. */
const TASK_LABELS: Readonly<Record<DemoTaskKind, string>> = {
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

function noteRoom(world: DemoWorld): void {
  const room = roomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));

  if (room && !world.maze.progress.roomsVisited.includes(room.side)) {
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

/** Announced on the floor's first step, because a floor that never said what it wants asks nothing. */
function statement(progress: DemoFloorProgress): string {
  const secondary = progress.secondary.map((task) => `${task.target} ${TASK_LABELS[task.kind]}`).join(", ");
  return `This floor: ${progress.main.target} ${TASK_LABELS[progress.main.kind]} opens the way down. Also worth a blessing: ${secondary}`;
}

export function stepTasks(world: DemoWorld): void {
  const progress = world.maze.progress;

  if (progress.killsAtArrival === undefined || progress.wallsBrokenAtArrival === undefined) {
    progress.killsAtArrival = world.kills;
    progress.wallsBrokenAtArrival = world.wallsBroken;
    announce(world, statement(progress), 6);
    return;
  }

  noteRoom(world);

  for (const task of progress.secondary) {
    if (settle(world, progress, task)) {
      awardBless(world);
    }
  }

  if (settle(world, progress, progress.main)) {
    announce(world, "The way down is open, and now you can see where it is", 4);
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
