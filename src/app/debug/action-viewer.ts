import { createDebugPage, createDebugPanel, createDebugScroller } from "@/app/debug/debug-shell";
import { createActionScenario, type ActionScenario } from "@/harness/action-scenario";
import { createFloorScenario } from "@/harness/floor-scenario";
import type { Cell, Facing } from "@/core/grid";
import type { CommandResult, GameCommand, RunSnapshot, RunWorld, SemanticEvent } from "@/core/run-state";

const FACING_SYMBOLS: Readonly<Record<Facing, string>> = {
  north: "↑",
  east: "→",
  south: "↓",
  west: "←",
};

const KEY_COMMANDS: Readonly<Partial<Record<string, GameCommand>>> = {
  KeyW: "forward",
  KeyA: "turnLeft",
  KeyD: "turnRight",
  KeyE: "interact",
  KeyS: "backward",
};

type MapCellPresentation = Readonly<{
  symbol: string;
  label: string;
  background: string;
  color: string;
}>;

const activeKeyboardHandlers = new WeakMap<HTMLElement, (event: KeyboardEvent) => void>();

const COMMANDS: readonly Readonly<{ command: GameCommand; label: string }>[] = [
  { command: "forward", label: "Forward (W)" },
  { command: "turnLeft", label: "Turn Left (A)" },
  { command: "turnRight", label: "Turn Right (D)" },
  { command: "interact", label: "Interact (E)" },
  { command: "backward", label: "Backward (S)" },
];

const SCENARIOS = {
  compact: {
    label: "Compact mechanics scenario",
    create: createActionScenario,
    description: "A small scenario for focused command and interaction checks.",
  },
  provisionalFloors: {
    label: "Provisional five-floor set",
    create: createFloorScenario,
    description: "The authored offline floor data assembled through the production catalog path.",
  },
} as const;

type ScenarioId = keyof typeof SCENARIOS;

function areSameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function eventLabel(event: SemanticEvent): string {
  return JSON.stringify(event);
}

function renderSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

function isEntityActive(snapshot: RunSnapshot, entityId: string): boolean {
  return snapshot.entities.find((entity) => entity.id === entityId)?.active === true;
}

function mapCellPresentation(world: RunWorld, snapshot: RunSnapshot, cell: Cell): MapCellPresentation {
  const player = snapshot.player;

  if (areSameCell(player.cell, cell)) {
    return {
      symbol: FACING_SYMBOLS[player.facing],
      label: `Player facing ${player.facing}`,
      background: "#f5c451",
      color: "#201600",
    };
  }

  if (world.floors.find((floor) => floor.id === player.floorId)?.solidCells.some((solid) => areSameCell(solid, cell))) {
    return { symbol: "▦", label: "Solid wall", background: "#34313f", color: "#d7d2e5" };
  }

  const entities = world.entities.filter(
    (entity) =>
      entity.floorId === player.floorId && areSameCell(entity.cell, cell) && isEntityActive(snapshot, entity.id),
  );
  const enemy = entities.find((entity) => entity.kind === "enemy");

  if (enemy) {
    const health = snapshot.entities.find((entity) => entity.id === enemy.id)?.health;
    return {
      symbol: "☠",
      label: `${enemy.appearanceId ?? "Enemy"}, ${health ?? "unknown"} health`,
      background: "#6d1f2e",
      color: "#fff0f2",
    };
  }

  const wall = entities.find((entity) => entity.kind === "breakableWall");

  if (wall) {
    const health = snapshot.entities.find((entity) => entity.id === wall.id)?.health;
    return {
      symbol: "◫",
      label: `Breakable wall, ${health ?? "unknown"} health`,
      background: "#6b4d32",
      color: "#fff3dc",
    };
  }

  const door = entities.find((entity) => entity.kind === "door");

  if (door) {
    const color = door.interaction?.requirements?.find((requirement) => requirement.type === "key")?.color;
    return {
      symbol: "▣",
      label: `Closed ${color ?? "unknown"} door`,
      background: color === "red" ? "#8b2836" : color === "blue" ? "#285f9b" : "#92752c",
      color: "#ffffff",
    };
  }

  const key = entities.find((entity) => entity.kind === "key");

  if (key) {
    const color = key.pickup?.effects.find((effect) => effect.type === "grantKey")?.color;
    return {
      symbol: "◆",
      label: `${color ?? "unknown"} key`,
      background: "#22202a",
      color: color === "red" ? "#ff6678" : color === "blue" ? "#69adff" : "#f5d761",
    };
  }

  if (entities.some((entity) => entity.kind === "stair")) {
    return { symbol: "⇩", label: "Stair", background: "#315a4b", color: "#e8fff6" };
  }

  if (entities.some((entity) => entity.kind === "hotSpring")) {
    return { symbol: "≈", label: "Hot spring", background: "#8f4e2d", color: "#fff2df" };
  }

  return { symbol: "", label: "Open floor", background: "#211e2a", color: "#8e879f" };
}

