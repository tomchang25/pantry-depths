import type { Facing } from "@/core/grid";
import type { MinimapCellView, MinimapView } from "@/ui/hud-view";

/**
 * Offsets from east, not from north: the marker glyph already points east at rest. North is up
 * because the grid's north step is `y - 1` and the map draws row zero at the top.
 */
const FACING_ROTATIONS: Readonly<Record<Facing, number>> = {
  east: 0,
  south: 90,
  west: 180,
  north: 270,
};

/** Shape as well as color, so a cell stays readable when color is unavailable. */
const CONTENT_GLYPHS: Readonly<Record<MinimapCellView["content"], string>> = {
  empty: "",
  enemy: "✕",
  key: "✦",
  door: "▤",
  stair: "▼",
  exit: "◎",
};

export type MountedMinimap = Readonly<{
  element: HTMLElement;
  update: (view: MinimapView) => void;
}>;

/**
 * Rebuilds the grid only when the floor's dimensions change, because moving between floors is the
 * only thing that alters the cell count; every other update rewrites the existing cells in place.
 */
export function createFloorMinimap(): MountedMinimap {
  const element = document.createElement("div");
  element.className = "hud-minimap";
  element.setAttribute("role", "img");
  const grid = document.createElement("div");
  grid.className = "hud-minimap__grid";
  element.append(grid);
  let cells: HTMLElement[] = [];
  let builtWidth = 0;
  let builtHeight = 0;

  const rebuild = (view: MinimapView): void => {
    grid.style.setProperty("--hud-minimap-columns", String(view.width));
    grid.replaceChildren();
    cells = view.cells.map(() => {
      const cell = document.createElement("span");
      cell.className = "hud-minimap__cell";
      grid.append(cell);
      return cell;
    });
    builtWidth = view.width;
    builtHeight = view.height;
  };

  const update = (view: MinimapView): void => {
    if (view.width !== builtWidth || view.height !== builtHeight) {
      rebuild(view);
    }

    view.cells.forEach((cell, index) => {
      const node = cells[index];

      if (!node) {
        return;
      }

      node.className = [
        "hud-minimap__cell",
        cell.solid ? "hud-minimap__cell--solid" : "hud-minimap__cell--open",
        cell.content === "empty" ? "" : `hud-minimap__cell--${cell.content}`,
        cell.player ? "hud-minimap__cell--player" : "",
      ]
        .filter(Boolean)
        .join(" ");
      node.textContent = cell.player ? "➤" : CONTENT_GLYPHS[cell.content];
      node.style.setProperty("--hud-minimap-rotation", cell.player ? `${FACING_ROTATIONS[view.facing]}deg` : "0deg");
    });

    const marked = view.cells.filter((cell) => cell.content !== "empty").length;
    element.setAttribute(
      "aria-label",
      `Floor map, ${view.width} by ${view.height}. You are facing ${view.facing}. ${marked} points of interest marked.`,
    );
  };

  return { element, update };
}
