import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ENEMY_ARCHETYPES } from "../../src/content/combat/enemies";
import { PLAYER_STAGES } from "../../src/content/combat/player-stages";
import { PROVISIONAL_FLOOR_SET, PROVISIONAL_FLOOR_VALIDATION } from "../../src/content/floor/floor-catalog";
import { calculateCombatProjection } from "../../src/core/combat";
import type { RunSnapshot } from "../../src/core/run-state";
import { PROVISIONAL_ROUTE, replayProvisionalRoute } from "../../src/harness/provisional-route";
import { getRouteCheckpoint, routeCompleted } from "../../src/harness/route-replay";

const DEFAULT_OUTPUT = "dev/docs/reports/pantry_depths_balance.html";

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n");
  return `<div class="overflow"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function stageLabel(snapshot: RunSnapshot): string {
  const stage = PLAYER_STAGES.find(
    (candidate) =>
      candidate.stats.attack === snapshot.player.attack &&
      candidate.stats.defense === snapshot.player.defense &&
      candidate.stats.maxHealth === snapshot.player.maxHealth,
  );

  return stage ? stage.label : `Unmatched ATK ${snapshot.player.attack} DEF ${snapshot.player.defense}`;
}

function checkpointEventSummary(events: readonly Readonly<{ type: string }>[]): string {
  return events.length === 0 ? "—" : events.map((event) => escapeHtml(event.type)).join(", ");
}

/** Renders the canonical current-content balance evidence without writing it. */
export function renderBalanceReport(): string {
  const replay = replayProvisionalRoute();
  const finalSnapshot = replay.steps.at(-1)?.after ?? replay.initialSnapshot;
  const routeSucceeded = routeCompleted(replay) && finalSnapshot.outcome === "victory";
  const routeEntityIds = new Set(PROVISIONAL_ROUTE.checkpoints.flatMap((checkpoint) => checkpoint.entityId ?? []));
  const entities = PROVISIONAL_FLOOR_SET.floors.flatMap((floor) =>
    floor.entities.map((entity) => ({ floorId: floor.id, entity })),
  );

  const enemyRows = ENEMY_ARCHETYPES.map((enemy) => {
    const floors = entities
      .filter((entry) => entry.entity.kind === "enemy" && entry.entity.archetypeId === enemy.id)
      .map((entry) => entry.floorId)
      .join(", ");
    return [
      escapeHtml(enemy.name),
      `<span class="num">${enemy.health}</span>`,
      `<span class="num">${enemy.attack}</span>`,
      `<span class="num">${enemy.defense}</span>`,
      escapeHtml(floors || "—"),
    ];
  });

  const matrixRows = ENEMY_ARCHETYPES.map((enemy) => {
    const row = [escapeHtml(enemy.name)];

    for (const stage of PLAYER_STAGES) {
      const projection = calculateCombatProjection(stage.stats, enemy);
      row.push(projection.canDefeat ? `<span class="num">${projection.totalCost}</span>` : "<span>—</span>");
    }

    return row;
  });

  const allEntities = PROVISIONAL_FLOOR_SET.floors.flatMap((floor) => floor.entities);
  const routeCheckpointRows = PROVISIONAL_ROUTE.checkpoints.map((checkpoint) => {
    const observed = getRouteCheckpoint(replay, checkpoint);
    const snapshot = observed.snapshot;
    const cost = replay.initialSnapshot.player.health - snapshot.player.health;
    const opened = allEntities
      .filter((entity) => entity.kind === "door")
      .filter((door) => !snapshot.entities.find((state) => state.id === door.id)?.active)
      .map((door) => door.id);
    const status = observed.reached ? "PASS" : "NOT REACHED";
    return [
      `<span class="${observed.reached ? "pass" : "fail"}">${status}</span>`,
      escapeHtml(checkpoint.label),
      escapeHtml(stageLabel(snapshot)),
      `<span class="num">${snapshot.player.health}/${snapshot.player.maxHealth}</span>`,
      `<span class="num">${snapshot.player.attack}/${snapshot.player.defense}</span>`,
      `<span class="num">R${snapshot.player.keys.red} B${snapshot.player.keys.blue} Y${snapshot.player.keys.yellow}</span>`,
      `<span class="num">${cost}</span>`,
      escapeHtml(opened.join(", ") || "—"),
      checkpointEventSummary(observed.events),
    ];
  });

  const findingRows = PROVISIONAL_FLOOR_VALIDATION.findings.length
    ? PROVISIONAL_FLOOR_VALIDATION.findings.map((finding) => [
        `<span class="${finding.severity === "error" ? "fail" : "pass"}">${escapeHtml(finding.severity.toUpperCase())}</span>`,
        escapeHtml(finding.code),
        escapeHtml(finding.message),
      ])
    : [['<span class="pass">PASS</span>', "No findings", "Structural validator returned no findings."]];

  const placementRows = entities.map(({ floorId, entity }) => [
    escapeHtml(floorId),
    escapeHtml(entity.kind),
    escapeHtml(entity.id),
    `<span class="num">${entity.cell.x}, ${entity.cell.y}</span>`,
    routeEntityIds.has(entity.id)
      ? '<span class="pass">Forced route</span>'
      : "<span>Bypassable / not route-marked</span>",
  ]);

  const optionalEnemies = entities.filter(
    (entry) => entry.entity.kind === "enemy" && !routeEntityIds.has(entry.entity.id),
  );
  const optionalRows = optionalEnemies.length
    ? optionalEnemies.map(({ floorId, entity }) => [
        escapeHtml(floorId),
        escapeHtml(entity.id),
        escapeHtml(entity.kind === "enemy" ? entity.archetypeId : ""),
      ])
    : [["—", "No bypassable enemies in provisional content", "—"]];

  const routeStatus = routeSucceeded ? "PASS" : "FAIL";
  const topologyStatus =
    PROVISIONAL_FLOOR_VALIDATION.findings.some((finding) => finding.severity === "error") ||
    !PROVISIONAL_FLOOR_VALIDATION.solution
      ? "FAIL"
      : "PASS";

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pantry Depths — Balance Report</title>
    <style>
      :root { color-scheme: light dark; --bg: #f6f4f8; --panel: #ffffff; --ink: #1d1a24; --muted: #5f5a6b; --line: #e0dce6; --accent: #6b3fa0; --ok: #2f7d54; --warn: #a4402f; }
      @media (prefers-color-scheme: dark) { :root { --bg: #17151c; --panel: #201d27; --ink: #e8e5ee; --muted: #9c96a8; --line: #302c3a; --accent: #b28ce0; --ok: #6cd39a; --warn: #e08b7a; } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.65 -apple-system, "Segoe UI", system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 40px 20px 96px; }
      h1 { font-size: 26px; margin: 0 0 6px; } h2 { font-size: 19px; margin: 40px 0 12px; padding-top: 20px; border-top: 1px solid var(--line); }
      .sub { color: var(--muted); margin: 0 0 28px; } .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin: 16px 0; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; } th, td { border-bottom: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; } th { color: var(--muted); font-size: 13px; } .num { font-variant-numeric: tabular-nums; } .pass { color: var(--ok); font-weight: 700; } .fail { color: var(--warn); font-weight: 700; } .overflow { overflow-x: auto; } code { font-size: 13px; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Pantry Depths — Balance Report</h1>
      <p class="sub">由 <code>src/content/</code>、<code>src/core/</code>、拓撲驗證與 canonical route replay 重新產生。請以此頁檢閱目前 provisional content，不是 A06 的最終平衡承諾。</p>

      <section class="card" aria-labelledby="summary-heading">
        <h2 id="summary-heading">摘要</h2>
        <p>強制路線：<span class="${routeSucceeded ? "pass" : "fail"}">${routeStatus}</span>；結局：${escapeHtml(finalSnapshot.outcome)}；路線成本：${replay.initialSnapshot.player.health - finalSnapshot.player.health} / ${replay.initialSnapshot.player.maxHealth} HP；剩餘：${finalSnapshot.player.health} HP。</p>
        <p>結構拓撲：<span class="${topologyStatus === "PASS" ? "pass" : "fail"}">${topologyStatus}</span>；structural solution steps：${PROVISIONAL_FLOOR_VALIDATION.solution?.length ?? 0}。拓撲通過只證明可達，並不取代下方的 command、戰鬥與 HP evidence。</p>
      </section>

      <h2 id="enemies">① 敵人表</h2>
      ${table(["敵人", "HP", "攻擊", "防禦", "目前出現樓層"], enemyRows)}

      <h2 id="matrix">② 成本矩陣</h2>
      <p>每格由 shared <code>calculateCombatProjection</code> 計算；<code>—</code> 表示當前攻擊無法穿透。</p>
      ${table(["敵人", ...PLAYER_STAGES.map((stage) => stage.label)], matrixRows)}

      <h2 id="route">③ Provisional 強制路線 HP 預算</h2>
      <p>每個 checkpoint 都來自同一個 command trace。開啟門欄位依 snapshot 的 entity activity 導出，沒有手動維護的成本或 door list。</p>
      ${table(["狀態", "Checkpoint", "Stage", "HP", "ATK/DEF", "鑰匙", "累積成本", "已開啟門", "本步事件"], routeCheckpointRows)}

      <h2 id="floors">④ 樓層連通性驗證</h2>
      ${table(["結果", "檢查", "說明"], findingRows)}

      <h2 id="placements">⑤ 樓層實體與路線歸屬</h2>
      <p>Forced route 表示該實體由 provisional fixture 的 checkpoint 標記；其餘內容不是目前強制路線的一部分。</p>
      ${table(["樓層", "種類", "實體", "座標", "路線歸屬"], placementRows)}

      <h2 id="optional">⑥ 可繞過敵人</h2>
      ${table(["樓層", "實體", "Archetype"], optionalRows)}
    </main>
  </body>
</html>
`;
}

async function main(): Promise<void> {
  const outputPath = resolve(DEFAULT_OUTPUT);
  await writeFile(outputPath, renderBalanceReport(), "utf8");
  process.stdout.write(`Generated balance report at ${outputPath}.\n`);
}

if (!process.env.VITEST) {
  void main().catch((caught: unknown) => {
    const message = caught instanceof Error ? caught.message : "Unable to generate the balance report.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
