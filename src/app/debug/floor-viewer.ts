import { PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION } from "@/content/floor/floor-catalog";
import { getFloorTileDefinition, type FloorEntitySource, type FloorSource } from "@/content/floor/floor-schema";
import type { Cell } from "@/core/grid";

type TilePresentation = Readonly<{
  background: string;
  label: string;
  symbol: string;
}>;

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function entityPresentation(entity: FloorEntitySource): TilePresentation {
  if (entity.kind === "enemy") {
    return { symbol: "☠", label: `Enemy: ${entity.archetypeId}`, background: "#6d1f2e" };
  }

  if (entity.kind === "key") {
    return { symbol: "◆", label: `${entity.color} key`, background: "#22202a" };
  }

  if (entity.kind === "door") {
    return { symbol: "▣", label: `${entity.color} door`, background: "#285f9b" };
  }

  if (entity.kind === "stair") {
    return { symbol: "⇩", label: `Stair to ${entity.destinationFloorId}`, background: "#315a4b" };
  }

  if (entity.kind === "breakableWall") {
    return {
      symbol: `◫${entity.hintFaces.map((face) => ({ north: "↑", east: "→", south: "↓", west: "←" })[face]).join("")}`,
      label: `Breakable wall; hint faces: ${entity.hintFaces.join(", ")}`,
      background: "#6b4d32",
    };
  }

  return { symbol: "≈", label: "Hot spring", background: "#8f4e2d" };
}

function basePresentation(tile: string): TilePresentation {
  const definition = getFloorTileDefinition(tile);

  if (!definition) {
    return { symbol: "?", label: "Unknown tile", background: "#6d1f2e" };
  }

  if (definition.blocksEntry) {
    return { symbol: "▦", label: definition.label, background: "#34313f" };
  }

  return { symbol: "", label: definition.label, background: "#211e2a" };
}

