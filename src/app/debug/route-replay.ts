import { createDebugPage, createDebugPanel, createDebugScroller } from "@/app/debug/debug-shell";
import { PLAYER_STAGES } from "@/content/combat/player-stages";
import { PROVISIONAL_RUN_WORLD } from "@/content/floor/floor-catalog";
import { PROVISIONAL_ROUTE, replayProvisionalRoute } from "@/harness/provisional-route";
import { getRouteCheckpoint, routeCompleted } from "@/harness/route-replay";
import type { RunSnapshot, SemanticEvent } from "@/core/run-state";

function stageLabel(snapshot: RunSnapshot): string {
  const stage = PLAYER_STAGES.find(
    (candidate) =>
      candidate.stats.attack === snapshot.player.attack &&
      candidate.stats.defense === snapshot.player.defense &&
      candidate.stats.maxHealth === snapshot.player.maxHealth,
  );

  return stage?.label ?? `Unmatched ATK ${snapshot.player.attack} DEF ${snapshot.player.defense}`;
}

function openedDoorIds(snapshot: RunSnapshot): string {
  const opened = PROVISIONAL_RUN_WORLD.entities
    .filter((entity) => entity.kind === "door")
    .filter((entity) => snapshot.entities.find((state) => state.id === entity.id)?.active === false)
    .map((entity) => entity.id);

  return opened.length === 0 ? "None" : opened.join(", ");
}

function eventSummary(events: readonly SemanticEvent[]): string {
  return events.length === 0 ? "None" : events.map((event) => event.type).join(", ");
}

function appendCell(parent: HTMLTableRowElement, text: string): void {
  const cell = document.createElement("td");
  cell.textContent = text;
  parent.append(cell);
}

function appendHeader(parent: HTMLTableRowElement, text: string): void {
  const header = document.createElement("th");
  header.scope = "col";
  header.textContent = text;
  parent.append(header);
}

function createTable(headers: readonly string[]): Readonly<{ table: HTMLTableElement; body: HTMLTableSectionElement }> {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  const body = document.createElement("tbody");

  for (const header of headers) {
    appendHeader(row, header);
  }

  head.append(row);
  table.append(head, body);
  return { table, body };
}

/** Renders the canonical provisional command trace and its named balance checkpoints. */
export function renderRouteReplay(mount: HTMLElement): void {
  const replay = replayProvisionalRoute();
  const finalSnapshot = replay.steps.at(-1)?.after ?? replay.initialSnapshot;
  const complete = routeCompleted(replay);
  const routeSucceeded = complete && finalSnapshot.outcome === "victory";
  const { page, content } = createDebugPage({
    title: "Route Replay",
    description:
      "Replay the provisional forced route through a fresh canonical session and inspect its progression evidence.",
    width: "wide",
  });
  const status = document.createElement("p");
  const checkpointPanel = createDebugPanel(
    "Progression Checkpoints",
    "Named balance checkpoints observed along the current canonical route.",
  );
  const checkpointTable = createTable([
    "Status",
    "Checkpoint",
    "Stage",
    "HP",
    "ATK / DEF",
    "Keys",
    "Cost",
    "Opened doors",
    "Events",
  ]);
  const tracePanel = createDebugPanel(
    "Canonical Command Trace",
    "Every command is shown with its acceptance state, before/after location, health, and semantic events.",
  );
  const traceTable = createTable(["#", "Command", "Status", "Before", "After", "Events"]);

  status.setAttribute("role", "status");
  status.dataset.tone = routeSucceeded ? "success" : "error";
  status.textContent = routeSucceeded
    ? `Route passed: ${replay.steps.length} canonical commands reached victory with ${finalSnapshot.player.health} HP.`
    : `Route evidence failed: ${replay.steps.length} of ${PROVISIONAL_ROUTE.commands.length} commands ran; outcome is ${finalSnapshot.outcome}.`;

  for (const checkpoint of PROVISIONAL_ROUTE.checkpoints) {
    const observed = getRouteCheckpoint(replay, checkpoint);
    const row = document.createElement("tr");
    const snapshot = observed.snapshot;
    const cost = replay.initialSnapshot.player.health - snapshot.player.health;

    appendCell(row, observed.reached ? "Reached" : "Not reached");
    appendCell(row, checkpoint.label);
    appendCell(row, stageLabel(snapshot));
    appendCell(row, `${snapshot.player.health}/${snapshot.player.maxHealth}`);
    appendCell(row, `${snapshot.player.attack}/${snapshot.player.defense}`);
    appendCell(row, `R${snapshot.player.keys.red} B${snapshot.player.keys.blue} Y${snapshot.player.keys.yellow}`);
    appendCell(row, String(cost));
    appendCell(row, openedDoorIds(snapshot));
    appendCell(row, eventSummary(observed.events));
    checkpointTable.body.append(row);
  }

  for (const [index, step] of replay.steps.entries()) {
    const row = document.createElement("tr");
    const before = step.before.player;
    const after = step.after.player;

    appendCell(row, String(index + 1));
    appendCell(row, step.command);
    appendCell(row, step.accepted ? "Accepted" : `Rejected: ${step.rejectionReason ?? "unknown"}`);
    appendCell(row, `${before.floorId} (${before.cell.x}, ${before.cell.y}) ${before.facing} HP ${before.health}`);
    appendCell(row, `${after.floorId} (${after.cell.x}, ${after.cell.y}) ${after.facing} HP ${after.health}`);
    appendCell(row, eventSummary(step.events));
    traceTable.body.append(row);
  }

  checkpointPanel.body.append(createDebugScroller(checkpointTable.table, "Progression checkpoints"));
  tracePanel.body.append(createDebugScroller(traceTable.table, "Canonical command trace"));
  content.append(status, checkpointPanel.panel, tracePanel.panel);
  mount.replaceChildren(page);
}
