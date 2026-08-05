/**
 * One assembled floor, shown from above and from inside it.
 *
 * Shared by the two surfaces that edit a map and a room, because both are asking the same pair of
 * questions about the same kind of thing. From above, a floor answers what landed where and what the
 * scatter did to the ground; from inside, at the game's own eye height, it answers whether the space is
 * the size it should be. Neither view answers the other, and a caller hands over one world so the two
 * cannot drift onto different draws.
 */

import { createRenderPanel, openHeading, type RenderPanel } from "@/app/debug/render-panel";
import type { MapCastKind, MapTileKind } from "@/core/floor/room-contract";
import type { World } from "@/core/world";

/**
 * One colour per tile kind, chosen to be told apart at four pixels rather than to look like the game.
 *
 * This is a diagram and says so. The renderer beside it is what answers how a floor looks; if these
 * agreed with it, the two views would be the same view at two sizes.
 *
 * Exported because the palette an author paints from has to name the same colours: two tables held
 * equal by whoever remembers to edit both is two tables that will disagree.
 */
export const TILE_COLOURS: Readonly<Record<MapTileKind, string>> = {
  open: "#2b3240",
  border: "#0a0c11",
  stone: "#7b8494",
  wood: "#9a6134",
  water: "#2f6fb5",
  barricade: "#c08a3e",
  filled: "#249e8c",
  mortar: "#b1522a",
  trench: "#152a6e",
};

/**
 * One colour per body, on the same terms as the tiles above: told apart at four pixels rather than
 * made to look like the game.
 *
 * Exported for the same reason too. The palette an author picks a body from and the mark the diagram
 * puts on a cell are the same statement about the same thing, and two tables would drift.
 *
 * The three slimes carry their own colours because that is what tells them apart in play; the four
 * skeletons share a bone tone and are told apart by which weapon they carry, which a four-pixel square
 * cannot show — so they are deliberately one colour here and named in the label instead.
 */
export const CAST_COLOURS: Readonly<Record<MapCastKind, string>> = {
  slimeGreen: "#6fbf5b",
  slimeBlue: "#5b8fd6",
  slimeRed: "#c9534d",
  swordsman: "#e6e0cf",
  hammerman: "#e6e0cf",
  javelineer: "#e6e0cf",
  crossbowman: "#e6e0cf",
};

/** The largest a diagram cell is drawn, so a small floor does not fill the window with squares. */
const MAX_CELL = 14;
const DIAGRAM_WIDTH = 620;

/**
 * Draws one assembled floor from above.
 *
 * Written rather than borrowed: the authoring map this would have reused answers to a schema that no
 * longer describes anything, and it goes when the tooling around it does.
 */
function drawDiagram(canvas: HTMLCanvasElement, world: World): void {
  const maze = world.maze;
  const cell = Math.max(2, Math.min(MAX_CELL, Math.floor(DIAGRAM_WIDTH / maze.width)));
  const ratio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = maze.width * cell * ratio;
  canvas.height = maze.height * cell * ratio;
  canvas.style.width = `${maze.width * cell}px`;
  canvas.style.height = `${maze.height * cell}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const tile = maze.tiles[y * maze.width + x];
      context.fillStyle = tile ? TILE_COLOURS[tile.kind] : TILE_COLOURS.border;
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  // Every body the assembled floor holds, drawn before the labels so a body under one does not hide
  // it. Taken from the assembly rather than from the draft on purpose: what an author needs confirmed
  // is that the cast survived the assembler, and a mark drawn from the form would only restate the
  // form back to them.
  for (const enemy of world.enemies) {
    context.fillStyle = CAST_COLOURS[enemy.archetype.id];
    context.beginPath();
    context.arc(enemy.x * cell, enemy.y * cell, Math.max(1.5, cell * 0.3), 0, Math.PI * 2);
    context.fill();
  }

  context.lineWidth = 1;
  context.font = "11px ui-monospace, monospace";
  context.textBaseline = "top";

  for (const room of maze.rooms) {
    context.strokeStyle = "rgba(255, 255, 255, 0.45)";
    context.strokeRect(
      room.minX * cell + 0.5,
      room.minY * cell + 0.5,
      (room.maxX - room.minX + 1) * cell - 1,
      (room.maxY - room.minY + 1) * cell - 1,
    );
    context.fillStyle = "rgba(0, 0, 0, 0.65)";
    const label = room.side === undefined ? room.id : `${room.id} · ${room.side}`;
    const width = context.measureText(label).width;
    context.fillRect(room.minX * cell, room.minY * cell, width + 6, 15);
    context.fillStyle = "#e8ecf5";
    context.fillText(label, room.minX * cell + 3, room.minY * cell + 2);
  }

  for (const [mark, colour] of [
    [maze.entrance, "#5ddc7a"],
    [maze.exit, "#f0c24b"],
  ] as const) {
    context.fillStyle = colour;
    context.beginPath();
    context.arc((mark.x + 0.5) * cell, (mark.y + 0.5) * cell, Math.max(2, cell * 0.42), 0, Math.PI * 2);
    context.fill();
  }
}

export type FloorPreview = Readonly<{
  element: HTMLElement;
  /** Shows one assembled floor. Calling it again with another world replaces what is on screen. */
  show: (world: World, label: string) => void;
}>;

/** Creates the pair of views, whose only input is the world a caller assembled. */
export function createFloorPreview(): FloorPreview {
  const element = document.createElement("div");
  const diagram = document.createElement("canvas");
  let shown: World | undefined;
  let renderer: RenderPanel | undefined;

  element.className = "map-workbench-preview";
  diagram.className = "map-workbench-diagram";
  diagram.setAttribute("role", "img");
  element.append(diagram);

  return {
    element,
    show: (world, label) => {
      // The heading is chosen once per floor rather than per frame: recomputing it every frame would
      // make the camera twitch as bodies walked through the line it measured.
      world.player.angle = openHeading(world);
      shown = world;
      drawDiagram(diagram, world);
      diagram.setAttribute("aria-label", `${label}, ${world.maze.width} by ${world.maze.height} cells`);

      // Deferred rather than made with the panel, because the renderer stops its own frame loop on the
      // first scene it cannot draw and never restarts it. Made before there was a floor, it would throw
      // on frame one and stay a dead canvas for the rest of the session.
      if (!renderer) {
        renderer = createRenderPanel({
          ariaLabel: "The assembled floor, from where the run arrives",
          // Never cleared once set, so this cannot fail after the panel exists.
          frame: () => ({ world: shown as World }),
        });
        element.append(renderer.element);
      }
    },
  };
}
