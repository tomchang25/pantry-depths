import type { BalanceAnalysis, BalanceRouteCheckpoint } from "@/harness/balance-analysis";

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

function stageLabel(checkpoint: BalanceRouteCheckpoint): string {
  return checkpoint.stage ? checkpoint.stage.label : `Unmatched ATK ${checkpoint.attack} DEF ${checkpoint.defense}`;
}

function eventSummary(eventTypes: readonly string[]): string {
  return eventTypes.length === 0 ? "—" : eventTypes.map((type) => escapeHtml(type)).join(", ");
}

/**
 * Serializes the balance model to the committed report.
 *
 * Serialization only: every displayed value is read from the model, and no field is derived here.
 * The output must stay deterministic so regenerating an unchanged model produces an unchanged file.
 */
export function renderBalanceReportHtml(analysis: BalanceAnalysis): string {
  const { route, topology } = analysis;

  const enemyRows = analysis.enemies.map((row) => [
    escapeHtml(row.enemy.name),
    `<span class="num">${row.enemy.health}</span>`,
    `<span class="num">${row.enemy.attack}</span>`,
    `<span class="num">${row.enemy.defense}</span>`,
    escapeHtml(row.floorIds.join(", ") || "—"),
  ]);

  const matrixRows = analysis.enemies.map((row) => [
    escapeHtml(row.enemy.name),
    ...row.projections.map((projection) =>
      projection.canDefeat ? `<span class="num">${projection.totalCost}</span>` : "<span>—</span>",
    ),
  ]);

  const routeCheckpointRows = route.checkpoints.map((checkpoint) => [
    `<span class="${checkpoint.reached ? "pass" : "fail"}">${checkpoint.reached ? "PASS" : "NOT REACHED"}</span>`,
    escapeHtml(checkpoint.label),
    escapeHtml(stageLabel(checkpoint)),
    `<span class="num">${checkpoint.health}/${checkpoint.maxHealth}</span>`,
    `<span class="num">${checkpoint.attack}/${checkpoint.defense}</span>`,
    `<span class="num">R${checkpoint.keys.red} B${checkpoint.keys.blue} Y${checkpoint.keys.yellow}</span>`,
    `<span class="num">${checkpoint.accumulatedCost}</span>`,
    escapeHtml(checkpoint.openedDoorIds.join(", ") || "—"),
    eventSummary(checkpoint.eventTypes),
  ]);

  const findingRows = topology.findings.length
    ? topology.findings.map((finding) => [
        `<span class="${finding.severity === "error" ? "fail" : "pass"}">${escapeHtml(finding.severity.toUpperCase())}</span>`,
        escapeHtml(finding.code),
        escapeHtml(finding.message),
      ])
    : [['<span class="pass">PASS</span>', "No findings", "Structural validator returned no findings."]];

  const placementRows = analysis.placements.map((placement) => [
    escapeHtml(placement.floorId),
    escapeHtml(placement.kind),
    escapeHtml(placement.entityId),
    `<span class="num">${placement.cell.x}, ${placement.cell.y}</span>`,
    placement.onForcedRoute ? '<span class="pass">Forced route</span>' : "<span>Bypassable / not route-marked</span>",
  ]);

  const optionalRows = analysis.bypassableEnemies.length
    ? analysis.bypassableEnemies.map((placement) => [
        escapeHtml(placement.floorId),
        escapeHtml(placement.entityId),
        escapeHtml(placement.archetypeId ?? ""),
      ])
    : [["—", "No bypassable enemies in provisional content", "—"]];

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
      <p class="sub">由 <code>src/content/</code>、<code>src/core/</code>、拓撲驗證與 canonical route replay 重新產生。請以此頁檢閱目前 provisional content，不是最終樓層設計的平衡承諾。</p>

      <section class="card" aria-labelledby="summary-heading">
        <h2 id="summary-heading">摘要</h2>
        <p>強制路線：<span class="${route.succeeded ? "pass" : "fail"}">${route.succeeded ? "PASS" : "FAIL"}</span>；結局：${escapeHtml(route.outcome)}；路線成本：${route.totalCost} / ${route.maxHealth} HP；剩餘：${route.finalHealth} HP。</p>
        <p>結構拓撲：<span class="${topology.passed ? "pass" : "fail"}">${topology.passed ? "PASS" : "FAIL"}</span>；structural solution steps：${topology.solutionSteps}。拓撲通過只證明可達，並不取代下方的 command、戰鬥與 HP evidence。</p>
      </section>

      <h2 id="enemies">① 敵人表</h2>
      ${table(["敵人", "HP", "攻擊", "防禦", "目前出現樓層"], enemyRows)}

      <h2 id="matrix">② 成本矩陣</h2>
      <p>每格由 shared <code>calculateCombatProjection</code> 計算；<code>—</code> 表示當前攻擊無法穿透。</p>
      ${table(["敵人", ...analysis.stages.map((stage) => stage.label)], matrixRows)}

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