function renderMap(map: HTMLElement, world: RunWorld, snapshot: RunSnapshot): void {
  const floor = world.floors.find((candidate) => candidate.id === snapshot.player.floorId);

  if (!floor) {
    throw new Error(`unknown scenario floor: ${snapshot.player.floorId}`);
  }

  map.replaceChildren();
  map.setAttribute("aria-label", `Scenario map for ${floor.id}`);
  map.style.gridTemplateColumns = `repeat(${floor.width}, 2.75rem)`;

  for (let y = 0; y < floor.height; y += 1) {
    const row = document.createElement("span");
    row.setAttribute("role", "row");
    row.className = "debug-action-map__row";

    for (let x = 0; x < floor.width; x += 1) {
      const cell = document.createElement("span");
      const presentation = mapCellPresentation(world, snapshot, { x, y });
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${presentation.label} at ${x}, ${y}`);
      cell.className = "debug-action-map__cell";
      cell.title = presentation.label;
      cell.textContent = presentation.symbol;
      cell.style.background = presentation.background;
      cell.style.color = presentation.color;
      row.append(cell);
    }

    map.append(row);
  }
}

/** Renders the development-only command and snapshot inspection surface. */
export function renderActionViewer(mount: HTMLElement): void {
  let scenarioId: ScenarioId = "compact";
  let scenario: ActionScenario = SCENARIOS[scenarioId].create();
  let beforeSnapshot = scenario.session.getSnapshot();
  let result: CommandResult | undefined;

  const { page, content } = createDebugPage({
    title: "Action Viewer",
    description:
      "Step the real deterministic command boundary and inspect the active map, semantic events, and exact snapshots.",
    width: "wide",
  });
  const controlsPanel = createDebugPanel(
    "Scenario Commands",
    "Run a real scenario through the canonical command boundary and inspect every resulting state change.",
  );
  const scenarioDescription = document.createElement("p");
  const keyboardHelp = document.createElement("p");
  const scenarioLabel = document.createElement("label");
  const scenarioSelect = document.createElement("select");
  const controls = document.createElement("div");
  const mapPanel = createDebugPanel("Current Scenario Map");
  const playerSummary = document.createElement("p");
  const map = document.createElement("div");
  const legend = document.createElement("p");
  const resultPanel = createDebugPanel("Last Command Result");
  const status = document.createElement("p");
  const events = document.createElement("ol");
  const tracePanel = createDebugPanel("Snapshot Trace");
  const beforeDetails = document.createElement("details");
  const beforeHeading = document.createElement("summary");
  const before = document.createElement("pre");
  const afterDetails = document.createElement("details");
  const afterHeading = document.createElement("summary");
  const after = document.createElement("pre");

  keyboardHelp.textContent = "Use W/A/S/D/E on the keyboard or the buttons below. Press R to reset the scenario.";
  keyboardHelp.className = "debug-muted";
  scenarioLabel.textContent = "Scenario";
  scenarioLabel.className = "debug-field";
  scenarioLabel.htmlFor = "action-viewer-scenario";
  scenarioSelect.id = "action-viewer-scenario";
  legend.textContent =
    "Legend: arrows Player · ☠ Enemy · ▦ Wall · ◫ Breakable wall · ▣ Door · ◆ Key · ⇩ Stair · ≈ Hot spring.";
  beforeHeading.textContent = "Before Snapshot";
  afterHeading.textContent = "After Snapshot";
  controls.className = "debug-button-row";
  map.className = "debug-action-map";
  map.setAttribute("role", "grid");
  playerSummary.className = "debug-muted";
  status.setAttribute("role", "status");
  beforeDetails.append(beforeHeading, before);
  afterDetails.append(afterHeading, after);

  for (const [id, definition] of Object.entries(SCENARIOS) as readonly [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = definition.label;
    scenarioSelect.append(option);
  }

  scenarioLabel.append(scenarioSelect);

  const resetScenario = (): void => {
    scenario = SCENARIOS[scenarioId].create();
    beforeSnapshot = scenario.session.getSnapshot();
    result = undefined;
    render();
  };

  scenarioSelect.addEventListener("change", () => {
    scenarioId = scenarioSelect.value as ScenarioId;
    resetScenario();
  });

  const sendCommand = (command: GameCommand): void => {
    beforeSnapshot = scenario.session.getSnapshot();
    result = scenario.session.dispatch(command);
    render();
  };

  const render = (): void => {
    const afterSnapshot = scenario.session.getSnapshot();
    const player = afterSnapshot.player;
    scenarioDescription.textContent = SCENARIOS[scenarioId].description;
    playerSummary.textContent = `${player.floorId} · (${player.cell.x}, ${player.cell.y}) · facing ${player.facing} · HP ${player.health}/${player.maxHealth} · ATK ${player.attack} · DEF ${player.defense} · keys R${player.keys.red} B${player.keys.blue} Y${player.keys.yellow} · ${afterSnapshot.outcome}`;
    renderMap(map, scenario.world, afterSnapshot);
    before.textContent = renderSnapshot(beforeSnapshot);
    after.textContent = renderSnapshot(afterSnapshot);
    events.replaceChildren();

    if (!result) {
      status.textContent = "No command has been sent yet.";
      status.dataset.tone = "info";
      return;
    }

    status.textContent = result.accepted ? "Accepted player tick." : `Cancelled input: ${result.reason}.`;
    status.dataset.tone = result.accepted ? "success" : "warning";

    for (const event of result.events) {
      const item = document.createElement("li");
      item.textContent = eventLabel(event);
      events.append(item);
    }
  };

  for (const entry of COMMANDS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.label;
    button.addEventListener("click", () => sendCommand(entry.command));
    controls.append(button);
  }

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset Scenario";
  reset.addEventListener("click", resetScenario);
  controls.append(reset);

  const previousKeyboardHandler = activeKeyboardHandlers.get(mount);

  if (previousKeyboardHandler) {
    window.removeEventListener("keydown", previousKeyboardHandler);
  }

  const handleKeyboard = (event: KeyboardEvent): void => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      resetScenario();
      return;
    }

    const command = KEY_COMMANDS[event.code];

    if (!command) {
      return;
    }

    event.preventDefault();
    sendCommand(command);
  };

  activeKeyboardHandlers.set(mount, handleKeyboard);
  window.addEventListener("keydown", handleKeyboard);

  controlsPanel.body.append(scenarioDescription, scenarioLabel, keyboardHelp, controls);
  mapPanel.body.append(playerSummary, createDebugScroller(map, "Current scenario map"), legend);
  resultPanel.body.append(status, events);
  tracePanel.body.append(beforeDetails, afterDetails);
  content.append(controlsPanel.panel, mapPanel.panel, resultPanel.panel, tracePanel.panel);
  mount.replaceChildren(page);
  render();
}
