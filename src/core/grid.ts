/**
 * The grid vocabulary the render contract speaks: a four-way facing and an integer cell.
 *
 * The turn-based movement model that once lived beside these — turn tables, facing-relative steps —
 * is retired; the demo's rules own movement as continuous angles. What survives here is what the
 * presentation layer still types itself against: a wall face is one of four facings, and a floor
 * patch names the cell it covers.
 */

export type Facing = "north" | "east" | "south" | "west";

export type Cell = Readonly<{
  x: number;
  y: number;
}>;
