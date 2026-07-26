import {
  getFloorTileDefinition,
  type EnvironmentFeatureSource,
  type FloorSource,
  type GameplayEntitySource,
} from "@/content/floor/floor-schema";
import type { Cell, Facing } from "@/core/grid";

type CellPresentation = Readonly<{
  background: string;
  color: string;
  label: string;
  symbol: string;
}>;

export type EnvironmentBadge = Readonly<{
  label: string;
  symbol: string;
}>;

export type AuthoredFloorCell = Readonly<{
  cell: Cell;
  environmentBadges: readonly EnvironmentBadge[];
  environmentFeatures: readonly EnvironmentFeatureSource[];
  gameplayEntity: GameplayEntitySource | undefined;
  isSolutionCell: boolean;
  primary: CellPresentation;
  terrain: CellPresentation;
}>;

export type AuthoredFloorMapOptions = Readonly<{
  ariaLabel: string;
  floor: FloorSource;
  onSelect?: (cell: Cell) => void;
  selectedCell?: Cell;
  solutionCells?: readonly Cell[];
}>;

const FACING_SYMBOLS: Readonly<Record<Facing, string>> = {
  north: "↑",
  east: "→",
  south: "↓",
  west: "←",
};

const ENVIRONMENT_BADGES: Readonly<Record<EnvironmentFeatureSource["kind"], EnvironmentBadge>> = {
  tileDecoration: { symbol: "✦", label: "Tile decoration" },
  wallDecoration: { symbol: "↟", label: "Wall-face decoration" },
  ambientLight: { symbol: "☼", label: "Ambient light" },
  effectEmitter: { symbol: "≈", label: "Effect emitter" },
};

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function terrainPresentation(tile: string): CellPresentation {
  const definition = getFloorTileDefinition(tile);

  if (!definition) {
    return { symbol: "?", label: "Unknown terrain", background: "#6d1f2e", color: "#fff0f2" };
  }

  if (!definition.blocksEntry) {
    return { symbol: "", label: definition.label, background: "#211e2a", color: "#8e879f" };
  }

  if (tile === "=") {
    return { symbol: "▤", label: definition.label, background: "#4a3d47", color: "#eee4ef" };
  }

  if (tile === "+") {
    return { symbol: "╫", label: definition.label, background: "#374252", color: "#e3f0ff" };
  }

  return { symbol: "▦", label: definition.label, background: "#34313f", color: "#d7d2e5" };
}

function gameplayPresentation(entity: GameplayEntitySource): CellPresentation {
  if (entity.kind === "enemy") {
    return { symbol: "☠", label: `Enemy: ${entity.archetypeId}`, background: "#6d1f2e", color: "#fff0f2" };
  }

  if (entity.kind === "key") {
    return { symbol: "◆", label: `${entity.color} key`, background: "#22202a", color: "#f5d761" };
  }

  if (entity.kind === "door") {
    const background = entity.color === "red" ? "#8b2836" : entity.color === "blue" ? "#285f9b" : "#92752c";
    return { symbol: "▣", label: `${entity.color} door`, background, color: "#ffffff" };
  }

  if (entity.kind === "stair") {
    return { symbol: "⇩", label: `Stair to ${entity.destinationFloorId}`, background: "#315a4b", color: "#e8fff6" };
  }

  if (entity.kind === "breakableWall") {
    return {
      symbol: "◫",
      label: `Breakable wall; hint faces: ${entity.hintFaces.join(", ")}`,
      background: "#6b4d32",
      color: "#fff3dc",
    };
  }

  return { symbol: "≈", label: "Hot spring", background: "#8f4e2d", color: "#fff2df" };
}

function environmentFeaturesAt(floor: FloorSource, cell: Cell): readonly EnvironmentFeatureSource[] {
  return floor.environmentFeatures.filter((feature) =>
    feature.kind === "wallDecoration" ? sameCell(feature.wallCell, cell) : sameCell(feature.cell, cell),
  );
}

function environmentBadges(features: readonly EnvironmentFeatureSource[]): readonly EnvironmentBadge[] {
  const kinds = new Set<EnvironmentFeatureSource["kind"]>();

  for (const feature of features) {
    kinds.add(feature.kind);
  }

  return [...kinds].map((kind) => ENVIRONMENT_BADGES[kind]);
}

/** Projects one authored cell without creating DOM state, so viewers and tests share its layered meaning. */
export function projectAuthoredFloorCell(
  floor: FloorSource,
  cell: Cell,
  solutionCells: readonly Cell[] = [],
): AuthoredFloorCell {
  const tile = floor.tiles[cell.y]?.[cell.x] ?? "#";
  const terrain = terrainPresentation(tile);
  const gameplayEntity = floor.gameplayEntities.find((entity) => sameCell(entity.cell, cell));
  const features = environmentFeaturesAt(floor, cell);

  return {
    cell,
    terrain,
    gameplayEntity,
    environmentFeatures: features,
    environmentBadges: environmentBadges(features),
    primary: gameplayEntity ? gameplayPresentation(gameplayEntity) : terrain,
    isSolutionCell: solutionCells.some((solutionCell) => sameCell(solutionCell, cell)),
  };
}

