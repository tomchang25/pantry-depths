export type Facing = "north" | "east" | "south" | "west";

export type Cell = Readonly<{
  x: number;
  y: number;
}>;

const FACING_STEPS: Readonly<Record<Facing, Cell>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const LEFT_TURNS: Readonly<Record<Facing, Facing>> = {
  north: "west",
  west: "south",
  south: "east",
  east: "north",
};

const RIGHT_TURNS: Readonly<Record<Facing, Facing>> = {
  north: "east",
  east: "south",
  south: "west",
  west: "north",
};

/**
 * A step relative to the player's facing. The player keeps a four-way `Facing` no matter which of
 * these is taken: only `forward` and `backward` follow the eyes, and the two lateral steps are the
 * whole reason a sidestep no longer costs a turn, a walk, and a turn back.
 */
export type MoveDirection = "forward" | "backward" | "left" | "right";

const BACK_TURNS: Readonly<Record<Facing, Facing>> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

const IDENTITY_TURNS: Readonly<Record<Facing, Facing>> = {
  north: "north",
  east: "east",
  south: "south",
  west: "west",
};

/** Total lookup rather than a branch chain, so a new direction cannot silently reuse another's step. */
const DIRECTION_HEADINGS: Readonly<Record<MoveDirection, Readonly<Record<Facing, Facing>>>> = {
  forward: IDENTITY_TURNS,
  backward: BACK_TURNS,
  left: LEFT_TURNS,
  right: RIGHT_TURNS,
};

export function areSameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

export function areEdgeAdjacent(left: Cell, right: Cell): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}

export function moveForward(cell: Cell, facing: Facing): Cell {
  const step = FACING_STEPS[facing];
  return { x: cell.x + step.x, y: cell.y + step.y };
}

export function turnLeft(facing: Facing): Facing {
  return LEFT_TURNS[facing];
}

export function turnRight(facing: Facing): Facing {
  return RIGHT_TURNS[facing];
}

/** The heading a step travels along, which is the facing itself only for `forward`. */
export function headingFor(facing: Facing, direction: MoveDirection): Facing {
  return DIRECTION_HEADINGS[direction][facing];
}

export function moveInDirection(cell: Cell, facing: Facing, direction: MoveDirection): Cell {
  return moveForward(cell, headingFor(facing, direction));
}
