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
