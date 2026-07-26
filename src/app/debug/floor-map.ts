import {
  getFloorTileDefinition,
  type EnvironmentFeatureSource,
  type FloorSetSource,
  type FloorSource,
  type FloorTile,
  type GameplayEntitySource,
} from "@/content/floor/floor-schema";
import type { Cell, Facing } from "@/core/grid";
import { ENEMY_ARCHETYPES } from "@/content/combat/enemies";
import { PLAYER_UPGRADES } from "@/content/combat/player-stages";

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

export type AuthoredKeyCounts = Readonly<{
  blue: number;
  red: number;
  yellow: number;
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
  interaction?: AuthoredFloorMapInteraction;
  onSelect?: (cell: Cell) => void;
  selectedCell?: Cell;
  solutionCells?: readonly Cell[];
}>;

export type AuthoredMapTool = "select" | FloorTile;

export type AuthoredFloorMapInteraction = Readonly<{
  movingEntityId?: string;
  onMoveEntity?: (floorId: string, entityId: string, cell: Cell) => void;
  onPaintEnd?: () => void;
  onPaintStart?: () => void;
  onPaintTerrain?: (floorId: string, cell: Cell, tile: FloorTile) => void;
  tool: AuthoredMapTool;
}>;

export type CellEditorOptions = Readonly<{
  floor: FloorSource;
  floorSet: FloorSetSource;
  movingEntityId?: string;
  onAddEntity: (kind: GameplayEntitySource["kind"]) => void;
  onBeginMove: (entityId: string) => void;
  onPaintTerrain: (tile: FloorTile) => void;
  onRemoveEntity: (entityId: string) => void;
  onResize: (width: number, height: number) => void;
  onToolChange: (tool: AuthoredMapTool) => void;
  onUpdateEntity: (originalId: string, entity: GameplayEntitySource) => void;
  selectedCell: Cell | undefined;
  tool: AuthoredMapTool;
}>;

const FACING_SYMBOLS: Readonly<Record<Facing, string>> = {
  north: "↑",
  east: "→",
  south: "↓",
  west: "←",
};

const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];

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
    const color = entity.color === "red" ? "#ff6678" : entity.color === "blue" ? "#69adff" : "#f5d761";
    return { symbol: "⚿", label: `${entity.color} key`, background: "#22202a", color };
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

/** Counts authored key entities by the three gameplay colors on one floor. */
export function countAuthoredKeys(floor: FloorSource): AuthoredKeyCounts {
  const counts = { red: 0, blue: 0, yellow: 0 };

  for (const entity of floor.gameplayEntities) {
    if (entity.kind === "key") {
      counts[entity.color] += 1;
    }
  }

  return counts;
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
  let pointerEntityId: string | undefined;
  let pointerPainting = false;
  let suppressPointerClick = false;

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
      button.addEventListener("pointerdown", () => {
        if (!options.interaction) {
          return;
        }

        if (options.interaction.tool !== "select") {
          pointerPainting = true;
          suppressPointerClick = true;
          options.interaction.onPaintStart?.();
          options.interaction.onPaintTerrain?.(options.floor.id, cell, options.interaction.tool);
          return;
        }

        pointerEntityId = projection.gameplayEntity?.id;
      });
      button.addEventListener("pointerenter", () => {
        if (!options.interaction) {
          return;
        }

        if (pointerPainting && options.interaction.tool !== "select") {
          suppressPointerClick = true;
          options.interaction.onPaintTerrain?.(options.floor.id, cell, options.interaction.tool);
          return;
        }

        if (pointerEntityId && !sameCell(projection.cell, cell)) {
          suppressPointerClick = true;
          options.interaction.onMoveEntity?.(options.floor.id, pointerEntityId, cell);
          pointerEntityId = undefined;
        }
      });
      button.addEventListener("pointerup", () => {
        pointerEntityId = undefined;
        if (pointerPainting) {
          options.interaction?.onPaintEnd?.();
        }
        pointerPainting = false;
      });
      button.addEventListener("pointercancel", () => {
        pointerEntityId = undefined;
        if (pointerPainting) {
          options.interaction?.onPaintEnd?.();
        }
        pointerPainting = false;
      });
      button.addEventListener("click", () => {
        if (suppressPointerClick) {
          suppressPointerClick = false;
          return;
        }

        if (options.interaction?.movingEntityId) {
          options.interaction.onMoveEntity?.(options.floor.id, options.interaction.movingEntityId, cell);
          return;
        }

        if (options.interaction && options.interaction.tool !== "select") {
          options.interaction.onPaintTerrain?.(options.floor.id, cell, options.interaction.tool);
          return;
        }

        options.onSelect?.(cell);
      });

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

  grid.addEventListener("pointerleave", () => {
    pointerEntityId = undefined;

    if (pointerPainting) {
      options.interaction?.onPaintEnd?.();
    }

    pointerPainting = false;
  });

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

function createEditorField(label: string, input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const field = document.createElement("label");
  field.className = "debug-field";
  field.textContent = label;
  field.append(input);
  return field;
}

function createTextInput(value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  return input;
}

function createNumberInput(value: number, min: number): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.step = "1";
  input.value = String(value);
  return input;
}