function selectedFaceSymbols(projection: AuthoredFloorCell): string {
  const faces = new Set<Facing>();

  if (projection.gameplayEntity?.kind === "breakableWall") {
    for (const face of projection.gameplayEntity.hintFaces) {
      faces.add(face);
    }
  }

  for (const feature of projection.environmentFeatures) {
    if (feature.kind === "wallDecoration") {
      faces.add(feature.face);
    }
  }

  return [...faces].map((face) => FACING_SYMBOLS[face]).join("");
}

function authoredCellLabel(projection: AuthoredFloorCell, selected: boolean): string {
  const labels = [projection.terrain.label];

  if (projection.gameplayEntity) {
    labels.push(projection.primary.label);
  }

  for (const feature of projection.environmentFeatures) {
    labels.push(describeEnvironmentFeature(feature));
  }

  if (projection.isSolutionCell) {
    labels.push("structural solution");
  }

  if (selected) {
    labels.push("selected");
  }

  return `${labels.join("; ")} at ${projection.cell.x}, ${projection.cell.y}`;
}

/** Creates the keyboard-selectable, layered map used by floor-inspection surfaces. */
export function createAuthoredFloorMap(options: AuthoredFloorMapOptions): HTMLElement {
  const grid = document.createElement("div");
  const width = options.floor.tiles[0]?.length ?? 0;
  const solutionCells = options.solutionCells ?? [];

  grid.setAttribute("aria-label", options.ariaLabel);
  grid.className = "debug-map-grid";
  grid.style.gridTemplateColumns = `repeat(${width}, 2.75rem)`;

  for (let y = 0; y < options.floor.tiles.length; y += 1) {
    const row = options.floor.tiles[y] ?? "";

    for (let x = 0; x < row.length; x += 1) {
      const cell = { x, y };
      const projection = projectAuthoredFloorCell(options.floor, cell, solutionCells);
      const selected = options.selectedCell !== undefined && sameCell(options.selectedCell, cell);
      const button = document.createElement("button");
      const symbol = document.createElement("span");
      const badges = document.createElement("span");
      const faceSymbols = selectedFaceSymbols(projection);

      button.type = "button";
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", authoredCellLabel(projection, selected));
      button.className = [
        "debug-map-cell",
        selected ? "debug-map-cell--selected" : "",
        projection.isSolutionCell ? "debug-map-cell--solution" : "",
        projection.gameplayEntity?.kind === "breakableWall" ? "debug-map-cell--breakable" : "",
      ]
        .filter(Boolean)
        .join(" ");
      button.title = button.getAttribute("aria-label") ?? "Authored floor cell";
      button.style.background = projection.primary.background;
      button.style.color = projection.primary.color;
      button.addEventListener("click", () => options.onSelect?.(cell));

      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = projection.primary.symbol || (projection.isSolutionCell ? "·" : "");
      badges.setAttribute("aria-hidden", "true");
      badges.className = "debug-map-cell__badges";
      badges.textContent = projection.environmentBadges.map((badge) => badge.symbol).join("");
      button.append(symbol, badges);

      if (faceSymbols) {
        const faces = document.createElement("span");
        faces.setAttribute("aria-hidden", "true");
        faces.className = "debug-map-cell__faces";
        faces.textContent = faceSymbols;
        button.append(faces);
      }

      grid.append(button);
    }
  }

  return grid;
}

function detailList(entries: readonly Readonly<{ term: string; value: string }>[]): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "debug-detail-list";

  for (const entry of entries) {
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = entry.term;
    value.textContent = entry.value;
    list.append(term, value);
  }

  return list;
}

function describeGameplayEntity(entity: GameplayEntitySource): readonly Readonly<{ term: string; value: string }>[] {
  const common = [
    { term: "Kind", value: entity.kind },
    { term: "ID", value: entity.id },
  ];

  if (entity.kind === "enemy") {
    return [...common, { term: "Archetype", value: entity.archetypeId }];
  }

  if (entity.kind === "key") {
    return [...common, { term: "Color", value: entity.color }];
  }

  if (entity.kind === "door") {
    return [
      ...common,
      { term: "Color", value: entity.color },
      { term: "Upgrade effect", value: entity.upgradeEffectId ?? "None" },
    ];
  }

  if (entity.kind === "stair") {
    return [
      ...common,
      {
        term: "Destination",
        value: `${entity.destinationFloorId} (${entity.destinationCell.x}, ${entity.destinationCell.y})`,
      },
      { term: "Destination facing", value: entity.destinationFacing },
    ];
  }

  if (entity.kind === "breakableWall") {
    return [
      ...common,
      { term: "Health", value: String(entity.health) },
      { term: "Defense", value: String(entity.defense) },
      { term: "Hint faces", value: entity.hintFaces.join(", ") },
    ];
  }

  return common;
}

