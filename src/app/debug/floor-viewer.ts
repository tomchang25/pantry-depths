import {
  createAuthoredFloorMap,
  createCellInspector,
  createFloorButtons,
  createFloorMapLegend,
} from "@/app/debug/floor-map";
import { createDebugPage } from "@/app/debug/debug-shell";
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
  const shell = embedded
    ? undefined
    : createDebugPage({
        title,
        description:
          "Inspect parsed floor data through a layered authoring map, selected-cell metadata, and structural-validation evidence.",
        width: "wide",
      });
  const page = shell?.page ?? document.createElement("section");
  const content = shell?.content ?? page;
  const introduction = document.createElement("section");
  const heading = document.createElement("h3");
  const description = document.createElement("p");
  const floorControlsHeading = document.createElement(embedded ? "h4" : "h2");
  const floorControls = document.createElement("div");
  const validationPanel = document.createElement("section");
  const validationStatus = document.createElement("p");
  const findingsHeading = document.createElement(embedded ? "h4" : "h2");
  const findings = document.createElement("ul");
  const mapPanel = document.createElement("section");
  const floorHeading = document.createElement(embedded ? "h4" : "h2");
  const floorDescription = document.createElement("p");
  const mapLayout = document.createElement("div");
  const mapScroller = document.createElement("div");
  const inspectorMount = document.createElement("div");
  const legendMount = document.createElement("div");
  const solutionPanel = document.createElement("section");
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
  page.classList.add("debug-floor-inspector");
  introduction.className = "debug-panel";
  validationPanel.className = "debug-panel";
  mapPanel.className = "debug-panel debug-panel--accent";
  solutionPanel.className = "debug-panel";
  floorControls.className = "debug-floor-controls-host";
  validationStatus.setAttribute("role", "status");
  mapLayout.className = "debug-map-layout";
  mapScroller.className = "debug-scroller";
  mapScroller.setAttribute("aria-label", "Authored floor map");
  mapScroller.setAttribute("role", "region");
  mapScroller.tabIndex = 0;

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
    validationStatus.dataset.tone = !validation
      ? "info"
      : validation.findings.some((finding) => finding.severity === "error") || !validation.solution
        ? "error"
        : "success";
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

  if (embedded) {
    introduction.append(heading, description);
  }

  introduction.append(floorControlsHeading, floorControls);
  validationPanel.append(findingsHeading, validationStatus, findings);
  mapPanel.append(floorHeading, floorDescription, mapLayout, legendMount);
  solutionPanel.append(solutionHeading, solution);
  mapLayout.append(mapScroller, inspectorMount);
  content.append(introduction, mapPanel, validationPanel, solutionPanel);
  mount.replaceChildren(page);
  render();
}

/** Renders the canonical read-only floor-set inspection surface. */
export function renderFloorViewer(mount: HTMLElement): void {
  renderFloorSetInspector(mount, PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION, "Floor Set Viewer");
}