function createGrid(floor: FloorSource, solutionCells: readonly Cell[]): HTMLElement {
  const grid = document.createElement("div");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${floor.id} authored floor grid`);
  grid.style.background = "#15121c";
  grid.style.display = "grid";
  grid.style.gap = "0.2rem";
  grid.style.gridTemplateColumns = `repeat(${floor.tiles[0]?.length ?? 0}, 2.75rem)`;
  grid.style.padding = "0.5rem";
  grid.style.width = "max-content";

  for (let y = 0; y < floor.tiles.length; y += 1) {
    const row = document.createElement("span");
    row.setAttribute("role", "row");
    row.style.display = "contents";

    for (let x = 0; x < (floor.tiles[y]?.length ?? 0); x += 1) {
      const cell = { x, y };
      const entity = floor.entities.find((candidate) => sameCell(candidate.cell, cell));
      const presentation = entity ? entityPresentation(entity) : basePresentation(floor.tiles[y]?.[x] ?? "#");
      const isSolutionCell = solutionCells.some((solutionCell) => sameCell(solutionCell, cell));
      const element = document.createElement("span");
      element.setAttribute("role", "gridcell");
      element.setAttribute(
        "aria-label",
        `${presentation.label} at ${x}, ${y}${isSolutionCell ? "; structural solution" : ""}`,
      );
      element.title = element.getAttribute("aria-label") ?? presentation.label;
      element.textContent = presentation.symbol || (isSolutionCell ? "·" : "");
      element.style.alignItems = "center";
      element.style.aspectRatio = "1";
      element.style.background = presentation.background;
      element.style.border = isSolutionCell ? "2px solid #f5c451" : "1px solid #514b61";
      element.style.borderRadius = "0.35rem";
      element.style.color = "#fff3dc";
      element.style.display = "flex";
      element.style.fontSize = entity?.kind === "breakableWall" ? "0.85rem" : "1.3rem";
      element.style.fontWeight = "700";
      element.style.justifyContent = "center";
      element.style.lineHeight = "1";
      row.append(element);
    }

    grid.append(row);
  }

  return grid;
}

/** Renders a parsed floor set, validation findings, and one computed structural route. */
export function renderFloorSetInspector(
  mount: HTMLElement,
  floorSet: typeof PROVISIONAL_FLOOR_SET,
  validation: typeof PROVISIONAL_FLOOR_VALIDATION,
  title: string,
  embedded = false,
): void {
  const page = document.createElement(embedded ? "section" : "main");
  const heading = document.createElement(embedded ? "h3" : "h1");
  const description = document.createElement("p");
  const selectorLabel = document.createElement("label");
  const selector = document.createElement("select");
  const validationStatus = document.createElement("p");
  const findingsHeading = document.createElement(embedded ? "h4" : "h2");
  const findings = document.createElement("ul");
  const floorHeading = document.createElement(embedded ? "h4" : "h2");
  const floorDescription = document.createElement("p");
  const gridScroller = document.createElement("div");
  const solutionHeading = document.createElement(embedded ? "h4" : "h2");
  const solution = document.createElement("ol");
  let selectedFloorId = floorSet.floors[0]?.id ?? "";

  heading.textContent = title;
  description.textContent =
    "Inspect parsed floor-set data, its structural validation, and one legal route to the goal.";
  selectorLabel.textContent = "Floor: ";
  selectorLabel.htmlFor = embedded ? "floor-workbench-preview-floor" : "floor-viewer-floor";
  selector.id = selectorLabel.htmlFor;
  selectorLabel.append(selector);
  validationStatus.setAttribute("role", "status");
  findingsHeading.textContent = "Topology Findings";
  floorHeading.textContent = "Authored Grid";
  solutionHeading.textContent = "Structural Solution";
  gridScroller.style.maxWidth = "100%";
  gridScroller.style.overflow = "auto";

  for (const floor of floorSet.floors) {
    const option = document.createElement("option");
    option.value = floor.id;
    option.textContent = `${floor.id} — ${floor.theme}`;
    selector.append(option);
  }

  const render = (): void => {
    const floor = floorSet.floors.find((candidate) => candidate.id === selectedFloorId);

    if (!floor) {
      throw new Error(`Unknown selected floor: ${selectedFloorId}`);
    }

    const errors = validation.findings.filter((finding) => finding.severity === "error");
    validationStatus.textContent =
      errors.length === 0 && validation.solution
        ? `Valid topology. One structural solution contains ${validation.solution.length} steps.`
        : `Invalid topology. ${errors.length} error findings prevent a structural solution.`;
    findings.replaceChildren();

    for (const finding of validation.findings) {
      const item = document.createElement("li");
      item.textContent = `${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`;
      findings.append(item);
    }

    if (validation.findings.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No findings.";
      findings.append(item);
    }

    const solutionSteps = (validation.solution ?? []).filter((step) => step.floorId === floor.id);
    floorDescription.textContent = `${floor.id} uses the ${floor.theme} theme. Gold borders mark cells used by this structural solution.`;
    gridScroller.replaceChildren(
      createGrid(
        floor,
        solutionSteps.map((step) => step.cell),
      ),
    );
    solution.replaceChildren();

    for (const step of solutionSteps) {
      const item = document.createElement("li");
      item.textContent = `${step.type} at (${step.cell.x}, ${step.cell.y})${step.entityId ? ` — ${step.entityId}` : ""}`;
      solution.append(item);
    }

    if (solutionSteps.length === 0) {
      const item = document.createElement("li");
      item.textContent = "This floor is not used by the computed structural solution.";
      solution.append(item);
    }
  };

  selector.addEventListener("change", () => {
    selectedFloorId = selector.value;
    render();
  });

  page.append(
    heading,
    description,
    selectorLabel,
    validationStatus,
    findingsHeading,
    findings,
    floorHeading,
    floorDescription,
    gridScroller,
    solutionHeading,
    solution,
  );
  mount.replaceChildren(page);
  render();
}

/** Renders the canonical read-only floor-set inspection surface. */
export function renderFloorViewer(mount: HTMLElement): void {
  renderFloorSetInspector(mount, PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION, "Floor Set Viewer");
}