function createSelect<Value extends string>(
  options: readonly Readonly<{ label: string; value: Value }>[],
  value: Value,
): HTMLSelectElement {
  const select = document.createElement("select");

  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue.value;
    option.textContent = optionValue.label;
    option.selected = optionValue.value === value;
    select.append(option);
  }

  return select;
}

function checkedFaces(form: HTMLFormElement): readonly Facing[] {
  return FACINGS.filter((face) => form.querySelector<HTMLInputElement>(`input[name="hint-${face}"]`)?.checked);
}

function createEntityForm(
  floorSet: FloorSetSource,
  entity: GameplayEntitySource,
  onUpdate: (originalId: string, entity: GameplayEntitySource) => void,
): HTMLFormElement {
  const form = document.createElement("form");
  const fields = document.createElement("div");
  const idInput = createTextInput(entity.id);
  const save = document.createElement("button");

  fields.className = "debug-form-grid";
  save.type = "submit";
  save.textContent = "Apply Entity Changes";
  fields.append(createEditorField("ID", idInput));

  if (entity.kind === "enemy") {
    const archetype = createSelect(
      ENEMY_ARCHETYPES.map((candidate) => ({ label: candidate.name, value: candidate.id })),
      entity.archetypeId as (typeof ENEMY_ARCHETYPES)[number]["id"],
    );
    fields.append(createEditorField("Archetype", archetype));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onUpdate(entity.id, { ...entity, id: idInput.value, archetypeId: archetype.value });
    });
  } else if (entity.kind === "key") {
    const color = createSelect(
      [
        { label: "Red", value: "red" },
        { label: "Blue", value: "blue" },
        { label: "Yellow", value: "yellow" },
      ] as const,
      entity.color,
    );
    fields.append(createEditorField("Color", color));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onUpdate(entity.id, { ...entity, id: idInput.value, color: color.value as typeof entity.color });
    });
  } else if (entity.kind === "door") {
    const color = createSelect(
      [
        { label: "Red", value: "red" },
        { label: "Blue", value: "blue" },
        { label: "Yellow", value: "yellow" },
      ] as const,
      entity.color,
    );
    const upgrade = createSelect(
      [
        { label: "No upgrade", value: "" },
        ...PLAYER_UPGRADES.map((candidate) => ({ label: candidate.label, value: candidate.id })),
      ],
      entity.upgradeEffectId ?? "",
    );
    fields.append(createEditorField("Color", color), createEditorField("Upgrade effect", upgrade));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { upgradeEffectId: _ignoredUpgradeEffectId, ...door } = entity;
      onUpdate(entity.id, {
        ...door,
        id: idInput.value,
        color: color.value as typeof entity.color,
        ...(upgrade.value ? { upgradeEffectId: upgrade.value } : {}),
      });
    });
  } else if (entity.kind === "stair") {
    const destinationFloor = createSelect(
      floorSet.floors.map((floor) => ({ label: `${floor.id} — ${floor.theme}`, value: floor.id })),
      entity.destinationFloorId,
    );
    const destinationStair = document.createElement("select");
    const destinationHelp = document.createElement("p");
    const facing = createSelect(
      FACINGS.map((face) => ({ label: face, value: face })),
      entity.destinationFacing,
    );
    const updateDestinationStairs = (): boolean => {
      const floor = floorSet.floors.find((candidate) => candidate.id === destinationFloor.value);
      const stairs = floor?.gameplayEntities.filter(
        (candidate): candidate is Extract<GameplayEntitySource, { kind: "stair" }> =>
          candidate.kind === "stair" && candidate.id !== entity.id,
      );
      const currentStair = stairs?.find(
        (candidate) => candidate.cell.x === entity.destinationCell.x && candidate.cell.y === entity.destinationCell.y,
      );

      destinationStair.replaceChildren();

      if (!stairs || stairs.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No other stair on this floor";
        destinationStair.append(option);
        destinationStair.disabled = true;
        return false;
      }

      for (const stair of stairs) {
        const option = document.createElement("option");
        option.value = stair.id;
        option.textContent = stair.id;
        option.selected = stair.id === (currentStair ?? stairs[0])?.id;
        destinationStair.append(option);
      }

      destinationStair.disabled = false;
      return true;
    };
    const hasDestinationStair = updateDestinationStairs();

    destinationFloor.addEventListener("change", () => {
      save.disabled = !updateDestinationStairs();
    });
    destinationHelp.className = "debug-muted";
    destinationHelp.textContent = "Choose an existing stair ID; its destination cell is filled automatically.";
    fields.append(
      createEditorField("Destination floor", destinationFloor),
      createEditorField("Destination stair", destinationStair),
      createEditorField("Arrive facing", facing),
      destinationHelp,
    );
    save.disabled = !hasDestinationStair;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const floor = floorSet.floors.find((candidate) => candidate.id === destinationFloor.value);
      const destination = floor?.gameplayEntities.find(
        (candidate): candidate is Extract<GameplayEntitySource, { kind: "stair" }> =>
          candidate.kind === "stair" && candidate.id === destinationStair.value,
      );

      if (!destination) {
        return;
      }

      onUpdate(entity.id, {
        ...entity,
        id: idInput.value,
        destinationFloorId: destinationFloor.value,
        destinationCell: destination.cell,
        destinationFacing: facing.value as Facing,
      });
    });
  } else if (entity.kind === "breakableWall") {
    const health = createNumberInput(entity.health, 1);
    const defense = createNumberInput(entity.defense, 0);
    const faceFields = document.createElement("div");
    faceFields.className = "debug-checkbox-row";
    faceFields.setAttribute("aria-label", "Breakable-wall hint faces");

    for (const face of FACINGS) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = `hint-${face}`;
      checkbox.checked = entity.hintFaces.includes(face);
      label.append(checkbox, ` ${face}`);
      faceFields.append(label);
    }

    fields.append(createEditorField("Health", health), createEditorField("Defense", defense), faceFields);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onUpdate(entity.id, {
        ...entity,
        id: idInput.value,
        health: Number(health.value),
        defense: Number(defense.value),
        hintFaces: checkedFaces(form),
      });
    });
  } else {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onUpdate(entity.id, { ...entity, id: idInput.value });
    });
  }

  form.append(fields, save);
  return form;
}