function describeEnvironmentFeature(feature: EnvironmentFeatureSource): string {
  if (feature.kind === "tileDecoration") {
    return `Tile decoration: ${feature.decorationPresetId}`;
  }

  if (feature.kind === "wallDecoration") {
    const extras = [
      feature.lightPresetId ? `light ${feature.lightPresetId}` : undefined,
      feature.effectPresetId ? `effect ${feature.effectPresetId}` : undefined,
    ]
      .filter((value): value is string => value !== undefined)
      .join(", ");
    return `Wall decoration: ${feature.decorationPresetId} on ${feature.face} face${extras ? `; ${extras}` : ""}`;
  }

  if (feature.kind === "ambientLight") {
    return `Ambient light: ${feature.lightPresetId}`;
  }

  return `Effect emitter: ${feature.effectPresetId}`;
}

/** Creates the read-only selected-cell inspector used before editing children add mutation controls. */
export function createCellInspector(floor: FloorSource, selectedCell: Cell | undefined): HTMLElement {
  const inspector = document.createElement("aside");
  const heading = document.createElement("h3");

  heading.textContent = "Cell Inspector";
  inspector.setAttribute("aria-label", "Selected authored floor cell");
  inspector.className = "debug-cell-inspector";
  inspector.append(heading);

  if (!selectedCell) {
    const instruction = document.createElement("p");
    instruction.textContent = "Select a map cell to inspect its terrain, gameplay entity, and environment metadata.";
    inspector.append(instruction);
    return inspector;
  }

  const projection = projectAuthoredFloorCell(floor, selectedCell);
  const terrainHeading = document.createElement("h4");
  const gameplayHeading = document.createElement("h4");
  const environmentHeading = document.createElement("h4");
  terrainHeading.textContent = "Cell";
  gameplayHeading.textContent = "Gameplay Entity";
  environmentHeading.textContent = "Environment Features";
  inspector.append(
    terrainHeading,
    detailList([
      { term: "Coordinates", value: `${selectedCell.x}, ${selectedCell.y}` },
      { term: "Terrain", value: projection.terrain.label },
    ]),
    gameplayHeading,
  );

  if (projection.gameplayEntity) {
    inspector.append(detailList(describeGameplayEntity(projection.gameplayEntity)));
  } else {
    const emptyEntity = document.createElement("p");
    emptyEntity.textContent = "No gameplay entity occupies this cell.";
    inspector.append(emptyEntity);
  }

  inspector.append(environmentHeading);

  if (projection.environmentFeatures.length === 0) {
    const emptyFeatures = document.createElement("p");
    emptyFeatures.textContent = "No environment features anchor to this cell.";
    inspector.append(emptyFeatures);
    return inspector;
  }

  const features = document.createElement("ul");

  for (const feature of projection.environmentFeatures) {
    const item = document.createElement("li");
    item.textContent = `${feature.id} — ${describeEnvironmentFeature(feature)}`;
    features.append(item);
  }

  inspector.append(features);
  return inspector;
}

/** Creates numbered floor controls so every floor count and target remains visible. */
export function createFloorButtons(
  floors: readonly FloorSource[],
  selectedFloorId: string,
  onSelect: (floorId: string) => void,
): HTMLElement {
  const controls = document.createElement("div");
  controls.setAttribute("aria-label", "Floor selection");
  controls.className = "debug-floor-controls";

  for (const [index, floor] of floors.entries()) {
    const button = document.createElement("button");
    const selected = floor.id === selectedFloorId;
    button.type = "button";
    button.textContent = String(index + 1);
    button.title = `${floor.id} — ${floor.theme}`;
    button.setAttribute("aria-label", `Floor ${index + 1}: ${floor.id}, ${floor.theme}`);
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => onSelect(floor.id));
    controls.append(button);
  }

  return controls;
}

/** Creates a written legend for the complete authored-map overview vocabulary. */
export function createFloorMapLegend(): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const entries = document.createElement("ul");
  const legendEntries = [
    "▦ Stone wall · ▤ Old-brick wall · ╫ Iron-bar wall · blank Passable floor",
    "☠ Enemy · ◆ Key · ▣ Door · ⇩ Stair · ◫ Breakable wall · ≈ Hot spring",
    "✦ Tile decoration · ↟ Wall-face decoration · ☼ Ambient light · ≈ Effect emitter",
    "Gold border Structural solution · White border Selected cell · Selected face arrows Authored hints or wall anchors",
  ];
  section.className = "debug-map-legend";
  heading.textContent = "Map Legend";

  for (const entry of legendEntries) {
    const item = document.createElement("li");
    item.textContent = entry;
    entries.append(item);
  }

  section.append(heading, entries);
  return section;
}
