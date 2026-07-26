import { createDebugPage, createDebugPanel, createDebugScroller } from "@/app/debug/debug-shell";
import { ENEMY_ARCHETYPES, getEnemyArchetype, type EnemyArchetype, type EnemyId } from "@/content/combat/enemies";
import { getPlayerStage, PLAYER_STAGES, type PlayerStage } from "@/content/combat/player-stages";
import { calculateCombatProjection, type CombatProjection } from "@/core/combat";

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function formatStage(stage: PlayerStage): string {
  return `${stage.label} (ATK ${stage.stats.attack} / DEF ${stage.stats.defense})`;
}

function formatCost(projection: CombatProjection): string {
  return projection.canDefeat ? String(projection.totalCost) : "Impassable";
}

function appendDetail(detail: HTMLDListElement, term: string, description: string): void {
  const group = document.createElement("div");
  const detailTerm = document.createElement("dt");
  const detailDescription = document.createElement("dd");
  detailTerm.textContent = term;
  detailDescription.textContent = description;
  group.append(detailTerm, detailDescription);
  detail.append(group);
}

function renderProjectionDetail(detail: HTMLDListElement, stage: PlayerStage, enemy: EnemyArchetype): void {
  const projection = calculateCombatProjection(stage.stats, enemy);

  detail.replaceChildren();
  appendDetail(detail, "Player Damage", String(projection.playerDamage));
  appendDetail(detail, "Can Defeat", projection.canDefeat ? "Yes" : "No");
  appendDetail(detail, "Hits to Kill", projection.hitsToKill === null ? "—" : String(projection.hitsToKill));
  appendDetail(detail, "Retaliation Damage", String(projection.retaliationDamage));
  appendDetail(detail, "Total Cost", formatCost(projection));
}

function createMatrix(): HTMLTableElement {
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  const header = document.createElement("tr");
  const enemyHeader = document.createElement("th");

  caption.textContent = "Total health cost to defeat each enemy";
  enemyHeader.scope = "col";
  enemyHeader.textContent = "Enemy";
  header.append(enemyHeader);

  for (const stage of PLAYER_STAGES) {
    const stageHeader = document.createElement("th");
    stageHeader.scope = "col";
    stageHeader.textContent = stage.label;
    header.append(stageHeader);
  }

  const tableHead = document.createElement("thead");
  tableHead.append(header);
  table.append(caption, tableHead);

  const tableBody = document.createElement("tbody");

  for (const enemy of ENEMY_ARCHETYPES) {
    const row = document.createElement("tr");
    const enemyName = document.createElement("th");
    enemyName.scope = "row";
    enemyName.textContent = enemy.name;
    row.append(enemyName);

    for (const stage of PLAYER_STAGES) {
      const cost = document.createElement("td");
      cost.textContent = formatCost(calculateCombatProjection(stage.stats, enemy));
      row.append(cost);
    }

    tableBody.append(row);
  }

  table.append(tableBody);
  return table;
}

/** Renders the development-only inspection surface for the combat content and model. */
export function renderCombatExplorer(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Combat Explorer",
    description: "Inspect the deterministic combat projection for every authored stage and enemy.",
  });
  const controls = createDebugPanel(
    "Selected Projection",
    "Choose one authored player stage and enemy to inspect the exact deterministic exchange.",
  );
  const stageLabel = document.createElement("label");
  const stageSelect = document.createElement("select");
  const enemyLabel = document.createElement("label");
  const enemySelect = document.createElement("select");
  const form = document.createElement("div");
  const detailHeading = document.createElement("h3");
  const detail = document.createElement("dl");
  const matrix = createDebugPanel(
    "Combat Cost Matrix",
    "Total health cost for every current player stage and authored enemy pairing.",
  );

  stageLabel.htmlFor = "combat-stage";
  stageLabel.textContent = "Player Stage";
  stageLabel.className = "debug-field";
  stageSelect.id = stageLabel.htmlFor;
  enemyLabel.htmlFor = "combat-enemy";
  enemyLabel.textContent = "Enemy";
  enemyLabel.className = "debug-field";
  enemySelect.id = enemyLabel.htmlFor;
  detailHeading.textContent = "Projection Details";
  form.className = "debug-form-grid";
  detail.className = "debug-detail-grid";

  for (const stage of PLAYER_STAGES) {
    stageSelect.append(createOption(String(stage.id), formatStage(stage)));
  }

  for (const enemy of ENEMY_ARCHETYPES) {
    enemySelect.append(createOption(enemy.id, enemy.name));
  }

  const updateDetail = (): void => {
    const stage = getPlayerStage(Number(stageSelect.value));
    const enemy = getEnemyArchetype(enemySelect.value as EnemyId);

    renderProjectionDetail(detail, stage, enemy);
  };

  stageSelect.addEventListener("change", updateDetail);
  enemySelect.addEventListener("change", updateDetail);
  updateDetail();

  stageLabel.append(stageSelect);
  enemyLabel.append(enemySelect);
  form.append(stageLabel, enemyLabel);
  controls.body.append(form, detailHeading, detail);
  matrix.body.append(createDebugScroller(createMatrix(), "Combat cost matrix"));
  content.append(controls.panel, matrix.panel);
  mount.replaceChildren(page);
}