/** Creates the Workbench-only Cell Editor; callers retain canonical draft mutation ownership. */
export function createCellEditor(options: CellEditorOptions): HTMLElement {
  const editor = document.createElement("aside");
  const heading = document.createElement("h3");
  const sizeHeading = document.createElement("h4");
  const sizeFields = document.createElement("div");
  const width = createNumberInput(options.floor.tiles[0]?.length ?? 1, 1);
  const height = createNumberInput(options.floor.tiles.length, 1);
  const resize = document.createElement("button");
  const toolHeading = document.createElement("h4");
  const tool = createSelect(
    [
      { label: "Select / Move Entity", value: "select" },
      { label: "Paint Passable Floor", value: "." },
      { label: "Paint Stone Wall", value: "#" },
      { label: "Paint Old-brick Wall", value: "=" },
      { label: "Paint Iron-bar Wall", value: "+" },
    ] as const,
    options.tool,
  );

  heading.textContent = "Cell Editor";
  sizeHeading.textContent = "Floor Size";
  toolHeading.textContent = "Map Tool";
  editor.className = "debug-cell-inspector";
  editor.setAttribute("aria-label", "Selected authored floor cell editor");
  sizeFields.className = "debug-form-grid";
  resize.type = "button";
  resize.textContent = "Apply Resize";
  resize.addEventListener("click", () => options.onResize(Number(width.value), Number(height.value)));
  tool.addEventListener("change", () => options.onToolChange(tool.value as AuthoredMapTool));
  sizeFields.append(createEditorField("Width", width), createEditorField("Height", height), resize);
  editor.append(heading, sizeHeading, sizeFields, toolHeading, createEditorField("Active tool", tool));

  if (!options.selectedCell) {
    const instruction = document.createElement("p");
    instruction.textContent = "Select a map cell to edit terrain or gameplay content.";
    editor.append(instruction);
    return editor;
  }

  const projection = projectAuthoredFloorCell(options.floor, options.selectedCell);
  const cellHeading = document.createElement("h4");
  const terrain = createSelect(
    [
      { label: "Passable floor", value: "." },
      { label: "Stone wall", value: "#" },
      { label: "Old-brick wall", value: "=" },
      { label: "Iron-bar wall", value: "+" },
    ] as const,
    options.floor.tiles[options.selectedCell.y]?.[options.selectedCell.x] as FloorTile,
  );
  cellHeading.textContent = "Cell";
  terrain.addEventListener("change", () => {
    const tile = terrain.value as FloorTile;
    options.onToolChange(tile);
    options.onPaintTerrain(tile);
  });
  editor.append(
    cellHeading,
    detailList([
      { term: "Coordinates", value: `${options.selectedCell.x}, ${options.selectedCell.y}` },
      { term: "Terrain", value: projection.terrain.label },
    ]),
    createEditorField("Base terrain", terrain),
  );

  const gameplayHeading = document.createElement("h4");
  gameplayHeading.textContent = "Gameplay Entity";
  editor.append(gameplayHeading);

  if (projection.gameplayEntity) {
    const actions = document.createElement("div");
    const move = document.createElement("button");
    const remove = document.createElement("button");
    actions.className = "debug-button-row";
    move.type = "button";
    move.textContent = options.movingEntityId === projection.gameplayEntity.id ? "Choose Move Target" : "Move Entity";
    move.addEventListener("click", () => options.onBeginMove(projection.gameplayEntity?.id ?? ""));
    remove.type = "button";
    remove.textContent = "Remove Entity";
    remove.className = "debug-button--danger";
    remove.addEventListener("click", () => options.onRemoveEntity(projection.gameplayEntity?.id ?? ""));
    actions.append(move, remove);
    editor.append(createEntityForm(options.floorSet, projection.gameplayEntity, options.onUpdateEntity), actions);
  } else {
    const kind = createSelect(
      [
        { label: "Enemy", value: "enemy" },
        { label: "Key", value: "key" },
        { label: "Door", value: "door" },
        { label: "Stair", value: "stair" },
        { label: "Breakable Wall", value: "breakableWall" },
        { label: "Hot Spring", value: "hotSpring" },
      ] as const,
      "enemy",
    );
    const add = document.createElement("button");
    const actions = document.createElement("div");
    add.type = "button";
    add.textContent = "Add Gameplay Entity";
    add.addEventListener("click", () => options.onAddEntity(kind.value as GameplayEntitySource["kind"]));
    actions.className = "debug-button-row";
    actions.append(add);
    editor.append(createEditorField("New entity kind", kind), actions);
  }

  const environmentHeading = document.createElement("h4");
  environmentHeading.textContent = "Environment Features (Read-only)";
  editor.append(environmentHeading);

  if (projection.environmentFeatures.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No environment features anchor to this cell.";
    editor.append(empty);
  } else {
    const features = document.createElement("ul");

    for (const feature of projection.environmentFeatures) {
      const item = document.createElement("li");
      item.textContent = `${feature.id} — ${describeEnvironmentFeature(feature)}`;
      features.append(item);
    }

    editor.append(features);
  }

  return editor;
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
  const groups = document.createElement("div");
  const legendGroups = [
    {
      title: "Terrain",
      entries: [
        { symbol: "▦", label: "Stone wall" },
        { symbol: "▤", label: "Old-brick wall" },
        { symbol: "╫", label: "Iron-bar wall" },
        { symbol: "·", label: "Passable floor" },
      ],
    },
    {
      title: "Gameplay",
      entries: [
        { symbol: "☠", label: "Enemy" },
        { symbol: "⚿", label: "Red key", tone: "red" },
        { symbol: "⚿", label: "Blue key", tone: "blue" },
        { symbol: "⚿", label: "Yellow key", tone: "yellow" },
        { symbol: "▣", label: "Door" },
        { symbol: "⇩", label: "Stair" },
        { symbol: "◫", label: "Breakable wall" },
        { symbol: "≈", label: "Hot spring" },
      ],
    },
    {
      title: "Environment",
      entries: [
        { symbol: "✦", label: "Tile decoration" },
        { symbol: "↟", label: "Wall-face decoration" },
        { symbol: "☼", label: "Ambient light" },
        { symbol: "≈", label: "Effect emitter" },
      ],
    },
    {
      title: "Overlays",
      entries: [
        { symbol: "▤", label: "Gold outline: structural solution", tone: "solution" },
        { symbol: "▤", label: "White outline: selected cell", tone: "selected" },
        { symbol: "↑", label: "Authored hint or wall anchor face" },
      ],
    },
  ];
  section.className = "debug-map-legend";
  groups.className = "debug-map-legend__groups";
  heading.textContent = "Map Legend";

  for (const group of legendGroups) {
    const groupSection = document.createElement("section");
    const groupHeading = document.createElement("h4");
    const entries = document.createElement("ul");
    groupSection.className = "debug-map-legend__group";
    groupHeading.textContent = group.title;
    entries.className = "debug-map-legend__entries";

    for (const entry of group.entries) {
      const item = document.createElement("li");
      const symbol = document.createElement("span");
      const label = document.createElement("span");
      symbol.className = `debug-map-legend__symbol${entry.tone ? ` debug-map-legend__symbol--${entry.tone}` : ""}`;
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = entry.symbol;
      label.textContent = entry.label;
      item.append(symbol, label);
      entries.append(item);
    }

    groupSection.append(groupHeading, entries);
    groups.append(groupSection);
  }

  section.append(heading, groups);
  return section;
}
