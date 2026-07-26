import {
  createAuthoredFloorMap,
  createCellInspector,
  createFloorButtons,
  createFloorMapLegend,
} from "@/app/debug/floor-map";
import { PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION } from "@/content/floor/floor-catalog";
import type { FloorSetSource } from "@/content/floor/floor-schema";
import type { FloorValidationResult } from "@/content/floor/floor-validation";
import type { Cell } from "@/core/grid";

export type FloorInspectorSelection = Readonly<{
  cell?: Cell;
  floorId: string;
}>;

export type FloorSetInspectorOptions = Readonly<{
  embedded?: boolean;
  onSelectionChange?: (selection: FloorInspectorSelection) => void;
  selection?: FloorInspectorSelection;
}>;

function validationStatusText(validation: FloorValidationResult | undefined): string {
  if (!validation) {
    return "Draft map is schema-valid but has not been structurally validated.";
  }

  const errors = validation.findings.filter((finding) => finding.severity === "error");

  if (errors.length === 0 && validation.solution) {
    return `Valid topology. One structural solution contains ${validation.solution.length} steps.`;
  }

  return `Invalid topology. ${errors.length} error findings prevent a structural solution.`;
}

/** Renders a parsed floor set, optional validation evidence, and a selected-cell authoring inspector. */
export function renderFloorSetInspector(
  mount: HTMLElement,
  floorSet: FloorSetSource,
  validation: FloorValidationResult | undefined,
  title: string,
  options: FloorSetInspectorOptions = {},
): void {
  const embedded = options.embedded ?? false;
  const page = document.createElement(embedded ? "section" : "main");
  const heading = document.createElement(embedded ? "h3" : "h1");
  const description = document.createElement("p");
  const floorControlsHeading = document.createElement(embedded ? "h4" : "h2");
  const floorControls = document.createElement("div");
  const validationStatus = document.createElement("p");
  const findingsHeading = document.createElement(embedded ? "h4" : "h2");
  const findings = document.createElement("ul");
  const floorHeading = document.createElement(embedded ? "h4" : "h2");
  const floorDescription = document.createElement("p");
  const mapLayout = document.createElement("div");
  const mapScroller = document.createElement("div");
  const inspectorMount = document.createElement("div");
  const legendMount = document.createElement("div");
  const solutionHeading = document.createElement(embedded ? "h4" : "h2");
  const solution = document.createElement("ol");
  let selectedFloorId = floorSet.floors.some((floor) => floor.id === options.selection?.floorId)
    ? (options.selection?.floorId ?? "")
    : (floorSet.floors[0]?.id ?? "");
  let selectedCell = options.selection?.cell;

  heading.textContent = title;
  description.textContent =
    "Inspect parsed floor data through a layered authoring map, selected-cell metadata, and optional structural-validation evidence.";
  floorControlsHeading.textContent = "Floors";
  findingsHeading.textContent = "Topology Findings";
  floorHeading.textContent = "Authored Map";
  solutionHeading.textContent = "Structural Solution";
  validationStatus.setAttribute("role", "status");
  mapLayout.style.display = "flex";
  mapLayout.style.flexWrap = "wrap";
  mapLayout.style.gap = "1rem";
  mapLayout.style.alignItems = "flex-start";
  mapScroller.style.flex = "1 1 30rem";
  mapScroller.style.maxWidth = "100%";
  mapScroller.style.overflow = "auto";
  inspectorMount.style.flex = "1 1 18rem";
  inspectorMount.style.maxWidth = "100%";

  const publishSelection = (): void => {
    options.onSelectionChange?.({
      floorId: selectedFloorId,
      ...(selectedCell ? { cell: selectedCell } : {}),
    });
  };

  const render = (): void => {
    const floor = floorSet.floors.find((candidate) => candidate.id === selectedFloorId);

    if (!floor) {
      throw new Error(`Unknown selected floor: ${selectedFloorId}`);
    }

    floorControls.replaceChildren(
      createFloorButtons(floorSet.floors, selectedFloorId, (floorId) => {
        selectedFloorId = floorId;
        selectedCell = undefined;
        publishSelection();
        render();
      }),
    );
    validationStatus.textContent = validationStatusText(validation);
    findings.replaceChildren();

    if (!validation) {
      const item = document.createElement("li");
      item.textContent = "No structural validation has run for this draft.";
      findings.append(item);
    } else if (validation.findings.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No findings.";
      findings.append(item);
    } else {
      for (const finding of validation.findings) {
        const item = document.createElement("li");
        item.textContent = `${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`;
        findings.append(item);
      }
    }

    const cellIsInsideFloor =
      selectedCell !== undefined &&
      selectedCell.x >= 0 &&
      selectedCell.y >= 0 &&
      selectedCell.y < floor.tiles.length &&
      selectedCell.x < (floor.tiles[selectedCell.y]?.length ?? 0);

    if (!cellIsInsideFloor && selectedCell !== undefined) {
      selectedCell = undefined;
      publishSelection();
    }

    const solutionSteps = (validation?.solution ?? []).filter((step) => step.floorId === floor.id);
    floorDescription.textContent = `${floor.id} uses the ${floor.theme} theme. Gold borders mark cells used by the current structural solution; select a cell to inspect every authored layer.`;
    mapScroller.replaceChildren(
      createAuthoredFloorMap({
        ariaLabel: `${floor.id} authored floor map`,
        floor,
        solutionCells: solutionSteps.map((step) => step.cell),
        onSelect: (cell) => {
          selectedCell = cell;
          publishSelection();
          render();
        },
        ...(selectedCell ? { selectedCell } : {}),
      }),
    );
    inspectorMount.replaceChildren(createCellInspector(floor, selectedCell));
    legendMount.replaceChildren(createFloorMapLegend());
    solution.replaceChildren();

    for (const step of solutionSteps) {
      const item = document.createElement("li");
      item.textContent = `${step.type} at (${step.cell.x}, ${step.cell.y})${step.entityId ? ` — ${step.entityId}` : ""}`;
      solution.append(item);
    }

    if (solutionSteps.length === 0) {
      const item = document.createElement("li");
      item.textContent = validation
        ? "This floor is not used by the computed structural solution."
        : "Validate this draft to compute a structural solution.";
      solution.append(item);
    }
  };

  page.append(
    heading,
    description,
    floorControlsHeading,
    floorControls,
    validationStatus,
    findingsHeading,
    findings,
    floorHeading,
    floorDescription,
    mapLayout,
    legendMount,
    solutionHeading,
    solution,
  );
  mapLayout.append(mapScroller, inspectorMount);
  mount.replaceChildren(page);
  render();
}

/** Renders the canonical read-only floor-set inspection surface. */
export function renderFloorViewer(mount: HTMLElement): void {
  renderFloorSetInspector(mount, PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION, "Floor Set Viewer");
}
